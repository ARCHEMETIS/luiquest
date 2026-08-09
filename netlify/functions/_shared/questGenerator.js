// สร้าง roadmap + เควสรายวัน — เส้นทาง curated (จาก starter_quests, ไม่แตะ Gemini, #06)
// + เส้นทางหัวข้อพิมพ์อิสระ (generate สดด้วย Gemini) + ต่อเควสรายวันของ roadmap เดิม (ใช้โดย ticket 08 nightly, #07)
import { getTopicOutline, isAllowedLink, safeSearchLink } from './curatedContent.js';
import {
  generateJSON,
  QUEST_MODEL_CHAIN,
  ROADMAP_JSON_SCHEMA,
  QUEST_CONTINUATION_JSON_SCHEMA,
} from './gemini.js';
import { TOPIC_REJECT_CODE, TOPIC_REJECT_MESSAGE } from './topicModeration.js';
import { learningDayStr } from './datetime.js';

export const FREE_PLAN_LIMIT_MESSAGE =
  'แผนฟรีเรียนได้ทีละ 1 หัวข้อ — ปิด roadmap เดิมก่อน หรืออัปเกรด Premium เพื่อเรียนหลายหัวข้อพร้อมกัน';

// เพดาน "หัวข้อที่เก็บไว้" ของแผนฟรี (รวม active — ไม่นับแถว failed) — สลับไปมาได้อิสระ progress ไม่หาย
export const FREE_SAVED_ROADMAP_LIMIT = 3;
export const FREE_SAVED_LIMIT_MESSAGE = `แผนฟรีเก็บได้สูงสุด ${FREE_SAVED_ROADMAP_LIMIT} หัวข้อ (progress ทุกหัวข้อยังอยู่ครบ สลับกลับมาเรียนต่อได้เสมอ) — อัปเกรด Premium เพื่อเริ่มหัวข้อใหม่ได้ไม่จำกัด`;

function isActiveRoadmapLimitError(err) {
  return String(err?.message || '').includes('FREE_PLAN_ACTIVE_ROADMAP_LIMIT');
}

// ต้องตรงกับ isPremiumActive ใน create-payment.js เสมอ เพื่อเช็ควันหมดอายุแบบเดียวกัน
export function isPremiumActive(profile, now = new Date()) {
  if (!profile?.is_premium || !profile.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  return Number.isFinite(premiumUntil.getTime()) && premiumUntil > new Date(now);
}

// คัด starter_quests(topic_id, level) มาเป็น daily_quest วันที่ 1 ของ roadmap ใหม่
async function seedDayOneFromStarter(admin, { roadmapId, topicId, level }) {
  const { data: starter, error: starterErr } = await admin
    .from('starter_quests')
    .select('id, title, description, content, checklist, xp_reward')
    .eq('topic_id', topicId)
    .eq('level', level)
    .eq('day_number', 1) // เลือกเฉพาะวันแรก เพราะคลังมีหลายวันต่อหัวข้อ×ระดับ
    .maybeSingle();
  if (starterErr) console.error('โหลด starter quest วันที่ 1 ไม่สำเร็จ:', starterErr);

  // ยังไม่มี starter quest ของหัวข้อ×ระดับนี้ (เช่นเติมเนื้อหาไม่ทัน) — กันไม่ให้ onboarding ค้าง
  const title = starter?.title ?? 'เควสแรก: เริ่มสำรวจหัวข้อนี้กันเลย';
  const description =
    starter?.description ??
    'เควสตัวอย่างเบื้องต้น ระหว่างระบบเตรียมคลังเควสของหัวข้อนี้ให้ครบ — เควสเต็มรูปแบบจะตามมาเร็ว ๆ นี้';

  const checklistItems = Array.isArray(starter?.checklist) && starter.checklist.length
    ? starter.checklist
    : [{ label: 'อ่าน/ดูแหล่งเรียนเบื้องต้นของหัวข้อนี้', link_url: null }];

  const checklist = checklistItems.map((item, i) => ({
    order_index: item.order_index ?? i,
    label: item.label ?? `ขั้นตอนที่ ${i + 1}`,
    link_url: item.link_url ?? null,
  }));
  return createQuestWithChecklist(admin, {
    roadmapId,
    phaseId: null,
    dayNumber: 1,
    scheduledDate: learningDayStr(),
    title,
    description,
    content: starter?.content ?? {},
    xpReward: starter?.xp_reward ?? 10,
    sourceStarterId: starter?.id ?? null,
    checklist,
  });
}

// พักทุก roadmap ที่ active อยู่ของ user (progress เก็บไว้ครบ) — เรียกก่อน insert/activate ตัวใหม่เสมอ
// เพื่อไม่ชน DB trigger enforce_active_roadmap_limit (ฟรี active ได้ทีละ 1)
async function pauseActiveRoadmaps(admin, userId) {
  const { error } = await admin
    .from('roadmaps')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw error;
}

// เพดานหัวข้อที่เก็บไว้ของแผนฟรี — เช็คก่อนสร้าง roadmap ใหม่เท่านั้น (สลับหัวข้อเดิมไม่โดนเช็ค)
// ไม่นับแถว status='failed' (generate ไม่สำเร็จ ไม่ใช่หัวข้อที่เก็บไว้จริง — กัน retry กินเพดานฟรี)
async function assertSavedCapacity(admin, userId) {
  const { data: profile } = await admin.from('profiles').select('is_premium, premium_until').eq('id', userId).maybeSingle();
  if (isPremiumActive(profile)) return;
  const { count } = await admin
    .from('roadmaps')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'failed');
  if ((count ?? 0) >= FREE_SAVED_ROADMAP_LIMIT) {
    const err = new Error(FREE_SAVED_LIMIT_MESSAGE);
    err.code = 'FREE_PLAN_SAVED_ROADMAP_LIMIT';
    throw err;
  }
}

