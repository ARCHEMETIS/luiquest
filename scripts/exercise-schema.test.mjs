// เทสโจทย์คู่ก่อน-หลัง — ตัวเลขที่จะเอาไปนำเสนอขึ้นอยู่กับความถูกต้องของชุดนี้ทั้งหมด
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExerciseItem, validateExercisePair, attachExercise } from './exercise-schema.mjs';
import { EXERCISES_DATA_ML_BEGINNER } from './exercises-data-ml-beginner.mjs';

const validItem = {
  kind: 'single_choice',
  prompt: 'ข้อมูลชุดนี้ควรใช้กราฟแบบไหน',
  choices: ['แท่ง', 'เส้น', 'วงกลม'],
  correct_index: 1,
  explanation: 'ข้อมูลตามเวลาเหมาะกับกราฟเส้น',
};

test('ชุดโจทย์ pilot Data/ML มือใหม่ ผ่านเกณฑ์ครบทั้ง 7 วัน', () => {
  assert.equal(EXERCISES_DATA_ML_BEGINNER.length, 7);
  EXERCISES_DATA_ML_BEGINNER.forEach((entry) => {
    assert.equal(validateExercisePair(entry, `วันที่ ${entry.dayNumber}`), true);
  });
  const days = EXERCISES_DATA_ML_BEGINNER.map((e) => e.dayNumber);
  assert.deepEqual(days, [1, 2, 3, 4, 5, 6, 7]);
});

test('correct_index ที่ชี้นอกช่วง choices ต้องถูกปฏิเสธ', () => {
  assert.throws(() => validateExerciseItem({ ...validItem, correct_index: 3 }, 'x'), /correct_index/);
  assert.throws(() => validateExerciseItem({ ...validItem, correct_index: -1 }, 'x'), /correct_index/);
});

test('choices น้อยกว่า 3 หรือมากกว่า 4 ต้องถูกปฏิเสธ', () => {
  assert.throws(() => validateExerciseItem({ ...validItem, choices: ['ก', 'ข'] }, 'x'), /choices/);
  assert.throws(
    () => validateExerciseItem({ ...validItem, choices: ['ก', 'ข', 'ค', 'ง', 'จ'] }, 'x'),
    /choices/
  );
});

test('ไม่มี explanation ต้องถูกปฏิเสธ — ผู้เรียนต้องได้รู้ว่าทำไม', () => {
  assert.throws(() => validateExerciseItem({ ...validItem, explanation: '  ' }, 'x'), /explanation/);
});

test('★ ใช้โจทย์เดียวกันเป็นทั้ง pre และ post ไม่ได้ (ไม่งั้นวัดแค่ความจำคำตอบ)', () => {
  assert.throws(
    () => validateExercisePair({ pre: validItem, post: { ...validItem } }, 'x'),
    /pre กับ post ใช้โจทย์เดียวกันไม่ได้/
  );
});

test('attachExercise ไม่แก้ content เดิม และคง intro/objectives ไว้ครบ', () => {
  const original = { intro: 'บทนำ', objectives: ['ก', 'ข'] };
  const pair = EXERCISES_DATA_ML_BEGINNER[0];
  const merged = attachExercise(original, pair, 'test');
  assert.equal(merged.intro, 'บทนำ');
  assert.deepEqual(merged.objectives, ['ก', 'ข']);
  assert.ok(merged.exercise.pre && merged.exercise.post);
  assert.equal(original.exercise, undefined); // ของเดิมต้องไม่ถูกแตะ
});

test('ไม่มีโจทย์ให้แนบ = คืน content เดิมไปตรง ๆ', () => {
  const original = { intro: 'บทนำ' };
  assert.equal(attachExercise(original, null, 'test'), original);
});
