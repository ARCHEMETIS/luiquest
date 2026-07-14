// Helper เวลาโซนไทย — ใช้คำนวณ streak (วันติดต่อกัน) และ "วันนี้" ตามเวลาไทย ไม่ใช่ UTC
const TZ = 'Asia/Bangkok';

function tzOffsetMs(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce((a, p) => ((a[p.type] = p.value), a), {});
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUTC - date.getTime();
}

// "YYYY-MM-DD" ตามเวลาไทย
export function bangkokDateStr(d = new Date()) {
  const off = tzOffsetMs(d, TZ);
  return new Date(d.getTime() + off).toISOString().slice(0, 10);
}

export function prevDateStr(s) {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10);
}

// เที่ยงคืนไทยถัดไป (ISO) — ใช้บอกเวลารีเซ็ตโควต้าแชท
export function nextBangkokMidnightISO() {
  const now = new Date();
  const off = tzOffsetMs(now, TZ);
  const wallNow = new Date(now.getTime() + off);
  const nextWall = Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate() + 1, 0, 0, 0);
  return new Date(nextWall - off).toISOString();
}

export function startOfBangkokDayISO(d = new Date()) {
  const off = tzOffsetMs(d, TZ);
  const wall = new Date(d.getTime() + off);
  const startWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), 0, 0, 0);
  return new Date(startWall - off).toISOString();
}