export async function createCuratedRoadmap(admin, { userId, topicId, topicSlug, topicTitle, level, minutesPerDay }) {
  // เคยมี roadmap หัวข้อนี้อยู่แล้ว (uniq_roadmap_user_topic) — สลับกลับมา active แทนการสร้างใหม่ (progress เดิมอยู่ครบ)
  const { data: existing, error: existingErr } = await admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    if (!existing.is_active) {
      await pauseActiveRoadmaps(admin, userId);
      const { error: actErr } = await admin.from('roadmaps').update({ is_active: true }).eq('id', existing.id);
      if (actErr) throw actErr;
      existing.is_active = true;
    }
    const { data: quest, error: questErr } = await admin
      .from('daily_quests')
      .select('id, roadmap_id, phase_id, day_number, title, description, content, xp_reward')
      .eq('roadmap_id', existing.id)
      .eq('day_number', 1)
      .maybeSingle();
    if (questErr) throw questErr;
    const { data: checklist, error: checklistErr } = quest
      ? await admin.from('quest_checklist_items').select('id, order_index, label, link_url').eq('quest_id', quest.id)
      : { data: [], error: null };
    if (checklistErr) throw checklistErr;
    return { roadmap: existing, quest, checklist: checklist ?? [], reused: true };
  }

  await assertSavedCapacity(admin, userId);
  await pauseActiveRoadmaps(admin, userId);

  const { data: roadmap, error: roadmapErr } = await admin
    .from('roadmaps')
    .insert({
      user_id: userId,
      topic_id: topicId,
      topic_title: topicTitle,
      level,
      minutes_per_day: minutesPerDay,
      status: 'ready',
      is_active: true,
      content: { outline: getTopicOutline(topicSlug)?.outline ?? null },
    })
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .single();

  if (roadmapErr) {
    if (isActiveRoadmapLimitError(roadmapErr)) {
      const err = new Error(FREE_PLAN_LIMIT_MESSAGE);
      err.code = 'FREE_PLAN_ACTIVE_ROADMAP_LIMIT';
      throw err;
    }
    // race: request คู่ขนาน (double-tap) แทรก insert หัวข้อเดียวกันไปก่อน — เช็ค existing ข้างบนไม่เห็นกัน
    // ดึงแถวที่ชนะมาคืนแบบ reused แทนที่จะ 500 ใส่ผู้ใช้ (แถวนั้น active อยู่แล้วจากการ insert ที่ชนะ)
    if (roadmapErr.code === '23505') {
      const { data: raced, error: racedErr } = await admin
        .from('roadmaps')
        .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
        .eq('user_id', userId)
        .eq('topic_id', topicId)
        .single();
      if (racedErr) throw racedErr;
      const { data: quest, error: questErr } = await admin
        .from('daily_quests')
        .select('id, roadmap_id, phase_id, day_number, title, description, content, xp_reward')
        .eq('roadmap_id', raced.id)
        .eq('day_number', 1)
        .maybeSingle();
      if (questErr) throw questErr;
      const { data: checklist, error: checklistErr } = quest
        ? await admin.from('quest_checklist_items').select('id, order_index, label, link_url').eq('quest_id', quest.id)
        : { data: [], error: null };
      if (checklistErr) throw checklistErr;
      return { roadmap: raced, quest, checklist: checklist ?? [], reused: true };
    }
    throw roadmapErr;
  }

  const { quest, checklist } = await seedDayOneFromStarter(admin, { roadmapId: roadmap.id, topicId, level });
  return { roadmap, quest, checklist, reused: false };
}

// ============================================================
// โหมดพิมพ์อิสระ + ต่อเควสรายวัน (generate สดด้วย Gemini, #07)
// ============================================================

const LEVEL_LABEL_TH = { beginner: 'มือใหม่', intermediate: 'พอมีพื้น', advanced: 'แน่นแล้ว' };

function clampXp(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 15;
  return Math.max(10, Math.min(30, n));
}

// guardrail หลัก (#02/#05): link_url ที่ Gemini คืนมาต้องผ่าน isAllowedLink เท่านั้น
// ไม่ผ่าน -> แทนที่ด้วยลิงก์ค้นหา (ไม่ทิ้งขั้นตอนนั้นทิ้ง) ไม่มี link_url เลยก็ปล่อย null ไว้ (ไม่บังคับยัดลิงก์)
function sanitizeChecklistLinks(items, topicTitle) {
  return (Array.isArray(items) ? items : []).map((item, i) => {
    const label = item?.label ? String(item.label).slice(0, 200) : `ขั้นตอนที่ ${i + 1}`;
    let linkUrl = item?.link_url || null;
    if (linkUrl && !isAllowedLink(linkUrl)) {
      linkUrl = safeSearchLink(`${label} ${topicTitle}`.trim());
    }
    return { label, link_url: linkUrl };
  });
}

