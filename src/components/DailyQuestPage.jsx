// หน้าเควสรายวันของลุยเควส (ticket #4 — design-brief section 3.5) — ต่อ state/API จริงแล้ว (ticket #09)
// states: loading (skeleton) | ready (เควสวันนี้) | notready (generate ไม่ทัน + retry)
//         | done (ทำเสร็จแล้ว celebration) | broken (streak ขาด — โทนปลอบ) | day1 (ผู้ใช้ใหม่ เลขเป็น 0)
// กติกา gating: ต้องติ๊ก checklist ครบทุกข้อ ปุ่มเคลม XP ถึงโผล่ (แบบเดียวกับปุ่มลุยต่อใน OnboardingFlow)
// props จริงส่งมาจาก src/pages/Quest.jsx — ค่า MOCK เหลือไว้เป็น default เผื่อ preview ไม่ส่ง props (showStateToggle)

import { useEffect, useRef, useState } from "react";
import GhostMascot from "./GhostMascot";

const MOCK = {
  dateLabel: "อาทิตย์ 13 ก.ค.",
  topic: "Python",
  userInitial: "พ", // จากชื่อ Google
  quest: {
    title: "วันนี้ลุย: ตัวแปรและ type ใน Python",
    desc: "ทำความรู้จักตัวแปร, string, number, boolean แล้วลองประกาศเองให้คล่องมือ — จบวันนี้อ่านโค้ดคนอื่นรู้เรื่องขึ้นเยอะ",
    minutes: 30,
    xp: 50,
  },
  checklist: [
    { id: "m1", label: "ดูคลิปตัวแปร Python ให้จบ", link_url: null },
    { id: "m2", label: "ประกาศตัวแปรเอง 5 แบบใน REPL", link_url: null },
    { id: "m3", label: "ลองใช้ type() เช็คค่าที่สร้าง", link_url: null },
    { id: "m4", label: "ทำ mini quiz ท้ายบทให้ผ่าน", link_url: null },
  ],
  stats: {
    xp: 1250,
    streak: 6,
    phase: "Phase 2 • พื้นฐานภาษา",
    phasePct: 35,
    rank: "B",
    nextRank: "A",
    rankPct: 72,
    rankXp: "430/600",
    boardRank: 2, // อันดับใน leaderboard รวม (MVP) — Wave 2 ค่อยสลับ scope เป็นเฉพาะเพื่อน
    boardTotal: 5,
  },
  day1Stats: {
    xp: 0,
    streak: 0,
    phase: "Phase 1 • เริ่มต้น",
    phasePct: 0,
    rank: "–",
    nextRank: "C",
    rankPct: 0,
    rankXp: "0/100",
    boardRank: null,
    boardTotal: 5,
  },
  done: { earnedXp: 50, newStreak: 7 },
  rankUp: { from: "B", to: "A", nextGoal: "S" }, // เคลมรอบนี้แต้มถึงพอดี — เด้งฉากแรงค์อัพก่อนเข้า done
};

// ประกายรอบตัวอักษรแรงค์ใหม่ตอนแรงค์อัพ
const RANKUP_SPARKS = [
  { left: "-30%", top: "-10%", delay: "0s", char: "✦", color: "#FBBF24" },
  { right: "-28%", top: "-16%", delay: ".2s", char: "✧", color: "#F472B6" },
  { left: "-22%", top: "62%", delay: ".45s", char: "✧", color: "#8B5CF6" },
  { right: "-24%", top: "58%", delay: ".65s", char: "✦", color: "#FBBF24" },
  { left: "30%", top: "-26%", delay: ".9s", char: "✦", color: "#34D399" },
];

const PREVIEW_STATES = [
  { id: "loading", label: "โหลด" },
  { id: "ready", label: "เควสวันนี้" },
  { id: "notready", label: "เควสไม่พร้อม" },
  { id: "done", label: "เสร็จแล้ว" },
  { id: "rankup", label: "แรงค์อัพ" },
  { id: "broken", label: "streak ขาด" },
  { id: "day1", label: "วันแรก" },
];

