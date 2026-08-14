const PIXEL_COLOR = {
  ".": "transparent",
  S: "#A78BFA",
  B: "#8B5CF6",
  W: "#ffffff",
  P: "#831843",
  E: "#F472B6",
};

const GRID = [
  "..SSSS..",
  ".SSSSSS.",
  "SSBBBBSS",
  "SWWBBWWS",
  "SWPBBPWS",
  "SBBBBBBS",
  "SBBBBBBS",
  "EEEEEEEE",
  "E.E.E.E.",
];

const GLITTER = [
  { left: "14%", top: "22%", color: "#FBBF24", delay: "0s", size: "1.1rem", char: "✦" },
  { right: "12%", top: "18%", color: "#F472B6", delay: ".08s", size: "1.1rem", char: "✧" },
  { left: "46%", top: "4%", color: "#8B5CF6", delay: ".05s", size: "1.1rem", char: "✦" },
  { left: "26%", top: "10%", color: "#F472B6", delay: ".15s", size: "1.1rem", char: "✧" },
  { right: "24%", top: "30%", color: "#FBBF24", delay: ".12s", size: ".85rem", char: "✦" },
  { left: "6%", top: "44%", color: "#8B5CF6", delay: ".2s", size: ".9rem", char: "✧" },
  { right: "6%", top: "46%", color: "#FBBF24", delay: ".18s", size: "1.1rem", char: "✦" },
  { left: "60%", top: "8%", color: "#8B5CF6", delay: ".1s", size: ".85rem", char: "✧" },
  { left: "36%", top: "38%", color: "#F472B6", delay: ".25s", size: ".8rem", char: "✦" },
];

const TEARS = [
  { left: "14%", top: "46%", delay: "0s" },
  { left: "75%", top: "46%", delay: ".45s" },
  { left: "20%", top: "48%", delay: ".85s" },
  { left: "69%", top: "48%", delay: "1.1s" },
];

// จุดระเบิดพลุหลังตัว (mood "fireworks") — size = รัศมีกระจายของเม็ดพลุ
const FIREWORKS = [
  { left: "-22%", top: "6%", color: "#FBBF24", delay: "0s", size: 26 },
  { right: "-24%", top: "0%", color: "#F472B6", delay: ".55s", size: 30 },
  { left: "10%", top: "-20%", color: "#8B5CF6", delay: "1.1s", size: 24 },
  { right: "4%", top: "-8%", color: "#34D399", delay: ".8s", size: 20 },
];
const BURST_DIRS = [
  [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7],
];

// โน้ตเพลงลอยตอนเต้น (mood "groove")
const NOTES = [
  { left: "-34%", top: "14%", delay: "0s", char: "♪", color: "#8B5CF6" },
  { right: "-32%", top: "26%", delay: ".5s", char: "♫", color: "#EC4899" },
  { left: "-4%", top: "-16%", delay: "1s", char: "♩", color: "#F59E0B" },
  { right: "2%", top: "-22%", delay: "1.4s", char: "♪", color: "#8B5CF6" },
];

// ลูกศรทองพุ่งขึ้นฟ้าตอนแรงค์อัพ (mood "rankup")
const RANK_ARROWS = [
  { left: "-28%", delay: "0s", size: "18px" },
  { right: "-26%", delay: ".5s", size: "16px" },
  { left: "38%", delay: ".9s", size: "14px" },
];

// ประกายไฟตรงหัวค้อน (mood "building") — เด้งพร้อมจังหวะที่ค้อนลง
const SPARKS = [
  { left: "-26%", top: "26%", color: "#FBBF24", delay: "0s", size: ".8rem", char: "✦" },
  { left: "-32%", top: "40%", color: "#F472B6", delay: ".3s", size: ".7rem", char: "✧" },
  { left: "-18%", top: "44%", color: "#FBBF24", delay: ".15s", size: ".65rem", char: "✦" },
];

const MOOD_ANIMATION = {
  idle: "ghost-idle 1.2s steps(2) infinite",
  celebrate: "ghost-jump .5s steps(2) 3",
  sad: "ghost-sad 2s steps(3) infinite",
  sixseven: "ghost-sixseven 1s steps(2) infinite",
  fireworks: "ghost-bounce .7s steps(2) infinite",
  rankup: "ghost-rankup 1.6s steps(4) infinite",
  groove: "ghost-dance .9s steps(2) infinite",
  building: "ghost-build 1.2s steps(2) infinite",
};