// กรองบทเรียนจาก Gemini ก่อนบันทึก เพื่อให้ response เพี้ยนไม่ทำเควสล้มทั้งก้อน
function sanitizeQuestContent(value) {
  const intro = typeof value?.intro === 'string' ? value.intro.trim().slice(0, 500) : '';
  const objectives = (Array.isArray(value?.objectives) ? value.objectives : [])
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 4);
  if (!intro && objectives.length === 0) return {};
  return {
    ...(intro ? { intro } : {}),
    ...(objectives.length ? { objectives } : {}),
  };
}

const GENERATION_CLAIM_STALE_MS = 2 * 60 * 1000;
const QUEST_SELECT = 'id, roadmap_id, phase_id, day_number, scheduled_date, title, description, content, xp_reward, source_starter_id';

async function readQuestForDay(admin, roadmapId, dayNumber) {
  const { data: quest, error: questErr } = await admin
    .from('daily_quests')
    .select(QUEST_SELECT)
    .eq('roadmap_id', roadmapId)
    .eq('day_number', dayNumber)
    .maybeSingle();
  if (questErr) throw questErr;
  if (!quest) return null;

  const { data: checklist, error: checklistErr } = await admin
    .from('quest_checklist_items')
    .select('id, order_index, label, link_url')
    .eq('quest_id', quest.id)
    .order('order_index', { ascending: true });
  if (checklistErr) throw checklistErr;
  return { quest, checklist: checklist ?? [] };
}

async function claimGeneration(admin, { roadmapId, dayNumber }) {
  const existing = await readQuestForDay(admin, roadmapId, dayNumber);
  if (existing) return { status: 'ready', ...existing };

  const claimToken = globalThis.crypto.randomUUID();
  const { data: inserted, error: insertErr } = await admin
    .from('quest_generation_claims')
    .insert({ roadmap_id: roadmapId, day_number: dayNumber, claim_token: claimToken })
    .select('roadmap_id, day_number, claim_token, status, claimed_at')
    .maybeSingle();
  if (!insertErr && inserted) return { status: 'claimed', claimToken };
  if (insertErr?.code !== '23505') throw insertErr;

  const raced = await readQuestForDay(admin, roadmapId, dayNumber);
  if (raced) return { status: 'ready', ...raced };

  const staleBefore = new Date(Date.now() - GENERATION_CLAIM_STALE_MS).toISOString();
  const { data: currentClaim, error: currentClaimErr } = await admin
    .from('quest_generation_claims')
    .select('status, claimed_at')
    .eq('roadmap_id', roadmapId)
    .eq('day_number', dayNumber)
    .maybeSingle();
  if (currentClaimErr) throw currentClaimErr;
  if (currentClaim?.status === 'failed' && Date.parse(currentClaim.claimed_at) >= Date.now() - GENERATION_CLAIM_STALE_MS) {
    return { status: 'failed' };
  }
  const { data: reclaimed, error: reclaimErr } = await admin
    .from('quest_generation_claims')
    .update({ claim_token: claimToken, claimed_at: new Date().toISOString(), status: 'generating', quest_id: null })
    .eq('roadmap_id', roadmapId)
    .eq('day_number', dayNumber)
    .in('status', ['generating', 'failed'])
    .lt('claimed_at', staleBefore)
    .select('roadmap_id, day_number, claim_token, status, claimed_at')
    .maybeSingle();
  if (reclaimErr) throw reclaimErr;
  if (reclaimed) return { status: 'claimed', claimToken };
  return { status: 'generating' };
}

async function releaseGenerationClaim(admin, { roadmapId, dayNumber, claimToken }) {
  if (!claimToken) return;
  await admin
    .from('quest_generation_claims')
    .update({ status: 'failed', claimed_at: new Date().toISOString() })
    .eq('roadmap_id', roadmapId)
    .eq('day_number', dayNumber)
    .eq('claim_token', claimToken);
}

async function createQuestWithChecklist(admin, {
  roadmapId,
  phaseId,
  dayNumber,
  scheduledDate,
  title,
  description,
  content,
  xpReward,
  sourceStarterId,
  checklist,
  claimToken = null,
}) {
  const { data, error } = await admin.rpc('create_quest_with_checklist', {
    p_roadmap_id: roadmapId,
    p_phase_id: phaseId ?? null,
    p_day_number: dayNumber,
    p_scheduled_date: scheduledDate ?? null,
    p_title: title,
    p_description: description ?? null,
    p_content: content ?? {},
    p_xp_reward: xpReward,
    p_source_starter_id: sourceStarterId ?? null,
    p_checklist: checklist,
    p_claim_token: claimToken,
  });
  if (error) throw error;
  if (!data?.quest) throw new Error('create_quest_with_checklist returned no quest');
  return { quest: data.quest, checklist: data.checklist ?? [] };
}

