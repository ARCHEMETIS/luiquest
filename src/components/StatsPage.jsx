// หน้า /stats สาธารณะของลุยเควส (ticket #9) — ไม่ต้องล็อกอิน คนนอก/อาจารย์เปิดดูได้ทันที
// โชว์การเติบโตของแอพเป็น social proof ล้วน ๆ — ห้ามมีชื่อ/ข้อมูลส่วนตัวใด ๆ ตาม design-brief section 3.10
// mock data ด้านล่าง ฝั่งโค้ดต่อ endpoint aggregate จริงเองภายหลัง
// states: loading (skeleton) | ready (แอพโตแล้ว) | early (เพิ่งเปิดตัว ตัวเลขยังน้อย — ต้องดูมีอนาคต ไม่โล่งเหงา)

import { useEffect, useRef, useState } from "react";
import GhostMascot from "./GhostMascot";
import { LuiQuestFavicon } from "./LuiQuestLogo";

const MOCK = {
  ready: {
    totalSignups: 3842,
    activeUsers: 2615,
    questsCompleted: 48920,
    maxStreak: 62,
    avgStreak: 9,
    // จุดข้อมูลกราฟสะสม — ไม่ผูกกับจำนวนวันที่ตายตัว (ของจริงมาจาก endpoint) เลยไม่ใส่ label ช่วงเวลาเป๊ะ ๆ
    growth: [210, 480, 760, 1050, 1360, 1690, 2040, 2390, 2720, 3040, 3340, 3620, 3780, 3842],
  },
  early: {
    totalSignups: 34,
    activeUsers: 21,
    questsCompleted: 186,
    maxStreak: 11,
    avgStreak: 3,
    growth: [3, 6, 11, 17, 23, 28, 34],
  },
};

const PREVIEW_STATES = [
  { id: "loading", label: "โหลด" },
  { id: "ready", label: "โตแล้ว" },
  { id: "early", label: "เพิ่งเปิดตัว" },
];

