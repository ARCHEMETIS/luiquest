// topic_key — กุญแจของ ledger `xp_awards` ที่ "อยู่รอด" แม้ผู้ใช้ลบหัวข้อทิ้งแล้วสร้างใหม่
//
// ทำไมต้องมีไฟล์นี้: เดิม guard กันทำเควสซ้ำใช้ `unique(user_id, quest_id)` ซึ่งพังทันทีที่ลบ
// roadmap เพราะ daily_quests โดน cascade ลบตาม → สร้างหัวข้อเดิมใหม่ได้ quest_id ชุดใหม่หมด
// → เคลม XP ซ้ำได้ไม่จำกัด (P0 ที่เจอตอน audit 4 ส.ค. 2026)
//
// ของที่อยู่รอดจริงมีสองแบบ:
//   - curated  → `topics.slug` คงที่ตลอด ไม่ผูกกับ roadmap ของใครเลย
//   - freeform → `roadmaps.topic_id` เป็น null ต้องใช้ชื่อหัวข้อแทน จึงต้อง normalize ให้
//     "Python", " python ", "PYTHON" กลายเป็นกุญแจเดียวกัน ไม่งั้นเปลี่ยนตัวพิมพ์แล้วปั๊มต่อได้
//
// ต้องตรงกับตรรกะ backfill ใน supabase/migrations/2026-08-04-xp-awards-ledger.sql เป๊ะ ๆ
// (lower + trim + ยุบช่องว่างซ้อนให้เหลือช่องเดียว) ไม่งั้นแถวเก่ากับแถวใหม่จะคนละกุญแจ

export function normalizeTopicTitle(title) {
  return String(title ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// รับ object roadmap ที่ select มาพร้อม topics(slug) — รองรับทั้งรูปแบบ object และ array
// (PostgREST คืน relation เป็น array เมื่อ join แบบ many, เป็น object เมื่อ !inner/one-to-one)
export function topicKeyOf(roadmap) {
  const topics = roadmap?.topics;
  const slug = Array.isArray(topics) ? topics[0]?.slug : topics?.slug;
  if (slug) return `topic:${slug}`;
  return `free:${normalizeTopicTitle(roadmap?.topic_title) || 'unknown'}`;
}