function normalizePhases(phases) {
  const arr = Array.isArray(phases) ? phases : [];
  return arr.slice(0, 6).map((p, i) => ({
    phase_number: i + 1,
    title: String(p?.title ?? `เฟส ${i + 1}`).slice(0, 120),
    description: String(p?.description ?? '').slice(0, 300),
  }));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidGeneratedRoadmap(value) {
  if (!value || value.topic_ok !== true || !Array.isArray(value.phases) || value.phases.length < 3 || value.phases.length > 6) {
    return false;
  }
  if (!value.phases.every((phase) => (
    phase &&
    Number.isInteger(phase.phase_number) &&
    isNonEmptyString(phase.title) &&
    isNonEmptyString(phase.description)
  ))) {
    return false;
  }

  const firstQuest = value.first_quest;
  return Boolean(
    firstQuest &&
    isNonEmptyString(firstQuest.title) &&
    isNonEmptyString(firstQuest.description) &&
    Number.isInteger(firstQuest.xp_reward) &&
    Array.isArray(firstQuest.checklist) &&
    firstQuest.checklist.length >= 2 &&
    firstQuest.checklist.length <= 4 &&
    firstQuest.checklist.every((item) => (
      item &&
      isNonEmptyString(item.label) &&
      (item.link_url == null || typeof item.link_url === 'string')
    ))
  );
}

export const FREEFORM_SYSTEM_PROMPT = `You design a Thai learning roadmap and first daily quest for LuiQuest.

You have no browser. You cannot verify that any course, video, instructor, lesson, or URL exists. Never invent course names, video titles, instructor names, claims that a specific lesson was found, or deep URLs.

ตัดสิน topic_ok ตามกติกาไทยนี้ (ห้ามย่อ — เกณฑ์ชุดนี้ทดสอบกับ Gemini จริงมาแล้วว่าไม่ over-block):
- topic_ok = true เมื่อหัวข้อเป็น "สิ่งที่คนตั้งใจฝึกให้เก่งขึ้นได้จริง" — ทักษะ วิชา ภาษา กีฬา ดนตรี งานฝีมือ อาชีพ งานอดิเรก การดูแลตัวเอง ฯลฯ (ครอบคลุมหัวข้อกว้าง ๆ อย่าง "ทำอาหาร" หรือเฉพาะทางอย่าง "อ่านงบการเงิน" ก็ใช้ได้ทั้งคู่)
- topic_ok = false เมื่อหัวข้อเป็นเรื่องเพศ/ลามก, คำหยาบหรือคำด่า, ความรุนแรงหรือทำร้ายคน, สิ่งผิดกฎหมาย/ทำอันตราย (เช่น ทำระเบิด ทำยาเสพติด โกงข้อสอบ แฮกบัญชีคนอื่น), การเหยียด/สร้างความเกลียดชัง, หรือเป็นข้อความมั่ว ๆ พิมพ์เล่นที่ไม่ใช่หัวข้อเรียน
- ตอนตัดสินให้ดูเจตนาจริงของหัวข้อ ไม่ใช่แค่คำ — "โทษของยาเสพติด" หรือ "ความปลอดภัยไซเบอร์" คือหัวข้อเรียนที่ใช้ได้ (true)
- ถ้า topic_ok = false ให้กรอก phases/first_quest แบบสั้นที่สุดพอผ่าน schema (ระบบจะทิ้งทั้งก้อน ไม่ต้องตั้งใจเขียน) และห้ามใส่เนื้อหาหยาบคายลงไป
Write concise, friendly Thai. For every phase, its description must explicitly state both its prerequisite and its outcome.
Respect the learner's daily time budget exactly:
- 15 minutes: 2-3 short tasks.
- 30 minutes: exactly 3 short tasks.
- 60 minutes: at most 4 short tasks.

The first quest must be practical today and contain 2-4 checklist items. Write intro as 2-3 concise Thai sentences: first say what the learner is starting today, then say what today's quest adds. Write objectives as 2-4 concrete, checkable capabilities in Thai, using the authored-bank style such as "สร้าง...ได้" or "อธิบาย...ได้". A checklist label must say "ค้นหา..." when it points the learner to search for something; it must not assert that a specific course or lesson was found.

For every checklist item, link_url must be null or exactly one of these permitted search URL patterns:
- https://www.youtube.com/results?search_query=<query>
- https://www.google.com/search?q=<query>
Use no homepage URL, deep URL, or any other URL. Do not name a specific resource unless it was supplied by the user.

Return JSON matching the schema exactly.`;
export function buildFreeformRoadmapPrompt({ topicTitle, level, minutesPerDay }) {
  return `ผู้เรียนอยากเก่ง: "${topicTitle}"
ระดับพื้นฐาน: ${LEVEL_LABEL_TH[level] ?? level}
เวลาที่มีต่อวัน: ${minutesPerDay} นาที

ออกแบบ roadmap ~4 เฟส + เควสแรกที่ทำได้ทันทีวันนี้ โดย intro 2-3 ประโยคต้องบอกว่าผู้เรียนกำลังเริ่มอะไรและวันนี้จะเพิ่มอะไร ส่วน objectives เป็นความสามารถภาษาไทยที่ตรวจสอบได้ 2-4 ข้อ ตอบเป็น JSON ตาม schema เท่านั้น`;
}

/**
 * สร้าง roadmap หัวข้อพิมพ์อิสระ — generate สดด้วย Gemini เสมอ (ไม่มี cache ต่อ topic เพราะ topic_id เป็น null)
 * คืนค่า:
 *  - สำเร็จ: { roadmap, quest, checklist, phase, failed: false }
 *  - Gemini หมด chain ทั้งหมด: { roadmap, quest: null, checklist: [], phase: null, failed: true }
 *    (roadmap ถูก insert เป็น status:'failed', is_active:false — ไม่กินโควตา active roadmap ของแผนฟรี ผู้ใช้เรียกซ้ำได้)
 *  - response ผิด shape: { roadmap: null, quest: null, checklist: [], phase: null, failed: true } (ไม่ insert ข้อมูลที่โมเดลคืนมา)
 */
export async function createFreeformRoadmap(admin, { userId, topicTitle, level, minutesPerDay }) {
  // เคยมี roadmap หัวข้อพิมพ์อิสระนี้อยู่แล้ว (จับคู่ด้วย topic_title แบบ case-insensitive/trim เพราะ topic_id เป็น null
  // เลยไม่มี unique constraint ให้พึ่ง) — สลับกลับมา active แทนการยิง Gemini + insert ใหม่ (progress เดิมอยู่ครบ)
  // ไม่นับแถว status='failed' เป็น "มีหัวข้อนี้อยู่แล้ว" (ไม่มีเนื้อหาจริงให้กลับไปเรียนต่อ)
  const trimmedTitle = topicTitle.trim();
  const { data: existing, error: existingErr } = await admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .eq('user_id', userId)
    .is('topic_id', null)
    .ilike('topic_title', trimmedTitle)
    .neq('status', 'failed')
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    if (!existing.is_active) {
      await pauseActiveRoadmaps(admin, userId);
      const { error: actErr } = await admin.from('roadmaps').update({ is_active: true }).eq('id', existing.id);
      if (actErr) throw actErr;
      existing.is_active = true;
    }
    const { data: quest, error: questErr } = await admin
      .from('daily_quests')
      .select('id, roadmap_id, phase_id, day_number, title, description, content, xp_reward')
      .eq('roadmap_id', existing.id)
      .eq('day_number', 1)
      .maybeSingle();
    if (questErr) throw questErr;
    const { data: checklist, error: checklistErr } = quest
      ? await admin.from('quest_checklist_items').select('id, order_index, label, link_url').eq('quest_id', quest.id)
      : { data: [], error: null };
    if (checklistErr) throw checklistErr;
    return { roadmap: existing, quest, checklist: checklist ?? [], reused: true };
  }

  // เช็คเพดานก่อนยิง Gemini เสมอ — กันไม่ให้เสียโควต้า Gemini ฟรีไปกับ request ที่รู้อยู่แล้วว่าจะถูกปฏิเสธ
  // (ยังไม่พัก roadmap เดิมตรงนี้ — พักหลัง generate สำเร็จเท่านั้น กันเคส Gemini ล่มแล้วหัวข้อเดิมโดนพักทิ้งเปล่า ๆ)
  await assertSavedCapacity(admin, userId);

  let generated = null;
  try {
    generated = await generateJSON({
      systemInstruction: FREEFORM_SYSTEM_PROMPT,
      prompt: buildFreeformRoadmapPrompt({ topicTitle, level, minutesPerDay }),
      chain: QUEST_MODEL_CHAIN,
      schema: ROADMAP_JSON_SCHEMA,
      temperature: 0.9,
    });
  } catch (err) {
    if (!err?.exhausted) throw err; // error อื่นที่ไม่ใช่ chain หมด (bug/env) โยนต่อเป็น 500 จริง ไม่ silent fallback
  }

  // ด่านกรองหัวข้อชั้นที่ 2 — โมเดลตีกลับเอง (ชั้นที่ 1 = บล็อกลิสต์ใน generate-quest.js ยิงก่อนถึง Gemini)
  // ทิ้งเนื้อหาที่ generate มาทั้งก้อน ไม่ insert roadmap ใด ๆ ลง DB (ไม่กินเพดานหัวข้อ ไม่มีขยะค้าง)
  if (generated && generated.topic_ok === false) {
    const err = new Error(TOPIC_REJECT_MESSAGE);
    err.code = TOPIC_REJECT_CODE;
    throw err;
  }

  // ต้องได้ topic_ok=true และ shape ครบก่อนพัก roadmap เดิมหรือ insert ใด ๆ — response เพี้ยนถือเป็น generation failure
  if (generated && !isValidGeneratedRoadmap(generated)) {
    console.warn('[questGenerator] Gemini roadmap response invalid — treat as generation failure');
    return { roadmap: null, quest: null, checklist: [], phase: null, failed: true };
  }

  if (!generated) {
    // ห้ามแต่งเนื้อหา/ลิงก์ที่ไม่มีจริงสำหรับหัวข้อพิมพ์อิสระ (ไม่มี starter_quests ให้ fallback แบบ curated) — คืน failed ตรง ๆ
    const { data: roadmap, error: roadmapErr } = await admin
      .from('roadmaps')
      .insert({
        user_id: userId,
        topic_id: null,
        topic_title: topicTitle,
        level,
        minutes_per_day: minutesPerDay,
        status: 'failed',
        is_active: false, // ไม่กินโควตา active roadmap ของแผนฟรี — ให้ผู้ใช้เรียกซ้ำได้ทันที
        content: null,
      })
      .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
      .single();
    if (roadmapErr) {
      if (isActiveRoadmapLimitError(roadmapErr)) {
        const err = new Error(FREE_PLAN_LIMIT_MESSAGE);
        err.code = 'FREE_PLAN_ACTIVE_ROADMAP_LIMIT';
        throw err;
      }
      throw roadmapErr;
    }
    return { roadmap, quest: null, checklist: [], phase: null, failed: true };
  }

  const phasesOutline = normalizePhases(generated.phases);
  const checklist = sanitizeChecklistLinks(generated.first_quest?.checklist, topicTitle);

  // generate สำเร็จแล้วเท่านั้นถึงพักหัวข้อเดิม — progress เก็บไว้ครบ สลับกลับได้ผ่าน /switch-roadmap
  await pauseActiveRoadmaps(admin, userId);

  const { data: roadmap, error: roadmapErr } = await admin
    .from('roadmaps')
    .insert({
      user_id: userId,
      topic_id: null,
      topic_title: topicTitle,
      level,
      minutes_per_day: minutesPerDay,
      status: 'ready',
      is_active: true,
      content: { phases: phasesOutline }, // cache โครง roadmap ไว้ให้ ticket 08 ต่อเควสโดยไม่ต้องถาม Gemini ซ้ำ
    })
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .single();

  if (roadmapErr) {
    if (isActiveRoadmapLimitError(roadmapErr)) {
      const err = new Error(FREE_PLAN_LIMIT_MESSAGE);
      err.code = 'FREE_PLAN_ACTIVE_ROADMAP_LIMIT';
      throw err;
    }
    throw roadmapErr;
  }

  const firstPhase = phasesOutline[0] ?? { phase_number: 1, title: topicTitle, description: '' };
  const { data: phase, error: phaseErr } = await admin
    .from('phases')
    .insert({
      roadmap_id: roadmap.id,
      phase_number: 1,
      title: firstPhase.title,
      description: firstPhase.description,
    })
    .select('id, roadmap_id, phase_number, title, description')
    .single();
  if (phaseErr) throw phaseErr;

  const created = await createQuestWithChecklist(admin, {
    roadmapId: roadmap.id,
    phaseId: phase.id,
    dayNumber: 1,
    scheduledDate: learningDayStr(),
    title: String(generated.first_quest.title ?? topicTitle).slice(0, 200),
    description: String(generated.first_quest.description ?? '').slice(0, 500),
    content: sanitizeQuestContent(generated.first_quest),
    xpReward: clampXp(generated.first_quest.xp_reward),
    sourceStarterId: null,
    checklist: checklist.map((item, i) => ({ ...item, order_index: i })),
  });

  await admin.from('activity_log').insert({
    user_id: userId,
    event_type: 'roadmap_start',
    metadata: { freeform: true, topic_title: topicTitle },
  });

  return { roadmap, ...created, phase, failed: false };
}

