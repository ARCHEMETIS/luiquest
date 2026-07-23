// แถบเมนูโปรไฟล์สไลด์จากขอบจอ (profile-drawer-prompt.md, เพิ่มเติม 18 ก.ค. 2026 จาก ticket #10 app shell/nav)
// รวมเนื้อหาจาก ticket #7 (ชวนเพื่อน) + ฟีเจอร์สลับหัวข้อที่เรียนอยู่เข้าด้วยกัน แทนการทำเป็นหน้าแยก
// เปิดจากการแตะรูปโปรไฟล์/ชื่อผู้ใช้ใน nav จริง (ตัว nav ยังไม่ได้ทำ — ที่นี่จำลอง header ไว้ให้กดเปิดดูได้ตอน preview)
// รับ prop เปิด/ปิดจากภายนอกได้ (open/onClose) — ถ้าไม่ส่งมาจะคุมสถานะเปิด/ปิดของตัวเองเพื่อ preview
// states (preset ข้อมูล): capped (ครบเพดานฟรี 3/3 หัวข้อ) | single (มีหัวข้อเดียว + ยังไม่มีเพื่อนสมัคร) | premium (ไม่จำกัดหัวข้อ)
// หมายเหตุ: บรีฟต้นฉบับเรียกระบบคะแนนว่า "grade A-F" แต่ ticket #4 ที่ shipped แล้วใช้ระบบ "แรงค์" S/A/B/C แทน — ที่นี่ใช้แรงค์ให้ตรงกับหน้าเควส

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { api } from "../lib/api.js";
import { supabase } from "../lib/supabaseClient.js";

// level enum จริงจาก backend = beginner/intermediate/advanced (ต่างจาก id การ์ด onboarding some/solid)
const LEVEL_LABEL = { beginner: "มือใหม่ 🌱", intermediate: "พอมีพื้น 🌿", advanced: "แน่นแล้ว 🌳" };
const RANK_COLOR = { S: "text-[#FBBF24]", A: "text-emerald-600", B: "text-[#8B5CF6]", C: "text-amber-600" };
const TOPIC_CAP_FREE = 3;

