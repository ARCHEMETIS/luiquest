// สถานะ "ติดตั้งแอพลงหน้าจอโฮมได้ไหม" — ที่เดียวของทั้งแอพ
//
// ทำไมต้องเป็นโมดูลกลาง ไม่ใช่ state ในคอมโพเนนต์: event `beforeinstallprompt` ยิงครั้งเดียว
// และมักยิง "ก่อน" React mount เสร็จ ถ้าไปดักใน useEffect ของคอมโพเนนต์จะพลาด event ไปเลย
// ดักที่ระดับโมดูล (รันตอน import) จึงเก็บทัน แล้วค่อยแจกให้คนที่สนใจทีหลัง
//
// ตอนนี้มีสองที่ที่ต้องรู้: การ์ดชวนติดตั้ง (InstallPrompt) กับผีน้อยที่แถบล่าง (NavMascot)

const DISMISS_KEY = 'luiquest_install_dismissed_at';
// กดปิดแล้วเงียบ 14 วัน — ไม่ใช่ปิดถาวร เพราะคนมักปิดตอนยังไม่รู้จักแอพดีพอ
const SNOOZE_DAYS = 14;

let deferredEvent = null;
const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb());
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS ใช้ property ของตัวเอง ไม่ใช่ media query
  );
}

export function isIos() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function snoozedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at ? Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000 : false;
  } catch {
    return false; // โหมดส่วนตัวบางเบราว์เซอร์อ่าน localStorage ไม่ได้ — ถือว่ายังไม่เคยปิด
  }
}

export function snooze() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // เขียนไม่ได้ก็ไม่เป็นไร แค่จะถูกชวนอีกรอบหน้า
  }
  notify();
}

/** ชวนติดตั้งได้จริงไหม (Chrome/Android ที่ยังไม่ติดตั้งและยังไม่เพิ่งกดปิด) */
export function canInstall() {
  return !!deferredEvent && !isStandalone() && !snoozedRecently();
}

/** iOS ติดตั้งได้แต่กดปุ่มแทนไม่ได้ ต้องสอนให้กดแชร์เอง (Safari ไม่มี beforeinstallprompt) */
export function needsIosHint() {
  return isIos() && !isStandalone() && !snoozedRecently();
}

/** เรียกกล่องติดตั้งของเบราว์เซอร์ — ใช้ได้ครั้งเดียวต่อ event ที่เก็บไว้ */
export async function promptInstall() {
  if (!deferredEvent) return 'unavailable';
  const evt = deferredEvent;
  deferredEvent = null; // ใช้แล้วทิ้ง เรียกซ้ำ event เดิมไม่ได้
  notify();
  evt.prompt();
  const choice = await evt.userChoice.catch(() => null);
  return choice?.outcome ?? 'dismissed';
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // กันแถบของเบราว์เซอร์เด้งเอง เดี๋ยวเราชวนเองด้วยการ์ดที่เข้ากับแอพ
    deferredEvent = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    snooze(); // ติดตั้งแล้วไม่ต้องชวนอีก
  });
}