// ~1 สัปดาห์ต่อเฟส — heuristic ง่าย ๆ ตัดสินใจ deterministic จาก day_number ล้วน (ไม่ให้ Gemini ตัดสินเรื่อง phase boundary)
const PHASE_LENGTH_DAYS = 6;

export function phaseNumberForDay(dayNumber) {
  return Math.floor((dayNumber - 1) / PHASE_LENGTH_DAYS) + 1;
}

const CONTINUATION_SYSTEM_PROMPT = `You extend an existing LuiQuest Thai learning roadmap by creating exactly one next-day micro-skill quest.

You have no browser. You cannot verify that any course, video, instructor, lesson, or URL exists. Never invent course names, video titles, instructor names, claims that a specific lesson was found, or deep URLs.

Write concise, friendly Thai. Build exactly one micro-skill that follows from the current phase. Never jump ahead, never repeat a recent quest, and make the learner do one clear next step. Write intro as 2-3 concise Thai sentences that explicitly reference what the learner did the day before, then state what today's quest adds. Write objectives as 2-4 concrete, checkable capabilities in Thai, using the authored-bank style such as "สร้าง...ได้" or "อธิบาย...ได้".
For every phase description, explicitly state its prerequisite and its outcome.
Respect the learner's daily time budget exactly:
- 15 minutes: 2-3 short tasks.
- 30 minutes: exactly 3 short tasks.
- 60 minutes: at most 4 short tasks.

Use 2-4 checklist items. A checklist label must say "ค้นหา..." when it points the learner to search for something; it must not assert that a specific course or lesson was found.
For every checklist item, link_url must be null or exactly one of these permitted search URL patterns:
- https://www.youtube.com/results?search_query=<query>
- https://www.google.com/search?q=<query>
Use no homepage URL, deep URL, or any other URL. Do not name a specific resource unless it was supplied by the user.

If a current phase is provided, preserve its prerequisite and outcome and make the micro-skill follow from them. If a new phase is required, make its prerequisite explicit and state the outcome it enables.
Return JSON matching the schema exactly.`;
function buildCuratedGrounding(outline) {
  if (!outline) return 'ไม่มีข้อมูลแหล่งเรียนเพิ่มเติมสำหรับหัวข้อนี้ ใช้ความรู้ทั่วไปได้แต่ห้ามแต่งลิงก์';
  const sources = (outline.sources ?? []).map((s) => `- ${s.label}: ${s.url}`).join('\n');
  return `ภาพรวมหัวข้อนี้: ${outline.outline}\n\nแหล่งเรียนที่อนุญาต (ใช้ได้เฉพาะหน้าหลักของโดเมนเหล่านี้เท่านั้น):\n${sources}`;
}

