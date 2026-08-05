// ชวนติดตั้งแอพลงหน้าจอโฮม — การ์ดเล็ก ๆ เด้งขึ้นเหนือ bottom nav พร้อมผีน้อย
//
// ทำไมต้องเขียนเอง ไม่ใช้ของเบราว์เซอร์: Chrome เลิกเด้งแถบ "ติดตั้ง" ให้เองแล้ว
// ต้องดัก event `beforeinstallprompt` เก็บไว้ แล้วเรียก .prompt() ตอนผู้ใช้กดปุ่มของเราเอง
// (ตัวดัก event อยู่ที่ src/lib/installState.js เพราะ event ยิงก่อน React mount ได้)
//
// ★ ข้อจำกัดจริง: iOS ไม่มี event นี้เลย (Safari ไม่รองรับ) จึงต้องแยกเป็นโหมด "สอนให้กดเอง"
//   ผ่านปุ่มแชร์ — ไม่มีทางลัดกว่านี้ ไม่ว่าจะเขียนโค้ดยังไง
import { useEffect, useState } from "react";
import GhostMascot from "./GhostMascot.jsx";
import { canInstall, needsIosHint, promptInstall, snooze, subscribe } from "../lib/installState.js";

// รอให้ผู้ใช้ได้ใช้แอพก่อนค่อยชวน — เด้งทันทีที่เปิดหน้าแรกคือวิธีที่ทำให้คนกดปิดทิ้ง
const SHOW_DELAY_MS = 20000;

// ขนาด grid จริงของ GhostMascot — ต้องย่อด้วย scale เท่านั้น (ดูคอมเมนต์ตรงที่เรียกใช้)
const GHOST_GRID_W = 96;
const GHOST_GRID_H = 108;
const GHOST_SIZE = 44;

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    let timer;
    const evaluate = () => {
      if (visible) return;
      const ios = needsIosHint();
      if (!canInstall() && !ios) return;
      setIosHint(ios);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    evaluate();
    const unsub = subscribe(evaluate);
    // ผีน้อยที่แถบล่างชวนแล้วผู้ใช้กดฟองคำพูด → เด้งการ์ดขึ้นทันที ไม่ต้องรอ 20 วิ
    const openNow = () => {
      setIosHint(needsIosHint());
      setLeaving(false);
      setVisible(true);
    };
    window.addEventListener("luiquest-show-install", openNow);

    return () => {
      clearTimeout(timer);
      unsub();
      window.removeEventListener("luiquest-show-install", openNow);
    };
  }, [visible]);

  const close = () => {
    snooze();
    setLeaving(true);
    setTimeout(() => setVisible(false), 220); // ให้ท่าเลื่อนลงเล่นจบก่อนค่อยถอดออกจากจอ
  };

  const install = async () => {
    await promptInstall();
    close(); // กดติดตั้งหรือกดยกเลิกในกล่องเบราว์เซอร์ก็ตาม รอบนี้พอแล้ว ไม่ตื๊อซ้ำ
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes lq-install-in {
          from { opacity: 0; transform: translateY(24px) scale(.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lq-install-out {
          to { opacity: 0; transform: translateY(24px) scale(.96); }
        }
        @keyframes lq-install-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lq-install-card, .lq-install-ghost { animation: none !important; }
        }
      `}</style>

      {/* เกาะ "หลังคา" ของแถบ nav แบบเดียวกับ NavMascot (พ่อของมันคือ <nav> ที่ตั้ง relative ไว้)
          ห้ามใช้ fixed + --shell-bottom-offset: ตัวแปรนั้นตั้งใน AppShell.jsx ซึ่งเลิกใช้แล้ว
          AppShellLayout ไม่ได้ตั้งให้ ค่าจะกลายเป็น 0 แล้วการ์ดไปทับแถบ nav พอดี */}
      <div
        role="dialog"
        aria-label="ติดตั้งลุยเควสลงหน้าจอโฮม"
        className="pointer-events-none absolute inset-x-0 bottom-full z-30 flex justify-center px-3 pb-3"
      >
        <div
          className="lq-install-card pointer-events-auto relative w-full max-w-sm rounded-2xl border-2 border-[#FBCFE8] bg-white/95 p-3.5 pr-9 shadow-[0_12px_30px_rgba(139,92,246,.22)] backdrop-blur"
          style={{
            animation: leaving
              ? "lq-install-out .22s ease-in forwards"
              : "lq-install-in .42s cubic-bezier(.22,1,.36,1) both",
          }}
        >
          <button
            onClick={close}
            aria-label="ไว้ก่อน"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[#9D5C7C] transition hover:bg-[#FDF2F8] hover:text-[#831843] active:translate-y-px"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            {/* ★ GhostMascot เป็น inline-block ขนาดจริง 96×108 — สั่ง h-/w- ไม่ได้ย่อตัวผี
                กล่องเล็กลงแต่ตัวผียังใหญ่เท่าเดิม แล้วล้นไปทับตัวหนังสือ (เจอบนโน้ตบุ๊ก 5 ส.ค. 2026)
                ต้องย่อด้วย absolute + scale จากมุมบนซ้าย แบบเดียวกับ HeaderMascot ใน AppShellLayout */}
            <span
              className="lq-install-ghost relative inline-block shrink-0 overflow-hidden"
              style={{
                width: GHOST_SIZE,
                height: GHOST_SIZE * (GHOST_GRID_H / GHOST_GRID_W),
                animation: "lq-install-bob 2.2s ease-in-out infinite",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: GHOST_GRID_W,
                  height: GHOST_GRID_H,
                  transform: `scale(${GHOST_SIZE / GHOST_GRID_W})`,
                  transformOrigin: "top left",
                }}
              >
                <GhostMascot mood="celebrate" />
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-heading text-[13px] font-bold leading-snug text-[#831843]">
                เอาลุยเควสไปไว้หน้าจอมั้ย?
              </p>
              {iosHint ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#9D5C7C]">
                  กดปุ่ม <span className="font-bold">แชร์</span> ข้างล่าง แล้วเลือก{" "}
                  <span className="font-bold">เพิ่มไปยังหน้าจอโฮม</span> — เปิดได้เหมือนแอพเลย
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#9D5C7C]">
                  กดครั้งเดียว เปิดได้จากหน้าจอเลย ไม่ต้องพิมพ์ลิงก์ทุกวัน
                </p>
              )}
            </div>

            {!iosHint && (
              <button
                onClick={install}
                className="shrink-0 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_16px_rgba(139,92,246,.35)] transition hover:-translate-y-0.5 active:translate-y-px"
              >
                ติดตั้งเลย
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
