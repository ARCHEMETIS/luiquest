// หน้าการ์ดแชร์ streak ของลุยเควส (ticket #8 — design-brief section 3.9) — mock data ด้านล่าง ฝั่งโค้ดต่อ backend จริงเองภายหลัง
// states: streak (มี streak ให้อวด) | zero (streak ขาด/ยังไม่เริ่ม — การ์ดสลับไปอวด XP รวมแทน ไม่โชว์เลข 0)
// การ์ดคือ "ป้ายโฆษณาเคลื่อนที่" ของแอพ — ตั้งใจให้ตัดขาดจากโทนพาสเทลปกติ ใช้กราเดียนต์ม่วง-ชมพู-ทองเข้มแบบโปสเตอร์แทน
// เลข streak เริ่มต้น (7) ตั้งใจให้ต่อเนื่องจากปุ่ม "แชร์การ์ด streak" ใน DailyQuestPage state done (newStreak: 7)

import { useEffect, useRef, useState } from "react";
import GhostMascot from "./GhostMascot";
import { LuiQuestFavicon } from "./LuiQuestLogo";

// tagline แบรนด์ประจำการ์ด (ข้อมูลผู้ใช้จริง — streak/xp/ชื่อ/ลิงก์ชวน — มาจาก props)
const DEFAULT_TAGLINE = "อยากเก่งอะไร ลุยเลย — วันละเควส";

const SHARE_CHANNELS = [
  { id: "line", label: "LINE", className: "bg-[#06C755] text-white" },
  { id: "instagram", label: "IG", className: "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white" },
  { id: "other", label: "อื่นๆ", className: "border border-white/70 bg-white/90 text-[#8B5CF6]" },
];

const BackIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
    />
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke="currentColor" aria-hidden="true" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

// จุดดาวกระพริบลอยพื้นหลังการ์ด (ตำแหน่งตายตัว ให้ดูมีชีวิตแต่ไม่ต้องสุ่ม)
const CARD_STARS = [
  { left: "10%", top: "8%", delay: "0s", size: "14px", char: "✦" },
  { right: "12%", top: "14%", delay: ".4s", size: "10px", char: "✧" },
  { left: "18%", top: "34%", delay: ".9s", size: "9px", char: "✦" },
  { right: "8%", top: "40%", delay: "1.3s", size: "13px", char: "✧" },
  { left: "8%", top: "62%", delay: ".65s", size: "10px", char: "✦" },
  { right: "16%", top: "68%", delay: "1.6s", size: "9px", char: "✧" },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// เอียงการ์ดตามไจโรมือถือ (deviceorientation) — เดสก์ท็อป/เครื่องไม่มีไจโรใช้ตำแหน่งเมาส์แทนให้เห็นเอฟเฟกต์ตอน preview
// iOS 13+ ต้องขอสิทธิ์ผ่าน gesture ก่อนถึงจะฟัง deviceorientation ได้ — ปุ่มเล็ก ๆ มุมการ์ดโผล่เฉพาะตอนต้องขอ
function useCardTilt() {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [needsPermission, setNeedsPermission] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const supportsOrientation = typeof window.DeviceOrientationEvent !== "undefined";
    const needsIOSPermission = supportsOrientation && typeof DeviceOrientationEvent.requestPermission === "function";
    if (needsIOSPermission && !granted) {
      setNeedsPermission(true);
      return;
    }

    if (supportsOrientation && ("ontouchstart" in window || needsIOSPermission)) {
      const onOrient = (e) => {
        if (e.beta == null && e.gamma == null) return;
        // beta ~90° ตอนถือตั้งตรงปกติ — คำนวณ delta จากมุมนั้นแทนมุม 0 เพื่อให้ท่าถือปกติคือการ์ดเรียบ
        const rx = clamp(((e.beta ?? 90) - 90) * -0.22, -9, 9);
        const ry = clamp((e.gamma ?? 0) * 0.32, -11, 11);
        setTilt({ rx, ry });
      };
      window.addEventListener("deviceorientation", onOrient);
      return () => window.removeEventListener("deviceorientation", onOrient);
    }

    const el = cardRef.current;
    const onMove = (e) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ rx: clamp(py * -16, -9, 9), ry: clamp(px * 16, -11, 11) });
    };
    const onLeave = () => setTilt({ rx: 0, ry: 0 });
    el?.addEventListener("mousemove", onMove);
    el?.addEventListener("mouseleave", onLeave);
    return () => {
      el?.removeEventListener("mousemove", onMove);
      el?.removeEventListener("mouseleave", onLeave);
    };
  }, [granted]);

  const requestTilt = () => {
    DeviceOrientationEvent.requestPermission?.()
      .then((state) => {
        setNeedsPermission(false);
        if (state === "granted") setGranted(true);
      })
      .catch(() => setNeedsPermission(false));
  };

  return { cardRef, tilt, needsPermission, requestTilt };
}

