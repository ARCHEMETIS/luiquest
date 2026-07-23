// Scheduled Function — pre-generate เควสรายวันตอนกลางคืน (cron ใน function config, ทุก 10 นาที 19-21 UTC = ตี 2-5 ไทย, #08)
// ไม่มีตาราง "job queue" จริงในสคีมา (ล็อกแล้วตาม supabase-schema.md) — คิวคำนวณสดจาก roadmaps/daily_quests/quest_completions ทุกรอบ
// BATCH_SIZE = 3: scheduled function timeout 30 วิ (สั้นกว่า function ปกติ 60 วิ) — 3 คิว Gemini sequential
// (สูงสุด ~2 model attempts × ~2 tries ต่อคิว + backoff retry RPM ~3 วิ ใน gemini.js tryChain) ประมาณการ worst-case ~15-20 วิ ยังเหลือ margin
// ผูกกับ deploy-plan.md sec.3: 18 รอบ/คืน × 3 = ~54 การ generate/คืน — ห้ามขยับ BATCH_SIZE โดยไม่คำนวณ timeout ใหม่
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { generateNextQuest } from './_shared/questGenerator.js';

const SCAN_LIMIT = 60; // หน้าต่างสแกน roadmap ต่อรอบ — คุมต้นทุน query ไม่ให้บวมตามจำนวนผู้ใช้
const BATCH_SIZE = 3; // คิวที่ประมวลผลจริงต่อรอบ (ดูเหตุผล timeout ด้านบน)

// schedule อยู่ใน config นี้ (แทน netlify.toml) ตามรูปแบบที่ Netlify แนะนำ
export const config = {
  schedule: '*/10 19-21 * * *',
};

// ── กันคนนอกยิงฟังก์ชันนี้เอง (ยืนยันจริง 23 ก.ค. 2026) ────────────────────────────────
// ย้าย schedule มาไว้ใน config แล้ว **endpoint ก็ยังเปิดสาธารณะอยู่**: POST จากเครื่องนอก
// ยังได้ 200 และประมวลผลจริง (ทดสอบแล้วเห็น processed:1) — เอกสารที่บอกว่า scheduled function
// ไม่มี public URL ใช้ไม่ได้กับ setup นี้ ฟังก์ชันนี้รันด้วย service role + ยิง Gemini ได้
//
// ด่านที่ใช้: อนุญาตให้ "ทำงานจริง" เฉพาะในหน้าต่าง cron เท่านั้น (19:00-21:59 UTC = ตี 2-5 ไทย)
// - cron ของจริงรันในหน้าต่างนี้อยู่แล้ว → ไม่มีทางทำ cron พัง ซึ่งสำคัญกว่าการกันคนนอกแบบเป๊ะ ๆ
// - นอกหน้าต่าง คนนอกยิงเท่าไหร่ก็ไม่เกิดงาน ไม่แตะ DB ไม่แตะ Gemini
// - ในหน้าต่าง ถึงยิงได้ก็ทำได้แค่งานที่ cron จะทำอยู่แล้ว (คิว eligibility คำนวณสด เควสที่สร้างแล้ว
//   ไม่ถูกสร้างซ้ำ) จึงไม่มีทางใช้ปั๊มโควตา Gemini ให้หมดวัน
// ตั้ง PREGEN_BYPASS_SECRET ใน Netlify env แล้วส่ง header x-pregen-secret มาให้ตรง เพื่อสั่งรันเองนอกเวลา
const CRON_WINDOW_UTC_HOURS = [19, 20, 21];

function isInsideCronWindow(now = new Date()) {
  return CRON_WINDOW_UTC_HOURS.includes(now.getUTCHours());
}

function hasBypassSecret(req) {
  const expected = typeof Netlify !== 'undefined' ? Netlify.env.get('PREGEN_BYPASS_SECRET') : process.env.PREGEN_BYPASS_SECRET;
  return Boolean(expected) && req.headers.get('x-pregen-secret') === expected;
}

