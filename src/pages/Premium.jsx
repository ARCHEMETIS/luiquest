// หน้าพรีเมียม — จ่าย 39 บาท/เดือน ด้วย QR พร้อมเพย์ + อัปสลิป (spec §6.3 ล็อกไว้แล้ว ห้ามออกแบบ flow ใหม่)
//
// ลำดับตามสเปกเป๊ะ ๆ:
//   1) บอกว่าพรีเมียมปลดล็อกอะไร  2) ราคา 39 บาท/เดือน
//   3) QR พร้อมเพย์ที่ generate ในเบราว์เซอร์เอง (ฝังยอด 39 บาทไปเลย ผู้จ่ายไม่ต้องพิมพ์ยอด)
//   4) โชว์ ref code เด่น ๆ ให้ใส่ในหมายเหตุการโอน  5) อัปสลิป → เข้าสถานะ "รอตรวจสอบ"
//
// กฎเหล็กของสเปกที่ห้ามละเมิด: onboarding→เควสแรกต้องไม่เจอ paywall, ทุกจุดขายเป็น soft
//   → หน้านี้เข้าจากปุ่มพรีเมียมในแถบโปรไฟล์เท่านั้น กดย้อนกลับได้ตลอด และย้ำทุกสถานะว่า "ใช้ฟรีต่อได้"
//
// backend ที่คู่กัน (อีก agent เขียนคู่ขนาน — สัญญาเดียวกันเป๊ะ):
//   POST /.netlify/functions/create-payment -> { ref_code, amount, status, promptpay_id } (อาจ 503)
//   อัปไฟล์เข้า bucket "payment-slips" ที่โฟลเดอร์ = auth.uid() ของตัวเอง (RLS บังคับ)
//   POST /.netlify/functions/submit-slip { ref_code, slip_path }
//
// QR วาดเอง 100%: payload EMVCo อยู่ที่ src/lib/promptpay.js, ตัวเข้ารหัส QR อยู่ที่ src/lib/qrEncode.js
// (package.json ไม่มีไลบรารี QR และบรีฟห้ามเพิ่ม dependency)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GhostMascot from "../components/GhostMascot.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { api } from "../lib/api.js";
import { buildPromptPayPayload } from "../lib/promptpay.js";
import { encodeQr, qrToSvgPath } from "../lib/qrEncode.js";
import { supabase } from "../lib/supabaseClient.js";

const PRICE_BAHT = 39;
const MAX_SLIP_BYTES = 5 * 1024 * 1024;

// จุดขายที่เจ้าของเลือก — ❄️ freeze streak เป็นพระเอก (อยู่บนสุด ตัวใหญ่สุด)
// ทุกบรรทัดต้องเป็นของที่มีจริงในระบบเท่านั้น (ห้ามขายของที่ยังไม่ได้ทำ)
const PERKS = [
  {
    icon: "❄️",
    title: "Freeze streak",
    desc: "พลาดไป 1 วัน streak ไม่ขาด — ระบบยกให้วันนึง เก็บไฟที่ต่อมาเป็นสิบวันไว้ได้ (ถ้าหายไปติดกันหลายวัน streak ยังรีเซ็ตตามปกตินะ)",
    hero: true,
  },
  { icon: "📚", title: "เก็บหัวข้อได้ไม่จำกัด", desc: "เซฟหัวข้อไว้สลับกลับมาเรียนต่อได้ทุกเมื่อ ทีละหัวข้อ (แผนฟรีเก็บได้ 3)" },
  { icon: "✨", title: "ป้ายพรีเมียม", desc: "ขึ้นข้างชื่อคุณบนกระดานอันดับ" },
  { icon: "💬", title: "แชทโค้ชแบบจุใจ", desc: "ถามโค้ชได้วันละ 100 ข้อความ (แผนฟรีวันละ 10)" },
  { icon: "⚡", title: "เควสมากกว่าวันละอัน", desc: "วันไหนไฟแรงก็ลุยได้ถึงวันละ 3 เควส (แผนฟรีวันละ 1)" },
];