function ShareCard({ ui, streakDays, xp, userName, initial, referralLink, tagline }) {
  const isStreak = ui === "streak";
  const { cardRef, tilt, needsPermission, requestTilt } = useCardTilt();

  return (
    <div
      ref={cardRef}
      className="relative mx-auto aspect-[9/16] w-full max-w-[210px] overflow-hidden rounded-[24px] border-4 border-white/40 shadow-[0_16px_36px_rgba(139,92,246,.38)]"
      style={{
        background: "linear-gradient(155deg, #7C3AED 0%, #C026D3 48%, #EC4899 78%, #F59E0B 120%)",
        transform: `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: "transform 120ms ease-out",
      }}
    >
      {/* ดาวกระพริบตกแต่งพื้นหลัง — ตัวการ์ดคือรูปที่จะถูกบันทึก/แชร์ */}
      {CARD_STARS.map((s, i) => (
        <span
          key={i}
          className="pointer-events-none absolute text-white/80"
          style={{ left: s.left, right: s.right, top: s.top, fontSize: s.size, animation: `ssc-twinkle 2.4s ease-in-out ${s.delay} infinite` }}
        >
          {s.char}
        </span>
      ))}
      <div
        className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,.45), transparent 70%)" }}
      />

      {/* แสงกวาดตอนการ์ดโผล่/สลับ state — remount ด้วย key={ui} ให้เล่นซ้ำทุกครั้งที่สลับ */}
      <div
        key={ui}
        aria-hidden="true"
        className="ssc-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3"
        style={{
          background: "linear-gradient(115deg, transparent 10%, rgba(255,255,255,.55) 50%, transparent 90%)",
          animation: "ssc-shimmer-sweep 1.4s cubic-bezier(.2,.7,.3,1) .2s both",
        }}
      />

      {/* ประกายโฮโลแกรม — เลื่อนตามมุมเอียง ให้ความรู้สึกเหมือนการ์ดฟอยล์จริง */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,.5) 45%, rgba(255,255,255,.06) 55%, transparent 70%)",
          backgroundSize: "250% 250%",
          backgroundPosition: `${50 + tilt.ry * 3}% ${50 + tilt.rx * 3}%`,
          mixBlendMode: "overlay",
        }}
      />

      {needsPermission && (
        <button
          onClick={requestTilt}
          aria-label="เปิดเอฟเฟกต์เอียงจอ"
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm transition hover:bg-white/40 active:translate-y-px"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5M16.5 3 21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </button>
      )}

      {/* เนื้อการ์ด — เว้นขอบบน/ล่างกันโดน UI ของ IG story บัง (นาฬิกา/ปุ่มแตะกล้อง) */}
      <div className="relative flex h-full flex-col items-center px-3 pb-3 pt-4 text-center">
        {/* แบรนด์ — ย่อโลโก้ด้วย transform (w-11/h-11 เดิมคง แต่ margin ติดลบดึงพื้นที่ส่วนเกินคืน) */}
        <div className="flex items-center gap-1">
          <LuiQuestFavicon className="-m-3 scale-[0.45]" />
          <span className="font-heading text-xs font-bold text-white">ลุยเควส</span>
        </div>

        {/* เนื้อหาหลัก — มาสคอต + ตัวเลขเด่น
            มาสคอตครอบด้วยกล่องสูงคงที่ (h-14) เพราะ transform scale ไม่ลดพื้นที่ใน layout จริง —
            ครอบแล้วค่อยย่อด้วย scale ข้างในถึงจะกินที่ตามที่เห็นจริง ๆ */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-3 flex h-14 items-center justify-center">
            <GhostMascot mood={isStreak ? "fireworks" : "groove"} className="scale-[0.62]" />
          </div>

          {isStreak ? (
            <>
              <p
                className="font-heading text-6xl font-bold leading-none text-white"
                style={{ textShadow: "3px 3px 0 rgba(76,29,149,.55)" }}
              >
                {streakDays}
              </p>
              <p className="mt-1 font-heading text-sm font-bold text-white" style={{ textShadow: "1.5px 1.5px 0 rgba(76,29,149,.4)" }}>
                วันติดต่อกัน 🔥
              </p>
              <p className="mt-1.5 text-[9px] leading-snug text-white/85">ลุยไม่หยุด ทุกวันคือ XP ที่เพิ่มขึ้น</p>
            </>
          ) : (
            <>
              <p
                className="font-heading text-4xl font-bold leading-none text-white"
                style={{ textShadow: "3px 3px 0 rgba(76,29,149,.55)" }}
              >
                {(xp ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 font-heading text-sm font-bold text-white" style={{ textShadow: "1.5px 1.5px 0 rgba(76,29,149,.4)" }}>
                XP สะสมทั้งหมด ✨
              </p>
              <p className="mt-1.5 text-[9px] leading-snug text-white/85">เริ่มนับ streak ใหม่วันนี้ ลุยกันต่อเลย!</p>
            </>
          )}
        </div>

        {/* แถบผู้ใช้ + ลิงก์ชวน — คอนทราสต์อ่านง่ายบนพื้นกราเดียนต์ */}
        <div className="w-full rounded-xl bg-white/90 px-2.5 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-400 font-heading text-[10px] font-bold text-white">
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-[10px] font-bold text-[#831843]">{userName}</span>
          </div>
          <p className="mt-1 text-[8px] leading-tight text-[#9D5C7C]">{tagline}</p>
          <p className="mt-0.5 truncate text-[8px] font-bold text-[#8B5CF6]">{(referralLink || "").replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
    </div>
  );
}

export default function StreakCardPage({
  streak = 0,
  totalXp = 0,
  userName = "",
  referralLink = "",
  tagline = DEFAULT_TAGLINE,
  onBack,
  onSaveImage,
  onShare,
  showStateToggle = false,
}) {
  // streak > 0 = การ์ดอวด streak, ไม่งั้นสลับไปอวด XP รวม (ไม่โชว์เลข 0) — ตาม state เดิม streak/zero
  const ui = streak > 0 ? "streak" : "zero";
  const initial = (userName || "?").trim().charAt(0).toUpperCase() || "?";
  const [saveMsg, setSaveMsg] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const timers = useRef({});

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const flash = (key, setter, value, ms = 2200) => {
    clearTimeout(timers.current[key]);
    setter(value);
    timers.current[key] = setTimeout(() => setter(""), ms);
  };

  const saveImage = () => {
    onSaveImage?.();
    // ยังไม่ render เป็นไฟล์ภาพจริง (ไม่พึ่ง lib) — บอกวิธีเซฟที่ใช้ได้จริงบนมือถือแทนการหลอกว่าเซฟแล้ว
    flash("save", setSaveMsg, "กดค้างที่การ์ดเพื่อเซฟรูป แล้วเอาไปโพสต์ได้เลย 📸", 3200);
  };

  const share = (channel) => {
    if (navigator.share) {
      onShare?.(channel);
      flash("share", setShareMsg, "เปิดหน้าต่างแชร์ให้แล้ว");
    } else {
      // เดสก์ท็อปไม่มี Web Share — คัดลอกลิงก์ชวนให้จริง
      navigator.clipboard?.writeText(referralLink).catch(() => {});
      flash("share", setShareMsg, `คัดลอกลิงก์ชวนแล้ว เอาไปแชร์ผ่าน ${channel.label} ได้เลย`);
    }
  };

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden font-body text-[#831843]"
      style={{
        backgroundColor: "#FDF2F8",
        backgroundImage: [
          "radial-gradient(ellipse 220px 160px at 8% 4%, rgba(139,92,246,.14), transparent 70%)",
          "radial-gradient(ellipse 200px 180px at 95% 22%, rgba(249,168,212,.30), transparent 70%)",
          "radial-gradient(ellipse 260px 200px at 15% 96%, rgba(236,72,153,.10), transparent 70%)",
        ].join(","),
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        @keyframes ssc-twinkle { 0%,100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes ssc-msg-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes ssc-shimmer-sweep { 0% { transform: translateX(-160%) skewX(-16deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateX(420%) skewX(-16deg); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ssc-shimmer { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      <main className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-5 md:max-w-lg ${showStateToggle ? "pt-12" : "pt-5"}`}>
        {/* หัวจอ: ย้อนกลับ + ชื่อหน้า — ปักไว้บนสุดเสมอ ไม่ลอยตามการจัดกลาง */}
        <div className="mb-1 flex h-8 shrink-0 items-center gap-3">
          <button
            onClick={() => onBack?.()}
            aria-label="ย้อนกลับ"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] transition hover:border-[#8B5CF6]/50 hover:bg-white hover:text-[#8B5CF6] active:translate-y-px"
          >
            <BackIcon />
          </button>
          <h1 className="font-heading text-sm font-bold">การ์ดแชร์ streak</h1>
        </div>

        {/* การ์ด + ปุ่ม action — จัดกลางแนวตั้งในที่ว่างที่เหลือ กันไม่ให้จอสูงเกินดูโหว่ล่าง */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <ShareCard ui={ui} streakDays={streak} xp={totalXp} userName={userName} initial={initial} referralLink={referralLink} tagline={tagline} />

          <div className="mt-4 flex w-full flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {SHARE_CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => share(ch)}
                  className={`flex h-9 items-center justify-center gap-1 rounded-full text-[12px] font-bold transition hover:-translate-y-0.5 active:translate-y-px ${ch.className}`}
                >
                  {ch.id === "other" && <ShareIcon />}
                  {ch.label}
                </button>
              ))}
            </div>
            {shareMsg && (
              <p className="text-center text-[10px] font-bold text-[#8B5CF6]" style={{ animation: "ssc-msg-in .25s ease-out" }}>
                {shareMsg}
              </p>
            )}

            <button
              onClick={saveImage}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#FBCFE8] bg-white/80 py-2 font-heading text-sm font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 active:translate-y-px"
            >
              <SaveIcon />
              บันทึกภาพ
            </button>
            {saveMsg && (
              <p className="text-center text-[10px] font-bold text-[#8B5CF6]" style={{ animation: "ssc-msg-in .25s ease-out" }}>
                {saveMsg}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