export default async (req) => {
  // นอกหน้าต่าง cron = ไม่ทำอะไรเลย (ดูเหตุผลด้านบน) — ตอบสั้น ๆ ไม่บอกสถานะภายในของระบบ
  if (!isInsideCronWindow() && !hasBypassSecret(req)) {
    console.warn('[pre-generate-quests] ถูกเรียกนอกหน้าต่าง cron — ไม่ทำงาน');
    return new Response(JSON.stringify({ ok: true, skipped: 'outside-window' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let nextRun = null;
  try {
    const body = await req.json();
    nextRun = body?.next_run ?? null;
  } catch {
    // scheduled invoke บางครั้งไม่มี body ที่ parse ได้ (เช่น ทดสอบด้วย functions:invoke) — ไม่ใช่ error จริง
  }
  if (nextRun) console.log(`[pre-generate-quests] next_run: ${nextRun}`);

  const admin = getAdminClient();

  // 1) หยิบ roadmap ที่ active + พร้อมใช้งาน มาเป็น scan window (เก่าสุดก่อน เพื่อ fairness ข้ามรอบ)
  const { data: candidates, error: candidatesErr } = await admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, content, created_at')
    .eq('is_active', true)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .limit(SCAN_LIMIT);

  if (candidatesErr) {
    console.error('[pre-generate-quests] ดึง candidate roadmaps ไม่สำเร็จ', candidatesErr);
    return new Response(JSON.stringify({ ok: false, error: candidatesErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scanned = candidates?.length ?? 0;
  const eligible = [];
  let skippedNoQuests = 0;

  // 2-4) ต่อ roadmap: หา day ปัจจุบัน (max day_number) → ต้องทำเควสนั้นจบแล้ว (มีแถวใน quest_completions) → ยังไม่มีเควสของวันถัดไป
  for (const roadmap of candidates ?? []) {
    const { data: latestQuests, error: latestErr } = await admin
      .from('daily_quests')
      .select('id, day_number')
      .eq('roadmap_id', roadmap.id)
      .order('day_number', { ascending: false })
      .limit(1);

    if (latestErr) {
      console.error(`[pre-generate-quests] ดึง daily_quests ล่าสุดของ roadmap ${roadmap.id} ไม่สำเร็จ`, latestErr);
      continue; // ไม่ crash ทั้ง batch เพราะ roadmap เดียว
    }

    const latestQuest = latestQuests?.[0];
    if (!latestQuest) {
      // ไม่ควรเกิดจริง (onboarding สร้าง day 1 เสมอ) แต่กันไว้ไม่ให้ crash
      skippedNoQuests += 1;
      continue;
    }

    const maxDay = latestQuest.day_number;

    // เควสปัจจุบันเสร็จหรือยัง — เช็คแค่ว่ามีแถว quest_completions ของ quest_id นี้อยู่ไหม (unique(user_id, quest_id) + roadmap เป็นของ user เดียว)
    const { data: completionRows, error: completionErr } = await admin
      .from('quest_completions')
      .select('quest_id')
      .eq('quest_id', latestQuest.id)
      .limit(1);

    if (completionErr) {
      console.error(`[pre-generate-quests] เช็ค quest_completions ของ quest ${latestQuest.id} ไม่สำเร็จ`, completionErr);
      continue;
    }
    if (!completionRows || completionRows.length === 0) {
      continue; // ยังไม่ทำเควสปัจจุบันจบ — ยังไม่ต้อง generate ล่วงหน้า
    }

    // กันซ้ำ: วันถัดไปถูก pre-generate ไปแล้วในรอบก่อนหน้าของคืนนี้หรือยัง
    const { data: nextDayQuests, error: nextDayErr } = await admin
      .from('daily_quests')
      .select('id')
      .eq('roadmap_id', roadmap.id)
      .eq('day_number', maxDay + 1)
      .limit(1);

    if (nextDayErr) {
      console.error(`[pre-generate-quests] เช็ค day_number ถัดไปของ roadmap ${roadmap.id} ไม่สำเร็จ`, nextDayErr);
      continue;
    }
    if (nextDayQuests && nextDayQuests.length > 0) {
      continue; // มีอยู่แล้ว — ไม่ต้องทำซ้ำ
    }

    eligible.push({ roadmap, dayNumber: maxDay + 1 });
  }

  // 5) เอา batch แรก (เรียงตาม created_at เดิม เก่าสุดก่อน)
  const batch = eligible.slice(0, BATCH_SIZE);

  // 6-7) ยิง generateNextQuest ทีละตัว sequential (แชร์ Gemini RPM budget เดียวกัน)
  let succeeded = 0;
  let failed = 0;
  const roadmapIdsProcessed = [];

  for (const item of batch) {
    roadmapIdsProcessed.push(item.roadmap.id);
    try {
      const result = await generateNextQuest(admin, { roadmap: item.roadmap, dayNumber: item.dayNumber });
      if (result?.failed) {
        failed += 1;
        console.warn(
          `[pre-generate-quests] roadmap ${item.roadmap.id} day ${item.dayNumber}: generateNextQuest คืน failed (Gemini หมด chain / ไม่มี fallback)`
        );
      } else {
        succeeded += 1;
      }
    } catch (err) {
      // error จริง (bug/env เช่น env var หาย) — ล็อกแล้วไปต่อ roadmap ถัดไป ไม่ให้ล้มทั้ง batch
      failed += 1;
      console.error(`[pre-generate-quests] roadmap ${item.roadmap.id} day ${item.dayNumber} error จริง`, err);
    }
  }

  const summary = {
    ok: true,
    scanned,
    eligible: eligible.length,
    processed: batch.length,
    succeeded,
    failed,
    skipped_no_quests: skippedNoQuests,
    roadmap_ids_processed: roadmapIdsProcessed,
  };

  console.log('[pre-generate-quests]', JSON.stringify(summary));

  // ตอบกลับแบบสรุปตัวเลขล้วน — ไม่คืน roadmap_ids_processed ออกไปข้างนอก (endpoint นี้สาธารณะ
  // ในหน้าต่าง cron จึงไม่ควรบอก id ของผู้ใช้; รายละเอียดเต็มอยู่ใน log ฝั่ง Netlify แล้ว)
  const { roadmap_ids_processed: _ids, ...publicSummary } = summary;
  return new Response(JSON.stringify(publicSummary), {
    headers: { 'Content-Type': 'application/json' },
  });
};
