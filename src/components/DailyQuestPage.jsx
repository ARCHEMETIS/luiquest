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

// ฝุ่นแสงลอยพื้นหลัง (ambient) — ให้หน้าไม่นิ่งเหมือนฟอร์ม แต่ยังอ่านตัวหนังสือทับได้
// ตำแหน่ง/สี/จังหวะ fix ไว้เป็นตาราง ไม่สุ่มตอน render จะได้ไม่กระโดดใหม่ทุกครั้งที่ setState
// 10 ชิ้นพอ + ขยับด้วย transform/opacity ล้วน เพราะเป็น PWA ที่คนติดตั้งบนมือถือ
const DQ_PARTICLES = [
  { left: "6%", top: "22%", size: 6, color: "#C4B5FD", dur: "13s", delay: "0s", rise: "-38px", peak: 0.5 },
  { left: "18%", top: "62%", size: 4, color: "#F9A8D4", dur: "16s", delay: "1.4s", rise: "-30px", peak: 0.55 },
  { left: "31%", top: "12%", size: 5, color: "#FBBF24", dur: "15s", delay: "3.1s", rise: "-34px", peak: 0.4 },
  { left: "44%", top: "78%", size: 7, color: "#C4B5FD", dur: "18s", delay: "0.7s", rise: "-42px", peak: 0.35 },
  { left: "57%", top: "34%", size: 4, color: "#F472B6", dur: "14s", delay: "2.2s", rise: "-28px", peak: 0.45 },
  { left: "69%", top: "88%", size: 5, color: "#FBBF24", dur: "17s", delay: "4.5s", rise: "-36px", peak: 0.35 },
  { left: "78%", top: "18%", size: 6, color: "#F9A8D4", dur: "15s", delay: "1.9s", rise: "-32px", peak: 0.5 },
  { left: "88%", top: "56%", size: 4, color: "#C4B5FD", dur: "19s", delay: "3.6s", rise: "-40px", peak: 0.4 },
  { left: "26%", top: "42%", size: 11, char: "✦", color: "#FBBF24", dur: "12s", delay: "2.8s", rise: "-26px", peak: 0.4 },
  { left: "83%", top: "72%", size: 10, char: "✧", color: "#8B5CF6", dur: "14s", delay: "5.2s", rise: "-24px", peak: 0.35 },
];

// ประกายรอบปุ่มเคลม XP — เล่นรอบเดียวตอนปุ่มโผล่ (ใช้ keyframe dq-spark ตัวเดียวกับฉากแรงค์อัพ ให้ภาษาเดียวกัน)
const CTA_SPARKS = [
  { left: "6%", top: "-2px", delay: ".1s", char: "✦", color: "#FBBF24" },
  { right: "10%", top: "-6px", delay: ".25s", char: "✧", color: "#F472B6" },
  { left: "46%", top: "-8px", delay: ".4s", char: "✦", color: "#8B5CF6" },
];

// ---- ท่ามาตรฐานของหน้านี้ ----
// popIn = การ์ด/ไทล์เด้งเข้าทีละใบแบบหน่วงกัน (stagger) ตอนหน้าโผล่ ไม่ให้ขึ้นมาพรวดเดียวทั้งหน้า
// หน่วงสูงสุดตัดที่ index 12 กันเช็คลิสต์ยาว ๆ แล้วข้อท้าย ๆ มาช้าจนน่ารำคาญ
const popIn = (i = 0) => ({
  animation: `dq-pop .42s cubic-bezier(.22,1,.36,1) ${(0.05 + Math.min(i, 12) * 0.05).toFixed(2)}s both`,
});
// สั่นสั้น ๆ ตอนแตะของที่กดได้ (tactile) — สั้นกว่า 400ms เสมอ ไม่ให้ขวางการกดข้อถัดไป
const WOBBLE = { animation: "dq-wobble .38s ease-in-out" };

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

// ---- pilot "อ่านแล้วลุยโจทย์" (Data/ML วัน 1–7) ----
// เควสบางวันแนบ content.exercise = { pre, post } มาด้วย: ถามก่อนอ่าน 1 ข้อ แล้วถามอีกข้อ
// (คนละข้อ วัดเรื่องเดียวกัน) หลังติ๊กเช็คลิสต์ครบ — เทียบสองค่านี้ต่อคนคือสิ่งเดียวที่แยกออกว่า
// "บทเรียนสอนได้ผล" หรือ "เขารู้อยู่แล้ว" เควสส่วนใหญ่ไม่มีก้อนนี้ หน้าต้องเหมือนเดิมเป๊ะ
// ★ ห้ามยัด correct_index ลง DOM ก่อนผู้เรียนตอบ — อ่านตอนกดปุ่มเท่านั้น
const asQuestion = (q) =>
  q && typeof q.prompt === "string" && Array.isArray(q.choices) && q.choices.length > 0 && Number.isInteger(q.correct_index)
    ? q
    : null;

const DIFFICULTY_CHIPS = [
  { value: "too_easy", label: "ง่ายไป" },
  { value: "right", label: "พอดี" },
  { value: "too_hard", label: "ยากไป" },
];
const TIME_FIT_CHIPS = [
  { value: "within_budget", label: "ทันเวลา" },
  { value: "over_budget", label: "เกินเวลา" },
];

