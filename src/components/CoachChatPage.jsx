// หน้าแชทโค้ช AI ของลุยเควส (ticket #5 — design-brief section 3.6) — ต่อ API จริงแล้ว (ticket #09)
// กติกาโควต้า: นับตอนผู้ใช้ "ส่งสำเร็จ" เท่านั้น ครบแล้วช่องพิมพ์ disable ทันที + บอกเวลารีเซ็ต
// props จริงส่งมาจาก src/pages/Coach.jsx — onSend ต้องคืน { ok, reply?, remaining?, limited?, resetAt? }

import { useEffect, useRef, useState } from "react";
import GhostMascot from "./GhostMascot";

const DEFAULT_QUOTA_TOTAL = 10;

const MOCK_SUGGESTIONS = [
  "ตัวแปรกับค่าคงที่ต่างกันยังไง",
  "โค้ดฉัน error ตรงนี้ แก้ยังไงดี",
  "ขอตัวอย่างโจทย์ฝึกเพิ่ม",
];

// path จาก Heroicons 24/outline (assets/heroicons — MIT)
const ICON_PATHS = {
  send: ["M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"],
  clock: ["M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  back: ["M15.75 19.5 8.25 12l7.5-7.5"],
  retry: [
    "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99",
  ],
};

const Icon = ({ name, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={className}>
    {ICON_PATHS[name].map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

// อวตารโค้ช — ผีพิกเซลตัวจริงจาก GhostMascot ย่อด้วย transform scale ให้พอดีวงกลมอวตาร (ขนาดจริงของ grid คือ 96×108 ตาม GhostMascot.jsx)
const GHOST_GRID_W = 96;
const GHOST_GRID_H = 108;

const CoachAvatar = ({ size = 28 }) => {
  const scale = size / GHOST_GRID_W;
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-pink-100"
      style={{ width: size, height: size }}
    >
      {/* วางที่มุมบนซ้ายแบบ absolute แทนปล่อยให้ flex เซ็นเตอร์กล่องขนาดจริงก่อนย่อ — ไม่งั้น scale จะหดเข้าหาจุดที่ถูกเซ็นเตอร์ไว้นอกกรอบ ทำให้ผีหายไปหมด */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: GHOST_GRID_W,
          height: GHOST_GRID_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <GhostMascot mood="idle" />
      </span>
    </span>
  );
};

function nowThaiTime() {
  return new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function CoachChatPage({
  onBack,
  onGoToQuest,
  showStateToggle = false,
  topicTitle = "หัวข้อของคุณ",
  initialMessages = [],
  initialQuotaUsed = 0,
  quotaTotal = DEFAULT_QUOTA_TOTAL,
  onSend,
  heightClass = "h-dvh", // ฝังในเชลล์ส่ง "h-full" ให้ช่องพิมพ์เกาะก้น main (ไม่หลุดใต้ bottom nav)
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [quotaUsed, setQuotaUsed] = useState(initialQuotaUsed);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  const quotaLeft = quotaTotal - quotaUsed;
  const quotaExhausted = quotaLeft <= 0;
  const canSend = !quotaExhausted && !sending && input.trim().length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // ยิงข้อความจริงผ่าน onSend (parent เรียก api.chat) — หักโควต้าตอนตอบสำเร็จเท่านั้น ตามกติกาบนสุดของไฟล์
  const dispatch = async (text, { onSettled }) => {
    setSending(true);
    try {
      const result = await onSend?.(text);
      if (result?.limited) {
        setQuotaUsed(quotaTotal);
        onSettled({ failed: false, limited: true });
      } else if (result?.ok) {
        setMessages((m) => [...m, { role: "coach", text: result.reply, time: nowThaiTime() }]);
        // ปกติเซิร์ฟเวอร์ส่ง remaining กลับมาเป๊ะ ๆ — เผื่อกรณี degraded ที่ไม่มีค่านี้ นับเพิ่มเองไปก่อน 1 (เซิร์ฟเวอร์นับข้อความ user เสมอ)
        setQuotaUsed((q) => (typeof result.remaining === "number" ? quotaTotal - result.remaining : q + 1));
        onSettled({ failed: false, limited: false });
      } else {
        onSettled({ failed: true, limited: false });
      }
    } catch {
      onSettled({ failed: true, limited: false });
    } finally {
      setSending(false);
    }
  };

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed || quotaExhausted || sending) return;
    setMessages((m) => [...m, { role: "user", text: trimmed, time: nowThaiTime() }]);
    setInput("");
    dispatch(trimmed, {
      onSettled: ({ failed }) => {
        if (failed) {
          setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, failed: true } : msg)));
        }
      },
    });
  };

  const retryFailed = (i) => {
    if (sending || quotaExhausted) return;
    const text = messages[i].text;
    setMessages((m) => m.map((msg, idx) => (idx === i ? { ...msg, failed: false } : msg)));
    dispatch(text, {
      onSettled: ({ failed }) => {
        if (failed) setMessages((m) => m.map((msg, idx) => (idx === i ? { ...msg, failed: true } : msg)));
      },
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
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
        @keyframes coach-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes coach-dot { 0%,60%,100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
      `}</style>

      <div className={`mx-auto flex w-full min-h-0 max-w-md flex-1 flex-col md:max-w-xl ${showStateToggle ? "pt-14" : "pt-2"}`}>
        {/* header: ย้อนกลับ + ชื่อโค้ช + ตัวนับโควต้า (เห็นชัดตลอดตามบรีฟ) */}
        <div className="flex items-center gap-3 border-b border-[#FBCFE8] px-4 pb-3">
          <button
            onClick={() => onBack?.()}
            aria-label="ย้อนกลับ"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] transition hover:border-[#8B5CF6]/50 hover:bg-white hover:text-[#8B5CF6] active:translate-y-px"
          >
            <Icon name="back" className="h-5 w-5" />
          </button>
          <CoachAvatar size={36} />
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[15px] font-bold leading-tight">โค้ชเอไอ</h1>
            <p className="truncate text-[10px] text-[#9D5C7C]">ถามได้ทุกเรื่องของเควส {topicTitle}</p>
          </div>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${
              quotaExhausted
                ? "bg-red-100 text-red-600"
                : quotaLeft <= 2
                  ? "bg-amber-100 text-amber-700"
                  : "border border-[#FBCFE8] bg-white/80 text-[#9D5C7C]"
            }`}
          >
            เหลือ {Math.max(quotaLeft, 0)}/{quotaTotal} ข้อความวันนี้
          </span>
        </div>

        {/* พื้นที่บทสนทนา */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            /* ---------- ว่าง — ยังไม่เคยคุย: ข้อความต้อนรับ + ปุ่มคำถามแนะนำ ---------- */
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <GhostMascot mood="idle" className="mb-4 scale-75" />
              <h2 className="font-heading text-lg font-bold">มีอะไรให้โค้ชช่วยไหม 👋</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#9D5C7C]">
                ถามได้เลยเรื่องเควส {topicTitle} วันนี้ ไม่เข้าใจตรงไหน โค้ชอธิบายให้ทันที
              </p>
              <div className="mt-5 flex w-full max-w-[300px] flex-col gap-2">
                {MOCK_SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    className="w-full rounded-full border border-[#FBCFE8] bg-white/80 px-4 py-2 text-left text-xs font-bold text-[#8B5CF6] transition hover:-translate-y-0.5 hover:border-[#8B5CF6]/50 hover:shadow-[0_6px_14px_rgba(139,92,246,.15)] active:translate-y-px"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  style={{ animation: "coach-in .25s ease-out" }}
                >
                  {m.role === "coach" && <CoachAvatar />}
                  <div className={`flex max-w-[78%] flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    {m.failed ? (
                      <div className="rounded-2xl rounded-br-sm border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-700">
                        {m.text}
                      </div>
                    ) : (
                      <div
                        className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${
                          m.role === "user"
                            ? "rounded-2xl rounded-br-sm bg-gradient-to-r from-violet-500 to-pink-500 text-white"
                            : "rounded-2xl rounded-bl-sm border-2 border-[#FBCFE8] bg-white/90 text-[#831843]"
                        }`}
                      >
                        {m.text}
                      </div>
                    )}
                    {m.failed ? (
                      <button
                        onClick={() => retryFailed(i)}
                        className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700"
                      >
                        <Icon name="retry" className="h-3 w-3" />
                        ส่งไม่สำเร็จ — ลองใหม่
                      </button>
                    ) : (
                      <span className="mt-1 px-1 text-[10px] text-[#9D5C7C]/70">{m.time}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* โค้ชกำลังพิมพ์ — จุดสามเม็ดกระเพื่อม */}
              {sending && (
                <div className="flex items-end gap-2" style={{ animation: "coach-in .25s ease-out" }}>
                  <CoachAvatar />
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border-2 border-[#FBCFE8] bg-white/90 px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-[#9D5C7C]"
                        style={{ animation: `coach-dot 1s ease-in-out ${d * 0.15}s infinite` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        {/* โควต้าหมด — ปลอบ + บอกเวลารีเซ็ต + ชวนไปทำอย่างอื่นต่อ */}
        {quotaExhausted && (
          <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800" style={{ animation: "coach-in .3s ease-out" }}>
            <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-bold">คุยกับโค้ชครบโควต้าวันนี้แล้ว 🌙</span>
              <br />
              เที่ยงคืนโควต้าเต็มอีกครั้ง ระหว่างนี้ไปลุยเควสต่อกันไหม?
              <button
                onClick={() => onGoToQuest?.()}
                className="mt-2 block rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-3.5 py-1.5 font-heading text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(139,92,246,.28)] transition hover:-translate-y-0.5 active:translate-y-px"
              >
                ไปทำเควสต่อ 🚀
              </button>
            </div>
          </div>
        )}

        {/* ช่องพิมพ์ — disable ตอนโควต้าหมด/โค้ชกำลังพิมพ์อยู่ */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[#FBCFE8] px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={quotaExhausted || sending}
            placeholder={quotaExhausted ? "โควต้าหมดสำหรับวันนี้" : sending ? "รอโค้ชตอบแป๊บนึง..." : "พิมพ์คำถามถึงโค้ช..."}
            className="flex-1 rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2.5 text-[13px] text-[#831843] outline-none transition placeholder:text-[#9D5C7C]/70 focus:border-[#8B5CF6] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="ส่งข้อความ"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition active:translate-y-px ${
              canSend ? "hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)]" : "opacity-40"
            }`}
          >
            <Icon name="send" className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