// path จาก Heroicons 24/outline (assets/heroicons — MIT)
const ICON_PATHS = {
  users: [
    "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  ],
  bolt: ["m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"],
  checkBadge: [
    "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
  ],
  fire: [
    "M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z",
    "M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z",
  ],
  chartBar: [
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  ],
  sparkles: [
    "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
  ],
  rocket: [
    "M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  ],
  arrowRightCircle: ["m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
};

const Icon = ({ name, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={className}>
    {ICON_PATHS[name].map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

// นับตัวเลขวิ่งจากค่าก่อนหน้า → ค่าใหม่ (ครั้งแรกค่าก่อนหน้า = 0 เสมอ เลยได้เอฟเฟกต์นับจาก 0 แบบเดิมตอนโผล่จอ)
// ไล่จากค่าก่อนหน้าแทนที่จะรีเซ็ตเป็น 0 ทุกครั้ง เพื่อรองรับ useLiveTick ที่ขยับเลขทีละนิดหลังโผล่จอแล้ว
// (pattern เดิมจาก useCountUp ใน LeaderboardPage ticket #6 ต่อยอด)
const useCountUp = (target, delayMs = 0, durationMs = 900) => {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    const startValue = prevTarget.current;
    let raf;
    let start;
    const timer = setTimeout(() => {
      const tick = (t) => {
        if (start === undefined) start = t;
        const progress = Math.min((t - start) / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setValue(Math.round(startValue + (target - startValue) * eased));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    prevTarget.current = target;
    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, delayMs, durationMs]);
  return value;
};

// จำลองตัวเลขขยับสดเบา ๆ ให้สมกับ badge "ข้อมูลสด" — บวกทีละนิดแบบสุ่มทุก ~3-8 วิ ไม่ใช่ real-time จาก backend จริง
// (ของจริงต่อ WebSocket/polling endpoint เอง อันนี้แค่จำลองให้ตัวเลขไม่นิ่งค้างเฉย ๆ)
const useLiveTick = (base, active, step = [1, 2], everyMs = [4000, 7000]) => {
  const [value, setValue] = useState(base);
  useEffect(() => {
    setValue(base);
    if (!active) return;
    let timer;
    const schedule = () => {
      const wait = everyMs[0] + Math.random() * (everyMs[1] - everyMs[0]);
      timer = setTimeout(() => {
        setValue((v) => v + Math.floor(step[0] + Math.random() * (step[1] - step[0] + 1)));
        schedule();
      }, wait);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [base, active]);
  return value;
};

const CountUp = ({ value, delay = 0, className }) => {
  const shown = useCountUp(value, delay);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {shown.toLocaleString()}
    </span>
  );
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
};

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-[#FBCFE8]/50 ${className}`} />;

// ประกายวนรอบตัวเลข "ใช้งานจริง" — เน้นว่าเป็นเลขเด่นสุดของหน้า ตามหลัก "เอฟเฟกต์ต้องใหญ่ใจถึง" (steps() + ระยะ 40-52px)
const HERO_SPARKS = [
  { left: "-16%", top: "-8%", delay: "0s", travel: 46, color: "#FBBF24", shadow: "#B45309", char: "✦" },
  { right: "-14%", top: "-4%", delay: ".3s", travel: 42, color: "#EC4899", shadow: "#FBCFE8", char: "✧" },
  { left: "-8%", top: "84%", delay: ".6s", travel: 44, color: "#8B5CF6", shadow: "#FBCFE8", char: "✦" },
  { right: "-6%", top: "80%", delay: ".9s", travel: 48, color: "#FBBF24", shadow: "#B45309", char: "✧" },
];

const StatTile = ({ icon, label, value, suffix, delay = 0, accent = false }) => (
  <div
    className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[#FBCFE8] bg-white/70 px-2 py-3 text-center"
    style={{ animation: "stats-pop .4s ease-out both", animationDelay: `${delay}ms` }}
  >
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-xl ${
        accent ? "bg-amber-100 text-amber-600" : "bg-violet-100 text-violet-600"
      }`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </span>
    <span className="flex items-baseline gap-0.5">
      <CountUp value={value} delay={delay + 100} className="font-heading text-lg font-bold text-[#831843]" />
      <span className="text-[10px] text-[#9D5C7C]">{suffix}</span>
    </span>
    <span className="text-[9px] leading-tight text-[#9D5C7C]">{label}</span>
  </div>
);

// ---------- กราฟเติบโตสะสม (SVG มือ ไม่พึ่ง chart library) ----------
const CHART_W = 300;
const CHART_H = 112;
const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 4;
const CHART_PAD_X = 7; // กันจุดวงกลม/พัลส์ที่ปลายเส้นโดนตัดขอบซ้ายขวาของ viewBox
const CHART_INNER_H = CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;
const CHART_INNER_W = CHART_W - CHART_PAD_X * 2;

const buildLinePath = (points) => points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

const buildAreaPath = (points, baselineY) => {
  const line = buildLinePath(points);
  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  return `${line} L${lastX.toFixed(1)},${baselineY} L${firstX.toFixed(1)},${baselineY} Z`;
};

// ต่อแนวโน้มถัดไปจากจุดสุดท้าย — ใช้ตอนแอพเพิ่งเปิด (state early) ให้กราฟดูมีอนาคตต่อ ไม่ใช่จบห้วน ๆ
// กันกรณีจุดสองจุดสุดท้ายโตช้าผิดปกติด้วย floor ที่ 12% ของค่าสุดท้าย ไม่ให้เส้นแนวโน้มแบนจนดูไม่มีอนาคต
const extrapolateTrend = (values, count) => {
  const n = values.length;
  const last = values[n - 1];
  const prevGrowth = last - values[Math.max(n - 2, 0)];
  const step = Math.max(prevGrowth, Math.round(last * 0.12), 1);
  return Array.from({ length: count }, (_, i) => last + step * (i + 1));
};

function GrowthChart({ values, trend = false, delay = 0 }) {
  const pathRef = useRef(null);
  const [drawn, setDrawn] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const trendValues = trend ? extrapolateTrend(values, 4) : [];
  const combined = [...values, ...trendValues];
  const max = Math.max(...combined);
  const step = CHART_INNER_W / (combined.length - 1);
  const toY = (v) => CHART_PAD_TOP + (1 - v / max) * CHART_INNER_H;
  const points = combined.map((v, i) => [CHART_PAD_X + i * step, toY(v)]);
  const realPoints = points.slice(0, values.length);
  const trendPoints = trend ? points.slice(values.length - 1) : [];
  const baselineY = CHART_PAD_TOP + CHART_INNER_H;

  const linePath = buildLinePath(realPoints);
  const areaPath = buildAreaPath(realPoints, baselineY);
  const trendPath = trend ? buildLinePath(trendPoints) : "";
  const lastPoint = realPoints[realPoints.length - 1];
  const lastValue = values[values.length - 1];

  // วาดเส้นด้วย stroke-dashoffset จาก 0% → 100% ให้ความรู้สึกเหมือนเส้นค่อย ๆ ลากขึ้นจริง ๆ
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    setDrawn(false);
    if (reduceMotion) {
      setDrawn(true);
      return;
    }
    const length = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.getBoundingClientRect(); // force reflow ก่อนเริ่ม transition ถัดไป
    const timer = setTimeout(() => {
      el.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)";
      el.style.strokeDashoffset = "0";
      setDrawn(true);
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath, reduceMotion, delay]);

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        role="img"
        aria-label={`กราฟผู้ใช้สะสมเพิ่มขึ้นจาก ${values[0].toLocaleString()} คน เป็น ${lastValue.toLocaleString()} คน`}
      >
        <defs>
          <linearGradient id="statsAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity=".28" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="statsLineStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        {/* เส้นกริดแนวนอนจาง ๆ ไม่แข่งกับข้อมูล */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={CHART_W}
            y1={CHART_PAD_TOP + CHART_INNER_H * f}
            y2={CHART_PAD_TOP + CHART_INNER_H * f}
            stroke="#FBCFE8"
            strokeWidth="1"
          />
        ))}
        <path d={areaPath} fill="url(#statsAreaFill)" />
        {trend && (
          <path d={trendPath} fill="none" stroke="#EC4899" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" opacity=".45" />
        )}
        <path ref={pathRef} d={linePath} fill="none" stroke="url(#statsLineStroke)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        {lastPoint && (
          <g style={{ opacity: drawn ? 1 : 0, transition: "opacity .3s ease-out" }}>
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="3.5" fill="#fff" stroke="#8B5CF6" strokeWidth="2" />
            {!reduceMotion && (
              <circle cx={lastPoint[0]} cy={lastPoint[1]} r="5" fill="#8B5CF6" opacity=".22">
                <animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".22;0;.22" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#9D5C7C]">
        <span>เปิดตัว</span>
        {trend && <span className="text-[#EC4899]">แนวโน้มถัดไป ✦</span>}
        <span className="font-bold text-[#831843]">วันนี้ • {lastValue.toLocaleString()} คน</span>
      </div>
    </div>
  );
}

export default function StatsPage({ initialState = "ready", onLogin, showStateToggle = true }) {
  const [ui, setUi] = useState(initialState);
  const loading = ui === "loading";
  const early = ui === "early";
  const data = loading ? null : MOCK[ui] ?? MOCK.ready;

  // ตัวเลขที่ "ขยับสด" ได้จริงในโลกจริง (ผู้ใช้/เควสสำเร็จ) ให้ขยับเบา ๆ ต่อเนื่อง — สถิติที่นิ่งกว่า (streak สูงสุด/เฉลี่ย) ปล่อยนิ่งไว้ตามเดิม
  const liveActiveUsers = useLiveTick(data?.activeUsers ?? 0, !loading, [1, 2], [4000, 7000]);
  const liveTotalSignups = useLiveTick(data?.totalSignups ?? 0, !loading, [1, 3], [3500, 6500]);
  const liveQuestsCompleted = useLiveTick(data?.questsCompleted ?? 0, !loading, [2, 6], [2500, 5000]);
  const activePct = data ? Math.round((liveActiveUsers / liveTotalSignups) * 100) : 0;

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
        @keyframes stats-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes stats-pop { 0% { opacity: 0; transform: translateY(10px) scale(.75); } 65% { opacity: 1; transform: translateY(-3px) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes stats-spark { 0% { opacity: 0; transform: translateY(0) scale(.4) rotate(0deg); } 30% { opacity: 1; transform: translateY(calc(var(--spark-travel) * -.55)) scale(1.15) rotate(16deg); } 100% { opacity: 0; transform: translateY(calc(var(--spark-travel) * -1)) scale(.85) rotate(-12deg); } }
        @keyframes stats-icon-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,.35); } 50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); } }
      `}</style>

      {/* toggle สำหรับ preview แต่ละ state (ปิดได้ด้วย prop ตอนต่อ flow จริง) */}
      {showStateToggle && (
        <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 gap-1">
          {PREVIEW_STATES.map((s) => (
            <button
              key={s.id}
              onClick={() => setUi(s.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] transition ${
                ui === s.id ? "bg-[#8B5CF6] text-white" : "border border-[#FBCFE8] bg-white/80 text-[#9D5C7C]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        /* ---------- skeleton — จองที่ตามโครงจริง กัน layout เด้ง ---------- */
        <main className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pb-10 md:max-w-xl ${showStateToggle ? "pt-14" : "pt-6"}`}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-44" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-44" />
        </main>
      ) : (
        <main key={ui} className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pb-10 md:max-w-xl ${showStateToggle ? "pt-14" : "pt-6"}`}>
          {/* หัวจอ: แบรนด์ + ปุ่มเข้าสู่ระบบ (หน้านี้คนนอกเห็น ต้องมีทางไป login) */}
          <div className="flex items-center justify-between" style={{ animation: "stats-in .35s ease-out both" }}>
            <div className="flex items-center gap-2">
              <LuiQuestFavicon />
              <span className="font-heading text-sm font-bold">ลุยเควส</span>
            </div>
            <button
              onClick={() => onLogin?.()}
              className="flex items-center gap-1 rounded-full border border-[#FBCFE8] bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#8B5CF6] transition hover:border-[#8B5CF6]/50 hover:bg-white active:translate-y-px"
            >
              เข้าสู่ระบบ
              <Icon name="arrowRightCircle" className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* ตัวเลข headline — "ใช้งานจริง" เด่นกว่า "สมัครแล้ว" ตามบรีฟ — เป็นเลขเด่นสุดของหน้า ใส่ประกาย+glow ให้สมฐานะ */}
          <div className="flex flex-col items-center text-center" style={{ animation: "stats-pop .45s ease-out .05s both" }}>
            <p className="font-heading text-xs font-bold uppercase tracking-wide text-[#9D5C7C]">
              {early ? "เพิ่งเปิดตัว แต่กำลังไปได้สวย" : "ลุยเควสกำลังเติบโต"}
            </p>
            <div className="relative mt-2 flex items-center justify-center gap-2">
              {HERO_SPARKS.map((s, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="pointer-events-none absolute text-base"
                  style={{
                    left: s.left,
                    right: s.right,
                    top: s.top,
                    color: s.color,
                    textShadow: `1px 1px 0 ${s.shadow}`,
                    "--spark-travel": `${s.travel}px`,
                    animation: `stats-spark 1.8s steps(6) ${s.delay} infinite`,
                  }}
                >
                  {s.char}
                </span>
              ))}
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100">
                <span className="absolute inset-0 rounded-full" style={{ animation: "stats-icon-glow 2.2s ease-in-out infinite" }} />
                <Icon name="bolt" className="h-5 w-5 text-[#8B5CF6]" />
              </span>
              <CountUp
                value={liveActiveUsers}
                delay={150}
                className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text font-heading text-6xl font-bold leading-none text-transparent"
              />
            </div>
            <p className="mt-1 text-xs font-bold text-[#9D5C7C]">คนใช้งานจริง</p>
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#8B5CF6]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8B5CF6] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8B5CF6]" />
              </span>
              ข้อมูลสด อัพเดตวันนี้
            </span>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#FBCFE8] bg-white/70 px-3.5 py-1.5 text-[12px] text-[#9D5C7C]">
              <Icon name="users" className="h-3.5 w-3.5" />
              สมัครแล้ว <CountUp value={liveTotalSignups} delay={250} className="font-bold text-[#831843]" /> คน
            </div>
            <p className="mt-1.5 text-[10px] text-[#9D5C7C]/80">{activePct}% ของคนที่สมัคร ยังลุยต่อเนื่อง</p>
          </div>

          {/* กราฟการเติบโตสะสม */}
          <div
            className="rounded-2xl border-2 border-[#FBCFE8] bg-white/70 p-4 shadow-[0_6px_18px_rgba(139,92,246,.12)]"
            style={{ animation: "stats-in .35s ease-out .1s both" }}
          >
            <div className="flex items-center gap-1.5">
              <Icon name="chartBar" className="h-4 w-4 text-[#8B5CF6]" />
              <h2 className="font-heading text-[13px] font-bold">การเติบโตของผู้ใช้สะสม</h2>
            </div>
            <div className="mt-3">
              <GrowthChart key={ui} values={data.growth} trend={early} delay={300} />
            </div>
          </div>

          {/* ตัวเลขรอง social-proof */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon="checkBadge" label="เควสสำเร็จรวม" value={liveQuestsCompleted} suffix="ครั้ง" delay={350} />
            <StatTile icon="fire" label="streak สูงสุด" value={data.maxStreak} suffix="วัน" delay={400} accent />
            <StatTile icon="sparkles" label="streak เฉลี่ย" value={data.avgStreak} suffix="วัน" delay={450} />
          </div>

          {/* แบรนด์ + CTA — social proof มาก่อน ค่อยชวนสมัครปิดท้าย */}
          <div
            className="flex flex-col items-center rounded-2xl border-2 border-[#FBCFE8] bg-white/80 px-6 pb-6 pt-8 text-center"
            style={{ animation: "stats-in .35s ease-out .15s both" }}
          >
            <GhostMascot mood={early ? "groove" : "celebrate"} className="scale-90" />
            <h2 className="mt-2 font-heading text-base font-bold">
              {early ? "เป็นหนึ่งในคนกลุ่มแรกที่ได้ลุย" : "อยากลุยไปด้วยกันมั้ย?"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">
              เลือกหัวข้อที่อยากเก่ง แล้วเริ่มเก็บ XP ต่อ streak ไปกับเพื่อน ๆ ได้เลยวันนี้
            </p>
            <button
              onClick={() => onLogin?.()}
              className="mt-4 flex w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px"
            >
              <Icon name="rocket" className="h-4 w-4" />
              เริ่มลุยเลย ฟรี
            </button>
          </div>

          <p className="text-center text-[10px] text-[#9D5C7C]/70">อยากเก่งอะไร ลุยเลย — วันละเควส</p>
        </main>
      )}
    </div>
  );
}
