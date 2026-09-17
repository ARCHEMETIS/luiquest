// หน้าส่งความเห็นเกี่ยวกับแอพ (อาจารย์สั่งเพิ่ม 18 ก.ย. 2026)
//
// เขียนลง Supabase ตรงจากเบราว์เซอร์เหมือนหน้าโปรไฟล์ ไม่ผ่าน Netlify function เลย (ไม่กิน invocation)
// ทำได้เพราะ policy "app_feedback_insert_own" (supabase/migrations/2026-09-18-app-feedback.sql)
// ให้ insert ได้เฉพาะแถวที่ user_id เป็นตัวเอง และอ่านได้เฉพาะของตัวเอง
//
// ฝั่ง DB มี trigger กันกดรัวไว้ที่ 5 ครั้ง/คน/วัน — ตีกลับมาเป็นข้อความ FEEDBACK_DAILY_CAP
// ต้องดักแล้วแปลเป็นภาษาคน ไม่งั้นผู้ใช้เจอ error ดิบของ Postgres
//
// ระหว่างที่ยังไม่ได้รัน migration ตาราง app_feedback จะยังไม่มีใน production
// → PostgREST ตอบ PGRST205 "Could not find the table" ต้องแยกเคสนี้ออกจาก error จริง
// แล้วโชว์หน้า "เร็ว ๆ นี้" แทนการ์ดแดง (รูปแบบเดียวกับที่ Plan.jsx ทำกับ RPC แผนสอบ)

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { supabase } from "../lib/supabaseClient.js";

const CARD = "rounded-2xl border border-[#FBCFE8] bg-white/80 px-4 py-3.5";
const PRIMARY_BTN =
  "w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px disabled:opacity-60 disabled:hover:translate-y-0";

// ตรงกับ constraint app_feedback_message_check ใน migration — ถ้าจะขยับต้องขยับทั้งสองที่
const MESSAGE_MAX = 1000;

const RATINGS = [
  { value: 1, face: "😞", label: "แย่" },
  { value: 2, face: "😕", label: "ไม่ค่อยดี" },
  { value: 3, face: "😐", label: "เฉย ๆ" },
  { value: 4, face: "🙂", label: "ดี" },
  { value: 5, face: "🤩", label: "ดีมาก" },
];

// ค่าต้องตรงกับ constraint app_feedback_category_check เป๊ะ ๆ
const CATEGORIES = [
  { value: "bug", label: "เจอบั๊ก", hint: "กดแล้วพัง ค้าง หรือขึ้น error" },
  { value: "content", label: "เนื้อหาบทเรียน", hint: "เควส ลิงก์ ความยากง่าย" },
  { value: "ui", label: "หน้าตา/ใช้งานยาก", hint: "หาไม่เจอ กดไม่ถูก อ่านไม่ออก" },
  { value: "idea", label: "อยากให้มีเพิ่ม", hint: "ฟีเจอร์ที่อยากได้" },
  { value: "other", label: "อื่น ๆ", hint: "อะไรก็ได้ที่อยากบอก" },
];