// path จาก Heroicons 24/outline (assets/heroicons — MIT): code-bracket, chart-bar, globe-alt, sparkles, table-cells, banknotes
const TOPIC_META = {
  python: {
    title: "Python",
    tint: "bg-violet-100 text-violet-600",
    icon: ["M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"],
  },
  "data-ml": {
    title: "Data / ML",
    tint: "bg-pink-100 text-pink-500",
    icon: [
      "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
    ],
  },
  web: {
    title: "สร้างเว็บ",
    tint: "bg-sky-100 text-sky-500",
    icon: [
      "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    ],
  },
  ai: {
    title: "ใช้ AI เป็น",
    tint: "bg-fuchsia-100 text-fuchsia-500",
    icon: [
      "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
    ],
  },
  excel: {
    title: "Excel",
    tint: "bg-emerald-100 text-emerald-600",
    icon: [
      "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5",
    ],
  },
  finance: {
    title: "การเงินส่วนบุคคล",
    tint: "bg-amber-100 text-amber-600",
    icon: [
      "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
    ],
  },
};

// resolve icon/tint ต่อหัวข้อจาก topic_title จริง (me.js ไม่ส่ง slug มา) — curated จับ keyword ได้, freeform ใช้ default
const DEFAULT_TOPIC_META = {
  tint: "bg-violet-100 text-violet-600",
  icon: ["M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"],
};
const TOPIC_KEYWORD_META = [
  [/python|ไพทอน/i, TOPIC_META.python],
  [/data|\bml\b|machine|ดาต้า/i, TOPIC_META["data-ml"]],
  [/เว็บ|web|html|css/i, TOPIC_META.web],
  [/\bai\b|เอไอ|ปัญญาประดิษฐ์/i, TOPIC_META.ai],
  [/excel|sheet|ชีท|เอ็กเซล/i, TOPIC_META.excel],
  [/เงิน|การเงิน|finance|ลงทุน/i, TOPIC_META.finance],
];
const metaForTopic = (title) => TOPIC_KEYWORD_META.find(([re]) => re.test(title || ""))?.[1] ?? DEFAULT_TOPIC_META;

// icon UI ทั่วไปของแถบนี้ (ปิด/copy/เช็ค/ออกจากระบบ/ลูกศร/ประกาย/แชร์)
const ICON_PATHS = {
  close: ["M6 18 18 6M6 6l12 12"],
  copy: [
    "M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z",
  ],
  check: ["m4.5 12.75 6 6 9-13.5"],
  logout: [
    "M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9",
  ],
  chevronRight: ["m8.25 4.5 7.5 7.5-7.5 7.5"],
  sparkles: [
    "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
  ],
  share: [
    "M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z",
  ],
};

const Icon = ({ paths, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={className}>
    {paths.map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);



const SHARE_CHANNELS = [
  { id: "line", label: "LINE", className: "bg-[#06C755] text-white" },
  { id: "instagram", label: "IG", className: "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white" },
  { id: "other", label: "อื่นๆ", className: "border border-[#FBCFE8] bg-white/80 text-[#8B5CF6]" },
];

const TopicRow = ({ topic, onSelect }) => {
  const meta = metaForTopic(topic.title);
  const disabled = topic.active;
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(topic.id)}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-left transition ${
        disabled
          ? "cursor-default border-[#8B5CF6] bg-white shadow-[0_8px_20px_rgba(139,92,246,.18)]"
          : "cursor-pointer border-[#FBCFE8] bg-white/70 hover:-translate-y-0.5 hover:border-[#F9A8D4] hover:bg-white hover:shadow-[0_10px_22px_rgba(236,72,153,.15)] active:translate-y-px"
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}>
        <Icon paths={meta.icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold text-[#831843]">{topic.title}</span>
        <span className="block text-[9px] text-[#9D5C7C]">{LEVEL_LABEL[topic.level] ?? topic.level}</span>
      </span>
      {disabled ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#8B5CF6] px-2 py-0.5 text-[8px] font-bold text-white">
          กำลังลุยอยู่
        </span>
      ) : (
        <Icon paths={ICON_PATHS.chevronRight} className="h-3.5 w-3.5 shrink-0 text-[#9D5C7C]" />
      )}
    </button>
  );
};

export default function ProfileDrawer({ open, onClose, showStateToggle = false }) {
  const { session, signOut } = useAuth();
  const { profile, roadmaps, refetch } = useProfile();
  const navigate = useNavigate();
  const token = session?.access_token;

  const name = profile?.display_name || "นักผจญภัย";
  const initial = (name.charAt(0) || "?").toUpperCase();
  const referralLink = profile?.referral_code ? `${window.location.origin}/invite/${profile.referral_code}` : "";

  const [referralCount, setReferralCount] = useState(0);

  // สร้างข้อมูลรูปเดียวกับ preset เดิมจากของจริง (ลด diff ฝั่ง render) — topics.id = roadmap_id ตัวจริงไว้สลับ
  const preset = {
    plan: profile?.is_premium ? "premium" : "free",
    user: { name, initial },
    stats: { xp: profile?.total_xp ?? 0, streak: profile?.current_streak ?? 0, rank: profile?.grade ?? "–" },
    topics: (roadmaps ?? [])
      .filter((r) => r.status !== "failed")
      .map((r) => ({ id: r.id, title: r.topic_title, level: r.level, active: r.is_active })),
    referral: { link: referralLink, count: referralCount },
  };

  const isOpen = !!open;
  const requestClose = () => onClose?.();

  // เก็บ mount ไว้ระหว่างเล่น animation ปิด แล้วค่อย unmount จริงหลังทรานสิชันจบ (ไม่ให้แถบหายวับทันที)
  const [mounted, setMounted] = useState(isOpen);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted]);

  // นับจำนวนเพื่อนที่สมัครผ่านลิงก์เรา — RLS ให้ referrer อ่าน referrals ของตัวเองได้ (ชื่อเพื่อนอ่านไม่ได้ โชว์แค่จำนวน)
  useEffect(() => {
    if (!isOpen || !session?.user?.id) return; // ผูกกับ isOpen ไม่ใช่ mounted — เปิดใหม่ในช่วง exit-anim (mounted ยัง true) จะได้ count สด
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", session.user.id);
      if (!cancelled && typeof count === "number") setReferralCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, session?.user?.id]);

  const [switchingId, setSwitchingId] = useState(null);
  const [switchMsg, setSwitchMsg] = useState("");
  const [showCapUpsell, setShowCapUpsell] = useState(false); // เด้งกล่องขายพรีเมียมเมื่อกด "เพิ่มหัวข้อใหม่" ตอนครบเพดาน

  // ---- ปัดนิ้วปิดแถบ (แบบเฟซบุ๊ก) ----
  // dragX = ระยะที่นิ้วลากไปทางซ้าย (px) ระหว่างลากให้แถบวิ่งตามนิ้วจริง ๆ ไม่ใช่รอปล่อยแล้วค่อยเด้ง
  // axis: ตัดสินครั้งเดียวต่อ 1 การแตะว่าเป็นการลากแนวนอน (ปิดแถบ) หรือแนวตั้ง (เลื่อนเนื้อหาในแถบ)
  // เพื่อไม่ให้สองอย่างแย่งกัน — เลื่อนอ่านเนื้อหายาว ๆ ต้องไม่เผลอปิดแถบ
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef(null);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    dragRef.current = { x: t.clientX, y: t.clientY, axis: null };
  };
  const onTouchMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // ยังสั้นเกินกว่าจะตัดสินทิศ
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (d.axis !== "x") return;
    setDragX(Math.max(0, -dx)); // ลากไปทางขวาไม่ทำอะไร (แถบชิดขอบซ้ายอยู่แล้ว)
  };
  const onTouchEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    // ลากเกิน ~1 ใน 3 ของความกว้างแถบ (หรือ 90px) = ตั้งใจปิด; ไม่ถึงก็ดีดกลับที่เดิม
    if (d?.axis === "x" && dragX > 90) requestClose();
    setDragX(0);
  };
  const [copied, setCopied] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const timers = useRef({});
  const switchingRef = useRef(false); // guard แบบ synchronous กัน double-tap สลับหัวข้อสองอันเร็ว ๆ (state switchingId อัพเดตช้าไป 1 render)

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const flash = (key, setter, value, ms = 1600) => {
    clearTimeout(timers.current[key]);
    setter(value);
    timers.current[key] = setTimeout(() => setter(key === "copied" ? false : ""), ms);
  };

  const activeTopicId = preset.topics.find((t) => t.active)?.id;

  // สลับหัวข้อ active จริงผ่าน service-role function แล้ว refetch โปรไฟล์ (progress หัวข้อเดิมไม่หาย)
  const selectTopic = async (roadmapId) => {
    if (roadmapId === activeTopicId || switchingRef.current || !token) return;
    switchingRef.current = true; // ล็อกทันที (sync) กันคลิกอันที่สองแทรกก่อน setSwitchingId จะ re-render
    const target = preset.topics.find((t) => t.id === roadmapId);
    setSwitchingId(roadmapId);
    try {
      await api.switchRoadmap(roadmapId, token);
      await refetch();
      flash("switch", setSwitchMsg, `สลับไปเรียน ${target?.title ?? "หัวข้อใหม่"} แล้ว`);
    } catch {
      flash("switch", setSwitchMsg, "สลับหัวข้อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSwitchingId(null);
      switchingRef.current = false;
    }
  };

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard?.writeText(referralLink).catch(() => {});
    flash("copied", setCopied, true);
  };

  const share = (channel) => {
    if (referralLink && navigator.share) {
      navigator
        .share({ title: "ลุยเควส", text: "มาลุยเควสเก็บ XP/streak กัน! สมัครผ่านลิงก์นี้ได้ XP ทั้งคู่", url: referralLink })
        .catch(() => {});
      flash("share", setShareMsg, "เปิดหน้าต่างแชร์ให้แล้ว");
    } else {
      // เบราว์เซอร์ไม่มี Web Share (เดสก์ท็อป) — คัดลอกลิงก์ให้จริง ไม่ใช่แค่ขึ้นข้อความ
      navigator.clipboard?.writeText(referralLink).catch(() => {});
      flash("share", setShareMsg, `คัดลอกลิงก์แล้ว เอาไปแชร์ผ่าน ${channel.label} ได้เลย`);
    }
  };

  const logout = async () => {
    requestClose();
    await signOut();
    navigate("/login");
  };

  const atCap = preset.topics.length >= TOPIC_CAP_FREE && preset.plan === "free";

  // ปิดสนิทแล้วไม่ render อะไรเลย — ไม่เหลือกล่องไปบัง/ดันหน้าที่อยู่ข้างหลัง
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 font-body text-[#831843]">
      <style>{`
        @keyframes pd-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>

      {mounted && (
        <>
          {/* backdrop */}
          <div
            onClick={requestClose}
            className={`absolute inset-0 z-40 bg-black transition-opacity duration-300 ${entered ? "opacity-40" : "opacity-0"}`}
          />

          {/* ตัวแถบเมนู — สไลด์จากซ้าย แบบเฟซบุ๊ก */}
          <aside
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            // ระหว่างลากด้วยนิ้ว: ปิด transition แล้วขยับตามนิ้วจริง ๆ ปล่อยเมื่อไหร่ค่อยคืน transition ให้ดีดกลับ/ปิดแบบนุ่ม
            style={dragX ? { transform: `translateX(-${dragX}px)`, transition: "none" } : undefined}
            className={`absolute inset-y-0 left-0 z-50 flex w-[78%] max-w-[280px] flex-col border-r-2 border-[#FBCFE8] bg-gradient-to-b from-white to-[#FDF2F8] shadow-[8px_0_30px_rgba(139,92,246,.20)] transition-transform duration-300 ease-out ${
              entered ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* header: ปิดแถบ */}
            <div className="flex shrink-0 items-center justify-end px-3.5 pt-3.5">
              <button
                onClick={requestClose}
                aria-label="ปิดแถบเมนู"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FBCFE8] bg-white/80 text-[#9D5C7C] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px"
              >
                <Icon paths={ICON_PATHS.close} className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* เนื้อหาเลื่อนได้ ยกเว้นปุ่มออกจากระบบที่ปักไว้ล่างสุด */}
            {/* ซ่อน scrollbar เมาส์ — เลื่อนด้วย wheel/touch ยังใช้ได้ปกติ */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* 1. สรุปบัญชี */}
              <div className="flex items-center gap-2.5 pb-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-200 to-pink-200 font-heading text-lg font-bold text-[#831843]">
                  {preset.user.initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-[14px] font-bold">{preset.user.name}</p>
                  {preset.plan === "premium" ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2 py-0.5 text-[9px] font-bold text-white">
                      <Icon paths={ICON_PATHS.sparkles} className="h-2.5 w-2.5" />
                      พรีเมียม
                    </span>
                  ) : (
                    <span className="mt-0.5 inline-block rounded-full border border-[#FBCFE8] bg-white/70 px-2 py-0.5 text-[9px] font-bold text-[#9D5C7C]">
                      แผนฟรี
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-1.5 text-center">
                  <p className="text-[9px] text-[#9D5C7C]">XP</p>
                  <p className="font-heading text-[13px] font-bold text-[#831843]">{preset.stats.xp.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-1.5 text-center">
                  <p className="text-[9px] text-[#9D5C7C]">streak 🔥</p>
                  <p className="font-heading text-[13px] font-bold text-[#831843]">{preset.stats.streak}</p>
                </div>
                <div className="rounded-2xl border border-[#FBCFE8] bg-white/70 px-2 py-1.5 text-center">
                  <p className="text-[9px] text-[#9D5C7C]">แรงค์</p>
                  <p className={`font-heading text-[13px] font-bold ${RANK_COLOR[preset.stats.rank] || "text-[#9D5C7C]"}`}>
                    {preset.stats.rank}
                  </p>
                </div>
              </div>

              {/* 2. หัวข้อที่เก็บไว้ (สลับได้) */}
              <div className="mt-4 border-t border-[#FBCFE8] pt-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-heading text-[12px] font-bold">หัวข้อที่เก็บไว้</h2>
                  <span className="text-[10px] text-[#9D5C7C]">
                    {preset.topics.length}/{preset.plan === "premium" ? "ไม่จำกัด" : TOPIC_CAP_FREE}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {preset.topics.map((t) => (
                    <TopicRow key={t.id} topic={{ ...t, active: t.id === activeTopicId }} onSelect={selectTopic} />
                  ))}
                </div>
                {switchMsg && (
                  <p className="mt-2 text-[10px] font-bold text-[#8B5CF6]" style={{ animation: "pd-in .25s ease-out" }}>
                    {switchMsg}
                  </p>
                )}
                {/* เพิ่มหัวข้อใหม่ — ทางเข้าเดียวที่พาไป onboarding ได้หลังมี roadmap แล้ว
                    (ก่อนหน้านี้ผู้ใช้สลับได้เฉพาะหัวข้อที่เก็บไว้ ไม่มีทางเริ่มหัวข้อใหม่เลยทั้งที่เพดานฟรีให้ 3)
                    โชว์เสมอแม้ครบเพดาน — พอครบแล้วกดจะเด้งขายพรีเมียมแทนการพาไป onboarding
                    (จังหวะที่ผู้ใช้ "อยากได้เพิ่ม" คือจังหวะขายที่ดีที่สุด ดีกว่าซ่อนปุ่มแล้วเงียบไป) */}
                <button
                  type="button"
                  onClick={() => {
                    if (atCap) {
                      setShowCapUpsell(true);
                      return;
                    }
                    requestClose();
                    navigate("/onboarding?mode=new");
                  }}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#FBCFE8] bg-white/60 px-3 py-2.5 text-[12px] font-bold text-[#8B5CF6] transition hover:border-[#8B5CF6]/60 hover:bg-white active:translate-y-px"
                >
                  <span className="text-[14px] leading-none">+</span> เพิ่มหัวข้อใหม่
                </button>

                {atCap && showCapUpsell && (
                  <div
                    className="mt-2.5 rounded-2xl border border-[#8B5CF6]/30 bg-gradient-to-br from-violet-50 to-pink-50 px-3 py-3 text-[11px] leading-relaxed text-[#831843]"
                    style={{ animation: "pd-in .25s ease-out" }}
                  >
                    <p className="font-heading text-[12px] font-bold">
                      เก็บครบ {TOPIC_CAP_FREE} หัวข้อแล้ว ✨
                    </p>
                    <p className="mt-1 text-[#9D5C7C]">
                      แผนฟรีเก็บได้ {TOPIC_CAP_FREE} หัวข้อ (progress ทุกหัวข้อยังอยู่ครบ สลับกลับมาเรียนต่อได้เสมอ) —
                      อยากลุยหลายหัวข้อพร้อมกันไม่จำกัด รอพรีเมียมเร็ว ๆ นี้
                    </p>
                  </div>
                )}
              </div>

              {/* 3. ชวนเพื่อน */}
              <div className="mt-4 border-t border-[#FBCFE8] pt-3.5">
                <h2 className="font-heading text-[12px] font-bold">ชวนเพื่อน ได้ XP ฟรี 🎁</h2>
                <p className="mt-1 text-[10px] leading-relaxed text-[#9D5C7C]">สมัครผ่านลิงก์ของคุณ = ได้ XP ทั้งคู่เลย</p>

                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex-1 truncate rounded-full border border-[#FBCFE8] bg-white/80 px-2.5 py-1.5 text-[10px] text-[#9D5C7C]">
                    {preset.referral.link}
                  </div>
                  <button
                    onClick={copyLink}
                    aria-label="คัดลอกลิงก์ชวนเพื่อน"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-[0_8px_18px_rgba(139,92,246,.28)] transition hover:-translate-y-0.5 active:translate-y-px"
                  >
                    <Icon paths={copied ? ICON_PATHS.check : ICON_PATHS.copy} className="h-3.5 w-3.5" />
                  </button>
                </div>
                {copied && (
                  <p className="mt-1 text-[10px] font-bold text-[#8B5CF6]" style={{ animation: "pd-in .25s ease-out" }}>
                    คัดลอกลิงก์แล้ว! ส่งให้เพื่อนได้เลย
                  </p>
                )}

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {SHARE_CHANNELS.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => share(ch)}
                      className={`flex h-8 items-center justify-center gap-1 rounded-full text-[10px] font-bold transition hover:-translate-y-0.5 active:translate-y-px ${ch.className}`}
                    >
                      {ch.id === "other" && <Icon paths={ICON_PATHS.share} className="h-3 w-3" />}
                      {ch.label}
                    </button>
                  ))}
                </div>
                {shareMsg && (
                  <p className="mt-2 text-[10px] font-bold text-[#8B5CF6]" style={{ animation: "pd-in .25s ease-out" }}>
                    {shareMsg}
                  </p>
                )}

                {preset.referral.count === 0 ? (
                  <p className="mt-3 rounded-2xl border border-[#FBCFE8] bg-white/60 px-3 py-2.5 text-[11px] leading-relaxed text-[#9D5C7C]">
                    ยังไม่มีเพื่อนสมัครผ่านลิงก์คุณเลย ลองแชร์ดูสิ ✨
                  </p>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {Array.from({ length: Math.min(preset.referral.count, 4) }, (_, i) => (
                        <span
                          key={i}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-200 to-pink-200 text-[10px] font-bold text-[#831843]"
                        >
                          🙂
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#9D5C7C]">
                      เพื่อนสมัครผ่านลิงก์คุณแล้ว <span className="font-bold text-[#831843]">{preset.referral.count}</span> คน
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4. ปุ่มออกจากระบบ — ปักไว้ล่างสุด ไม่ถูกเลื่อนหาย */}
            <div className="shrink-0 border-t border-[#FBCFE8] px-3.5 py-2.5">
              <button
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#FBCFE8] bg-white/70 py-2 text-[13px] font-bold text-[#9D5C7C] transition hover:border-red-300 hover:text-red-500 active:translate-y-px"
              >
                <Icon paths={ICON_PATHS.logout} className="h-3.5 w-3.5" />
                ออกจากระบบ
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
