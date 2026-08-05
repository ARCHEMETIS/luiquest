// มาสคอตที่เดินเล่นอยู่บนขอบ bottom nav (เจ้าของขอ: หน้าแรก "ยังดูเรียบ ๆ ยังไม่มีลูกเล่น")
//
// วางตัวยังไง: กล่องนี้เป็นลูกของ <nav> ที่ตั้ง relative ไว้ แล้วเกาะ bottom-full = "ยืนบนหลังคาแถบ nav" พอดี
//   → ไม่ต้องเดาความสูง nav (nav มี padding safe-area ของเครื่องบวกเพิ่มอีก) และไม่มีทางไปทับไอคอน
//   → ทั้งกล่อง pointer-events-none มีแค่ตัวผีเองที่ pointer-events-auto ปุ่ม nav ทุกปุ่มจึงกดได้ครบ 100%
// เดินยังไง: CSS animation ล้วน (translateX เป็น % ของความกว้างเชลล์ เพราะตัว walker กว้างเต็ม nav)
//   ไม่มี loop JS ต่อเฟรม — เดินไป หยุดพัก ย่ำอยู่กับที่ แล้วเดินกลับ วนไปเรื่อย ๆ
//   ตัวผีเองใช้ mood "idle" ของ GhostMascot ที่เด้งขึ้นลงอยู่แล้ว = ท่าเดิน+ท่าย่ำในตัว
// แตะแล้วอะไรเกิดขึ้น: ไป /coach (คนชอบแตะอวตาร/ตัวการ์ตูนก่อนเป็นอันดับแรก เดิมแตะแล้วเงียบ)
//   แตะรัว ๆ ติดกัน = มันงอน หันหลังให้แป๊บนึงแล้วค่อยคืนดี (mood "sad" ที่มีอยู่แล้ว)
// prefers-reduced-motion: ไม่เดิน ยืนนิ่งอยู่มุมซ้าย แต่ยังแตะได้เหมือนเดิม
//
// ยังไม่ทำ: ลากตัวมาสคอตไปวาง (drag-to-pick-up) — ชนกับท่าปัดเปิดแถบโปรไฟล์และการเลื่อนหน้า เก็บไว้รอบหน้า

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GhostMascot from "./GhostMascot.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { canInstall, needsIosHint } from "../lib/installState.js";
import {
  BUBBLE_VISIBLE_MS,
  FIRST_SPEAK_DELAY_MS,
  cooldownPassed,
  markSpoken,
  pickMascotMessage,
  wasSpoken,
} from "../lib/mascotChatter.js";

// grid จริงของ GhostMascot = 96×108 — ย่อด้วย absolute + scale จากมุมบนซ้าย (เทคนิคเดียวกับมาสคอตจิ๋วใน header)
const GRID_W = 96;
const GRID_H = 108;
const MASCOT_W = 30;
const MASCOT_H = Math.round(MASCOT_W * (GRID_H / GRID_W)); // 34

const SULK_TAPS = 3; // แตะกี่ครั้งในหน้าต่างเวลาเดียวกันถึงจะงอน
const SULK_WINDOW_MS = 1400;
const SULK_MS = 2000;
const CHECK_EVERY_MS = 15000; // เช็คว่า "ถึงเวลาพูดหรือยัง" ทุก 15 วิ (ไม่ใช่ทุกเฟรม)