export default function Feedback() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("other");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [notReady, setNotReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // เข้าลิงก์ /feedback ตรง ๆ (ไม่มีประวัติให้ย้อน) ต้องไม่พาออกจากแอพ — ตกลงไปที่หน้าเควสแทน
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/quest"));

  const send = async () => {
    if (!user || !rating || sending) return;
    setSending(true);
    setError(null);

    const trimmed = message.trim();
    // .select() ต่อท้ายเพื่อให้รู้ว่า RLS ปล่อยผ่านจริง — ถ้า policy ตีกลับจะได้ error ไม่ใช่เงียบ ๆ ผ่าน
    const { error: err } = await supabase
      .from("app_feedback")
      .insert({
        user_id: user.id,
        rating,
        category,
        message: trimmed ? trimmed.slice(0, MESSAGE_MAX) : null,
      })
      .select("id")
      .single();

    if (!mounted.current) return;
    setSending(false);

    if (err) {
      const detail = [err.message, err.details, err.hint, err.code].filter(Boolean).join(" ");
      // ยังไม่ได้รัน migration → ตารางยังไม่มีในฐานข้อมูล ไม่ใช่ความผิดผู้ใช้
      if (err.code === "PGRST205" || /Could not find the table/i.test(detail)) {
        setNotReady(true);
        return;
      }
      setError(
        detail.includes("FEEDBACK_DAILY_CAP")
          ? "วันนี้ส่งความเห็นครบ 5 ครั้งแล้ว 😄 ขอบคุณมาก ๆ พรุ่งนี้ส่งใหม่ได้อีก"
          : "ส่งไม่สำเร็จ 😅 เช็คเน็ตแล้วลองใหม่อีกครั้งนะ — ข้อความที่พิมพ์ไว้ยังอยู่ครบ"
      );
      return;
    }
    setSent(true);
  };

  return (
    <div
      className="relative isolate flex min-h-dvh flex-col overflow-hidden font-body text-[#831843]"
      style={{
        backgroundColor: "#FDF2F8",
        backgroundImage: [
          "radial-gradient(ellipse 220px 160px at 8% 4%, rgba(139,92,246,.14), transparent 70%)",
          "radial-gradient(ellipse 200px 180px at 95% 22%, rgba(249,168,212,.30), transparent 70%)",
        ].join(","),
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        @keyframes fb-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[#FBCFE8] bg-white/85 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 rounded-full border border-[#FBCFE8] bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#9D5C7C] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          กลับ
        </button>
        <span className="font-heading text-sm font-bold">บอกความเห็นหน่อย</span>
        <span className="w-[54px]" aria-hidden="true" />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pb-10 pt-4 md:max-w-xl">
        {notReady ? (
          <div className={`${CARD} text-center`} style={{ animation: "fb-in .25s ease-out" }}>
            <p className="text-4xl">🚧</p>
            <h2 className="mt-2 font-heading text-[15px] font-bold">ช่องรับความเห็นกำลังจะเปิด</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#9D5C7C]">
              หน้านี้พร้อมแล้ว รออีกนิดเดียวให้ฝั่งฐานข้อมูลเปิดรับ — กลับมากดใหม่ได้เลย
            </p>
            <button type="button" onClick={() => navigate("/quest")} className={`${PRIMARY_BTN} mt-4`}>
              กลับไปลุยเควสต่อ
            </button>
          </div>
        ) : sent ? (
          <div className={`${CARD} text-center`} style={{ animation: "fb-in .25s ease-out" }}>
            <p className="text-4xl">🙏</p>
            <h2 className="mt-2 font-heading text-[15px] font-bold">ขอบคุณมากเลย!</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#9D5C7C]">
              ความเห็นของคุณถูกบันทึกแล้ว — ทุกอันมีคนอ่านจริง และเป็นตัวตัดสินว่าจะแก้อะไรก่อน
            </p>
            <button
              type="button"
              onClick={() => navigate("/quest")}
              className={`${PRIMARY_BTN} mt-4`}
            >
              กลับไปลุยเควสต่อ
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setRating(0);
                setCategory("other");
                setMessage("");
              }}
              className="mt-2 w-full rounded-full border border-[#FBCFE8] bg-white/70 px-4 py-2 text-[11px] font-bold text-[#9D5C7C] transition hover:border-[#F9A8D4] active:translate-y-px"
            >
              ส่งเพิ่มอีกเรื่อง
            </button>
          </div>
        ) : (
          <>
            <div className={CARD}>
              <h2 className="font-heading text-[13px] font-bold">แอพเป็นยังไงบ้าง</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9D5C7C]">
                บอกตรง ๆ ได้เลย ติได้เต็มที่ — เราเอาไปแก้จริง ๆ และมันช่วยให้แอพนี้ดีขึ้นเร็วกว่าเดาเอง
              </p>

              <div className="mt-3 flex items-end justify-between gap-1">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    aria-label={r.label}
                    aria-pressed={rating === r.value}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2 transition ${
                      rating === r.value
                        ? "border-[#8B5CF6] bg-violet-50 -translate-y-0.5 shadow-[0_8px_18px_rgba(139,92,246,.20)]"
                        : "border-[#FBCFE8] bg-white/70 hover:border-[#F9A8D4] hover:-translate-y-0.5"
                    }`}
                  >
                    <span className={`text-2xl transition ${rating === r.value ? "" : "grayscale opacity-70"}`}>
                      {r.face}
                    </span>
                    <span className="text-[9px] font-bold text-[#9D5C7C]">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={CARD}>
              <h2 className="font-heading text-[13px] font-bold">เรื่องอะไร</h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    aria-pressed={category === c.value}
                    className={`rounded-full border-2 px-3 py-1.5 text-[11px] font-bold transition active:translate-y-px ${
                      category === c.value
                        ? "border-[#8B5CF6] bg-violet-100 text-[#8B5CF6]"
                        : "border-[#FBCFE8] bg-white/70 text-[#9D5C7C] hover:border-[#F9A8D4]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[#9D5C7C]">
                {CATEGORIES.find((c) => c.value === category)?.hint}
              </p>
            </div>

            <div className={CARD}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-heading text-[13px] font-bold">อยากเล่าเพิ่ม (ไม่ใส่ก็ได้)</h2>
                <span className={`text-[10px] ${message.length > MESSAGE_MAX ? "font-bold text-red-500" : "text-[#9D5C7C]"}`}>
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                rows={5}
                placeholder="เช่น อยากให้เควสสั้นลง / ลิงก์บทเรียนพาไปผิดที่ / ชอบตรงที่มี streak"
                className="mt-2 w-full resize-none rounded-2xl border-2 border-[#FBCFE8] bg-white/80 px-3 py-2.5 text-[12px] leading-relaxed text-[#831843] outline-none transition placeholder:text-[#D8A7C0] focus:border-[#8B5CF6]"
              />
            </div>

            {error && (
              <div
                className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-red-600"
                style={{ animation: "fb-in .25s ease-out" }}
              >
                ⚠️ {error}
              </div>
            )}

            <button type="button" onClick={send} disabled={sending || !rating} className={PRIMARY_BTN}>
              {sending ? "กำลังส่ง…" : rating ? "ส่งความเห็น" : "เลือกหน้ายิ้มก่อนนะ"}
            </button>

            <p className="px-2 text-center text-[10px] leading-relaxed text-[#9D5C7C]">
              ความเห็นของคุณคนอื่นมองไม่เห็น — หน้าสถิติสาธารณะโชว์แค่ "จำนวนคนที่ส่ง" กับ "คะแนนเฉลี่ย" เท่านั้น
            </p>
          </>
        )}
      </main>
    </div>
  );
}
