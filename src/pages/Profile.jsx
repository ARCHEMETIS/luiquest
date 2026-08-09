// หน้าโปรไฟล์ — แก้ชื่อที่ขึ้นกระดานอันดับ / เลือกรูป / ซ่อนตัวจากกระดานอันดับ
//
// เขียนลง Supabase ตรงจากเบราว์เซอร์ ไม่ผ่าน Netlify function เลย (ไม่กิน invocation)
// ทำได้เพราะ policy "profiles_update_own" (supabase/migrations/2026-07-23-profiles-column-lock.sql)
// pin คอลัมน์ระบบไว้หมด (total_xp / current_streak / is_premium / is_admin / referral_code / …)
// แต่ *ไม่* pin สามตัวนี้: display_name, avatar_url, leaderboard_opt_out
// → สามอย่างนี้คือทั้งหมดที่หน้านี้แตะได้ อยากเพิ่มฟิลด์อื่นต้องไปแก้ policy ก่อน ไม่ใช่แก้ที่นี่
//
// ชื่อโผล่บนกระดานอันดับสาธารณะ (view leaderboard) จึงต้องกรองก่อนบันทึกทุกครั้ง:
// trim + ยุบช่องว่างซ้ำ → ห้ามว่าง → ไม่เกิน 30 ตัวอักษร → ผ่าน checkTopicText (บล็อกลิสต์ตัวเดียวกับหัวข้อเรียน)

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { supabase } from "../lib/supabaseClient.js";
// ใช้บล็อกลิสต์ตัวเดียวกับหัวข้อเรียน ไม่ทำลิสต์ที่สอง — ไฟล์นี้เป็น ESM ล้วน ไม่มี import ของ node
// จึง bundle ลงฝั่งเบราว์เซอร์ได้ตรง ๆ (อยู่ใน root ของ vite เลย fs.allow ผ่าน)
import { checkTopicText } from "../../netlify/functions/_shared/topicModeration.js";

// เพดานความยาวชื่อ: 30 ตัวอักษร — ชื่อ Google ภาษาไทยจริงแทบไม่เกิน 25 และช่องชื่อบน header
// กับกระดานอันดับกว้างไม่ถึงเท่านั้นอยู่แล้ว (header truncate ที่ max-w-[100px]) ยาวกว่านี้คือไปกินที่คนอื่นเปล่า ๆ
const NAME_MAX = 30;

