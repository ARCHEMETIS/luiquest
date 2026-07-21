// หน้าอันดับ (leaderboard) ของลุยเควส (ticket #6) — mock data ด้านล่าง ฝั่งโค้ดต่อ API จริงเองภายหลัง
// แสดงอันดับ XP สะสมรวมทั้งแอพ: top 3 เป็นแท่นรางวัล + แถวอันดับ 4 เป็นต้นไป
// states: loading (skeleton) | ready (คนเยอะ ตัวเองอันดับลึก — มีการ์ด pin ลอยล่างจอ กดแล้วเลื่อนไปหาแถวตัวเอง)
//         | few (แอพเพิ่งเปิด คนน้อย ~5 คน — เก้าอี้ว่าง + มาสคอตชวนเพื่อนมาเติมอันดับ ไม่ปล่อยให้โล่งเหงา)
// การ์ด pin ซ่อนตัวเองอัตโนมัติเมื่อแถวของเราเลื่อนเข้ามาในจอ (IntersectionObserver)

import { useEffect, useRef, useState } from "react";
import GhostMascot from "./GhostMascot";


const EMPTY_SEAT_COUNT = 2; // เก้าอี้ว่างต่อท้ายกระดานตอนคนน้อย — 5 คน → อันดับว่าง 6 กับ 7 (ตั้งใจให้เข้ามุก 6/7 ของมาสคอต)


// สีเหรียญ top 3 — ทอง/เงิน/ทองแดง พร้อมสีเงาพิกเซลทึบของแต่ละเหรียญ
const MEDAL = {
  1: { color: "#FBBF24", shadow: "#B45309" },
  2: { color: "#94A3B8", shadow: "#64748B" },
  3: { color: "#D97706", shadow: "#92400E" },
};

// path จาก Heroicons 24/outline (assets/heroicons — MIT): trophy, user-plus, arrow-up
const ICON_PATHS = {
  trophy: [
    "M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0",
  ],
  userPlus: [
    "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z",
  ],
  arrowUp: ["M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"],
  arrowDown: ["M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"],
};

