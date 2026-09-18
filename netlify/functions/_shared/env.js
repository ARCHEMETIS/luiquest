// อ่าน environment variable ให้ได้ทั้งบน Netlify runtime และตอนรันด้วย node เปล่า ๆ (เทส/สคริปต์)
//
// เคยก๊อปตัวนี้ซ้ำอยู่ทั้งใน gemini.js และ kkuGateway.js — ถ้าวันหลังต้องเพิ่มอะไร
// (trim ค่า, ใส่ default, เช็ค runtime แบบใหม่) แก้ที่เดียวจะได้ไม่หลุดตัวใดตัวหนึ่ง
// แล้วสอง provider เข้าใจ config ไม่ตรงกันเงียบ ๆ
export function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}