function buildFreeformGrounding(cachedPhases) {
  if (!Array.isArray(cachedPhases) || !cachedPhases.length) {
    return 'ไม่มีโครง roadmap แคชไว้ ใช้บริบทจากชื่อหัวข้อ/เควสก่อนหน้าแทน';
  }
  return `โครง roadmap ที่วางไว้ตอนเริ่มต้น:\n${cachedPhases
    .map((p) => `- เฟส ${p.phase_number}: ${p.title} — ${p.description}`)
    .join('\n')}`;
}

function buildContinuationPrompt({
  topicTitle,
  level,
  minutesPerDay,
  dayNumber,
  grounding,
  recentTitles,
  currentPhase,
  needsNewPhase,
  targetPhaseNumber,
}) {
  const avoid = recentTitles.length
    ? `เควสเมื่อวานคือรายการแรก ตามด้วยเควสก่อนหน้านั้น (ห้ามซ้ำ ให้ต่อยอดเป็นสเต็ปถัดไป): ${recentTitles.join(' | ')}`
    : 'ยังไม่มีเควสก่อนหน้าในรายการล่าสุด';
  const phaseCtx = needsNewPhase
    ? `วันนี้เป็นจุดเริ่มเฟสใหม่ (เฟสที่ ${targetPhaseNumber}) — ตั้งชื่อ/คำอธิบายเฟสใหม่ให้ต่อเนื่องจาก roadmap`
    // ตาราง phases มีแค่ title/description จริง ๆ ไม่มีคอลัมน์ prerequisite/outcome แยก
    // (เช็คแล้วที่ schema.sql:133) — จึงส่ง description ไปตรง ๆ ตัวเดียว แล้วสั่งให้โมเดล
    // "คงสิ่งที่ต้องรู้ก่อน/สิ่งที่ทำได้หลังจบเฟส" ที่ฝังอยู่ในคำอธิบายนั้นไว้
    // (เวอร์ชันก่อนหน้าส่ง description ซ้ำสองช่องเป็น prerequisite กับ outcome ซึ่งไม่มีความหมาย)
    : `วันนี้ยังอยู่เฟสเดิม: "${currentPhase.title}" — ${currentPhase.description}
ให้ตอบ phase_title/phase_description ซ้ำตามนี้ และคงสิ่งที่ต้องรู้ก่อน (prerequisite) กับสิ่งที่ทำได้เมื่อจบเฟส (outcome) ที่ระบุไว้ในคำอธิบายเดิม`;

  return `หัวข้อ: "${topicTitle}"
ระดับพื้นฐาน: ${LEVEL_LABEL_TH[level] ?? level}
เวลาที่มีต่อวัน: ${minutesPerDay} นาที
วันนี้คือ day ${dayNumber} ของ roadmap

${grounding}

${avoid}

${phaseCtx}

ออกแบบเควสของวันนี้ โดย intro 2-3 ประโยคต้องอ้างถึงสิ่งที่ผู้เรียนทำเมื่อวานแล้วบอกว่าวันนี้ต่อยอดอะไร และ objectives ต้องเป็นความสามารถภาษาไทยที่ตรวจสอบได้ 2-4 ข้อ ตาม schema เท่านั้น (JSON ล้วน)`;
}