// พรีเมียมนับว่า "ยังใช้อยู่" ต่อเมื่อธงเปิด และยังไม่ถึง premium_until — mirror isPremiumActive
// ใน netlify/functions/create-payment.js เป๊ะ ๆ (premium_until ว่าง = ไม่ active)
// ไม่มีอะไรในระบบตั้ง is_premium กลับเป็น false ให้เลย ดูแต่ธงอย่างเดียวคนหมดอายุจะค้างสถานะพรีเมียมถาวร
// และกดต่ออายุไม่ได้ ทั้งที่ backend พร้อมรับเงินรอบใหม่อยู่แล้ว
export function isPremiumActive(profile, now = new Date()) {
  if (!profile?.is_premium || !profile.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  return Number.isFinite(premiumUntil.getTime()) && premiumUntil > new Date(now);
}

const CARD = "rounded-2xl border border-[#FBCFE8] bg-white/80 px-4 py-3.5";
const PRIMARY_BTN =
  "w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px disabled:opacity-60 disabled:hover:translate-y-0";
const GHOST_BTN =
  "w-full rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2.5 font-heading text-sm font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px";

const pop = (i = 0) => ({
  animation: `pm-pop .42s cubic-bezier(.22,1,.36,1) ${(0.04 + Math.min(i, 10) * 0.05).toFixed(2)}s both`,
});

// เบอร์พร้อมเพย์ที่โชว์เป็นตัวหนังสือ (เผื่อคนใช้มือถือเครื่องเดียว สแกน QR ตัวเองไม่ได้ ต้องพิมพ์เบอร์โอนแทน)
function prettyTarget(id) {
  const digits = String(id ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 13) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
  return digits;
}

export default function Premium() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { profile, refetch } = useProfile();
  const token = session?.access_token;

  // intro (ยังไม่กดสมัคร) | paying (มี ref + QR แล้ว) | waiting (ส่งสลิปแล้ว รอเจ้าของตรวจ)
  const [stage, setStage] = useState("intro");
  const [payment, setPayment] = useState(null); // { ref_code, amount, status, promptpay_id }
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false); // 503 = ระบบจ่ายเงินปิดชั่วคราว
  const [rejected, setRejected] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(null);
  const fileInput = useRef(null);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview); // กัน object URL ค้างในหน่วยความจำ
  }, [preview]);

  // กลับมาหน้านี้ใหม่หลังส่งสลิปไปแล้ว ต้องเห็นสถานะ "รอตรวจสอบ" ไม่ใช่เริ่มนับหนึ่งใหม่
  // อ่านจากตาราง payments ตรง ๆ ได้เลย (RLS: payments_select_own_or_admin) ไม่ต้องเปลือง function invocation
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("ref_code, amount, status, reject_reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (cancelled || !row) return;
      if (row.status === "submitted") {
        setPayment((p) => p ?? { ref_code: row.ref_code, amount: row.amount, status: row.status });
        setStage("waiting");
      } else if (row.status === "rejected") {
        setRejected(row.reject_reason || "ตรวจสลิปแล้วไม่ผ่าน");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // เข้าลิงก์ /premium ตรง ๆ (ไม่มีประวัติให้ย้อน) ต้องไม่พาออกจากแอพ — ตกลงไปที่หน้าเควสแทน
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/quest"));

  const flashCopy = (what, text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    clearTimeout(copyTimer.current);
    setCopied(what);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const startPayment = useCallback(async () => {
    if (creating || !token) return;
    setCreating(true);
    setError(null);
    setUnavailable(false);
    try {
      const res = await api.createPayment(token);
      setPayment(res);
      setStage(res?.status === "submitted" ? "waiting" : "paying");
    } catch (err) {
      if (err?.status === 503) setUnavailable(true);
      else setError(err?.message || "เริ่มขั้นตอนจ่ายเงินไม่สำเร็จ ลองใหม่อีกครั้งนะ");
    } finally {
      setCreating(false);
    }
  }, [creating, token]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (!f.type.startsWith("image/")) {
      setError("ขอเป็นไฟล์รูปนะ (แคปหน้าจอสลิปก็ได้)");
      return;
    }
    if (f.size > MAX_SLIP_BYTES) {
      setError("รูปใหญ่เกิน 5MB ลองย่อขนาดก่อนนะ");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const sendSlip = async () => {
    if (!file || !payment?.ref_code || !user?.id || uploading) return;
    setUploading(true);
    setError(null);
    try {
      // ต้องอัปเข้าโฟลเดอร์ชื่อ uid ของตัวเองเท่านั้น — RLS ของ bucket เช็ค (storage.foldername(name))[1] = auth.uid()
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${payment.ref_code}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-slips")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);

      await api.submitSlip({ ref_code: payment.ref_code, slip_path: path }, token);
      setPayment((p) => ({ ...p, status: "submitted" }));
      setStage("waiting");
      setRejected(null);
      refetch?.();
    } catch (err) {
      setError(err?.message || "ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้งนะ");
    } finally {
      setUploading(false);
    }
  };

  // ---- QR: สร้าง payload EMVCo แล้วเข้ารหัสเป็นตาราง QR ในเครื่อง (ไม่มีการยิงรูปจากที่ไหน) ----
  const qr = useMemo(() => {
    if (!payment?.promptpay_id) return null;
    const amount = Number(payment.amount) || PRICE_BAHT;
    const payload = buildPromptPayPayload(payment.promptpay_id, { amount });
    if (!payload) return null;
    try {
      const matrix = encodeQr(payload, { ecc: "M" });
      return { payload, ...matrix, path: qrToSvgPath(matrix) };
    } catch {
      return null;
    }
  }, [payment?.promptpay_id, payment?.amount]);

  const amountLabel = `${Number(payment?.amount) || PRICE_BAHT} บาท`;
  const isPremium = isPremiumActive(profile);
  const premiumExpired = !!profile?.is_premium && !isPremium; // เคยจ่ายแล้วแต่หมดอายุ — ต้องต่ออายุได้ ไม่ใช่โดนบล็อก

  return (
    <div
      className="relative isolate flex min-h-dvh flex-col overflow-hidden font-body text-[#831843]"
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
        @keyframes pm-pop { 0% { opacity: 0; transform: translateY(10px) scale(.96); } 60% { transform: translateY(-2px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pm-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes pm-shine { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        @media (prefers-reduced-motion: reduce) { .pm-anim { animation: none !important; } }
      `}</style>

      {/* header: ปิดหน้านี้ได้ตลอดเวลา — จุดขายทุกอันเป็น soft ตามกฎเหล็กของสเปก */}
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
        <span className="font-heading text-sm font-bold">ลุยเควส พรีเมียม</span>
        <span className="w-[54px]" aria-hidden="true" />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pb-10 pt-4 md:max-w-xl">
        {/* ---------- เป็นพรีเมียมอยู่แล้ว ---------- */}
        {isPremium && (
          <div className="pm-anim flex flex-col items-center rounded-2xl border-2 border-[#8B5CF6]/30 bg-gradient-to-br from-violet-50 to-pink-50 px-5 py-6 text-center" style={pop(0)}>
            <GhostMascot mood="fireworks" className="mb-3 scale-90" />
            <h1 className="font-heading text-lg font-bold">คุณเป็นพรีเมียมอยู่แล้ว ✨</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#9D5C7C]">
              ขอบคุณที่สนับสนุนลุยเควสนะ! freeze streak, ป้ายพรีเมียม, เควสวันละ 3 และแชทโค้ชวันละ 100 ข้อความ เปิดให้ใช้ครบแล้ว
            </p>
            <button type="button" onClick={() => navigate("/quest")} className={`${PRIMARY_BTN} mt-5 max-w-[260px]`}>
              กลับไปลุยเควส 🚀
            </button>
          </div>
        )}

        {!isPremium && (
          <>
            {/* ---------- 1. พรีเมียมได้อะไรบ้าง ---------- */}
            {stage === "intro" && (
              <>
                <div className="pm-anim flex items-center gap-3 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 px-4 py-3.5" style={pop(0)}>
                  <span className="relative block h-[54px] w-12 shrink-0 overflow-hidden">
                    <span style={{ position: "absolute", top: 0, left: 0, width: 96, height: 108, transform: "scale(.5)", transformOrigin: "top left" }}>
                      <GhostMascot mood="groove" />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <h1 className="font-heading text-[17px] font-bold leading-tight">อัปเกรดเป็นพรีเมียม</h1>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#9D5C7C]">
                      ทุกอย่างที่ทำให้ลุยต่อได้นานขึ้น — และไม่ต้องกลัว streak ขาดอีกต่อไป
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {PERKS.map((p, i) => (
                    <div
                      key={p.title}
                      className={`pm-anim flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                        p.hero
                          ? "border-[#8B5CF6]/35 bg-gradient-to-br from-violet-50 to-pink-50 shadow-[0_10px_22px_rgba(139,92,246,.12)]"
                          : "border-[#FBCFE8] bg-white/70"
                      }`}
                      style={pop(1 + i)}
                    >
                      <span className={p.hero ? "text-2xl leading-none" : "text-lg leading-none"}>{p.icon}</span>
                      <div className="min-w-0">
                        <p className={`font-heading font-bold ${p.hero ? "text-[14px]" : "text-[13px]"}`}>
                          {p.title}
                          {p.hero && (
                            <span className="ml-1.5 rounded-full bg-[#8B5CF6] px-1.5 py-0.5 align-middle text-[8px] font-bold text-white">
                              ตัวชูโรง
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#9D5C7C]">{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ---------- 2. ราคา ---------- */}
                <div className="pm-anim mt-1 rounded-2xl border-2 border-[#8B5CF6]/30 bg-white/85 px-4 py-4 text-center" style={pop(7)}>
                  <p className="text-[11px] text-[#9D5C7C]">ราคาเดียว ไม่มีแพ็กเกจซ่อน</p>
                  <p className="mt-0.5 font-heading text-3xl font-bold">
                    <span
                      style={{
                        backgroundImage: "linear-gradient(90deg,#8B5CF6,#EC4899,#FBBF24,#EC4899,#8B5CF6)",
                        backgroundSize: "200% 100%",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        animation: "pm-shine 2.5s linear infinite",
                      }}
                    >
                      {PRICE_BAHT} บาท
                    </span>
                    <span className="ml-1 align-middle text-sm font-bold text-[#9D5C7C]">/ เดือน</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[#9D5C7C]">จ่ายผ่านพร้อมเพย์ ยกเลิกเมื่อไหร่ก็แค่ไม่ต้องต่ออายุ</p>
                </div>

                {/* เคยเป็นพรีเมียมแล้วหมดอายุ — ทักแบบขอบคุณ ไม่ใช่ทวงเงิน แล้วเปิดทางต่ออายุให้เลย */}
                {premiumExpired && (
                  <div className="pm-anim rounded-2xl border border-[#8B5CF6]/30 bg-gradient-to-br from-violet-50 to-pink-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-[#831843]" style={{ animation: "pm-in .3s ease-out" }}>
                    <span className="font-bold">พรีเมียมของคุณหมดอายุแล้วนะ 💜</span>
                    <br />
                    ขอบคุณที่สนับสนุนกันมาตลอดเลย! ต่ออายุอีกเดือนได้เลย ของทุกอย่างกลับมาครบทันทีที่ตรวจสลิปผ่าน —
                    ระหว่างนี้ใช้ฟรีต่อได้ตามปกติ ไม่มีอะไรหาย
                  </div>
                )}

                {rejected && (
                  <div className="pm-anim rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800" style={{ animation: "pm-in .3s ease-out" }}>
                    <span className="font-bold">รอบที่แล้วสลิปยังไม่ผ่าน 🥲</span>
                    <br />
                    เหตุผล: {rejected} — สมัครใหม่ได้เลย ไม่เสียอะไร
                  </div>
                )}

                {unavailable && (
                  <div className="pm-anim rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800" style={{ animation: "pm-in .3s ease-out" }}>
                    <span className="font-bold">ตอนนี้ระบบสมัครพรีเมียมปิดชั่วคราว 🙏</span>
                    <br />
                    ยังไม่ต้องทำอะไรนะ ใช้แบบฟรีต่อได้ตามปกติ เดี๋ยวเปิดแล้วค่อยแวะกลับมาใหม่
                  </div>
                )}

                {error && (
                  <div className="pm-anim rounded-full bg-red-100 px-3 py-1.5 text-center text-[11px] text-red-600" style={{ animation: "pm-in .3s ease-out" }}>
                    ⚠️ {error}
                  </div>
                )}

                <div className="pm-anim mt-1 flex flex-col gap-2" style={pop(8)}>
                  <button type="button" onClick={startPayment} disabled={creating} className={PRIMARY_BTN}>
                    {creating ? "กำลังเตรียมให้..." : `${premiumExpired ? "ต่ออายุพรีเมียม" : "สมัครพรีเมียม"} ${PRICE_BAHT} บาท`}
                  </button>
                  <button type="button" onClick={goBack} className={GHOST_BTN}>
                    ไว้ก่อน ใช้ฟรีต่อ
                  </button>
                </div>
                <p className="mt-1 text-center text-[10px] leading-relaxed text-[#9D5C7C]/90">
                  แผนฟรีใช้ได้ครบทุกอย่างที่สำคัญเหมือนเดิม — เควสรายวัน, XP/streak, กระดานอันดับ, ชวนเพื่อน
                </p>
              </>
            )}

            {/* ---------- 3-5. QR + ref code + อัปสลิป ---------- */}
            {stage === "paying" && payment && (
              <>
                <div className="pm-anim rounded-2xl border-2 border-[#FBCFE8] bg-white/85 px-4 py-4 text-center" style={pop(0)}>
                  <p className="text-[11px] text-[#9D5C7C]">สแกนจ่ายด้วยแอพธนาคาร</p>
                  <p className="font-heading text-lg font-bold">พร้อมเพย์ {amountLabel}</p>

                  {qr ? (
                    <div className="mx-auto mt-3 w-fit rounded-2xl bg-white p-2.5 shadow-[0_10px_24px_rgba(139,92,246,.18)]">
                      <svg
                        viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}
                        shapeRendering="crispEdges"
                        className="h-52 w-52 md:h-60 md:w-60"
                        role="img"
                        aria-label={`QR พร้อมเพย์ ${amountLabel}`}
                      >
                        <rect width={qr.size + 8} height={qr.size + 8} fill="#ffffff" />
                        <g transform="translate(4,4)">
                          <path d={qr.path} fill="#831843" />
                        </g>
                      </svg>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
                      สร้าง QR ไม่สำเร็จ 😅{" "}
                      {payment.promptpay_id
                        ? "โอนตามเลขพร้อมเพย์ด้านล่างแทนได้เลย แล้วอัปสลิปตามปกติ"
                        : "ลองกดกลับแล้วเข้ามาใหม่อีกครั้งนะ"}
                    </p>
                  )}

                  {qr && (
                    <p className="mt-2.5 text-[11px] text-[#9D5C7C]">
                      ยอด {amountLabel} ฝังมากับ QR แล้ว — สแกนได้เลย ไม่ต้องพิมพ์ยอดเอง
                    </p>
                  )}

                  {/* เผื่อคนมีมือถือเครื่องเดียว (สแกนจอตัวเองไม่ได้) — โอนตามเบอร์พร้อมเพย์แทน */}
                  {payment.promptpay_id && (
                    <button
                      type="button"
                      onClick={() => flashCopy("pp", String(payment.promptpay_id))}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#FBCFE8] bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#8B5CF6] transition hover:border-[#8B5CF6]/50 active:translate-y-px"
                    >
                      พร้อมเพย์ {prettyTarget(payment.promptpay_id)}
                      <span className="text-[10px] text-[#9D5C7C]">{copied === "pp" ? "· คัดลอกแล้ว!" : "· แตะเพื่อคัดลอก"}</span>
                    </button>
                  )}
                </div>

                {/* ---------- 4. ref code ต้องเด่นที่สุดในหน้านี้ ---------- */}
                <div className="pm-anim rounded-2xl border-2 border-[#8B5CF6]/35 bg-gradient-to-br from-violet-50 to-pink-50 px-4 py-3.5 text-center" style={pop(1)}>
                  <p className="text-[11px] font-bold text-[#831843]">ใส่รหัสนี้ในช่อง "หมายเหตุ" ตอนโอนด้วยนะ</p>
                  <button
                    type="button"
                    onClick={() => flashCopy("ref", payment.ref_code)}
                    className="mt-1.5 inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#8B5CF6]/50 bg-white px-4 py-2 font-heading text-xl font-bold tracking-[3px] text-[#8B5CF6] transition hover:-translate-y-0.5 active:translate-y-px"
                  >
                    {payment.ref_code}
                  </button>
                  <p className="mt-1.5 text-[10px] text-[#9D5C7C]">
                    {copied === "ref" ? "คัดลอกรหัสแล้ว!" : "แตะรหัสเพื่อคัดลอก — มีรหัสนี้เจ้าของจะจับคู่ยอดของคุณได้เร็วขึ้นมาก"}
                  </p>
                </div>

                {/* ---------- 5. อัปสลิป ---------- */}
                <div className={`pm-anim ${CARD}`} style={pop(2)}>
                  <p className="font-heading text-[13px] font-bold">โอนแล้ว? แนบสลิปเลย</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#9D5C7C]">
                    แคปหน้าจอสลิปโอนมาแปะได้เลย เจ้าของจะเช็คแล้วเปิดพรีเมียมให้ (ปกติไม่เกิน 24 ชม.)
                  </p>

                  <input ref={fileInput} type="file" accept="image/*" onChange={pickFile} className="hidden" />

                  {preview ? (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={preview} alt="สลิปที่เลือกไว้" className="h-20 w-20 shrink-0 rounded-xl border border-[#FBCFE8] object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-[#831843]">{file?.name}</p>
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="mt-1 text-[11px] font-bold text-[#8B5CF6] underline underline-offset-2"
                        >
                          เปลี่ยนรูป
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#FBCFE8] bg-white/60 px-3 py-3 text-[12px] font-bold text-[#8B5CF6] transition hover:border-[#8B5CF6]/60 hover:bg-white active:translate-y-px"
                    >
                      <span className="text-[14px] leading-none">+</span> เลือกรูปสลิป
                    </button>
                  )}

                  {error && (
                    <p className="mt-2 rounded-full bg-red-100 px-3 py-1.5 text-center text-[11px] text-red-600" style={{ animation: "pm-in .3s ease-out" }}>
                      ⚠️ {error}
                    </p>
                  )}

                  <button type="button" onClick={sendSlip} disabled={!file || uploading} className={`${PRIMARY_BTN} mt-3`}>
                    {uploading ? "กำลังส่งสลิป..." : "ส่งสลิปให้ตรวจสอบ"}
                  </button>
                </div>

                <button type="button" onClick={goBack} className={GHOST_BTN}>
                  ไว้ก่อน กลับไปลุยเควส
                </button>
                <p className="text-center text-[10px] leading-relaxed text-[#9D5C7C]/90">
                  ยังไม่โอนก็ปิดหน้านี้ได้เลย รหัส {payment.ref_code} เก็บไว้ให้ กลับมาต่อทีหลังได้
                </p>
              </>
            )}

            {/* ---------- รอตรวจสอบ ---------- */}
            {stage === "waiting" && (
              <div className="pm-anim flex flex-1 flex-col items-center justify-center px-2 text-center" style={pop(0)}>
                <GhostMascot mood="idle" className="mb-4 scale-90" />
                <h1 className="font-heading text-lg font-bold">ได้รับสลิปแล้ว รอตรวจสอบแป๊บนึงนะ ⏳</h1>
                <p className="mt-2 text-xs leading-relaxed text-[#9D5C7C]">
                  เจ้าของจะเช็คยอดกับรหัส{" "}
                  <span className="font-heading font-bold text-[#8B5CF6]">{payment?.ref_code ?? "ของคุณ"}</span>{" "}
                  แล้วเปิดพรีเมียมให้ ปกติไม่เกิน 24 ชั่วโมง
                </p>
                <div className="mt-4 w-full max-w-[300px] rounded-2xl border border-[#8B5CF6]/25 bg-gradient-to-br from-violet-50 to-pink-50 px-4 py-3 text-[11px] leading-relaxed text-[#831843]">
                  <span className="font-bold">ระหว่างนี้ใช้ฟรีได้เต็มที่เหมือนเดิม</span> — เควสวันนี้, streak, กระดานอันดับ,
                  ชวนเพื่อน ทำงานปกติทุกอย่าง ไม่มีอะไรถูกล็อกไว้รอเงิน
                </div>
                <div className="mt-5 flex w-full max-w-[280px] flex-col gap-2">
                  <button type="button" onClick={() => navigate("/quest")} className={PRIMARY_BTN}>
                    กลับไปทำเควสวันนี้ 🚀
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