export default function NavMascot() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [bubble, setBubble] = useState(null); // { id, text, mood } ที่กำลังโชว์อยู่
  const [sulking, setSulking] = useState(false);
  const taps = useRef([]);
  const timers = useRef({});
  const bubbleRef = useRef(null); // เงาของ bubble ไว้เช็คใน callback โดยไม่ต้องผูก effect กับ state
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const dismiss = useCallback(() => {
    clearTimeout(timers.current.hide);
    bubbleRef.current = null;
    setBubble(null);
  }, []);

  // กดฟองคำพูดตอนน้องชวนติดตั้ง → เด้งการ์ดติดตั้งขึ้นมาเลย (InstallPrompt ดัก event นี้อยู่)
  // ใช้ custom event แบบเดียวกับ luiquest-open-profile เพราะสองตัวนี้อยู่คนละกิ่งของ tree
  const openInstall = useCallback(() => {
    window.dispatchEvent(new CustomEvent("luiquest-show-install"));
    dismiss();
  }, [dismiss]);

  // ---- จังหวะพูด: คุมความถี่ที่นี่ที่เดียว (คูลดาวน์ + ห้ามพูดซ้ำใน session — ดู mascotChatter.js) ----
  useEffect(() => {
    const trySpeak = () => {
      if (bubbleRef.current) return; // พูดอยู่แล้ว
      if (document.hidden) return; // ไม่แอบพูดตอนผู้ใช้ไม่ได้ดู (เผาคูลดาวน์ทิ้งเปล่า ๆ)
      if (!cooldownPassed()) return;
      const msg = pickMascotMessage({
        profile: profileRef.current,
        // ประโยคชวนติดตั้งใช้ได้เฉพาะตอนติดตั้งได้จริง (Chrome ที่ยังไม่ติดตั้ง หรือ iOS ที่ต้องสอนกดเอง)
        canInstall: canInstall() || needsIosHint(),
      });
      if (!msg || wasSpoken(msg.id)) return;
      markSpoken(msg.id);
      bubbleRef.current = msg;
      setBubble(msg);
      clearTimeout(timers.current.hide);
      timers.current.hide = setTimeout(() => {
        bubbleRef.current = null;
        setBubble(null);
      }, BUBBLE_VISIBLE_MS);
    };
    timers.current.first = setTimeout(trySpeak, FIRST_SPEAK_DELAY_MS);
    const interval = setInterval(trySpeak, CHECK_EVERY_MS);
    return () => {
      clearTimeout(timers.current.first);
      clearInterval(interval);
    };
  }, []);

  const handleTap = () => {
    if (sulking) return; // งอนอยู่ ไม่คุยด้วย
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < SULK_WINDOW_MS);
    clearTimeout(timers.current.go);
    if (taps.current.length >= SULK_TAPS) {
      taps.current = [];
      dismiss();
      setSulking(true);
      clearTimeout(timers.current.sulk);
      timers.current.sulk = setTimeout(() => setSulking(false), SULK_MS);
      return;
    }
    dismiss();
    // หน่วงเสี้ยววินาทีก่อนพาไป /coach — ถ้าไม่หน่วง แตะครั้งแรกจะเปลี่ยนหน้าแล้วมาสคอตถูก unmount ทันที
    // (มันโผล่เฉพาะหน้าเควส) แตะครั้งที่ 2-3 เลยไม่มีทางเกิดขึ้นเลย = ท่างอนตายสนิท
    timers.current.go = setTimeout(() => navigate("/coach"), 240);
  };

  // สีหน้าเปลี่ยนตามเรื่องที่พูด (mood มากับข้อความจาก mascotChatter) — งอนแล้วชนะทุกอย่าง
  const mood = sulking ? "sad" : bubble?.mood || "idle";
  // พูดอยู่/งอนอยู่ = หยุดเดิน (อ่านข้อความบนตัวที่ไถลไปมาไม่ไหว) แต่ค้างตำแหน่งเดิม ไม่วาร์ปกลับจุดเริ่ม
  const paused = !!bubble || sulking;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full z-10" style={{ height: MASCOT_H }}>
      <style>{`
        /* เดินไปทางขวา -> ยืนพัก -> เดินกลับ -> ยืนพัก (ช่วงที่ค่าไม่เปลี่ยน = ยืนย่ำอยู่กับที่) */
        @keyframes nav-mascot-stroll {
          0%   { transform: translateX(0); }
          10%  { transform: translateX(0); }
          40%  { transform: translateX(42%); }
          55%  { transform: translateX(42%); }
          85%  { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
        @keyframes nav-mascot-bubble-in {
          0%   { opacity: 0; transform: translateY(6px) scale(.9); }
          60%  { opacity: 1; transform: translateY(-1px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* งอน: หันหลังให้ (พลิกซ้ายขวา) แล้วยุบตัวลงนิดนึง */
        @keyframes nav-mascot-sulk {
          0%   { transform: scaleX(1) translateY(0); }
          30%  { transform: scaleX(-1) translateY(2px); }
          100% { transform: scaleX(-1) translateY(2px); }
        }
        /* เครื่องตั้งค่าลดการเคลื่อนไหว: ไม่เดิน ไม่เด้ง ไม่งอนแบบมีท่า — ยืนนิ่งอยู่มุมซ้าย แต่ยังแตะได้ปกติ */
        @media (prefers-reduced-motion: reduce) {
          .nav-mascot-walker, .nav-mascot-bubble, .nav-mascot-body, .nav-mascot-body * { animation: none !important; }
        }
      `}</style>

      <div
        className="nav-mascot-walker absolute bottom-0 left-0 h-full w-full"
        style={{ animation: "nav-mascot-stroll 34s ease-in-out infinite", animationPlayState: paused ? "paused" : "running" }}
      >
        {/* ฟองคำพูด — เกาะไปกับตัวมาสคอต (กว้างสุด 55% ของเชลล์ + ระยะเดิน 42% = ยังไม่ล้นขอบขวา)
            ทำเป็นฟองความคิดแบบมีจุดไล่ขึ้น ไม่ใช่หางแหลมติดหัว เพราะต้องยกตัวฟองให้สูงพ้นปุ่ม "ถามโค้ช"
            ที่ลอยอยู่ 20–60px เหนือแถบ nav ในหน้าเควส (ไม่งั้นฟองไปบังปุ่มตอนมาสคอตเดินไปทางขวา) */}
        {bubble && !sulking && (
          <>
            <button
              type="button"
              onClick={bubble.action === "install" ? openInstall : dismiss}
              aria-label={bubble.action === "install" ? "เปิดวิธีติดตั้งลงหน้าจอโฮม" : "ปิดข้อความของมาสคอต"}
              className="nav-mascot-bubble pointer-events-auto absolute left-1 max-w-[55%] rounded-2xl border border-[#FBCFE8] bg-white/95 px-3 py-1.5 text-left text-[10px] font-bold leading-snug text-[#831843] shadow-[0_8px_20px_rgba(139,92,246,.22)]"
              style={{ bottom: MASCOT_H + 28, animation: "nav-mascot-bubble-in .3s cubic-bezier(.22,1,.36,1) both" }}
            >
              {bubble.text}
            </button>
            <span
              aria-hidden="true"
              className="nav-mascot-bubble pointer-events-none absolute left-[14px] h-2 w-2 rounded-full border border-[#FBCFE8] bg-white/95"
              style={{ bottom: MASCOT_H + 15, animation: "nav-mascot-bubble-in .3s cubic-bezier(.22,1,.36,1) .05s both" }}
            />
            <span
              aria-hidden="true"
              className="nav-mascot-bubble pointer-events-none absolute left-[10px] h-1.5 w-1.5 rounded-full border border-[#FBCFE8] bg-white/95"
              style={{ bottom: MASCOT_H + 5, animation: "nav-mascot-bubble-in .3s cubic-bezier(.22,1,.36,1) .1s both" }}
            />
          </>
        )}

        <button
          type="button"
          onClick={handleTap}
          aria-label="คุยกับโค้ช"
          className="nav-mascot-body pointer-events-auto absolute bottom-0 left-3 block"
          style={{
            width: MASCOT_W,
            height: MASCOT_H,
            animation: sulking ? "nav-mascot-sulk .3s ease-out both" : undefined,
          }}
        >
          <span className="relative block h-full w-full overflow-hidden">
            <span
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: GRID_W,
                height: GRID_H,
                transform: `scale(${MASCOT_W / GRID_W})`,
                transformOrigin: "top left",
              }}
            >
              <GhostMascot mood={mood} />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