// mood: "idle" | "celebrate" | "sad" | "sixseven" (ท่ามีม 6-7 มือชั่งซ้ายขวา)
//       | "fireworks" (พลุระเบิดหลังตัว) | "rankup" (SSS เด้งบนหัว) | "groove" (เต้น+โน้ตเพลง)
//       | "building" (ตอกค้อน+ประกายไฟ — ใช้กับฟีเจอร์ที่ยังทำไม่เสร็จ)
// — prop celebrate เดิม (จาก ticket 11) ยังใช้ได้
//
// ★ ทำไม "building" ไม่ใช่ "sad" สำหรับหน้าที่ยังไม่เปิด (14 ส.ค. 2026):
//   ผีร้องไห้ = ขอโทษที่ทำพัง แต่ฟีเจอร์ที่ยังไม่เสร็จไม่ได้พัง มันกำลังมา
//   ท่าตอกค้อนสื่อว่า "ทำอยู่ อีกนิดเดียว" ซึ่งตรงกับความจริงและไม่ทำให้คนดูรู้สึกว่าแอพมีปัญหา
export default function GhostMascot({ celebrate = false, mood, className = "" }) {
  const activeMood = mood || (celebrate ? "celebrate" : "idle");

  return (
    <div className={`relative inline-block ${className}`}>
      <style>{`
        @keyframes ghost-idle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes ghost-jump { 0%,100% { transform: translateY(0) scale(1); } 40% { transform: translateY(-22px) scale(1.05); } 70% { transform: translateY(0) scale(.96); } }
        @keyframes ghost-sad { 0%,100% { transform: translateY(3px) scale(1,.97); } 50% { transform: translateY(6px) scale(1,.94); } }
        @keyframes ghost-dance { 0%,100% { transform: rotate(-9deg) translateY(0); } 50% { transform: rotate(9deg) translateY(-4px); } }
        @keyframes ghost-sixseven { 0%,100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(6deg) translateY(-3px); } }
        @keyframes ghost-bounce { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-10px) scale(1.03,.97); } }
        @keyframes ghost-rankup { 0%,20%,100% { transform: translateY(0) scale(1); } 10% { transform: translateY(-14px) scale(1.05); } }
        @keyframes ghost-build { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes ghost-hammer { 0%,100% { transform: rotate(-52deg); } 45%,55% { transform: rotate(14deg); } }
        @keyframes ghost-spark { 0%,40% { opacity: 0; transform: translateY(2px) scale(.4); } 50% { opacity: 1; transform: translateY(-5px) scale(1.1); } 100% { opacity: 0; transform: translateY(-14px) scale(.8); } }
        @keyframes ghost-hand-l { 0%,100% { transform: translateY(-8px); } 50% { transform: translateY(6px); } }
        @keyframes ghost-hand-r { 0%,100% { transform: translateY(6px); } 50% { transform: translateY(-8px); } }
        @keyframes ghost-num-pop { 0%,45%,100% { opacity: 0; transform: translateY(4px) scale(.6); } 10%,35% { opacity: 1; transform: translateY(-6px) scale(1); } }
        @keyframes ghost-fw { 0% { transform: scale(.15); opacity: 0; } 15% { opacity: 1; } 70% { transform: scale(1); opacity: .9; } 100% { transform: scale(1.3); opacity: 0; } }
        @keyframes ghost-sss { 0% { opacity: 0; transform: translate(-50%,6px) scale(.4); } 15% { opacity: 1; transform: translate(-50%,-10px) scale(1.15); } 30% { transform: translate(-50%,-8px) scale(1); } 75% { opacity: 1; transform: translate(-50%,-8px) scale(1); } 100% { opacity: 0; transform: translate(-50%,-18px) scale(1); } }
        @keyframes ghost-note { 0% { opacity: 0; transform: translateY(8px) scale(.6) rotate(0deg); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-42px) scale(1.15) rotate(16deg); } }
        @keyframes ghost-arrow { 0% { opacity: 0; transform: translateY(12px) scale(.7); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-52px) scale(1.1); } }
        @keyframes ghost-glitter-pop {
          0% { opacity: 0; transform: translateY(0) scale(.4) rotate(0deg); }
          25% { opacity: 1; transform: translateY(-8px) scale(1.15) rotate(20deg); }
          100% { opacity: 0; transform: translateY(-38px) scale(.9) rotate(-15deg); }
        }
        @keyframes ghost-tear-fall {
          0% { opacity: 0; transform: translateY(0); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translateY(30px); }
        }
        @keyframes ghost-puddle-grow {
          0% { transform: translateX(-50%) scaleX(.55); opacity: .45; }
          100% { transform: translateX(-50%) scaleX(1); opacity: .85; }
        }
      `}</style>

      <div
        className="grid grid-cols-8 grid-rows-9 gap-0 w-24 h-[108px]"
        style={{ animation: MOOD_ANIMATION[activeMood] }}
      >
        {GRID.flatMap((row, r) =>
          row.split("").map((cell, c) => (
            <div key={`${r}-${c}`} className="w-3 h-3" style={{ background: PIXEL_COLOR[cell] }} />
          ))
        )}
      </div>

      {activeMood === "celebrate" &&
        GLITTER.map((g, i) => (
          <span
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: g.left,
              right: g.right,
              top: g.top,
              color: g.color,
              fontSize: g.size,
              animation: `ghost-glitter-pop 1.1s steps(4) ${g.delay}`,
            }}
          >
            {g.char}
          </span>
        ))}

      {/* ท่า 6-7: มือพิกเซลสองข้างชั่งขึ้นลงสลับกัน + เลข 6/7 เด้งสลับ */}
      {activeMood === "sixseven" && (
        <>
          <span
            className="pointer-events-none absolute -left-5 top-1/2 h-2.5 w-3.5 rounded-[2px] bg-[#A78BFA]"
            style={{ animation: "ghost-hand-l 1s steps(2) infinite" }}
          />
          <span
            className="pointer-events-none absolute -right-5 top-1/2 h-2.5 w-3.5 rounded-[2px] bg-[#A78BFA]"
            style={{ animation: "ghost-hand-r 1s steps(2) infinite" }}
          />
          <span
            className="pointer-events-none absolute -left-10 -top-6 font-heading text-3xl font-bold text-[#8B5CF6]"
            style={{ textShadow: "2px 2px 0 #FBCFE8", animation: "ghost-num-pop 2s steps(3) infinite" }}
          >
            6
          </span>
          <span
            className="pointer-events-none absolute -right-10 -top-6 font-heading text-3xl font-bold text-[#EC4899]"
            style={{ textShadow: "2px 2px 0 #FBCFE8", animation: "ghost-num-pop 2s steps(3) 1s infinite" }}
          >
            7
          </span>
        </>
      )}

      {/* พลุระเบิดด้านหลังตัว (zIndex -1 = อยู่หลังผี) */}
      {activeMood === "fireworks" &&
        FIREWORKS.map((f, i) => (
          <span
            key={i}
            className="pointer-events-none absolute"
            style={{
              left: f.left,
              right: f.right,
              top: f.top,
              zIndex: -1,
              animation: `ghost-fw 1.6s steps(5) ${f.delay} infinite`,
            }}
          >
            {BURST_DIRS.map((d, j) => (
              <span
                key={j}
                className="absolute h-1.5 w-1.5 rounded-[1px]"
                style={{ background: f.color, left: d[0] * f.size + "px", top: d[1] * f.size + "px" }}
              />
            ))}
          </span>
        ))}

      {/* แรงค์อัพ: SSS สีทองสไตล์พิกเซลเด้งบนหัว + ประกาย */}
      {activeMood === "rankup" && (
        <>
          <span
            className="pointer-events-none absolute -top-11 left-1/2 font-heading text-2xl font-bold"
            style={{
              color: "#FBBF24",
              letterSpacing: "3px",
              textShadow: "2px 2px 0 #B45309, -2px 2px 0 #B45309, 0 3px 0 #92400E",
              animation: "ghost-sss 1.6s steps(4) infinite",
            }}
          >
            SSS
          </span>
          {RANK_ARROWS.map((a, i) => (
            <span
              key={i}
              className="pointer-events-none absolute top-1/3 font-bold"
              style={{
                left: a.left,
                right: a.right,
                color: "#FBBF24",
                fontSize: a.size,
                textShadow: "1px 1px 0 #B45309",
                animation: `ghost-arrow 1.2s steps(4) ${a.delay} infinite`,
              }}
            >
              ▲
            </span>
          ))}
          <span
            className="pointer-events-none absolute -left-4 -top-4 text-xs"
            style={{ color: "#FBBF24", animation: "ghost-glitter-pop 1.6s steps(4) .2s infinite" }}
          >
            ✦
          </span>
          <span
            className="pointer-events-none absolute -right-4 -top-3 text-xs"
            style={{ color: "#F472B6", animation: "ghost-glitter-pop 1.6s steps(4) .7s infinite" }}
          >
            ✧
          </span>
        </>
      )}

      {/* เต้น groove: โน้ตเพลงลอยขึ้นรอบตัว */}
      {activeMood === "groove" &&
        NOTES.map((n, i) => (
          <span
            key={i}
            className="pointer-events-none absolute font-bold"
            style={{
              left: n.left,
              right: n.right,
              top: n.top,
              color: n.color,
              fontSize: "24px",
              textShadow: "1px 1px 0 #FBCFE8",
              animation: `ghost-note 1.8s steps(4) ${n.delay} infinite`,
            }}
          >
            {n.char}
          </span>
        ))}

      {/* กำลังสร้าง: หมวกวิศวะ + ค้อนพิกเซลตอกลงซ้ำ ๆ + ประกายไฟกระเด็น */}
      {activeMood === "building" && (
        <>
          {/* หมวกเซฟตี้ใบใหญ่ ครอบลงมาถึงเหนือตา — inset-0 ให้พิกัดลูกอิงกล่องตัวผีทั้งใบ
              และใส่ animation เดียวกับตัวผี จะได้ขยับพร้อมกันไม่หลุดจากหัว */}
          <span
            className="pointer-events-none absolute inset-0"
            style={{ animation: "ghost-build 1.2s steps(2) infinite" }}
          >
            {/* โดม */}
            <span className="absolute -top-[10px] left-1/2 h-[32px] w-[64px] -translate-x-1/2 rounded-t-[30px] bg-[#FBBF24]" />
            {/* สันกลางหมวก */}
            <span className="absolute -top-[10px] left-1/2 h-[32px] w-[11px] -translate-x-1/2 rounded-t-[6px] bg-[#F59E0B]" />
            {/* ปีกหมวก — กว้างเกินหัวเล็กน้อยให้ดูครอบจริง */}
            <span className="absolute top-[19px] left-1/2 h-[10px] w-[88px] -translate-x-1/2 rounded-[5px] bg-[#F59E0B]" />
            {/* เงาใต้ปีกหมวกที่ทาบลงบนหัวผี */}
            <span className="absolute top-[29px] left-1/2 h-[4px] w-[72px] -translate-x-1/2 rounded-b-[4px] bg-[#B45309]/30" />
          </span>

          {/* ค้อน = ด้ามยาว + หัวค้อนสี่เหลี่ยม หมุนรอบจุดหมุนที่ปลายด้าม (มือผี) */}
          <span
            className="pointer-events-none absolute -left-2 top-[38%] h-[22px] w-[5px] origin-bottom rounded-[1px] bg-[#B45309]"
            style={{ animation: "ghost-hammer 1.2s steps(3) infinite" }}
          >
            <span className="absolute -left-[7px] -top-[3px] h-2.5 w-[19px] rounded-[2px] bg-[#94A3B8]" />
          </span>
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="pointer-events-none absolute font-bold"
              style={{
                left: s.left,
                top: s.top,
                color: s.color,
                fontSize: s.size,
                animation: `ghost-spark 1.2s steps(3) ${s.delay} infinite`,
              }}
            >
              {s.char}
            </span>
          ))}
        </>
      )}

      {activeMood === "sad" && (
        <>
          {TEARS.map((t, i) => (
            <span
              key={i}
              className="absolute pointer-events-none w-1.5 h-[7px] bg-[#93C5FD] rounded-[1px_1px_3px_3px]"
              style={{
                left: t.left,
                top: t.top,
                animation: `ghost-tear-fall 1.3s steps(4) ${t.delay} infinite`,
              }}
            />
          ))}
          {/* แอ่งน้ำตาที่พื้น — เอ่อกว้างขึ้น/ยุบลงสลับกัน */}
          <span
            className="absolute pointer-events-none left-1/2 -bottom-3 w-[62px] h-2 bg-[#93C5FD] rounded-[2px]"
            style={{ animation: "ghost-puddle-grow 1.6s steps(3) infinite alternate" }}
          />
          <span className="absolute pointer-events-none -bottom-3 left-[2%] w-1.5 h-[5px] bg-[#93C5FD] rounded-[1px] opacity-70" />
          <span className="absolute pointer-events-none -bottom-3 right-[2%] w-1.5 h-[5px] bg-[#93C5FD] rounded-[1px] opacity-70" />
        </>
      )}
    </div>
  );
}
