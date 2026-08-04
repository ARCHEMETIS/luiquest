// Scheduled Function — pre-generate เควสรายวันตอนกลางคืน (cron ใน function config, ทุก 10 นาที 19-21 UTC = ตี 2-5 ไทย, #08)
// ไม่มีตาราง "job queue" จริงในสคีมา (ล็อกแล้วตาม supabase-schema.md) — คิวคำนวณสดจาก roadmaps/daily_quests/quest_completions ทุกรอบ
// BATCH_SIZE = 1: Netlify free plan timeout 10 วิ — ให้ cron หลายรอบเป็นตัวเพิ่ม throughput
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { generateNextQuest } from './_shared/questGenerator.js';
import { nextLearningDayStr } from './_shared/datetime.js';

const BATCH_SIZE = 1; // free plan timeout 10 วินาที — ใช้จำนวนรอบ cron เพิ่ม throughput แทนการทำหลายคิวต่อรอบ

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

export function orderEligibleRoadmaps(roadmaps) {
  return [...roadmaps].sort((a, b) => {
    const generatedDiff = Date.parse(a.last_generated_at) - Date.parse(b.last_generated_at);
    if (generatedDiff) return generatedDiff;
    const createdDiff = Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? '');
    if (createdDiff) return createdDiff;
    return String(a.id).localeCompare(String(b.id));
  });
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

  // 1) RPC คัดเฉพาะ roadmap ที่พร้อมจริงและเรียงตัวที่สร้างนานสุดก่อน เพื่อ fairness ข้ามรอบ
  const { data: candidates, error: candidatesErr } = await admin.rpc('get_eligible_roadmaps_for_generation', {
    p_limit: BATCH_SIZE,
  });

  if (candidatesErr) {
    console.error('[pre-generate-quests] ดึง candidate roadmaps ไม่สำเร็จ', candidatesErr);
    return new Response(JSON.stringify({ ok: false, error: candidatesErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scanned = candidates?.length ?? 0;
  const eligible = orderEligibleRoadmaps(candidates ?? []);
  const skippedNoQuests = 0;

  // eligible roadmaps ถูกคัดด้วย RPC เดียวและเรียง least-recently-generated แล้ว — ไม่วน query ราย roadmap อีก
  // 5) สร้างทีละเควส — cron ทุก 10 นาทีช่วยเพิ่ม throughput โดยไม่เสี่ยง timeout
  const batch = eligible.slice(0, BATCH_SIZE).map((roadmap) => ({
    roadmap,
    dayNumber: roadmap.day_number,
  }));

  // 6-7) ยิง generateNextQuest ทีละตัว sequential (แชร์ Gemini RPM budget เดียวกัน)
  let succeeded = 0;
  let failed = 0;
  const roadmapIdsProcessed = [];

  for (const item of batch) {
    roadmapIdsProcessed.push(item.roadmap.id);
    try {
      const result = await generateNextQuest(admin, {
        roadmap: item.roadmap,
        dayNumber: item.dayNumber,
        scheduledDate: nextLearningDayStr(),
      });
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