// state ที่โชว์เควส + checklist เต็ม ๆ (ต่างกันแค่ banner/ตัวเลข)
const QUEST_STATES = ["ready", "broken", "day1"];

// path จาก Heroicons 24/outline (assets/heroicons — MIT): play-circle, book-open, chat-bubble-oval-left-ellipsis
const ICON_PATHS = {
  play: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    "M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z",
  ],
  book: [
    "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  ],
  chat: [
    "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z",
  ],
};

const Icon = ({ name, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={className}>
    {ICON_PATHS[name].map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

const RANK_COLOR = { S: "text-[#FBBF24]", A: "text-emerald-600", B: "text-[#8B5CF6]", C: "text-amber-600" };

// แถบ EXP สู่แรงค์ถัดไป — ต้นทาง = แรงค์ปัจจุบัน ปลายทาง = แรงค์ถัดไป, สี gradient ไหลวนตลอด
const RankBar = ({ stats }) => (
  <div className="mt-3 rounded-2xl border border-[#FBCFE8] bg-white/70 px-3.5 py-2.5">
    <div className="flex items-center justify-between text-[10px] text-[#9D5C7C]">
      <span>streak สู่แรงค์ถัดไป</span>
      <span className="font-bold">{stats.rankXp} วัน</span>
    </div>
    <div className="mt-1.5 flex items-center gap-2.5">
      <span className={`font-heading text-lg font-bold ${RANK_COLOR[stats.rank?.charAt(0)] || "text-[#9D5C7C]"}`}>
        {stats.rank}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#FBCFE8]/60">
        <div
          className="h-full rounded-full"
          style={{
            width: `${stats.rankPct}%`,
            backgroundImage: "linear-gradient(90deg,#8B5CF6,#EC4899,#FBBF24,#EC4899,#8B5CF6)",
            backgroundSize: "200% 100%",
            animation: "dq-rank-flow 2.5s linear infinite",
          }}
        />
      </div>
      <span className={`font-heading text-lg font-bold ${RANK_COLOR[stats.nextRank?.charAt(0)] || "text-[#9D5C7C]"}`}>
        {stats.nextRank}
      </span>
    </div>
  </div>
);

// แถบสถานะ 4 ช่อง: XP / streak / phase / grade — sub ใส่ข้อความให้เลข 0 ยังดูมีชีวิต (state day1)
const StatStrip = ({ stats, subs = {} }) => (
  <div className="grid grid-cols-4 gap-2">
    <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center">
      <p className="text-[10px] text-[#9D5C7C]">XP</p>
      <p className="font-heading text-[15px] font-bold text-[#831843]">{stats.xp.toLocaleString()}</p>
      {subs.xp && <p className="text-[9px] leading-tight text-[#9D5C7C]">{subs.xp}</p>}
    </div>
    <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center">
      <p className="text-[10px] text-[#9D5C7C]">streak 🔥</p>
      <p className="font-heading text-[15px] font-bold text-[#831843]">{stats.streak}</p>
      {subs.streak && <p className="text-[9px] leading-tight text-[#9D5C7C]">{subs.streak}</p>}
    </div>
    <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center">
      <p className="text-[10px] text-[#9D5C7C]">roadmap</p>
      <p className="font-heading text-[15px] font-bold text-[#831843]">{stats.phasePct}%</p>
      <div className="mx-auto mt-1 h-1 w-10 overflow-hidden rounded-full bg-[#FBCFE8]/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
          style={{ width: `${stats.phasePct}%` }}
        />
      </div>
    </div>
    {/* อันดับจาก leaderboard — อันดับ 1 ได้สีทอง (ตัวแรงค์ A/B/C ไปอยู่ที่แถบ EXP แทน ไม่โชว์ซ้ำ) */}
    <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center">
      <p className="text-[10px] text-[#9D5C7C]">อันดับ 🏆</p>
      <p className={`font-heading text-[15px] font-bold ${stats.boardRank === 1 ? "text-[#FBBF24]" : "text-[#831843]"}`}>
        {stats.boardRank ? `#${stats.boardRank}` : "–"}
      </p>
      <p className="text-[9px] leading-tight text-[#9D5C7C]">
        {subs.board || (stats.boardRank ? `จาก ${stats.boardTotal} คน` : "")}
      </p>
    </div>
  </div>
);

// แถบ skeleton ตอนโหลด
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-[#FBCFE8]/50 ${className}`} />
);

export default function DailyQuestPage({
  initialState = "ready",
  onOpenCoach,
  onShareStreak,
  onInvite,
  showStateToggle = true,
  heightClass = "min-h-dvh", // ฝังในเชลล์ส่ง "min-h-full" ให้เกาะความสูง main ที่หักหัว/nav ออกแล้ว (standalone = min-h-dvh)
  status,
  dateLabel = MOCK.dateLabel,
  topicTitle = MOCK.topic,
  userInitial = MOCK.userInitial,
  quest = MOCK.quest,
  checklistItems = MOCK.checklist,
  stats,
  onRetry,
  onClaim,
  claiming = false,
  claimError = null,
}) {
  const [ui, setUi] = useState(initialState);
  const [checked, setChecked] = useState([]);
  const [claimResult, setClaimResult] = useState(null);
  const ctaRef = useRef(null);

  const effectiveUi = claimResult ? claimResult.kind : status ?? ui;
  const isQuestState = QUEST_STATES.includes(effectiveUi);
  const allChecked = checklistItems.length > 0 && checked.length === checklistItems.length;
  const effectiveStats =
    stats ?? (effectiveUi === "day1" ? MOCK.day1Stats : effectiveUi === "broken" ? { ...MOCK.stats, streak: 0 } : MOCK.stats);
  const effectiveDone = claimResult?.kind === "done" ? claimResult : MOCK.done;
  const effectiveRankUp = claimResult?.kind === "rankup" ? claimResult : MOCK.rankUp;
  // ลิงก์แหล่งเรียนที่แนบมากับ checklist — โชว์เป็นชิปลิงก์ด่วนเหนือ checklist (คนละก้อนกับตัวเช็คลิสต์เอง)
  const resources = checklistItems.filter((item) => item.link_url);

  // เปลี่ยน quest (วันใหม่) แล้วล้าง checklist + ผลเคลมของเควสก่อนหน้าทิ้ง
  useEffect(() => {
    setChecked([]);
    setClaimResult(null);
  }, [quest?.id]);

  // ติ๊กครบแล้วเลื่อนหน้าลงไปหาปุ่มเคลมให้เอง (pattern เดียวกับ OnboardingFlow)
  useEffect(() => {
    if (isQuestState && allChecked) {
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [allChecked, isQuestState]);

  const toggleItem = (id) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const handleClaim = async () => {
    if (claiming) return;
    const result = await onClaim?.(checked);
    if (result?.ok) {
      setClaimResult({ kind: result.rankUp ? "rankup" : "done", ...result });
    }
  };

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
        @keyframes dq-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes dq-rank-flow { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        @keyframes dq-rankup-new { 0% { opacity: 0; transform: scale(2.8) rotate(-6deg); } 40% { opacity: 1; transform: scale(.9) rotate(2deg); } 60% { transform: scale(1.15) rotate(0deg); } 100% { transform: scale(1); } }
        @keyframes dq-spark { 0% { opacity: 0; transform: scale(.4) rotate(0deg); } 30% { opacity: 1; transform: scale(1.2) rotate(20deg); } 100% { opacity: 0; transform: translateY(-24px) scale(.8) rotate(-15deg); } }
      `}</style>

      {/* toggle สำหรับ preview แต่ละ state (ปิดได้ด้วย prop ตอนต่อ flow จริง) */}
      {showStateToggle && (
        <div className="absolute inset-x-0 top-2 z-20 flex flex-wrap items-center justify-center gap-1 px-3">
          {PREVIEW_STATES.map((s) => (
            <button
              key={s.id}
              onClick={() => setUi(s.id)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] transition ${
                ui === s.id
                  ? "bg-[#8B5CF6] text-white"
                  : "border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {effectiveUi === "loading" && (
        /* ---------- skeleton — ปกติแวบเดียวเพราะเควส pre-generate ---------- */
        <main className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 pb-8 md:max-w-xl ${showStateToggle ? "pt-14" : "pt-6"}`}>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-16" /> <Skeleton className="h-16" /> <Skeleton className="h-16" /> <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-40" />
          <Skeleton className="h-12" /> <Skeleton className="h-12" /> <Skeleton className="h-12" />
        </main>
      )}

      {effectiveUi === "notready" && (
        /* ---------- เควสยังไม่พร้อม — อธิบายตรง ๆ + ปุ่มลองใหม่ ไม่ใช่จอขาว ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-16 text-center md:max-w-lg">
          <GhostMascot mood="sad" className="mb-6 scale-90" />
          <h1 className="font-heading text-xl font-bold">เควสวันนี้ยังไม่พร้อม 😅</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#9D5C7C]">
            ระบบปั่นเควสไม่ทันแป๊บนึง — ไม่ใช่ความผิดคุณเลย
            <br />
            กดลองใหม่ได้เลย ปกติไม่เกินครึ่งนาทีก็มา
          </p>
          <button
            onClick={() => onRetry?.()}
            className="mt-6 w-full max-w-[260px] rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
          >
            ลองใหม่อีกครั้ง
          </button>
        </main>
      )}

      {effectiveUi === "rankup" && (
        /* ---------- ฉากแรงค์อัพ — แต้มถึงตอนเคลม XP: ตัวเก่าหลบ ตัวใหม่กระแทกเข้า ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-12 text-center md:max-w-lg">
          <GhostMascot mood="rankup" className="mb-4 scale-110" />
          <p
            className="font-heading text-2xl font-bold"
            style={{ color: "#FBBF24", letterSpacing: "3px", textShadow: "2px 2px 0 #B45309, -2px 2px 0 #B45309", animation: "dq-in .3s ease-out" }}
          >
            RANK UP!
          </p>

          <div className="mt-4 flex items-center gap-5">
            <span className={`font-heading text-3xl font-bold opacity-40 ${RANK_COLOR[effectiveRankUp.from] || ""}`}>
              {effectiveRankUp.from}
            </span>
            <span className="text-2xl text-[#FBBF24]" style={{ textShadow: "1px 1px 0 #B45309" }}>
              ▶
            </span>
            <span className="relative inline-block">
              <span
                className={`inline-block font-heading text-7xl font-bold ${RANK_COLOR[effectiveRankUp.to] || ""}`}
                style={{ textShadow: "4px 4px 0 rgba(180,83,9,.35)", animation: "dq-rankup-new .9s ease-out both" }}
              >
                {effectiveRankUp.to}
              </span>
              {RANKUP_SPARKS.map((s, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute text-lg"
                  style={{
                    left: s.left,
                    right: s.right,
                    top: s.top,
                    color: s.color,
                    animation: `dq-spark 1.4s steps(4) ${s.delay} infinite`,
                  }}
                >
                  {s.char}
                </span>
              ))}
            </span>
          </div>

          <p className="mt-4 text-sm text-[#9D5C7C]">
            เก็บแต้มครบ! แรงค์ขยับจาก <span className="font-bold text-[#8B5CF6]">{effectiveRankUp.from}</span> เป็น{" "}
            <span className="font-bold text-emerald-600">{effectiveRankUp.to}</span> เรียบร้อย
          </p>
          <p className="mt-1 text-[11px] text-[#9D5C7C]/80">
            เป้าหมายถัดไป: <span className="font-heading font-bold text-[#FBBF24]" style={{ textShadow: "1px 1px 0 #B45309" }}>{effectiveRankUp.nextGoal}</span>
          </p>

          <button
            onClick={() => setClaimResult((r) => (r ? { ...r, kind: "done" } : { kind: "done", ...MOCK.done }))}
            className="mt-6 w-full max-w-[260px] rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
          >
            ไปต่อเลย 🚀
          </button>
        </main>
      )}

      {effectiveUi === "done" && (
        /* ---------- ทำเสร็จวันนี้แล้ว — celebration เล่นใหญ่ + CTA ชวนแชร์ ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-12 text-center md:max-w-lg">
          <GhostMascot mood="fireworks" className="mb-5 scale-110" />
          <p
            className="font-heading text-4xl font-bold"
            style={{ color: "#FBBF24", textShadow: "3px 3px 0 #B45309", animation: "dq-in .35s ease-out" }}
          >
            +{effectiveDone.earnedXp} XP
          </p>
          <h1 className="mt-2 font-heading text-xl font-bold">เควสวันนี้เสร็จแล้ว! 🎉</h1>
          <p className="mt-1.5 text-sm text-[#9D5C7C]">
            streak พุ่งเป็น <span className="font-bold text-[#831843]">{effectiveDone.newStreak} วันติด</span> 🔥
            — อวดให้เพื่อนอิจฉาหน่อยมั้ย
          </p>
          <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2.5">
            <button
              onClick={() => onShareStreak?.()}
              className="w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
            >
              แชร์การ์ด streak 🔥
            </button>
            <button
              onClick={() => onInvite?.()}
              className="w-full rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2.5 font-heading text-sm font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px"
            >
              ชวนเพื่อนมาลุยด้วยกัน
            </button>
          </div>
          <p className="mt-4 text-[11px] text-[#9D5C7C]/80">เควสใหม่มาตอนตี 5 ของพรุ่งนี้ — พักได้เต็มที่</p>
        </main>
      )}

      {effectiveUi === "restday" && (
        /* ---------- ทำเควสครบของวันนี้แล้ว (กลับมาดูซ้ำ ไม่ใช่เพิ่งเคลม) — พักได้ ไม่ใช่ "ยังไม่พร้อม/ลองใหม่" ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-12 text-center md:max-w-lg">
          <GhostMascot mood="celebrate" className="mb-5 scale-110" />
          <h1 className="font-heading text-xl font-bold">เควสวันนี้จบแล้ว! 🎉</h1>
          <p className="mt-1.5 text-sm text-[#9D5C7C]">
            streak <span className="font-bold text-[#831843]">{effectiveStats.streak} วันติด</span> 🔥 — เก่งมาก พักได้เต็มที่วันนี้
          </p>
          <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2.5">
            <button
              onClick={() => onShareStreak?.()}
              className="w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
            >
              แชร์การ์ด streak 🔥
            </button>
            <button
              onClick={() => onInvite?.()}
              className="w-full rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2.5 font-heading text-sm font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px"
            >
              ชวนเพื่อนมาลุยด้วยกัน
            </button>
          </div>
          <p className="mt-4 text-[11px] text-[#9D5C7C]/80">เควสใหม่มาตอนตี 5 ของพรุ่งนี้ — เจอกันใหม่!</p>
        </main>
      )}

      {isQuestState && (
        /* ---------- หน้าเควสหลัก (ready / broken / day1 ต่างกันที่ banner + ตัวเลข) ---------- */
        <main className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-24 md:max-w-xl ${showStateToggle ? "pt-14" : "pt-6"}`}>
          {/* header: วันที่ + หัวข้อ + avatar จาก Google */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#9D5C7C]">{dateLabel} • เควสวันนี้</p>
              <h1 className="font-heading text-xl font-bold">{topicTitle}</h1>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-400 font-heading text-sm font-bold text-white">
              {userInitial}
            </div>
          </div>

          {/* banner ปลอบตอน streak ขาด — ยุให้กลับมา ไม่ประณาม */}
          {effectiveUi === "broken" && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800" style={{ animation: "dq-in .3s ease-out" }}>
              <span className="font-bold">streak ขาดไปเมื่อวาน 🥲 ไม่เป็นไรเลย</span>
              <br />
              คนเก่งไม่ใช่คนไม่เคยพลาด แต่คือคนที่กลับมาลุยต่อ — ทำเควสวันนี้ streak เริ่มนับใหม่ทันที
            </div>
          )}

          {/* banner ต้อนรับวันแรก — เลข 0 แต่ต้องไม่โล่งหลอน */}
          {effectiveUi === "day1" && (
            <div className="mt-3 rounded-2xl border border-[#FBCFE8] bg-white/80 px-3.5 py-2.5 text-xs leading-relaxed text-[#9D5C7C]" style={{ animation: "dq-in .3s ease-out" }}>
              <span className="font-bold text-[#831843]">ยินดีต้อนรับสู่ลุยเควส! 👋</span>
              <br />
              เควสแรกจัดให้แล้ว ใช้เวลาแค่ ~{quest.minutes} นาที — จบวันนี้ได้ทั้ง XP แรกและ streak วันแรกเลย
            </div>
          )}

          {claimError && (
            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-[11px] text-red-600" style={{ animation: "dq-in .3s ease-out" }}>
              ⚠️ {claimError}
            </div>
          )}

          {/* แถบสถานะ */}
          <div className="mt-4">
            <StatStrip
              stats={effectiveStats}
              subs={
                effectiveUi === "day1"
                  ? { xp: "เก็บแต้มแรกวันนี้", streak: "เริ่มนับวันนี้", board: "ทำเควสแรกก่อน" }
                  : effectiveUi === "broken"
                    ? { streak: "เริ่มใหม่วันนี้" }
                    : {}
              }
            />
          </div>

          {/* แถบ EXP แรงค์: B ──▶ A */}
          <RankBar stats={effectiveStats} />

          {/* การ์ดเควสวันนี้ */}
          <div className="mt-4 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4">
            <div className="flex items-center gap-2 text-[11px] text-[#9D5C7C]">
              <span>⏱ {quest.minutes} นาที</span>
              <span>•</span>
              <span className="font-bold text-[#8B5CF6]">⚡ {quest.xp} XP</span>
            </div>
            <h2 className="mt-1.5 font-heading text-[15px] font-bold leading-snug">{quest.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">{quest.desc}</p>
            {resources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {resources.map((r) => (
                  <a
                    key={r.id}
                    href={r.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-[#FBCFE8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8B5CF6] transition hover:-translate-y-0.5 hover:border-[#8B5CF6]/50 hover:shadow-[0_6px_14px_rgba(139,92,246,.15)] active:translate-y-px"
                  >
                    <Icon name="book" />
                    {r.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* checklist — gating: ครบทุกข้อถึงได้ XP */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-sm font-bold">
                เช็คลิสต์ <span className="text-[#9D5C7C]">({checked.length}/{checklistItems.length})</span>
              </h3>
              <span className="text-[10px] text-[#9D5C7C]">ติ๊กครบทุกข้อถึงได้ XP นะ</span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {checklistItems.map((item) => {
                const isOn = checked.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition active:translate-y-px ${
                      isOn
                        ? "border-[#8B5CF6]/40 bg-white"
                        : "border-[#FBCFE8] bg-white/70 hover:-translate-y-0.5 hover:border-[#F9A8D4] hover:bg-white hover:shadow-[0_10px_22px_rgba(236,72,153,.15)]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                        isOn ? "border-[#8B5CF6] bg-[#8B5CF6]" : "border-[#FBCFE8] group-hover:border-[#F9A8D4]"
                      }`}
                    >
                      {isOn && (
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                          <path d="M2.5 6.5 5 9l4.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[13px] leading-snug ${isOn ? "text-[#9D5C7C] line-through" : "text-[#831843]"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ปุ่มเคลม XP โผล่เมื่อติ๊กครบ — เลื่อนหน้าลงมาหาเอง */}
          {allChecked && (
            <div ref={ctaRef} className="mt-auto pb-1 pt-5" style={{ animation: "dq-in .25s ease-out" }}>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className={`w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px ${claiming ? "opacity-70" : ""}`}
              >
                {claiming ? "กำลังเคลม..." : `เคลม ${quest.xp} XP เลย 🎉`}
              </button>
            </div>
          )}

          {/* ทางเข้าแชทโค้ช — ลอยมุมขวาล่างทุก state ที่เห็นเควส */}
          <button
            onClick={() => onOpenCoach?.()}
            aria-label="เปิดแชทโค้ช"
            style={{ bottom: "calc(20px + var(--shell-bottom-offset, 0px))" }}
            className="fixed right-5 z-10 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.35)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.45)] hover:brightness-105 active:translate-y-px"
          >
            <Icon name="chat" className="h-5 w-5" />
            ถามโค้ช
          </button>
        </main>
      )}
    </div>
  );
}