// fallback แบบ static สำหรับหัวข้อ curated เท่านั้น เมื่อ Gemini หมด chain ทั้งหมด (#03)
// starter_quests has one authored row per (topic_id, level, day_number) for authored days and static fallback.
async function tryStarterFallback(admin, { roadmap, dayNumber, phase, scheduledDate, claimToken }) {
  const { data: starter } = await admin
    .from('starter_quests')
    .select('id, title, description, content, checklist, xp_reward')
    .eq('topic_id', roadmap.topic_id)
    .eq('level', roadmap.level)
    .eq('day_number', dayNumber)
    .maybeSingle();
  if (!starter) return { failed: true };

  const checklistItems =
    Array.isArray(starter.checklist) && starter.checklist.length
      ? starter.checklist
      : [{ label: 'อ่าน/ดูแหล่งเรียนของหัวข้อนี้ต่อ', link_url: null }];
  const checklist = checklistItems.map((item, i) => ({
    order_index: item.order_index ?? i,
    label: item.label ?? `ขั้นตอนที่ ${i + 1}`,
    link_url: item.link_url ?? null,
  }));
  const created = await createQuestWithChecklist(admin, {
    roadmapId: roadmap.id,
    phaseId: phase?.id ?? null,
    dayNumber,
    scheduledDate,
    title: starter.title,
    description: starter.description,
    content: starter.content ?? {},
    xpReward: starter.xp_reward ?? 10,
    sourceStarterId: starter.id,
    checklist,
    claimToken,
  });

  return { ...created, phase, failed: false };
}

/**
 * ต่อเควสถัดไปของ roadmap ที่มีอยู่แล้ว — ใช้โดย ticket 08 (pre-generate-quests.js, nightly scheduled function)
 * ครอบคลุมทั้ง curated (roadmap.topic_id ไม่ null, grounding จาก getTopicOutline) และ freeform
 * (roadmap.topic_id null, grounding จาก roadmap.content.phases ที่แคชไว้ตอนสร้าง)
 *
 * @param {object} admin - Supabase admin client (service role)
 * @param {{ roadmap: object, dayNumber: number }} params
 *   roadmap ต้องมีอย่างน้อย: id, topic_id, topic_title, level, minutes_per_day, content
 *
 * คืนค่า (สัญญากับ ticket 08 — ห้ามเปลี่ยนโดยไม่แจ้ง):
 *  - สำเร็จ: { quest, checklist, phase, failed: false }
 *      quest    = แถว daily_quests ที่ insert แล้ว (หรือดึงมาถ้าชนกับ cron รอบ/invocation อื่น)
 *      checklist = แถว quest_checklist_items ของเควสนั้น (array)
 *      phase    = แถว phases ที่เควสนี้อยู่ (อาจเป็น null ได้เฉพาะกรณี fallback แบบ static ที่หา/สร้าง phase ใหม่ไม่ได้)
 *  - ล้มเหลว (ไม่มี error object — ผู้เรียกควรข้าม roadmap นี้ไปคืนนี้ ไม่ throw): { failed: true }
 */