// ปุ่มตัวเลือกของโจทย์ — ยืมหน้าตาจากข้อเช็คลิสต์ให้เป็นภาษาเดียวกัน
const CHOICE_BASE =
  "dq-anim flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left text-[13px] leading-snug transition active:translate-y-px";
const CHOICE_IDLE =
  "cursor-pointer border-[#FBCFE8] bg-white/70 text-[#831843] hover:-translate-y-0.5 hover:border-[#F9A8D4] hover:bg-white hover:shadow-[0_10px_22px_rgba(236,72,153,.15)]";

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

// หลอด XP สู่เลเวลถัดไป — ทำเควสเสร็จเมื่อไหร่ก็ขยับทันที (ระบบเลเวลแบบเกม ดู src/lib/gradeBands.js)
// เดิมหลอดนี้นับ "วันติด" จึงค้าง 0% ทั้งที่ได้ XP มาแล้ว (เจ้าของเจอตอนใช้จริง 23 ก.ค. 2026)
// สีไหลวนตลอดด้วย dq-rank-flow + ความกว้างมี transition ให้เห็นมันวิ่งไปตอนเคลม XP
// ตอนหลอดว่าง (เพิ่งเลเวลอัพ) ยังโชว์แถบจาง ๆ ไว้ให้รู้ว่าหลอดมีอยู่ ไม่ใช่หน้าจอพัง
const RankBar = ({ stats, style }) => (
  <div className="dq-anim mt-3 rounded-2xl border border-[#FBCFE8] bg-white/70 px-3.5 py-2.5" style={style}>
    <div className="flex items-center justify-between text-[10px] text-[#9D5C7C]">
      <span>
        XP สู่เลเวลถัดไป
        {stats.xpToNext != null && <span className="ml-1 text-[#8B5CF6]">อีก {stats.xpToNext} XP</span>}
      </span>
      <span className="font-bold">{stats.rankXp} XP</span>
    </div>
    <div className="mt-1.5 flex items-center gap-2.5">
      <span className="flex flex-col items-center leading-none">
        <span className={`font-heading text-lg font-bold ${RANK_COLOR[stats.rank?.charAt(0)] || "text-[#9D5C7C]"}`}>
          {stats.rank}
        </span>
        <span className="mt-0.5 text-[9px] font-bold text-[#9D5C7C]">Lv.{stats.level ?? 1}</span>
      </span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#FBCFE8]/60">
        <div
          className="dq-anim h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(stats.rankPct ?? 0, 3)}%`, // ขั้นต่ำ 3% ให้เห็นหัวหลอดเสมอ
            opacity: (stats.rankPct ?? 0) === 0 ? 0.35 : 1,
            backgroundImage: "linear-gradient(90deg,#8B5CF6,#EC4899,#FBBF24,#EC4899,#8B5CF6)",
            backgroundSize: "200% 100%",
            animation: "dq-rank-flow 2.5s linear infinite",
          }}
        />
      </div>
      <span className="flex flex-col items-center leading-none">
        <span className={`font-heading text-lg font-bold ${RANK_COLOR[stats.nextRank?.charAt(0)] || "text-[#9D5C7C]"}`}>
          {stats.nextRank}
        </span>
        <span className="mt-0.5 text-[9px] font-bold text-[#9D5C7C]">Lv.{stats.nextLevel ?? 2}</span>
      </span>
    </div>
  </div>
);

