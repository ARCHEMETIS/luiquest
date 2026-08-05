// โมดูลกลางของ "โจทย์คู่ก่อน-หลัง" — ใช้ร่วมกันทั้ง seed-starter-quests.mjs (วันที่ 1)
// และ seed-quest-bank.mjs (วันที่ 2-14) เพื่อให้ตรวจด้วยเกณฑ์เดียวกันทั้งสองทาง
//
// ทำไมต้องมีไฟล์นี้: ตอน scrutinize แผน 5 ส.ค. 2026 พบว่า seed-starter-quests.mjs ไม่ได้เรียก
// validateQuestBank เลย ถ้าเอาโจทย์ไปใส่วันที่ 1 มันจะไม่ถูกตรวจอะไรเลยสักอย่าง
//
// ★ ทำไมต้องมีทั้ง pre และ post: ถ้าวัดแค่หลังเรียน จะแยกไม่ออกว่า "บทเรียนสอนได้ผล"
//   หรือ "ผู้เรียนรู้อยู่แล้วตั้งแต่แรก" — ต้องถามก่อนอ่าน 1 ข้อ แล้วถามหลังอ่านอีกข้อที่
//   วัดเรื่องเดียวกันแต่คนละสถานการณ์ (ใช้ข้อเดิมซ้ำ = วัดแค่ความจำคำตอบ ไม่ใช่ความเข้าใจ)

const VALID_KINDS = new Set(['single_choice']);

function itemError(label, message) {
  return new Error(`exercise ${label}: ${message}`);
}

/** ตรวจโจทย์ 1 ข้อ (pre หรือ post) */
export function validateExerciseItem(item, label) {
  if (!item || typeof item !== 'object') throw itemError(label, 'ต้องเป็น object');
  if (!VALID_KINDS.has(item.kind)) throw itemError(label, `kind ไม่รองรับ: ${item.kind}`);
  if (typeof item.prompt !== 'string' || !item.prompt.trim()) throw itemError(label, 'prompt ว่างไม่ได้');
  if (!Array.isArray(item.choices) || item.choices.length < 3 || item.choices.length > 4) {
    throw itemError(label, `choices ต้องมี 3-4 ข้อ ได้ ${item.choices?.length}`);
  }
  item.choices.forEach((c, i) => {
    if (typeof c !== 'string' || !c.trim()) throw itemError(label, `choice ที่ ${i + 1} ว่างไม่ได้`);
  });
  if (
    !Number.isInteger(item.correct_index) ||
    item.correct_index < 0 ||
    item.correct_index >= item.choices.length
  ) {
    throw itemError(label, `correct_index ต้องอยู่ใน 0..${item.choices.length - 1} ได้ ${item.correct_index}`);
  }
  if (typeof item.explanation !== 'string' || !item.explanation.trim()) {
    throw itemError(label, 'explanation ว่างไม่ได้ — ผู้เรียนต้องได้รู้ว่าทำไมถึงเป็นคำตอบนี้');
  }
  return true;
}

/** ตรวจคู่ pre/post ของหนึ่งวัน */
export function validateExercisePair(pair, label) {
  if (!pair || typeof pair !== 'object') throw itemError(label, 'ต้องเป็น object ที่มี pre และ post');
  validateExerciseItem(pair.pre, `${label}.pre`);
  validateExerciseItem(pair.post, `${label}.post`);
  // ★ ห้ามใช้ข้อเดียวกันสองรอบ ไม่งั้นเทียบก่อน-หลังแล้วได้แค่ "จำคำตอบได้ไหม"
  if (pair.pre.prompt.trim() === pair.post.prompt.trim()) {
    throw itemError(label, 'pre กับ post ใช้โจทย์เดียวกันไม่ได้ ต้องคนละข้อที่วัดเรื่องเดียวกัน');
  }
  return true;
}

/**
 * แนบโจทย์เข้า content ของเควสที่ตรงกับ (topicSlug, level, dayNumber)
 * คืน content ก้อนใหม่เสมอ ไม่แก้ของเดิม (seed script รันซ้ำได้)
 */
export function attachExercise(content, exercisePair, label) {
  if (!exercisePair) return content;
  validateExercisePair(exercisePair, label);
  return { ...(content ?? {}), exercise: { pre: exercisePair.pre, post: exercisePair.post } };
}

/** index โจทย์ตาม dayNumber เพื่อ lookup เร็ว ๆ ตอน seed */
export function exercisesByDay(list) {
  const map = new Map();
  (list ?? []).forEach((entry) => map.set(entry.dayNumber, entry));
  return map;
}