export async function generateNextQuest(admin, { roadmap, dayNumber, scheduledDate = learningDayStr() }) {
  const { data: phases } = await admin
    .from('phases')
    .select('id, roadmap_id, phase_number, title, description')
    .eq('roadmap_id', roadmap.id)
    .order('phase_number', { ascending: true });
  const phaseList = phases ?? [];

  const targetPhaseNumber = phaseNumberForDay(dayNumber);
  let existingPhase = phaseList.find((p) => p.phase_number === targetPhaseNumber) ?? null;

  const { data: recentQuests } = await admin
    .from('daily_quests')
    .select('day_number, title')
    .eq('roadmap_id', roadmap.id)
    .order('day_number', { ascending: false })
    .limit(5);
  const recentTitles = (recentQuests ?? []).map((q) => q.title).filter(Boolean);

  const claim = await claimGeneration(admin, { roadmapId: roadmap.id, dayNumber });
  if (claim.status === 'ready') {
    return { quest: claim.quest, checklist: claim.checklist, phase: existingPhase, failed: false };
  }
  if (claim.status === 'generating') {
    return { quest: null, checklist: [], phase: existingPhase, failed: true };
  }
  if (claim.status === 'failed') {
    return { quest: null, checklist: [], phase: existingPhase, failed: true };
  }
  const { claimToken } = claim;

  if (roadmap.topic_id) {
    const authored = await tryStarterFallback(admin, {
      roadmap,
      dayNumber,
      phase: existingPhase,
      scheduledDate,
      claimToken,
    });
    if (!authored.failed) return authored;
  }

  let grounding;
  if (roadmap.topic_id) {
    const { data: topic } = await admin.from('topics').select('slug').eq('id', roadmap.topic_id).maybeSingle();
    grounding = buildCuratedGrounding(topic ? getTopicOutline(topic.slug) : null);
  } else {
    grounding = buildFreeformGrounding(roadmap.content?.phases);
  }

  let generated = null;
  try {
    generated = await generateJSON({
      systemInstruction: CONTINUATION_SYSTEM_PROMPT,
      prompt: buildContinuationPrompt({
        topicTitle: roadmap.topic_title,
        level: roadmap.level,
        minutesPerDay: roadmap.minutes_per_day,
        dayNumber,
        grounding,
        recentTitles,
        currentPhase: existingPhase,
        needsNewPhase: !existingPhase,
        targetPhaseNumber,
      }),
      chain: QUEST_MODEL_CHAIN,
      schema: QUEST_CONTINUATION_JSON_SCHEMA,
      temperature: 0.9,
    });
  } catch (err) {
    if (!err?.exhausted) {
      await releaseGenerationClaim(admin, { roadmapId: roadmap.id, dayNumber, claimToken });
      throw err; // bug/env error จริง โยนต่อ ไม่ silent fallback
    }
  }

  if (!generated) {
    // Gemini หมด chain: curated มี starter_quests ให้ลองเป็นทางสำรอง, freeform ไม่มี (ห้ามแต่งเนื้อหา) -> failed ตรง ๆ
    if (roadmap.topic_id) {
      const authored = await tryStarterFallback(admin, {
        roadmap,
        dayNumber,
        phase: existingPhase,
        scheduledDate,
        claimToken,
      });
      if (!authored.failed) return authored;
    }
    await releaseGenerationClaim(admin, { roadmapId: roadmap.id, dayNumber, claimToken });
    return { failed: true };
  }

  // resolve phase: ใช้ของเดิมถ้ามี ไม่งั้น insert ใหม่ (handle race กับ cron tick อื่นด้วย unique(roadmap_id, phase_number))
  let phase = existingPhase;
  if (!phase) {
    const { data: newPhase, error: phaseErr } = await admin
      .from('phases')
      .insert({
        roadmap_id: roadmap.id,
        phase_number: targetPhaseNumber,
        title: String(generated.phase_title || `เฟส ${targetPhaseNumber}`).slice(0, 120),
        description: String(generated.phase_description || '').slice(0, 300),
      })
      .select('id, roadmap_id, phase_number, title, description')
      .single();
    if (phaseErr) {
      if (phaseErr.code === '23505') {
        const { data: existing } = await admin
          .from('phases')
          .select('id, roadmap_id, phase_number, title, description')
          .eq('roadmap_id', roadmap.id)
          .eq('phase_number', targetPhaseNumber)
          .single();
        phase = existing;
      } else {
        throw phaseErr;
      }
    } else {
      phase = newPhase;
    }
  }

  const checklist = sanitizeChecklistLinks(generated.checklist, roadmap.topic_title);
  if (checklist.length === 0) {
    await releaseGenerationClaim(admin, { roadmapId: roadmap.id, dayNumber, claimToken });
    return { failed: true };
  }
  const created = await createQuestWithChecklist(admin, {
    roadmapId: roadmap.id,
    phaseId: phase?.id ?? null,
    dayNumber,
    scheduledDate,
    title: String(generated.title).slice(0, 200),
    description: String(generated.description ?? '').slice(0, 500),
    content: sanitizeQuestContent(generated),
    xpReward: clampXp(generated.xp_reward),
    sourceStarterId: null,
    checklist: checklist.map((item, i) => ({ ...item, order_index: i })),
    claimToken,
  });

  return { ...created, phase, failed: false };
}