// แถบสถานะ 4 ช่อง: XP / streak / phase / grade — sub ใส่ข้อความให้เลข 0 ยังดูมีชีวิต (state day1)
// animate: ให้ 4 ไทล์เด้งเข้าไล่กันทีละใบตอนหน้าโผล่ (ตัวหน้าเรียกตอน intro เท่านั้น)
const StatStrip = ({ stats, subs = {}, animate = false }) => {
  const tile = (i) => (animate ? popIn(1 + i) : undefined);
  return (
  <div className="grid grid-cols-4 gap-2">
    <div className="dq-anim rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center" style={tile(0)}>
      <p className="text-[10px] text-[#9D5C7C]">XP</p>
      <p className="font-heading text-[15px] font-bold text-[#831843]">{stats.xp.toLocaleString()}</p>
      {subs.xp && <p className="text-[9px] leading-tight text-[#9D5C7C]">{subs.xp}</p>}
    </div>
    <div className="dq-anim rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center" style={tile(1)}>
      <p className="text-[10px] text-[#9D5C7C]">streak 🔥</p>
      <p className="font-heading text-[15px] font-bold text-[#831843]">{stats.streak}</p>
      {subs.streak && <p className="text-[9px] leading-tight text-[#9D5C7C]">{subs.streak}</p>}
    </div>
    <div className="dq-anim rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center" style={tile(2)}>
      <p className="text-[10px] text-[#9D5C7C]">roadmap</p>
      {/* phasePct = null แปลว่า "ยังไม่รู้" (เช่นวันพัก ที่ API ไม่ส่งเลขวันมา) — โชว์ขีดไว้ ไม่ใช่ 0% ที่โกหกว่าไม่คืบหน้า */}
      <p className="font-heading text-[15px] font-bold text-[#831843]">{stats.phasePct == null ? "–" : `${stats.phasePct}%`}</p>
      {stats.phasePct != null && (
        <div className="mx-auto mt-1 h-1 w-10 overflow-hidden rounded-full bg-[#FBCFE8]/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width] duration-700 ease-out"
            style={{ width: `${stats.phasePct}%` }}
          />
        </div>
      )}
    </div>
    {/* อันดับจาก leaderboard — อันดับ 1 ได้สีทอง (ตัวแรงค์ A/B/C ไปอยู่ที่แถบ EXP แทน ไม่โชว์ซ้ำ) */}
    <div className="dq-anim rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-2 text-center" style={tile(3)}>
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
};

// แถบ skeleton ตอนโหลด
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-[#FBCFE8]/50 ${className}`} />
);

const TomorrowQuestPreview = ({ quest }) => {
  const objectives = Array.isArray(quest?.objectives)
    ? quest.objectives.filter((o) => typeof o === "string" && o.trim())
    : [];
  return (
    <div className="w-full rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4 text-left">
      <p className="text-[11px] font-bold text-[#8B5CF6]">พรุ่งนี้ตอนตี 5 ได้ลุยต่อ</p>
      <h2 className="mt-1.5 font-heading text-[15px] font-bold leading-snug">{quest.title}</h2>
      <p className="mt-2.5 text-[11px] font-bold text-[#9D5C7C]">จบพรุ่งนี้จะทำอะไรได้</p>
      {objectives.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1">
          {objectives.map((objective, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-[#9D5C7C]">
              <span aria-hidden="true" className="text-[#8B5CF6]">•</span>
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">{quest.description}</p>
      )}
    </div>
  );
};

export default function DailyQuestPage({
  initialState = "ready",
  onOpenCoach,
  onShareStreak,
  onInvite,
  onCoach,
  showStateToggle = true,
  heightClass = "min-h-dvh", // ฝังในเชลล์ส่ง "min-h-full" ให้เกาะความสูง main ที่หักหัว/nav ออกแล้ว (standalone = min-h-dvh)
  status,
  dateLabel = MOCK.dateLabel,
  topicTitle = MOCK.topic,
  userInitial = MOCK.userInitial,
  quest = MOCK.quest,
  checklistItems = MOCK.checklist,
  tomorrowQuest = null,
  stats,
  onRetry,
  onClaim,
  claiming = false,
  claimError = null,
  // แถว quest_learning_signals ของเควสนี้ — undefined = ยังอ่านไม่เสร็จ (ห้ามใส่ default ที่นี่
  // ไม่งั้น undefined จะกลายเป็น null แล้วโจทย์จะแวบขึ้นมาถามซ้ำก่อนรู้ว่าเคยตอบไปแล้ว)
  signal,
  onSignal,
}) {
  const [ui, setUi] = useState(initialState);
  const [checked, setChecked] = useState([]);
  const [claimResult, setClaimResult] = useState(null);
  // doneDismissed = กดไปต่อจาก celebration แล้วให้ดูสถิติของวันนั้นต่อได้ทันที
  // ใช้ local view เพราะ status จริงจาก parent ยังเป็น ready จนกว่าจะข้ามวัน
  const [doneDismissed, setDoneDismissed] = useState(false);
  const ctaRef = useRef(null);
  // intro = ช่วงที่ชุด pop-in กำลังเล่น (ตอนหน้าโผล่/ได้เควสใหม่) — พอจบแล้วต้องถอด style animation ทิ้ง
  // ไม่งั้นเวลาแถวไหนสลับไปเล่นท่าสั่นแล้วสลับกลับ มันจะเด้ง pop-in ใหม่ทั้งที่อยู่บนจอมานานแล้ว
  const [intro, setIntro] = useState(true);
  // tapped = id ของอันที่เพิ่งแตะ (เก็บสั้น ๆ แล้วปลดเอง) — ใช้ state แทนใส่ animation ค้างไว้
  // เพราะ inline animation ที่ค่าไม่เปลี่ยนจะไม่เล่นซ้ำตอนกดรอบสอง
  const [tapped, setTapped] = useState(null);
  const tapTimer = useRef(null);
  // ---- โจทย์ก่อน/หลังอ่าน (มีเฉพาะเควสที่แนบ content.exercise มา) ----
  const [preAnswered, setPreAnswered] = useState(false); // ตอบข้อก่อนอ่านในรอบนี้แล้ว
  const [preSkipped, setPreSkipped] = useState(false); // กด "ข้ามไปอ่านเลย"
  const [postPick, setPostPick] = useState(null); // index ที่เลือกล่าสุดของข้อหลังอ่าน (null = ยังไม่ตอบ)
  const [postRevealed, setPostRevealed] = useState(false);
  const [rating, setRating] = useState({ difficulty: null, time_fit: null });
  const ratingRef = useRef({ difficulty: null, time_fit: null });

  const baseUi = claimResult ? claimResult.kind : status ?? ui;
  const effectiveUi = doneDismissed && baseUi === "done" ? "restday" : baseUi;
  const isQuestState = QUEST_STATES.includes(effectiveUi);
  const allChecked = checklistItems.length > 0 && checked.length === checklistItems.length;
  const effectiveStats =
    stats ?? (effectiveUi === "day1" ? MOCK.day1Stats : effectiveUi === "broken" ? { ...MOCK.stats, streak: 0 } : MOCK.stats);
  const effectiveDone = claimResult?.kind === "done" ? claimResult : MOCK.done;
  const effectiveRankUp = claimResult?.kind === "rankup" ? claimResult : MOCK.rankUp;
  // ลิงก์แหล่งเรียนที่แนบมากับ checklist — โชว์เป็นชิปลิงก์ด่วนเหนือ checklist (คนละก้อนกับตัวเช็คลิสต์เอง)
  const resources = checklistItems.filter((item) => item.link_url);
  // บทเรียนจาก quest.content — คลังเควสเขียนมือมี {intro, objectives} ส่วนเควสที่ Gemini สร้างเป็น {}
  // (questGenerator.js เขียน content: {} ตรง ๆ) จึงต้องเผื่อทั้ง null, {} และชนิดข้อมูลที่ไม่ตรง
  const lessonIntro = typeof quest.content?.intro === "string" ? quest.content.intro.trim() : "";
  const lessonObjectives = Array.isArray(quest.content?.objectives)
    ? quest.content.objectives.filter((o) => typeof o === "string" && o.trim())
    : [];
  // โจทย์ก่อน/หลังอ่าน — เควสส่วนใหญ่ไม่มี (content เป็น null หรือ {}) ทุกอย่างข้างล่างจึงตกเป็น null แล้วหน้าเหมือนเดิมทุกจุด
  const preQ = asQuestion(quest.content?.exercise?.pre);
  const postQ = asQuestion(quest.content?.exercise?.post);
  const hasExercise = !!(preQ || postQ);
  const signalReady = signal !== undefined; // undefined = ยังอ่านแถวสัญญาณไม่เสร็จ
  const preDone = preAnswered || signal?.pre_lesson_correct != null;
  // ตอบข้อหลังอ่านไปแล้วตั้งแต่ก่อนรีเฟรช และรอบนี้ยังไม่ได้แตะ → โชว์สถานะเดิม ห้ามถามซ้ำ
  const postLocked = postPick == null && signal?.first_attempt_correct != null;
  const postAnswerShown = postLocked || postPick != null || postRevealed;
  // ซ่อนบทเรียน/แหล่งอ่าน/เช็คลิสต์ ไว้จนกว่าจะตอบข้อก่อนอ่าน (หรือกดข้าม) — ถ้าอ่านก่อนตอบ ค่าที่วัดได้จะไม่มีความหมาย
  // ระหว่างที่ signal ยังมาไม่ถึงก็ซ่อนไว้ก่อน ดีกว่าโชว์บทเรียนแล้วหุบกลับตอนรู้ว่ายังไม่เคยตอบ
  const lessonGated = !!preQ && !preDone && !preSkipped;

  // เปลี่ยน quest (วันใหม่) แล้วล้าง checklist + ผลเคลมของเควสก่อนหน้าทิ้ง + เล่นชุด pop-in รอบใหม่
  useEffect(() => {
    setChecked([]);
    setClaimResult(null);
    setDoneDismissed(false);
    setIntro(true);
    setPreAnswered(false);
    setPreSkipped(false);
    setPostPick(null);
    setPostRevealed(false);
    setRating({ difficulty: null, time_fit: null });
    ratingRef.current = { difficulty: null, time_fit: null };
    const t = setTimeout(() => setIntro(false), 1200); // > หน่วงสูงสุด (.65s) + ความยาวท่า (.42s)
    return () => clearTimeout(t);
  }, [quest?.id]);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  // แถวสัญญาณมาถึงแล้ว — เติมสถานะที่เคยบันทึกไว้ (รีเฟรชกลางคันต้องเห็นของเดิม ไม่ใช่เริ่มนับหนึ่งใหม่)
  // ส่วน "ตอบข้อก่อน/หลังอ่านไปแล้วหรือยัง" อ่านจาก signal ตรง ๆ (preDone/postLocked) ไม่ต้องคัดลอกมาเก็บซ้ำ
  useEffect(() => {
    if (!signal) return;
    if (signal.revealed_answer) setPostRevealed(true);
    const savedRating = { difficulty: signal.difficulty ?? null, time_fit: signal.time_fit ?? null };
    ratingRef.current = savedRating;
    setRating(savedRating);
  }, [signal]);

  // ใส่ท่า pop-in เฉพาะช่วง intro — นอกช่วงนั้นคืนค่า undefined ให้ element ไม่มี animation ค้าง
  const enter = (i) => (intro ? popIn(i) : undefined);

  const tap = (id) => {
    setTapped(id);
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapped(null), 420);
  };

  // ติ๊กครบแล้วเลื่อนหน้าลงไปหาปุ่มเคลมให้เอง (pattern เดียวกับ OnboardingFlow)
  useEffect(() => {
    if (isQuestState && allChecked) {
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [allChecked, isQuestState]);

  const toggleItem = (id) => {
    tap(id); // สั่นให้รู้ว่ารับแล้ว ก่อนค่อยไปเปลี่ยน state
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  // ---- ตัวส่งสัญญาณของ pilot — telemetry ล้วน ยิงทิ้งไม่รอผล ไม่มีตัวไหนไปขวางการเคลม XP ----
  const answerPre = (i) => {
    if (!preQ || preDone) return;
    setPreAnswered(true); // ไม่เฉลยตรงนี้เด็ดขาด เฉลยตอนนี้ = สปอยล์ข้อท้าย แล้วค่าที่วัดจะไม่มีความหมาย
    onSignal?.({ event: "pre", correct: i === preQ.correct_index });
  };

  const answerPost = (i) => {
    if (!postQ || postLocked) return;
    // ส่งเฉพาะครั้งแรกของรอบนี้ (ฝั่ง server ก็เก็บเฉพาะคำตอบแรกอยู่แล้ว) ตอบใหม่ได้เพื่อให้ลองจนเข้าใจ
    if (postPick == null) onSignal?.({ event: "post", correct: i === postQ.correct_index });
    setPostPick(i);
  };

  const revealPost = () => {
    setPostRevealed(true);
    onSignal?.({ event: "reveal" });
  };

  const rate = (key, value) => {
    if (ratingRef.current[key] === value) return;
    const next = { ...ratingRef.current, [key]: value };
    ratingRef.current = next;
    setRating(next);
    onSignal?.({ event: "rating", difficulty: next.difficulty, time_fit: next.time_fit });
  };

  const handleClaim = async () => {
    tap("cta");
    if (claiming) return;
    const result = await onClaim?.(checked);
    if (result?.ok) {
      setClaimResult({ kind: result.rankUp ? "rankup" : "done", ...result });
    }
  };

  return (
    <div
      // isolate = ทำให้กล่องนี้เป็น stacking context ของตัวเอง ชั้นฝุ่นแสงจึงวาง zIndex -1 ได้
      // (อยู่เหนือพื้นหลัง แต่ต่ำกว่าเนื้อหาทุก state) โดยไม่ต้องไปไล่ใส่ z-index ให้ <main> ทีละอัน
      className={`relative isolate flex ${heightClass} flex-col overflow-hidden font-body text-[#831843]`}
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
        /* การ์ด/ไทล์เด้งเข้า — ใช้คู่กับ popIn(i) ที่หน่วงทีละใบ */
        @keyframes dq-pop { 0% { opacity: 0; transform: translateY(10px) scale(.96); } 60% { transform: translateY(-2px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        /* สั่นสั้น ๆ ตอนแตะของที่กดได้ */
        @keyframes dq-wobble { 0%,100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2.2deg) scale(1.02); } 55% { transform: rotate(1.8deg) scale(.995); } 80% { transform: rotate(-.8deg) scale(1); } }
        /* ฝุ่นแสงลอยขึ้นช้า ๆ วนไม่รู้จบ — transform/opacity ล้วน ไม่กระทบ layout */
        @keyframes dq-float { 0% { opacity: 0; transform: translateY(0) scale(.9); } 20% { opacity: var(--dq-peak, .45); } 80% { opacity: var(--dq-peak, .45); } 100% { opacity: 0; transform: translateY(var(--dq-rise, -32px)) scale(1.05); } }
        /* เคารพการตั้งค่าลดการเคลื่อนไหวของเครื่อง — ปิดของประดับ เหลือแต่เนื้อหา */
        @media (prefers-reduced-motion: reduce) {
          .dq-anim, .dq-particle { animation: none !important; transition: none !important; }
          .dq-particle { opacity: .25 !important; }
        }
      `}</style>

      {/* ฝุ่นแสงพื้นหลัง — ตกแต่งล้วน กดทะลุได้ (pointer-events-none) และอยู่หลังเนื้อหาทั้งหมด */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {DQ_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="dq-particle absolute"
            style={{
              left: p.left,
              top: p.top,
              width: p.char ? undefined : p.size,
              height: p.char ? undefined : p.size,
              fontSize: p.char ? p.size : undefined,
              lineHeight: 1,
              color: p.char ? p.color : undefined,
              background: p.char ? undefined : p.color,
              borderRadius: p.char ? undefined : "9999px",
              "--dq-rise": p.rise,
              "--dq-peak": p.peak,
              animation: `dq-float ${p.dur} ease-in-out ${p.delay} infinite`,
            }}
          >
            {p.char}
          </span>
        ))}
      </div>

      {/* toggle สำหรับ preview แต่ละ state (ปิดได้ด้วย prop ตอนต่อ flow จริง) */}
      {showStateToggle && (
        <div className="absolute inset-x-0 top-2 z-20 flex flex-wrap items-center justify-center gap-1 px-3">
          {PREVIEW_STATES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setDoneDismissed(false);
                setUi(s.id);
              }}
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
            {/* ดูสีจากตัวอักษรแรกเหมือนแถบแรงค์ปกติ — ถ้าใช้ทั้งสตริง SS/SSS จะหลุดสีทองกลายเป็นไม่มีสี */}
            <span className={`font-heading text-3xl font-bold opacity-40 ${RANK_COLOR[effectiveRankUp.from?.charAt(0)] || ""}`}>
              {effectiveRankUp.from}
            </span>
            <span className="text-2xl text-[#FBBF24]" style={{ textShadow: "1px 1px 0 #B45309" }}>
              ▶
            </span>
            <span className="relative inline-block">
              <span
                className={`inline-block font-heading text-7xl font-bold ${RANK_COLOR[effectiveRankUp.to?.charAt(0)] || ""}`}
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
          {/* อยู่แรงค์สูงสุด (SSS) แล้วจะไม่มี nextGoal ส่งมา — ซ่อนบรรทัดนี้ไปเลย ดีกว่าโชว์ "เป้าหมายถัดไป: SSS" ที่ถึงแล้ว */}
          {effectiveRankUp.nextGoal && (
            <p className="mt-1 text-[11px] text-[#9D5C7C]/80">
              เป้าหมายถัดไป: <span className="font-heading font-bold text-[#FBBF24]" style={{ textShadow: "1px 1px 0 #B45309" }}>{effectiveRankUp.nextGoal}</span>
            </p>
          )}

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
          {tomorrowQuest?.title ? (
            <p className="mt-1.5 text-sm text-[#9D5C7C]">
              streak พุ่งเป็น <span className="font-bold text-[#831843]">{effectiveDone.newStreak} วันติด</span> 🔥 — พรุ่งนี้มีเควสต่อรอแล้ว
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-[#9D5C7C]">
              streak พุ่งเป็น <span className="font-bold text-[#831843]">{effectiveDone.newStreak} วันติด</span> 🔥
              — อวดให้เพื่อนอิจฉาหน่อยมั้ย
            </p>
          )}
          <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2.5">
            {tomorrowQuest?.title ? (
              <TomorrowQuestPreview quest={tomorrowQuest} />
            ) : (
              <button
                onClick={() => setDoneDismissed(true)}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
              >
                ไปต่อ ดูความคืบหน้า
              </button>
            )}
            <button
              onClick={() => onShareStreak?.()}
              className={tomorrowQuest?.title
                ? "w-full rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2.5 font-heading text-sm font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px"
                : "w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"}
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
          {!tomorrowQuest?.title && (
            <p className="mt-4 text-[11px] text-[#9D5C7C]/80">เควสใหม่มาตอนตี 5 ของพรุ่งนี้ — พักได้เต็มที่</p>
          )}
        </main>
      )}

      {effectiveUi === "restday" && (
        /* ---------- ทำเควสครบของวันนี้แล้ว (กลับมาดูซ้ำ ไม่ใช่เพิ่งเคลม) — พักได้ ไม่ใช่ "ยังไม่พร้อม/ลองใหม่" ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-24 pt-6 text-center md:max-w-xl">
          {/* สถิติ + หลอด XP ต้องเห็นได้ในหน้านี้ด้วย — เดิมหน้านี้มีแต่ข้อความ "รอพรุ่งนี้"
              ทำให้ดูเลเวล/XP/อันดับไม่ได้เลยจนกว่าจะข้ามวัน (เจ้าของเจอตอนใช้จริง 23 ก.ค. 2026) */}
          <div className="w-full text-left">
            <StatStrip stats={effectiveStats} />
            <RankBar stats={effectiveStats} />
          </div>

          {/* mood "groove" วนไม่รู้จบ (เต้น + โน้ตเพลงลอย) — เดิมใช้ "celebrate" ซึ่งเป็น mood เดียว
              ที่ไม่ใช่ infinite (ghost-jump .5s steps(2) 3) เด้ง 3 ครั้งแล้วค้างนิ่งไปเลย */}
          <GhostMascot mood="groove" className="my-5 scale-110" />
          <h1 className="font-heading text-xl font-bold">เควสวันนี้จบแล้ว! 🎉</h1>
          <p className="mt-1.5 text-sm text-[#9D5C7C]">
            streak <span className="font-bold text-[#831843]">{effectiveStats.streak} วันติด</span> 🔥 — เก่งมาก พักได้เต็มที่วันนี้
          </p>
          <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2.5">
            {tomorrowQuest?.title && <TomorrowQuestPreview quest={tomorrowQuest} />}
            <button
              onClick={() => onShareStreak?.()}
              className={tomorrowQuest?.title
                ? "w-full rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2.5 font-heading text-sm font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px"
                : "w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"}
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
          {!tomorrowQuest?.title && (
            <p className="mt-4 text-[11px] text-[#9D5C7C]/80">เควสใหม่มาตอนตี 5 ของพรุ่งนี้ — เจอกันใหม่!</p>
          )}

          {/* ทางออกจากหน้านี้ — เดิมไม่มีเลย ค้างอยู่กับข้อความ "รอพรุ่งนี้" อย่างเดียว */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <button
              onClick={() => window.dispatchEvent(new Event("luiquest-open-profile"))}
              className="rounded-full border border-[#FBCFE8] bg-white/80 px-3.5 py-1.5 font-bold text-[#8B5CF6] transition hover:border-[#8B5CF6]/50 active:translate-y-px"
            >
              ดูโปรไฟล์ / สลับหัวข้อ
            </button>
            <button
              onClick={() => onCoach?.()}
              className="rounded-full border border-[#FBCFE8] bg-white/80 px-3.5 py-1.5 font-bold text-[#8B5CF6] transition hover:border-[#8B5CF6]/50 active:translate-y-px"
            >
              คุยกับโค้ชต่อ
            </button>
          </div>
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
            {/* อวตารนี้เด่นกว่าปุ่มโปรไฟล์จริงในแถบบน คนจึงกดตัวนี้เป็นอันแรก — เดิมเป็น <div> เฉย ๆ กดแล้วเงียบ
                ตอนนี้ยิง event เดียวกับที่ AppShellLayout ฟังอยู่แล้ว (luiquest-open-profile) เพื่อเปิดแถบโปรไฟล์ */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("luiquest-open-profile"))}
              aria-label="เปิดแถบโปรไฟล์"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-400 font-heading text-sm font-bold text-white transition hover:brightness-110 active:translate-y-px"
            >
              {userInitial}
            </button>
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
              animate={intro}
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
          <RankBar stats={effectiveStats} style={enter(5)} />

          {/* โจทย์ก่อนอ่าน (เฉพาะเควสที่แนบ content.exercise มา) — ถามก่อนเพื่อแยกให้ออกว่า
              "รู้อยู่แล้ว" หรือ "บทเรียนสอนให้" รอ signalReady ก่อนค่อยถาม จะได้ไม่ถามข้อที่ตอบไปแล้วซ้ำ */}
          {preQ && lessonGated && signalReady && (
            <div className="dq-anim mt-4 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4" style={enter(6)}>
              <h2 className="font-heading text-sm font-bold">ลองตอบก่อนอ่าน</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9D5C7C]">
                ลองตอบก่อนอ่าน จะได้รู้ว่าบทเรียนช่วยตรงไหน — ผิดก็ไม่หัก XP อะไรเลย
              </p>
              <p className="mt-2.5 whitespace-pre-line text-[13px] font-bold leading-relaxed text-[#831843]">{preQ.prompt}</p>
              <div className="mt-2.5 flex flex-col gap-2">
                {preQ.choices.map((c, i) => (
                  <button key={i} type="button" onClick={() => answerPre(i)} className={`${CHOICE_BASE} ${CHOICE_IDLE}`}>
                    {c}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPreSkipped(true)}
                className="mt-3 text-[11px] font-bold text-[#9D5C7C] underline underline-offset-2 transition hover:text-[#8B5CF6]"
              >
                ข้ามไปอ่านเลย
              </button>
            </div>
          )}

          {/* ตอบข้อก่อนอ่านแล้ว — รับคำตอบไว้เฉย ๆ ไม่บอกถูกผิด เพราะจะไปสปอยล์ข้อท้ายที่ใช้วัดผลจริง */}
          {preQ && preDone && (
            <div
              className="dq-anim mt-4 rounded-2xl border border-[#FBCFE8] bg-white/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-[#9D5C7C]"
              /* นอกช่วง intro (เพิ่งตอบเสร็จ) enter() คืน undefined — ใส่ dq-in ให้จาง ๆ เข้ามาเหมือน banner อื่น */
              style={enter(6) ?? { animation: "dq-in .3s ease-out" }}
            >
              <span className="font-bold text-[#8B5CF6]">รับคำตอบก่อนอ่านแล้ว</span> — ยังไม่เฉลยนะ เดี๋ยวมีอีกข้อตอนท้ายไว้เทียบกัน
            </div>
          )}

          {/* การ์ดเควสวันนี้ */}
          <div className="dq-anim mt-4 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4" style={enter(6)}>
            <div className="flex items-center gap-2 text-[11px] text-[#9D5C7C]">
              <span>⏱ {quest.minutes} นาที</span>
              <span>•</span>
              <span className="font-bold text-[#8B5CF6]">⚡ {quest.xp} XP</span>
            </div>
            <h2 className="mt-1.5 font-heading text-[15px] font-bold leading-snug">{quest.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">{quest.desc}</p>
            {/* บทเรียนสั้นก่อนลงมือ — มีเฉพาะเควสที่เขียนมือ (คลัง starter_quests) เควสที่ AI สร้างจะไม่มี */}
            {!lessonGated && lessonIntro && (
              <p className="mt-2.5 rounded-xl bg-[#FDF2F8] p-2.5 text-xs leading-relaxed text-[#7A4A63]">
                {lessonIntro}
              </p>
            )}
            {!lessonGated && lessonObjectives.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[11px] font-bold text-[#9D5C7C]">จบวันนี้จะทำอะไรได้</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {lessonObjectives.map((obj, i) => (
                    <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-[#9D5C7C]">
                      <span aria-hidden="true" className="text-[#8B5CF6]">•</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!lessonGated && resources.length > 0 && (
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

          {/* checklist — gating: ครบทุกข้อถึงได้ XP (ซ่อนไว้ก่อนถ้ายังค้างโจทย์ก่อนอ่านอยู่) */}
          {!lessonGated && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-sm font-bold">
                เช็คลิสต์ <span className="text-[#9D5C7C]">({checked.length}/{checklistItems.length})</span>
              </h3>
              <span className="text-[10px] text-[#9D5C7C]">ติ๊กครบทุกข้อถึงได้ XP นะ</span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {checklistItems.map((item, idx) => {
                const isOn = checked.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    style={tapped === item.id ? WOBBLE : enter(7 + idx)}
                    className={`dq-anim group flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition active:translate-y-px ${
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
          )}

          {/* โจทย์หลังอ่าน + ความเห็นสั้น ๆ — โผล่ตอนติ๊กครบ ตอบหรือไม่ตอบก็เคลม XP ได้เหมือนเดิมทุกอย่าง */}
          {hasExercise && allChecked && (
            <div className="mt-4 flex flex-col gap-3" style={{ animation: "dq-in .25s ease-out" }}>
              {postQ && (
                <div className="rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4">
                  <h3 className="font-heading text-sm font-bold">วัดผลหลังอ่าน</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#9D5C7C]">คนละข้อกับตอนแรก แต่วัดเรื่องเดียวกัน</p>
                  <p className="mt-2.5 whitespace-pre-line text-[13px] font-bold leading-relaxed text-[#831843]">{postQ.prompt}</p>
                  {postLocked ? (
                    /* ตอบไปแล้วตั้งแต่ก่อนรีเฟรช — โชว์ผลเดิม ไม่ถามใหม่ (คำตอบแรกคือค่าที่เอาไปวัด) */
                    <p className="mt-2.5 rounded-xl bg-[#FDF2F8] p-2.5 text-xs leading-relaxed text-[#7A4A63]">
                      {signal.first_attempt_correct ? "ข้อนี้ตอบถูกไปแล้ว 🎉" : "ข้อนี้ตอบไปแล้ว — อ่านคำอธิบายข้างล่างได้เลย"}
                    </p>
                  ) : (
                    <div className="mt-2.5 flex flex-col gap-2">
                      {postQ.choices.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => answerPost(i)}
                          /* เทียบ correct_index เฉพาะปุ่มที่ "ถูกเลือกไปแล้ว" เท่านั้น ก่อนตอบจึงไม่มีปุ่มไหนหน้าตาต่างกัน */
                          className={`${CHOICE_BASE} ${
                            postPick === i
                              ? postPick === postQ.correct_index
                                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                : "border-red-300 bg-red-50 text-red-600"
                              : CHOICE_IDLE
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  {postPick != null && (
                    <p className={`mt-2.5 text-xs font-bold ${postPick === postQ.correct_index ? "text-emerald-600" : "text-red-500"}`}>
                      {postPick === postQ.correct_index ? "ถูกต้อง! 🎉" : "ยังไม่ใช่ — เลือกใหม่ได้เลย (คำตอบแรกบันทึกไว้แล้ว)"}
                    </p>
                  )}
                  {postAnswerShown && postQ.explanation && (
                    <p className="mt-2 rounded-xl bg-[#FDF2F8] p-2.5 text-xs leading-relaxed text-[#7A4A63]">{postQ.explanation}</p>
                  )}
                  {!postAnswerShown && (
                    <button
                      type="button"
                      onClick={revealPost}
                      className="mt-3 text-[11px] font-bold text-[#9D5C7C] underline underline-offset-2 transition hover:text-[#8B5CF6]"
                    >
                      ดูเฉลย
                    </button>
                  )}
                </div>
              )}

              {/* ความเห็นสั้น ๆ ต่อเควสวันนี้ — ไม่บังคับ ไม่มีผลกับ XP ใช้ปรับความยาก/ความยาวของเควสรุ่นถัดไป */}
              <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-3.5 py-3">
                <p className="text-[11px] text-[#9D5C7C]">เควสวันนี้เป็นไงบ้าง (ตอบหรือไม่ตอบก็ได้)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DIFFICULTY_CHIPS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => rate("difficulty", c.value)}
                      className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition active:translate-y-px ${
                        rating.difficulty === c.value
                          ? "border border-[#8B5CF6] bg-[#8B5CF6] text-white"
                          : "border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6]"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TIME_FIT_CHIPS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => rate("time_fit", c.value)}
                      className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition active:translate-y-px ${
                        rating.time_fit === c.value
                          ? "border border-[#8B5CF6] bg-[#8B5CF6] text-white"
                          : "border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6]"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ปุ่มเคลม XP โผล่เมื่อติ๊กครบ — เลื่อนหน้าลงมาหาเอง */}
          {allChecked && (
            <div ref={ctaRef} className="relative mt-auto pb-1 pt-5" style={{ animation: "dq-in .25s ease-out" }}>
              {/* ประกายเล่นรอบเดียวตอนปุ่มโผล่ — บอกว่า "ครบแล้ว กดได้" โดยไม่ต้องมีข้อความเพิ่ม */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-3 block">
                {CTA_SPARKS.map((sp, i) => (
                  <span
                    key={i}
                    className="absolute font-heading text-[13px]"
                    style={{ left: sp.left, right: sp.right, top: sp.top, color: sp.color, animation: `dq-spark .9s ease-out ${sp.delay} both` }}
                  >
                    {sp.char}
                  </span>
                ))}
              </span>
              <button
                onClick={handleClaim}
                disabled={claiming}
                style={tapped === "cta" ? WOBBLE : undefined}
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
