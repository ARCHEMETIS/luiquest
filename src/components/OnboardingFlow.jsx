// หน้า Onboarding 3 ขั้นของลุยเควส — mock data ด้านล่าง ฝั่งโค้ดต่อ API จริงเองภายหลัง
// states: step1 | step2 | step3 | generating | done (ตาม design-brief section 3.2–3.4 + done เพิ่มเติม)
// ทุกหัวข้อผ่านหน้า generating เสมอ (มาสคอต+progress) — curated เร็วจริงแต่ตั้ง floor เวลาไว้ให้ไม่วูบวาบเกินไป

import { useEffect, useRef, useState } from "react";
import GhostMascot from "./GhostMascot";

const MOCK = {
  fallbackCustomTopic: "พูดอังกฤษให้คล่อง", // ใช้ตอนกด preview state "generating" ตรง ๆ โดยยังไม่ได้เลือกหัวข้อ
};

// path จาก Heroicons 24/outline (assets/heroicons — MIT): code-bracket, chart-bar, globe-alt, sparkles, table-cells, banknotes
const TOPICS = [
  {
    id: "python",
    title: "Python",
    desc: "ภาษายอดฮิต เริ่มง่ายสุด",
    tint: "bg-violet-100 text-violet-600",
    icon: ["M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"],
  },
  {
    id: "data-ml",
    title: "Data / ML",
    desc: "เล่นกับข้อมูล + โมเดล",
    tint: "bg-pink-100 text-pink-500",
    icon: [
      "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
    ],
  },
  {
    id: "web",
    title: "สร้างเว็บ",
    desc: "จาก HTML ยัน React",
    tint: "bg-sky-100 text-sky-500",
    icon: [
      "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    ],
  },
  {
    id: "ai",
    title: "ใช้ AI เป็น",
    desc: "prompt ยังไงให้เวิร์ก",
    tint: "bg-fuchsia-100 text-fuchsia-500",
    icon: [
      "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
    ],
  },
  {
    id: "excel",
    title: "Excel",
    desc: "สูตร + pivot ระดับโปร",
    tint: "bg-emerald-100 text-emerald-600",
    icon: [
      "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5",
    ],
  },
  {
    id: "finance",
    title: "การเงินส่วนบุคคล",
    desc: "ออม ลงทุน วางแผนเป็น",
    tint: "bg-amber-100 text-amber-600",
    icon: [
      "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
    ],
  },
];

// icon เส้นจาก Heroicons — สีตาม currentColor ของ parent
const TopicIcon = ({ paths, className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={className}>
    {paths.map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

const LEVELS = [
  { id: "beginner", emoji: "🌱", title: "มือใหม่", desc: "เริ่มจากศูนย์ได้เลย ไม่ต้องมีพื้นมาก่อน" },
  { id: "some", emoji: "🌿", title: "พอมีพื้น", desc: "เคยลองมาบ้าง อยากให้แน่นขึ้น" },
  { id: "solid", emoji: "🌳", title: "แน่นแล้ว", desc: "พื้นแน่นอยู่แล้ว อยากต่อยอดขั้นสูง" },
];

const TIMES = [
  { id: 15, emoji: "☕", title: "15 นาที", desc: "ชิล ๆ วันละนิดก็ไปได้ไกล" },
  { id: 30, emoji: "🔥", title: "30 นาที", desc: "กำลังดี ไม่หนักไม่เบา" },
  { id: 60, emoji: "🚀", title: "60 นาที", desc: "จัดเต็ม สายลุยตัวจริง" },
];

// ข้อความหมุนบนหน้ารอ generate (~5–20 วิ) — {topic} / {time} จะถูกแทนค่าจริง
const GENERATING_STEPS = [
  "กำลังส่องดูว่า “{topic}” ต้องเก่งอะไรบ้าง...",
  "ร่าง roadmap ฉบับลุยจริง ไม่ใช่ทฤษฎีลอย ๆ...",
  "หั่นบทเรียนให้พอดีวันละ {time} นาที...",
  "คัดเควสแรกที่สนุกสุดมาไว้หน้าสุด...",
  "เกือบแล้ว! ผีน้อยกำลังห่อเควสใส่กล่อง 🎁",
];

// ท่ามาสคอตวนระหว่างรอ generate — เปลี่ยนท่าทุก 2.8 วิ พร้อมจังหวะข้อความ
const GEN_MOODS = ["sixseven", "fireworks", "rankup", "groove"];

const PREVIEW_STATES = [
  { id: "step1", label: "ขั้น 1 หัวข้อ" },
  { id: "step2", label: "ขั้น 2 พื้นฐาน" },
  { id: "step3", label: "ขั้น 3 เวลา" },
  { id: "generating", label: "กำลังสร้าง" },
  { id: "done", label: "พร้อมลุย" },
];

const STEP_NUMBER = { step1: 1, step2: 2, step3: 3 };

const BackIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ปุ่มตัวเลือกแบบการ์ดแถวยาว (ใช้ทั้งขั้น 2 และ 3)
const OptionRow = ({ option, selected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left transition active:translate-y-px ${
      selected
        ? "border-[#8B5CF6] bg-white shadow-[0_8px_20px_rgba(139,92,246,.18)]"
        : "border-[#FBCFE8] bg-white/70 hover:-translate-y-0.5 hover:border-[#F9A8D4] hover:bg-white hover:shadow-[0_10px_22px_rgba(236,72,153,.15)]"
    }`}
  >
    <span className="text-2xl transition-transform group-hover:scale-110">{option.emoji}</span>
    <span className="flex-1">
      <span className="block font-heading text-[15px] font-bold text-[#831843]">{option.title}</span>
      <span className="block text-xs leading-snug text-[#9D5C7C]">{option.desc}</span>
    </span>
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? "border-[#8B5CF6] bg-[#8B5CF6]" : "border-[#FBCFE8]"
      }`}
    >
      {selected && (
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
          <path d="M2.5 6.5 5 9l4.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  </button>
);

// onComplete({ topicId, topicTitle, level, minutesPerDay }) ต้องคืน Promise — topicId เป็น null แปลว่าหัวข้อพิมพ์อิสระ
// ต่อ API จริงเสมอ (ticket #09): curated ยิงระหว่างหน้าคั่น (~0.9 วิ), พิมพ์อิสระยิงตอนเข้า generating
export default function OnboardingFlow({ initialState = "step1", onComplete, showStateToggle = true }) {
  const [ui, setUi] = useState(initialState);
  const [topicId, setTopicId] = useState(null);
  const [customTopic, setCustomTopic] = useState("");
  const [levelId, setLevelId] = useState(null);
  const [timeId, setTimeId] = useState(null);
  const [msgIndex, setMsgIndex] = useState(0);
  // หน้าคั่นโชว์ progress ระหว่างขั้น: { done: ขั้นที่เพิ่งจบ, next: state ถัดไป }
  const [transition, setTransition] = useState(null);
  const [genError, setGenError] = useState(null);
  const ctaRef = useRef(null);

  const isCustomTopic = customTopic.trim().length > 0;
  const topicLabel =
    customTopic.trim() || TOPICS.find((t) => t.id === topicId)?.title || MOCK.fallbackCustomTopic;
  const canContinue =
    ui === "step1" ? topicId !== null || isCustomTopic : ui === "step2" ? levelId !== null : timeId !== null;

  // หมุนข้อความบนหน้ารอ + ยิง API จริงทันที — เข้า done ตอน API ตอบสำเร็จจริง ไม่ใช่จับเวลาลวงอย่างเดียว
  // curated มัก resolve เร็วมาก (~0.9 วิ) เลยตั้ง floor ไว้ให้มาสคอตได้โชว์อย่างน้อยรอบนึง ไม่วูบวาบจนดูเป็นบั๊ก
  useEffect(() => {
    if (ui !== "generating") return;
    setMsgIndex(0);
    setGenError(null);
    // นับไม่หยุดเพื่อให้ท่ามาสคอตวนต่อ — ตัวข้อความค่อย clamp ตอน render
    const rotate = setInterval(() => setMsgIndex((i) => i + 1), 2800);
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          onComplete?.({
            topicId: isCustomTopic ? null : topicId,
            topicTitle: topicLabel,
            level: levelId,
            minutesPerDay: timeId,
          }),
          new Promise((r) => setTimeout(r, 2500)),
        ]);
        if (!cancelled) setUi("done");
      } catch (err) {
        if (!cancelled) {
          setGenError(err?.message || "สร้างเควสไม่สำเร็จ ลองใหม่อีกครั้ง");
          setUi("step3");
        }
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(rotate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui]);

  // หน้าคั่นระหว่าง step ค้าง ~0.9 วิ แล้วค่อยเข้า state ถัดไป (ไม่มี API ยิงตรงนี้แล้ว — ย้ายไปรวมที่ "generating" ทั้งหมด)
  useEffect(() => {
    if (!transition) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 950));
      if (!cancelled) {
        setUi(transition.next);
        setTransition(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transition]);

  // เลือกครบแล้วเลื่อนหน้าลงไปหาปุ่มให้เอง (ถ้าปุ่มอยู่พ้นจอ)
  useEffect(() => {
    if (STEP_NUMBER[ui] && canContinue) {
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [canContinue, ui]);

  const goNext = () => {
    if (ui === "step1") setTransition({ done: 1, next: "step2" });
    else if (ui === "step2") setTransition({ done: 2, next: "step3" });
    else if (ui === "step3") setTransition({ done: 3, next: "generating" });
  };

  const step = STEP_NUMBER[ui];

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden font-body text-[#831843]"
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
        @keyframes onb-msg-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes onb-progress { 0% { width: 4%; } 55% { width: 68%; } 100% { width: 93%; } }
        @keyframes onb-fill { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
      `}</style>

      {/* toggle สำหรับ preview แต่ละ state (ปิดได้ด้วย prop ตอนต่อ flow จริง) */}
      {showStateToggle && (
        <div className="absolute inset-x-0 top-2 z-20 flex flex-wrap items-center justify-center gap-1 px-3">
          {PREVIEW_STATES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setTransition(null);
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

      {transition ? (
        /* ---------- หน้าคั่นโชว์ progress หลังกดยืนยันแต่ละขั้น ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-16 pt-14 text-center md:max-w-lg">
          <div className="flex w-full max-w-[240px] gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-2 flex-1 overflow-hidden rounded-full bg-[#FBCFE8]/70">
                {n < transition.done && (
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" />
                )}
                {n === transition.done && (
                  <div
                    className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                    style={{ animation: "onb-fill .5s ease-out both", transformOrigin: "left" }}
                  />
                )}
              </div>
            ))}
          </div>
          <p
            className="mt-4 font-heading text-3xl font-bold"
            style={{ animation: "onb-msg-in .3s ease-out" }}
          >
            {transition.done}/3
          </p>
          <p className="mt-1 text-xs text-[#9D5C7C]">
            {transition.done === 3 ? "ครบแล้ว! จัดเควสให้เลย" : "เยี่ยม ไปกันต่อ"}
          </p>
        </main>
      ) : step ? (
        /* ---------- 3 ขั้นเลือกคำตอบ ---------- */
        <main
          className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 md:max-w-xl ${
            showStateToggle ? "pt-14" : "pt-6"
          }`}
        >
          {/* แถบปุ่มย้อน — โชว์เฉพาะขั้น 2–3 (progress ไปอยู่หน้าคั่นแทน) */}
          {step > 1 && (
            <div className="mb-4 flex h-9 items-center">
              <button
                onClick={() => setUi(step === 2 ? "step1" : "step2")}
                aria-label="ย้อนกลับ"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] transition hover:border-[#8B5CF6]/50 hover:bg-white hover:text-[#8B5CF6] active:translate-y-px"
              >
                <BackIcon />
              </button>
            </div>
          )}

          {ui === "step1" && (
            <>
              <div className="flex flex-col items-center text-center">
                <h1 className="font-heading text-xl font-bold">อยากเก่งอะไร ลุยเลย</h1>
                <p className="mt-1 text-xs text-[#9D5C7C]">เลือกมา 1 หัวข้อที่อยากลุยเป็นอย่างแรก</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {TOPICS.map((t) => {
                  const selected = topicId === t.id && !isCustomTopic;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTopicId(t.id);
                        setCustomTopic("");
                      }}
                      className={`group flex min-h-[104px] cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 px-3.5 py-3 text-left transition active:translate-y-px ${
                        selected
                          ? "border-[#8B5CF6] bg-white shadow-[0_8px_20px_rgba(139,92,246,.18)]"
                          : "border-[#FBCFE8] bg-white/70 hover:-translate-y-0.5 hover:border-[#F9A8D4] hover:bg-white hover:shadow-[0_10px_22px_rgba(236,72,153,.15)]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:-rotate-6 group-hover:scale-110 ${t.tint}`}
                      >
                        <TopicIcon paths={t.icon} />
                      </span>
                      <span className="mt-0.5 font-heading text-[13px] font-bold leading-tight text-[#831843]">
                        {t.title}
                      </span>
                      <span className="text-[11px] leading-snug text-[#9D5C7C]">{t.desc}</span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold text-[#9D5C7C]">
                  หรือพิมพ์หัวข้อเองเลย ✏️
                </span>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => {
                    setCustomTopic(e.target.value);
                    if (e.target.value.trim()) setTopicId(null);
                  }}
                  placeholder="เช่น พูดอังกฤษให้คล่อง, วาดรูปดิจิทัล..."
                  className={`w-full rounded-full border-2 bg-white/90 px-4 py-2.5 text-sm text-[#831843] outline-none transition placeholder:text-[#9D5C7C]/50 focus:border-[#8B5CF6] ${
                    isCustomTopic ? "border-[#8B5CF6]" : "border-[#FBCFE8]"
                  }`}
                />
                {isCustomTopic && (
                  <span className="mt-1.5 block text-[11px] text-[#9D5C7C]">
                    หัวข้อสั่งทำพิเศษ — เดี๋ยวระบบสร้างเควสให้สด ๆ รอแป๊บเดียว
                  </span>
                )}
              </label>
            </>
          )}

          {ui === "step2" && (
            <>
              <div className="flex flex-col items-center text-center">
                <h1 className="font-heading text-xl font-bold">
                  พื้นฐาน “{topicLabel}” ของคุณ ประมาณไหน?
                </h1>
                <p className="mt-1 text-xs text-[#9D5C7C]">ตอบตรง ๆ ได้เลย เควสจะได้พอดีมือ</p>
              </div>
              <div className="mt-5 flex flex-col gap-2.5">
                {LEVELS.map((lv) => (
                  <OptionRow key={lv.id} option={lv} selected={levelId === lv.id} onSelect={() => setLevelId(lv.id)} />
                ))}
              </div>
            </>
          )}

          {ui === "step3" && (
            <>
              {genError && (
                <div className="mb-4 flex items-center gap-1.5 self-center rounded-full bg-red-100 px-3 py-1.5 text-[11px] text-red-600">
                  ⚠️ {genError}
                </div>
              )}
              <div className="flex flex-col items-center text-center">
                <h1 className="font-heading text-xl font-bold">ว่างให้ลุยวันละกี่นาที?</h1>
                <p className="mt-1 text-xs text-[#9D5C7C]">เลือกตามจริง — น้อยแต่สม่ำเสมอ ชนะขาด</p>
              </div>
              <div className="mt-5 flex flex-col gap-2.5">
                {TIMES.map((t) => (
                  <OptionRow key={t.id} option={t} selected={timeId === t.id} onSelect={() => setTimeId(t.id)} />
                ))}
              </div>
            </>
          )}

          {/* CTA โผล่หลังเลือกแล้ว — เลื่อนหน้าลงมาหาปุ่มให้เอง */}
          {canContinue && (
            <div
              ref={ctaRef}
              className="mt-auto pb-1 pt-6"
              style={{ animation: "onb-msg-in .25s ease-out" }}
            >
              <button
                onClick={goNext}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
              >
                {ui === "step3" ? "เริ่มลุยเลย 🚀" : "ลุยต่อ"}
              </button>
            </div>
          )}
        </main>
      ) : (
        /* ---------- generating / done — จอเต็มกลางจอแบบหน้า login ---------- */
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-16 pt-14 text-center md:max-w-lg">
          <GhostMascot
            mood={ui === "done" ? "celebrate" : GEN_MOODS[msgIndex % GEN_MOODS.length]}
            className="mb-6 scale-90"
          />

          {ui === "generating" ? (
            <>
              <h1 className="font-heading text-xl font-bold">กำลังสร้างเควสให้...</h1>
              <span className="mt-2 inline-block rounded-full border border-[#FBCFE8] bg-white/80 px-3.5 py-1 text-xs font-bold text-[#8B5CF6]">
                {topicLabel}
              </span>

              {/* key ให้ข้อความ fade เข้าใหม่ทุกครั้งที่เปลี่ยน (clamp ค้างข้อความสุดท้าย) */}
              <p
                key={Math.min(msgIndex, GENERATING_STEPS.length - 1)}
                className="mt-4 min-h-[2.5rem] text-sm leading-relaxed text-[#9D5C7C]"
                style={{ animation: "onb-msg-in .4s ease-out" }}
              >
                {GENERATING_STEPS[Math.min(msgIndex, GENERATING_STEPS.length - 1)]
                  .replace("{topic}", topicLabel)
                  .replace("{time}", String(timeId ?? 30))}
              </p>

              <div className="mt-5 h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-[#FBCFE8]/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                  style={{ animation: "onb-progress 16s ease-out forwards" }}
                />
              </div>
              <p className="mt-3 text-[11px] text-[#9D5C7C]/80">
                หัวข้อสั่งทำพิเศษ ขอเวลาแป๊บ — ปกติไม่เกิน 20 วิ
              </p>
            </>
          ) : (
            <>
              <h1 className="font-heading text-xl font-bold">เควสแรกพร้อมแล้ว! 🎉</h1>
              <p className="mt-2 text-sm text-[#9D5C7C]">กำลังพาไปลุย “{topicLabel}”...</p>
              <span className="mt-5 h-5 w-5 animate-spin rounded-full border-[2.5px] border-[#8B5CF6]/30 border-t-[#8B5CF6]" />
            </>
          )}
        </main>
      )}
    </div>
  );
}