const Icon = ({ name, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={className}>
    {ICON_PATHS[name].map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

const Avatar = ({ name, className = "h-9 w-9 text-xs" }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-200 to-pink-200 font-heading font-bold text-[#831843] ${className}`}
  >
    {name.charAt(0)}
  </span>
);

// วงแหวนสีเหรียญรอบรูป top 3 — ให้สีเหรียญเกาะที่ตัวคนเลย ไม่ใช่แค่เลขอันดับ
const MEDAL_RING = { 1: "ring-[#FBBF24]", 2: "ring-[#94A3B8]", 3: "ring-[#D97706]" };

// นับ XP วิ่งขึ้นจาก 0 ถึงค่าจริง — ดีเลย์ผูกกับจังหวะป๊อปเข้าของการ์ด/แถว ให้ตัวเลขเริ่มนับพอดีตอนเห็น
const useCountUp = (target, delayMs = 0, durationMs = 700) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    let raf;
    let start;
    const timer = setTimeout(() => {
      const tick = (t) => {
        if (start === undefined) start = t;
        const progress = Math.min((t - start) / durationMs, 1);
        setValue(Math.round(target * (1 - Math.pow(1 - progress, 3)))); // ease-out cubic
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, delayMs, durationMs]);
  return value;
};

const XPCount = ({ value, delay = 0, className }) => {
  const shown = useCountUp(value, delay);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {shown.toLocaleString()} XP
    </span>
  );
};

const MeBadge = () => (
  <span className="shrink-0 rounded-full bg-[#8B5CF6] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">คุณ</span>
);

// avatar header ของตัวเอง — โทนเข้ม+ตัวหนังสือขาว ให้ตรงกับ avatar หัวจอของหน้าเควส (ไม่ใช่โทนพาสเทลแบบ Avatar ในลิสต์)
const HeaderAvatar = ({ name, className = "h-10 w-10 text-sm" }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-400 font-heading font-bold text-white ${className}`}
  >
    {name.charAt(0)}
  </span>
);

// เลขอันดับเหรียญ top 3 — ตัวใหญ่ เงาพิกเซลทึบตามสีเหรียญ
const MedalRank = ({ rank, className = "text-2xl" }) => (
  <span
    className={`font-heading font-bold leading-none ${className}`}
    style={{ color: MEDAL[rank].color, textShadow: `2px 2px 0 ${MEDAL[rank].shadow}` }}
  >
    {rank}
  </span>
);

// ประกายรอบเหรียญ top 3 — จำนวน/ระยะ/ดีเลย์ผูกกับ rank เอง (แชมป์ได้เยอะสุด+ไกลสุด ตามหลัก "เอฟเฟกต์ต้องใหญ่ใจถึง" ของมาสคอต)
const MEDAL_SPARKS = {
  1: [
    { left: "-34%", top: "6%", delay: "0s", travel: 48, char: "✦" },
    { right: "-30%", top: "0%", delay: ".35s", travel: 44, char: "✧" },
    { left: "-16%", top: "78%", delay: ".7s", travel: 40, char: "✦" },
    { right: "-20%", top: "72%", delay: "1.05s", travel: 46, char: "✧" },
  ],
  2: [
    { left: "-20%", top: "10%", delay: ".15s", travel: 34, char: "✧" },
    { right: "-18%", top: "60%", delay: ".55s", travel: 30, char: "✦" },
  ],
  3: [
    { right: "-20%", top: "8%", delay: ".25s", travel: 34, char: "✧" },
    { left: "-18%", top: "62%", delay: ".6s", travel: 30, char: "✦" },
  ],
};

// การ์ดแท่นรางวัล 1 ใบ — อันดับ 1 ใบใหญ่ตรงกลาง มีมงกุฎเด้งบนหัว + วงแหวนไฟหมุนรอบขอบ
// meRef แปะเฉพาะใบที่เป็นตัวเรา (เผื่อกรณีตัวเองติด top 3) เพื่อให้การ์ด pin ล่างจอรู้ว่าแถวเราอยู่ในจอหรือยัง
// flash = true ชั่วคราวตอนกด pin แล้วเลื่อนมาถึง (เฉพาะใบที่เป็น entry.me) ให้เห็นชัดว่า "นี่แหละแถวเรา"
const PodiumCard = ({ entry, rank, meRef, flash }) => {
  if (!entry) return <div aria-hidden="true" />; // กันพัง — กระดานบางกว่า 3 คน (เช่น แอพเพิ่งเปิดวันแรกสุด)
  const first = rank === 1;
  return (
    <div className="relative">
      {/* วงแหวนไฟหมุนรอบการ์ดแชมป์ — ทอง→ส้มไล่โปร่งใส หมุนแบบพิกเซล (steps) ไม่ลื่นแบบ ease */}
      {first && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-2xl blur-[2px]"
          style={{
            backgroundImage: "conic-gradient(from 0deg, transparent, #FBBF24 15%, #F97316 25%, transparent 40%, transparent 75%, #FBBF24 90%, transparent 100%)",
            animation: "lb-fire-spin 2.6s steps(24) infinite",
            zIndex: -1,
          }}
        />
      )}
      <div
        ref={entry.me ? meRef : undefined}
        className={`relative flex flex-col items-center rounded-2xl border-2 bg-white/90 px-2 text-center ${
          first
            ? "border-[#FBBF24] py-4 shadow-[0_10px_24px_rgba(251,191,36,.35)]"
            : `mt-7 py-3 ${entry.me ? "border-[#8B5CF6] shadow-[0_8px_20px_rgba(139,92,246,.18)]" : "border-[#FBCFE8]"}`
        }`}
        style={{ animation: "lb-pop-in .45s ease-out both", animationDelay: `${rank * 90}ms` }}
      >
        {entry.me && flash && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{ animation: "lb-flash 1s ease-out" }} />
        )}
        {first && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-6 text-2xl"
            style={{ animation: "lb-crown 1.2s steps(2) infinite" }}
          >
            👑
          </span>
        )}
        {MEDAL_SPARKS[rank].map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`pointer-events-none absolute ${first ? "text-base" : "text-xs"}`}
            style={{
              left: s.left,
              right: s.right,
              top: s.top,
              color: MEDAL[rank].color,
              textShadow: `1px 1px 0 ${MEDAL[rank].shadow}`,
              "--lb-travel": `-${s.travel}px`,
              animation: `lb-spark 1.6s steps(6) ${s.delay} infinite`,
            }}
          >
            {s.char}
          </span>
        ))}
        <MedalRank rank={rank} className={first ? "text-3xl" : "text-2xl"} />
        <Avatar
          name={entry.name}
          className={`mt-2 ring-[3px] ring-offset-2 ring-offset-white/90 ${MEDAL_RING[rank]} ${first ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm"}`}
        />
        <span className="mt-1.5 flex w-full items-center justify-center gap-1">
          {entry.me && <MeBadge />}
          <span className="truncate text-[11px] font-bold text-[#831843]">{entry.name}</span>
        </span>
        <XPCount value={entry.xp} delay={rank * 90 + 150} className="text-[10px] text-[#9D5C7C]" />
      </div>
    </div>
  );
};

// แถวอันดับ 4 เป็นต้นไป — แถวของเราขอบม่วง + badge "คุณ"
// flash = true ชั่วคราวตอนกด pin แล้วเลื่อนมาถึง (เฉพาะแถวที่เป็น entry.me)
const BoardRow = ({ entry, rank, meRef, index, flash }) => (
  <div
    ref={entry.me ? meRef : undefined}
    className={`relative flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 ${
      entry.me ? "border-[#8B5CF6] bg-white shadow-[0_8px_20px_rgba(139,92,246,.18)]" : "border-[#FBCFE8] bg-white/70"
    }`}
    style={{ animation: "lb-in .3s ease-out both", animationDelay: `${Math.min(index, 12) * 35}ms` }}
  >
    {entry.me && flash && (
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{ animation: "lb-flash 1s ease-out" }} />
    )}
    <span
      className={`w-7 shrink-0 text-center font-heading text-sm font-bold ${entry.me ? "text-[#8B5CF6]" : "text-[#9D5C7C]"}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {rank}
    </span>
    <Avatar name={entry.name} />
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="truncate text-[13px] font-bold text-[#831843]">{entry.name}</span>
      {entry.me && <MeBadge />}
    </span>
    <XPCount
      value={entry.xp}
      delay={Math.min(index, 12) * 35 + 100}
      className={`shrink-0 text-xs font-bold ${entry.me ? "text-[#8B5CF6]" : "text-[#9D5C7C]"}`}
    />
  </div>
);

// เก้าอี้ว่างตอนคนน้อย — โชว์ว่ากระดานยังมีที่ ไม่ใช่บั๊กข้อมูลหาย
// เรืองแสงจางๆ วนช้าๆ (ease ไม่ใช่ steps — ไม่ใช่ตัวมาสคอต) ดึงสายตาไล่ลงไปหาปุ่มชวนเพื่อนด้านล่าง
const EmptySeatRow = ({ rank, delay = 0 }) => (
  <div
    className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#FBCFE8] bg-white/40 px-3.5 py-2.5"
    style={{ animation: `lb-seat-glow 2.4s ease-in-out ${delay}s infinite` }}
  >
    <span className="w-7 shrink-0 text-center font-heading text-sm font-bold text-[#FBCFE8]" style={{ fontVariantNumeric: "tabular-nums" }}>
      {rank}
    </span>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#FBCFE8] font-heading text-sm font-bold text-[#FBCFE8]">
      ?
    </span>
    <span className="text-[12px] text-[#9D5C7C]/70">ที่นั่งว่าง — รอเพื่อนคุณอยู่</span>
  </div>
);

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-[#FBCFE8]/50 ${className}`} />;

export default function LeaderboardPage({ rows, loading = false, error = null, currentUserId, currentUserName, onInvite, showStateToggle = false, heightClass = "min-h-dvh" }) {
  const [meInView, setMeInView] = useState(false);
  const [meDir, setMeDir] = useState("down"); // แถวของเราอยู่ทางไหนของจอ — ให้ลูกศรบนการ์ด pin ชี้ถูกทาง
  const [justJumped, setJustJumped] = useState(false); // true ชั่วคราวตอนกด pin แล้วเลื่อนมาถึงแถวตัวเอง — ให้แถวกระพริบเรืองแสง
  const meRowRef = useRef(null);
  const jumpTimers = useRef({});

  // ต่อ view `leaderboard` จริงแล้ว — map แต่ละแถวเป็น { name, xp, me } (rank = ลำดับใน array), highlight แถวตัวเองจาก currentUserId
  const board = (rows ?? []).map((r) => ({ id: r.user_id, name: r.display_name || "ผู้ใช้ลุยเควส", xp: r.total_xp, rank: Number(r.rank), me: r.user_id === currentUserId }));
  const isLoading = loading || (!rows && !error);
  // คนน้อย → โหมด "few" (เก้าอี้ว่าง + ชวนเพื่อน ไม่โล่งเหงา), คนเยอะ → "ready" (การ์ด pin หาแถวตัวเอง)
  const ui = isLoading ? "loading" : board.length < 10 ? "few" : "ready";
  // findIndex ครั้งเดียวพอ, fallback อันดับ 1 ถ้าบอร์ดไม่มีแถวตัวเอง; กันพังตอนบอร์ดว่างด้วย ?? ก้อน default
  const meFoundIndex = board.findIndex((e) => e.me);
  const meFound = meFoundIndex >= 0;
  const meIndex = Math.max(meFoundIndex, 0);
  // ถ้าแถวตัวเองไม่อยู่ในบอร์ด (ยังไม่ติดอันดับ / ปิด leaderboard) ใช้ชื่อจริงจากโปรไฟล์ ไม่แอบอ้างอันดับของคนอื่น
  const me = meFound ? board[meIndex] : { id: currentUserId, name: currentUserName || "คุณ", xp: 0, rank: null, me: true };
  const meRank = me.rank ?? meIndex + 1; // ใช้อันดับจริงจาก view — คนอันดับลึกกว่า top slice จะไม่ถูกนับใหม่เป็น #(slice+1)
  const chaseTarget = meFound && meIndex > 0 ? board[meIndex - 1] : null; // คนที่อยู่เหนือเราหนึ่งอันดับ
  const chaseAdjacent = !!chaseTarget && chaseTarget.rank === meRank - 1; // ติดกันจริงเท่านั้นถึงโชว์ "ตามอีก X XP" (กันเพี้ยนตอนแถวเราถูก append ท้าย top slice)
  const chaseGap = chaseTarget ? chaseTarget.xp - me.xp : 0; // XP ที่ต้องแซง (เท่ากับพอดีคือเสมอ ไม่ใช่แซง)
  const seatStart = board.length + 1; // อันดับแรกที่ยังว่างต่อจากคนสุดท้ายในกระดาน (state few)

  // การ์ด pin โชว์เฉพาะตอนแถวของเราอยู่นอกจอ — แถวเลื่อนเข้ามาเมื่อไหร่ก็หลบให้เอง
  // meRowRef ถูกแปะทั้งจาก PodiumCard (ถ้าตัวเองติด top 3) และ BoardRow (อันดับ 4+) แล้วแต่ว่าใครตรงกับ entry.me
  useEffect(() => {
    setMeInView(false);
    if (ui !== "ready") return;
    const el = meRowRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]; // เอา record ล่าสุด กันกรณี batch เก่าค้างคิว
        setMeInView(entry.isIntersecting);
        if (!entry.isIntersecting) setMeDir(entry.boundingClientRect.top > 0 ? "down" : "up");
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ui]);

  const showPin = ui === "ready" && !meInView && meFound; // ไม่มีแถวตัวเองในบอร์ด = ไม่มีอะไรให้เลื่อนไปหา

  // หา scroll container จริงที่ครอบ el อยู่ — เดิม hardcode window ไว้ ใช้ได้ตอน standalone (หน้าเดี่ยว ๆ ไม่มีอะไรครอบ เลื่อนที่ window ปกติ)
  // แต่พอฝังใน AppShell (ticket #10) ตัวที่เลื่อนจริงคือ <main overflow-y-auto> ของเชลล์ ไม่ใช่ window อีกต่อไป (window/document ไม่ขยับเลย)
  // เลยต้องไต่ขึ้นไปหา ancestor ที่ scroll ได้จริงเอง ไม่ผูกกับ window ตรง ๆ — ถ้าไม่เจอเลย fallback เป็น document.scrollingElement เหมือนเดิม
  const getScrollAncestor = (node) => {
    let el = node && node.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };
  const isWindowScroller = (scroller) => scroller === document.documentElement || scroller === document.body;
  const getScrollTop = (scroller) => (isWindowScroller(scroller) ? window.scrollY : scroller.scrollTop);
  const setScrollTop = (scroller, y) => (isWindowScroller(scroller) ? window.scrollTo(0, y) : (scroller.scrollTop = y));
  const getViewportHeight = (scroller) => (isWindowScroller(scroller) ? window.innerHeight : scroller.clientHeight);

  // เลื่อนไปหาแถวตัวเองแบบคุมจังหวะเอง (rAF + ease-out) แทนพึ่ง native scrollIntoView({behavior:"smooth"})
  // เพราะบาง browser/OS (เช่น ปิด "แสดงภาพเคลื่อนไหว" ใน Windows) ลดงานเคลื่อนไหวให้กลายเป็นกระโดดทันทีเงียบๆ
  // โดยไม่บอกโค้ดเลย — คุมเองแล้วรู้ duration แน่ๆ เลยจับจังหวะกระพริบตอนเลื่อนถึงได้แม่นด้วย (ไม่ต้องเดา delay)
  // ยังเคารพ prefers-reduced-motion เองอยู่ดี ไม่ได้ไปข้ามการตั้งค่าการช่วยเหลือพิเศษของผู้ใช้
  const scrollToMe = () => {
    const el = meRowRef.current;
    if (!el) return;
    const scroller = getScrollAncestor(el);
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = el.getBoundingClientRect();
    const currentY = getScrollTop(scroller);
    const targetY = currentY + rect.top - getViewportHeight(scroller) / 2 + rect.height / 2;

    clearTimeout(jumpTimers.current.start);
    clearTimeout(jumpTimers.current.end);
    setJustJumped(false);

    if (reduceMotion) {
      setScrollTop(scroller, targetY);
      jumpTimers.current.start = setTimeout(() => {
        setJustJumped(true);
        jumpTimers.current.end = setTimeout(() => setJustJumped(false), 1000);
      }, 80);
      return;
    }

    const startY = currentY;
    const distance = targetY - startY;
    const duration = 650;
    let start;
    const step = (t) => {
      if (start === undefined) start = t;
      const progress = Math.min((t - start) / duration, 1);
      setScrollTop(scroller, startY + distance * (1 - Math.pow(1 - progress, 3))); // ease-out cubic
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    jumpTimers.current.start = setTimeout(() => {
      setJustJumped(true);
      jumpTimers.current.end = setTimeout(() => setJustJumped(false), 1000);
    }, duration);
  };

  useEffect(() => {
    const timers = jumpTimers.current;
    return () => {
      clearTimeout(timers.start);
      clearTimeout(timers.end);
    };
  }, []);

  return (
    <div
      className={`relative flex ${heightClass} flex-col overflow-hidden font-body text-[#831843]`}
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
        @keyframes lb-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes lb-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.75); } 65% { opacity: 1; transform: translateY(-3px) scale(1.06); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes lb-crown { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-4px) rotate(4deg); } }
        @keyframes lb-fire-spin { to { transform: rotate(360deg); } }
        @keyframes lb-spark { 0% { opacity: 0; transform: translateY(0) scale(.4) rotate(0deg); } 30% { opacity: 1; transform: translateY(calc(var(--lb-travel) * .3)) scale(1.15) rotate(18deg); } 100% { opacity: 0; transform: translateY(var(--lb-travel)) scale(.85) rotate(-12deg); } }
        @keyframes lb-pin-in { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes lb-arrow-flow { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        @keyframes lb-flash { 0% { box-shadow: 0 0 0 0 rgba(139,92,246,.55); } 60% { box-shadow: 0 0 0 10px rgba(139,92,246,0); } 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); } }
        @keyframes lb-seat-glow { 0%, 100% { border-color: #FBCFE8; box-shadow: 0 0 0 0 rgba(139,92,246,0); } 50% { border-color: #F9A8D4; box-shadow: 0 0 14px 1px rgba(139,92,246,.18); } }
      `}</style>

      {ui === "loading" ? (
        /* ---------- skeleton — จองที่ตามโครงจริง (แท่นรางวัล + แถว) กัน layout เด้ง ---------- */
        <main className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 md:max-w-xl ${showStateToggle ? "pt-14" : "pt-6"}`}>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <div className="mt-5 grid grid-cols-3 items-end gap-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-36" />
            <Skeleton className="h-28" />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-[58px]" /> <Skeleton className="h-[58px]" /> <Skeleton className="h-[58px]" />
            <Skeleton className="h-[58px]" /> <Skeleton className="h-[58px]" /> <Skeleton className="h-[58px]" />
          </div>
        </main>
      ) : (
        /* ---------- กระดานอันดับ (ready / few ใช้โครงเดียวกัน ต่างที่ข้อมูล + ของท้ายลิสต์) ---------- */
        <main
          className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 md:max-w-xl ${showStateToggle ? "pt-14" : "pt-6"} ${
            ui === "ready" ? "pb-28" : "pb-8"
          }`}
        >
          {/* header: ชื่อหน้า + avatar ของเรา (โครงเดียวกับหน้าเควส) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#9D5C7C]">
                XP สะสมรวมทั้งแอพ • {board.length.toLocaleString()} คน
              </p>
              <h1 className="flex items-center gap-1.5 font-heading text-xl font-bold">
                <Icon name="trophy" className="h-5 w-5 text-[#FBBF24]" />
                อันดับ
              </h1>
            </div>
            <HeaderAvatar name={me.name} />
          </div>

          {/* แท่นรางวัล top 3 — เรียง 2/1/3 ให้แชมป์อยู่กลางและสูงสุด (การ์ดที่ไม่มีคนครองยังไม่พังเพราะ PodiumCard กันพังเอง) */}
          <div className="mt-5 grid grid-cols-3 items-start gap-2">
            <PodiumCard entry={board[1]} rank={2} meRef={meRowRef} flash={justJumped} />
            <PodiumCard entry={board[0]} rank={1} meRef={meRowRef} flash={justJumped} />
            <PodiumCard entry={board[2]} rank={3} meRef={meRowRef} flash={justJumped} />
          </div>

          {/* คนน้อย + เรายังไม่ใช่ที่ 1 → แซะเบา ๆ ว่าแชมป์อยู่แค่เอื้อม (เลขอันดับ/ชื่อคนที่แซง derive จาก meRank จริง ไม่ล็อค #1) */}
          {ui === "few" && chaseAdjacent && (
            <p className="mt-3 text-center text-[11px] text-[#9D5C7C]" style={{ animation: "lb-in .3s ease-out .25s both" }}>
              อีกแค่ <span className="font-heading font-bold text-[#8B5CF6]">{(chaseGap + 1).toLocaleString()} XP</span> คุณก็แซง{" "}
              {chaseTarget.name.split(" ")[0]} ขึ้น #{meRank - 1} แล้วนะ
            </p>
          )}

          {/* อันดับ 4 เป็นต้นไป */}
          <div className="mt-4 flex flex-col gap-2">
            {board.slice(3).map((entry, i) => (
              <BoardRow key={entry.id ?? entry.name} entry={entry} rank={entry.rank ?? i + 4} index={i} meRef={meRowRef} flash={justJumped} />
            ))}
            {ui === "few" &&
              Array.from({ length: EMPTY_SEAT_COUNT }, (_, i) => <EmptySeatRow key={i} rank={seatStart + i} delay={i * 0.4} />)}
          </div>

          {/* คนน้อย: มาสคอตท่า 6/7 ชี้ไปที่อันดับว่าง 6-7 + CTA ชวนเพื่อน — กระดานโล่งคือโอกาส ไม่ใช่ความเหงา
              ท่า sixseven โชว์เลข 6/7 ตายตัวจากตัวมาสคอตเอง เลยใช้มุกนี้เฉพาะตอนที่นั่งว่างจริง ๆ คือ 6 กับ 7 พอดี
              (ตอนนี้คือ 5 คน) ถ้าจำนวนคนจริงเปลี่ยนจนไม่ตรงมุก ให้ผีทำท่า idle เฉย ๆ แทน ไม่ให้เลขในหัวข้อขัดกับตัวมาสคอต */}
          {ui === "few" && (
            <div
              className="mt-4 flex flex-col items-center rounded-2xl border-2 border-[#FBCFE8] bg-white/80 px-5 pb-5 pt-8 text-center"
              style={{ animation: "lb-in .35s ease-out .2s both" }}
            >
              <GhostMascot mood={seatStart === 6 ? "sixseven" : "idle"} className="scale-90" />
              <h2 className="mt-3 font-heading text-[15px] font-bold">
                อันดับ {seatStart} กับ {seatStart + 1} ยังว่างอยู่เลย
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">
                ช่วงนี้คนยังน้อย ขึ้น Top 3 ง่ายสุด ๆ — ชวนเพื่อนมาแข่งกัน
                <br />
                สมัครผ่านลิงก์คุณปุ๊บ ได้ XP กันทั้งคู่เลย
              </p>
              <button
                onClick={() => onInvite?.()}
                className="mt-4 flex w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
              >
                <Icon name="userPlus" className="h-4 w-4" />
                ชวนเพื่อนมาแข่ง
              </button>
            </div>
          )}
        </main>
      )}

      {/* การ์ด pin อันดับของเรา — ลอยล่างจอตอนแถวจริงอยู่นอกสายตา กดแล้วเลื่อนไปหา */}
      {showPin && (
        // bottom คำนวณผ่าน CSS var --shell-bottom-offset (ตั้งจาก AppShell ตอนฝัง เผื่อที่ให้ bottom nav) — standalone ไม่มีตัวแปรนี้ก็ fallback เป็น 0 เหมือนเดิม
        <div
          className="pointer-events-none fixed inset-x-0 z-10 flex justify-center px-6"
          style={{ bottom: "calc(16px + var(--shell-bottom-offset, 0px))" }}
        >
          <button
            onClick={scrollToMe}
            aria-label={`อันดับของคุณคือ ${meRank} — กดเพื่อเลื่อนไปดู`}
            className="pointer-events-auto flex w-full max-w-md cursor-pointer items-center gap-3 rounded-2xl border-2 border-[#8B5CF6] bg-white px-3.5 py-2.5 text-left shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] active:translate-y-px md:max-w-xl"
            style={{ animation: "lb-pin-in .3s ease-out both" }}
          >
            <span className="w-9 shrink-0 text-center font-heading text-lg font-bold text-[#8B5CF6]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {meRank}
            </span>
            <Avatar name={me.name} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold text-[#831843]">{me.name}</span>
                <MeBadge />
              </span>
              {chaseAdjacent && (
                <span className="block text-[10px] text-[#9D5C7C]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  ตามอันดับ {meRank - 1} อยู่แค่ {chaseGap.toLocaleString()} XP
                </span>
              )}
            </span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{
                backgroundImage: "linear-gradient(90deg, #8B5CF6, #EC4899, #8B5CF6)",
                backgroundSize: "200% 100%",
                animation: "lb-arrow-flow 2.2s linear infinite",
              }}
            >
              <Icon name={meDir === "up" ? "arrowUp" : "arrowDown"} className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
