// ตรรกะ "วันไหนแน่นเกินไป" ของปฏิทินแผนสอบ — แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพื่อเทสได้ตรง ๆ
// (แบบเดียวกับ examSchedule.js ที่แยกตรรกะจัดตารางออกจาก component)
//
// หลักคิด: ไม่ตัดสินด้วยตัวเลขที่เราคิดเอง แต่เทียบกับ **เวลาที่ผู้ใช้ตั้งไว้เอง**
// ทุกแผนมี minutes_per_day ที่เจ้าตัวกรอกว่าวันหนึ่งอ่านไหวกี่นาที ⇒ เพดานของวันนั้น
// คือผลรวมของวิชาที่ลงวันนั้น เกินเมื่อไหร่แปลว่าเกินที่ตัวเองบอกว่าไหว
//
// เลขตายตัวใช้ไม่ได้: คนตั้ง 30 นาที 3 วิชา = 90 นาทีก็เกินตัวแล้ว
// ส่วนคนตั้ง 150 นาที/วัน จะโดนเตือนทุกวันทั้งที่แผนพอดีเป๊ะ

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const OVERLOAD_RATIO = 1.5; // เกินเพดานตัวเองเกินครึ่ง = แดง

// รวมทุกแผนเป็นดัชนีรายวัน: วันไหนมีอะไรบ้าง กี่นาที เพดานเท่าไหร่ และวันไหนคือวันสอบ
// allocationsOf ฉีดเข้ามาเพื่อไม่ให้ไฟล์นี้ต้องรู้วิธีแตก topic_indexes/topic_minutes ของ component
export function buildCalendarIndex(plans, allocationsOf) {
  const byDate = new Map();
  const touch = (date) => {
    if (!byDate.has(date)) byDate.set(date, { study: [], exams: [], minutes: 0, capacity: 0, planIds: new Set() });
    return byDate.get(date);
  };

  plans.forEach((plan, planIndex) => {
    // ไม่ต้องเรียงก่อน: ปฏิทินจัดกลุ่มตามวันที่อยู่แล้ว ลำดับไม่มีผล
    (Array.isArray(plan?.items) ? plan.items : []).forEach((item) => {
      if (!DATE_ONLY.test(item.scheduled_date || '')) return;
      const allocations = allocationsOf(plan, item);
      const minutes = allocations.reduce((sum, a) => sum + a.minutes, 0);
      const cell = touch(item.scheduled_date);
      cell.study.push({ plan, planIndex, item, allocations, minutes });

      // วันที่ทำไปแล้ว/ข้ามแล้วไม่นับเป็นภาระที่เหลือ — ไม่งั้นอาทิตย์ที่ผ่านมาก็ยังแดงค้างอยู่
      if (item.status === 'scheduled') {
        cell.minutes += minutes;
        // เพดานของวันนี้ = ผลรวมเวลาที่เจ้าตัวตั้งไว้ของ "วิชาที่ลงวันนี้" นับวิชาละครั้งเดียว
        // (วิชาเดียวลงสองรายการในวันเดียวกัน ไม่ได้แปลว่าเจ้าตัวไหวเป็นสองเท่า)
        if (!cell.planIds.has(plan.id)) {
          cell.planIds.add(plan.id);
          cell.capacity += Number(plan.minutes_per_day) || 0;
        }
      }
    });
    if (DATE_ONLY.test(plan.exam_date || '')) touch(plan.exam_date).exams.push({ plan, planIndex });
  });

  return byDate;
}

// 'none' ว่าง · 'ok' อยู่ในเพดาน · 'heavy' เกินเพดาน · 'overloaded' เกินเพดานเกินครึ่ง
export function cellLoad(cell) {
  if (!cell || cell.minutes === 0 || cell.capacity === 0) return 'none';
  if (cell.minutes > cell.capacity * OVERLOAD_RATIO) return 'overloaded';
  if (cell.minutes > cell.capacity) return 'heavy';
  return 'ok';
}

// วันที่ยังมาไม่ถึงและแน่นเกินเพดาน — ใช้ขึ้นแถบเตือนก่อนตาราง
export function heavyDaysFrom(index, fromDate) {
  return [...index.entries()].filter(([date, cell]) => {
    if (date < fromDate) return false;
    const load = cellLoad(cell);
    return load === 'heavy' || load === 'overloaded';
  });
}