// ---- อวตารสำเร็จรูป ----
// ต้องเก็บเป็น data URI ไม่ใช่รหัสย่อ (เช่น "ghost:violet") เพราะที่อื่นในแอพเอา avatar_url
// ไปใส่ <img src> ตรง ๆ (AppShellLayout.jsx) — เก็บค่าที่ไม่ใช่ URL ลงไปคือรูปแตกทุกหน้าที่โชว์อวตาร
// ลายเป็นผีพิกเซลตัวเดียวกับ GhostMascot (grid 8x9 ชุดเดียวกัน) แต่คัดสีได้หลายแบบ
// — GhostMascot.jsx ไม่ได้ export GRID/PIXEL_COLOR ออกมา และไฟล์นั้นอยู่นอกขอบเขตงานนี้ จึงมิเรอร์ค่าไว้ที่นี่
const GHOST_ROWS = [
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

// รวมช่องสีเดียวกันที่ติดกันในแถวเดียวให้เป็นสี่เหลี่ยมเดียว แล้วยุบเป็น path ต่อสี
// (วาดทีละช่องจะได้ 72 <rect> = data URI ยาวเกินจำเป็นสำหรับค่าที่ต้องเก็บลง DB และส่งกลับมาทุกครั้งที่เรียก /me)
function ghostDataUri(palette) {
  const runs = {};
  GHOST_ROWS.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let w = 1;
      while (row[x + w] === key) w += 1;
      if (key !== ".") {
        runs[key] = runs[key] || [];
        runs[key].push(`M${x} ${y}h${w}v1h-${w}z`);
      }
      x += w;
    }
  });
  const paths = Object.keys(runs)
    .map((key) => `<path fill='${palette[key]}' d='${runs[key].join("")}'/>`)
    .join("");
  // viewBox จัตุรัส + ขยับผี (8x9) เข้ากลาง — ที่โชว์อวตารเป็นวงกลมหมด ภาพไม่จัตุรัสจะโดนบีบ
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'>` +
    `<rect width='10' height='10' fill='${palette.bg}'/>` +
    `<g transform='translate(1 .5)'>${paths}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const GHOST_PALETTES = [
  { id: "violet", label: "ม่วง", bg: "#EDE9FE", S: "#A78BFA", B: "#8B5CF6", W: "#ffffff", P: "#831843", E: "#F472B6" },
  { id: "pink", label: "ชมพู", bg: "#FCE7F3", S: "#F9A8D4", B: "#EC4899", W: "#ffffff", P: "#831843", E: "#A78BFA" },
  { id: "amber", label: "เหลือง", bg: "#FEF3C7", S: "#FCD34D", B: "#F59E0B", W: "#ffffff", P: "#7C2D12", E: "#F472B6" },
  { id: "emerald", label: "เขียว", bg: "#D1FAE5", S: "#6EE7B7", B: "#10B981", W: "#ffffff", P: "#064E3B", E: "#A78BFA" },
  { id: "sky", label: "ฟ้า", bg: "#DBEAFE", S: "#93C5FD", B: "#3B82F6", W: "#ffffff", P: "#1E3A8A", E: "#F472B6" },
];

const GHOST_AVATARS = GHOST_PALETTES.map((p) => ({ id: p.id, label: p.label, value: ghostDataUri(p) }));

const CARD = "rounded-2xl border border-[#FBCFE8] bg-white/80 px-4 py-3.5";
const PRIMARY_BTN =
  "w-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px disabled:opacity-60 disabled:hover:translate-y-0";

// ยุบช่องว่างซ้อนด้วย ไม่ใช่ trim อย่างเดียว — ไม่งั้นเว้นวรรคกลางชื่อรัว ๆ ก็ดันชื่อคนอื่นบนกระดานอันดับได้
const cleanName = (raw) => String(raw ?? "").trim().replace(/\s+/g, " ");

function validateName(raw) {
  const name = cleanName(raw);
  if (!name) return { error: "ยังไม่ได้ใส่ชื่อเลย — ใส่ชื่อที่อยากให้คนอื่นเห็นบนกระดานอันดับนะ" };
  if (name.length > NAME_MAX) return { error: `ชื่อยาวไปนิด ใส่ได้ไม่เกิน ${NAME_MAX} ตัวอักษร (ตอนนี้ ${name.length})` };
  // ไม่สะท้อนคำที่โดนจับกลับไปให้ผู้ใช้เห็น — บอกแค่ว่าใช้ไม่ได้ก็พอ
  if (!checkTopicText(name).ok) return { error: "ชื่อนี้ใช้ไม่ได้นะ 🙈 มีคำที่ไม่เหมาะกับที่สาธารณะอยู่ ลองตั้งใหม่ดู" };
  return { name };
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading, error: profileError, patchProfile } = useProfile();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(""); // "" = ไม่ใส่รูป (ให้แอพใช้ตัวอักษรแรกของชื่อแทน)
  const [optOut, setOptOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const hydrated = useRef(false);
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // เติมค่าเริ่มต้นครั้งเดียวตอนโปรไฟล์มาถึง — ถ้าเติมทุกครั้งที่ profile เปลี่ยน object
  // (refetch สร้าง object ใหม่เสมอตามโน้ตของ useProfile) จะทับสิ่งที่ผู้ใช้กำลังพิมพ์ค้างอยู่
  useEffect(() => {
    if (hydrated.current || !profile) return;
    hydrated.current = true;
    setName(profile.display_name ?? "");
    setAvatar(profile.avatar_url ?? "");
    setOptOut(!!profile.leaderboard_opt_out);
  }, [profile]);

  // รูปจาก Google เก็บไว้ใน session เสมอ — ต้องอ่านจากตรงนี้ ไม่ใช่จาก profile.avatar_url
  // เพราะพอผู้ใช้เลือกอวตารสำเร็จรูปทับไปแล้ว ค่าเดิมใน DB หายไป จะกลับมาใช้รูป Google ไม่ได้อีกเลย
  const googlePicture = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  const options = useMemo(() => {
    const list = [];
    if (googlePicture) list.push({ id: "google", label: "รูป Google", value: googlePicture });
    GHOST_AVATARS.forEach((a) => list.push(a));
    return list;
  }, [googlePicture]);

  const initial = (cleanName(name).charAt(0) || "?").toUpperCase();
  const dirty =
    !!profile &&
    (cleanName(name) !== (profile.display_name ?? "") ||
      (avatar || null) !== (profile.avatar_url ?? null) ||
      optOut !== !!profile.leaderboard_opt_out);

  const save = async () => {
    if (saving || !user?.id) return;
    const checked = validateName(name);
    if (checked.error) {
      setError(checked.error);
      setSaved(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    // .select() ต่อท้ายเพื่อให้รู้ว่า RLS ปล่อยผ่านจริง — ถ้า policy ตีกลับจะได้ error/0 แถว ไม่ใช่เงียบ ๆ ผ่าน
    const { data, error: err } = await supabase
      .from("profiles")
      .update({
        display_name: checked.name,
        avatar_url: avatar || null,
        leaderboard_opt_out: optOut,
      })
      .eq("id", user.id)
      .select("display_name, avatar_url, leaderboard_opt_out")
      .single();
    setSaving(false);
    if (err || !data) {
      setError("บันทึกไม่สำเร็จ 😅 เช็คเน็ตแล้วลองใหม่อีกครั้งนะ — ของเดิมยังอยู่ครบ ไม่มีอะไรหาย");
      return;
    }
    // อัพเดต state กลางให้ทั้งแอพเห็นชื่อ/รูปใหม่ทันทีโดยไม่ต้องรีโหลด (ถูกกว่ายิง /me ใหม่)
    setName(data.display_name ?? "");
    setAvatar(data.avatar_url ?? "");
    setOptOut(!!data.leaderboard_opt_out);
    patchProfile(data);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2600);
  };

  // เข้าลิงก์ /profile ตรง ๆ (ไม่มีประวัติให้ย้อน) ต้องไม่พาออกจากแอพ — ตกลงไปที่หน้าเควสแทน
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/quest"));

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
        @keyframes pf-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
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
        <span className="font-heading text-sm font-bold">โปรไฟล์ของฉัน</span>
        <span className="w-[54px]" aria-hidden="true" />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pb-10 pt-4 md:max-w-xl">
        {!profile ? (
          <div className={`${CARD} text-center text-[12px] text-[#9D5C7C]`}>
            {loading ? "กำลังโหลดโปรไฟล์…" : profileError ? "โหลดโปรไฟล์ไม่สำเร็จ ลองกลับเข้ามาใหม่อีกทีนะ" : "ยังไม่มีข้อมูลโปรไฟล์"}
          </div>
        ) : (
          <>
            {/* พรีวิว: หน้าตาที่คนอื่นจะเห็นบนกระดานอันดับ */}
            <div className={`${CARD} flex items-center gap-3`}>
              {avatar ? (
                <img src={avatar} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-200 to-pink-200 font-heading text-xl font-bold text-[#831843]">
                  {initial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[15px] font-bold">{cleanName(name) || "ยังไม่ได้ตั้งชื่อ"}</p>
                <p className="mt-0.5 text-[10px] text-[#9D5C7C]">
                  {optOut ? "ตอนนี้ซ่อนตัวจากกระดานอันดับอยู่" : "นี่คือหน้าตาที่คนอื่นเห็นบนกระดานอันดับ"}
                </p>
              </div>
            </div>

            {/* 1. ชื่อที่แสดง */}
            <div className={CARD}>
              <h2 className="font-heading text-[13px] font-bold">ชื่อที่แสดง</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9D5C7C]">
                ชื่อนี้ขึ้นบนกระดานอันดับให้คนอื่นเห็น — ตอนสมัครเราดึงชื่อจาก Google มาให้ ถ้าไม่อยากใช้ชื่อจริงเปลี่ยนได้เลย
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                  setSaved(false);
                }}
                maxLength={NAME_MAX}
                placeholder="เช่น นักผจญภัยสายดาต้า"
                className="mt-2.5 w-full rounded-2xl border-2 border-[#FBCFE8] bg-white/80 px-3.5 py-2 text-[13px] font-bold text-[#831843] outline-none transition placeholder:font-normal placeholder:text-[#D8A5BE] focus:border-[#8B5CF6]"
              />
              <p className="mt-1 text-right text-[10px] text-[#9D5C7C]">
                {cleanName(name).length}/{NAME_MAX}
              </p>
            </div>

            {/* 2. รูปโปรไฟล์ */}
            <div className={CARD}>
              <h2 className="font-heading text-[13px] font-bold">รูปโปรไฟล์</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9D5C7C]">
                เลือกผีประจำตัวสักสี หรือใช้รูปจาก Google ก็ได้ (ยังอัปโหลดรูปเองไม่ได้นะ)
              </p>
              <div className="mt-2.5 grid grid-cols-6 gap-2">
                {options.map((opt) => {
                  const active = avatar === opt.value;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAvatar(opt.value);
                        setSaved(false);
                      }}
                      aria-label={opt.label}
                      aria-pressed={active}
                      title={opt.label}
                      className={`flex aspect-square items-center justify-center rounded-full border-2 transition active:translate-y-px ${
                        active
                          ? "border-[#8B5CF6] shadow-[0_8px_20px_rgba(139,92,246,.24)]"
                          : "border-transparent hover:border-[#F9A8D4]"
                      }`}
                    >
                      <img src={opt.value} alt="" className="h-full w-full rounded-full object-cover" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAvatar("");
                  setSaved(false);
                }}
                aria-pressed={!avatar}
                className={`mt-2.5 w-full rounded-full border-2 px-3 py-1.5 text-[11px] font-bold transition active:translate-y-px ${
                  avatar
                    ? "border-[#FBCFE8] bg-white/70 text-[#9D5C7C] hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6]"
                    : "border-[#8B5CF6] bg-white text-[#8B5CF6]"
                }`}
              >
                ไม่ใส่รูป (ใช้ตัวอักษรแรกของชื่อแทน)
              </button>
            </div>

            {/* 3. ซ่อนตัวจากกระดานอันดับ */}
            <div className={CARD}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-[13px] font-bold">ซ่อนตัวจากกระดานอันดับ</h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#9D5C7C]">
                    เปิดไว้ = ชื่อกับ XP ของคุณจะไม่ขึ้นบนกระดานอันดับ คนอื่นจะมองไม่เห็นคุณเลย —{" "}
                    <span className="font-bold text-[#831843]">XP กับ streak ยังเก็บต่อตามปกติ ไม่มีอะไรหาย</span>{" "}
                    แค่ไม่ถูกเอาไปแสดงให้คนอื่นดู ปิดกลับเมื่อไหร่ก็ขึ้นเหมือนเดิม
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={optOut}
                  aria-label="ซ่อนตัวจากกระดานอันดับ"
                  onClick={() => {
                    setOptOut((v) => !v);
                    setSaved(false);
                  }}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${optOut ? "bg-[#8B5CF6]" : "bg-[#FBCFE8]"}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${optOut ? "left-[22px]" : "left-0.5"}`}
                  />
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-red-600" style={{ animation: "pf-in .25s ease-out" }}>
                ⚠️ {error}
              </div>
            )}
            {saved && (
              <div className="rounded-full bg-violet-100 px-3 py-1.5 text-center text-[11px] font-bold text-[#8B5CF6]" style={{ animation: "pf-in .25s ease-out" }}>
                บันทึกแล้ว ✨
              </div>
            )}

            <button type="button" onClick={save} disabled={saving || !dirty} className={PRIMARY_BTN}>
              {saving ? "กำลังบันทึก…" : dirty ? "บันทึก" : "บันทึกแล้ว"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
