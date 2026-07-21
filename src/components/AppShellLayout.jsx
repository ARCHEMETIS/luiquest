// App shell / navigation ของลุยเควส (ปรับจาก AppShell.jsx ของเพื่อนให้เข้ากับ React Router)
// เดิม AppShell คุมด้วย tab state + mount 3 หน้าค้างไว้; เวอร์ชันนี้ให้ routing เป็นตัวคุมแทน:
// bottom nav = <NavLink>/ปุ่ม navigate, เนื้อหา = <Outlet/> (หน้า /quest /coach /leaderboard เรนเดอร์ในนี้)
// header อวตารกดเปิด ProfileDrawer เป็น overlay controlled — /stats อยู่นอกเชลล์ตามบรีฟ
// คงดีไซน์เพื่อนครบ: โลโก้+มาสคอตจิ๋ว header, Heroicons, แถบ active ไหลตาม + ประกาย, CSS var --shell-bottom-offset
// ให้ปุ่ม fixed ในหน้าลูก (ปุ่มถามโค้ช/การ์ด pin อันดับ) บวกเข้ากับ bottom ของตัวเองกันชน nav
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import GhostMascot from "./GhostMascot.jsx";
import { LuiQuestFavicon } from "./LuiQuestLogo.jsx";
import ProfileDrawer from "./ProfileDrawer.jsx";
import { useProfile } from "../hooks/useProfile.jsx";

// ความสูงจริงของ bottom nav (โดยประมาณ) — ปุ่ม fixed ในหน้าลูกอ่านค่านี้ผ่าน CSS var กันลอยไปชนแถบ nav
const SHELL_NAV_HEIGHT = "56px";

// path จาก Heroicons 24/outline (assets/heroicons — MIT): home, chat-bubble-left-right, trophy
const ICON_PATHS = {
  quest: [
    "m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  ],
  coach: [
    "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
  ],
  leaderboard: [
    "M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0",
  ],
};

const Icon = ({ paths, className = "h-[18px] w-[18px]", strokeWidth = "1.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} stroke="currentColor" aria-hidden="true" className={className}>
    {paths.map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

// มาสคอตจิ๋วข้างโลโก้ header — ย่อ GhostMascot (grid จริง 96×108) ด้วย absolute + scale จากมุมบนซ้าย
const HEADER_MASCOT_GRID_W = 96;
const HEADER_MASCOT_GRID_H = 108;
const HeaderMascot = ({ size = 24 }) => {
  const scale = size / HEADER_MASCOT_GRID_W;
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-pink-100"
      style={{ width: size, height: size * (HEADER_MASCOT_GRID_H / HEADER_MASCOT_GRID_W) }}
    >
      <span style={{ position: "absolute", top: 0, left: 0, width: HEADER_MASCOT_GRID_W, height: HEADER_MASCOT_GRID_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <GhostMascot mood="idle" />
      </span>
    </span>
  );
};

// 3 ทางหลัก (เควส/โค้ช/อันดับ) — เพิ่มแท็บใหม่ในอนาคตแค่ต่อ array (กริดคอลัมน์ + แถบ active อ้าง .length/index เอง)
const NAV_ITEMS = [
  { to: "/quest", label: "เควสวันนี้", icon: ICON_PATHS.quest },
  { to: "/coach", label: "แชทโค้ช", icon: ICON_PATHS.coach },
  { to: "/leaderboard", label: "อันดับ", icon: ICON_PATHS.leaderboard },
];

export default function AppShellLayout() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile } = useProfile();
  const location = useLocation();
  const activeIndex = Math.max(0, NAV_ITEMS.findIndex((i) => location.pathname === i.to || location.pathname.startsWith(i.to + "/")));

  const name = profile?.display_name || "นักผจญภัย";
  const initial = (name.charAt(0) || "?").toUpperCase();

  // เปิด drawer จากที่อื่นได้ผ่าน event (ปุ่ม "ชวนเพื่อน" ในหน้าเควส/อันดับ dispatch มา)
  useEffect(() => {
    const openDrawer = () => setProfileOpen(true);
    window.addEventListener("luiquest-open-profile", openDrawer);
    return () => window.removeEventListener("luiquest-open-profile", openDrawer);
  }, []);

  return (
    <div
      className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden font-body text-[#831843] md:max-w-xl"
      style={{
        backgroundColor: "#FDF2F8",
        backgroundImage: [
          "radial-gradient(ellipse 220px 160px at 8% 4%, rgba(139,92,246,.14), transparent 70%)",
          "radial-gradient(ellipse 200px 180px at 95% 22%, rgba(249,168,212,.30), transparent 70%)",
          "radial-gradient(ellipse 260px 200px at 15% 96%, rgba(236,72,153,.10), transparent 70%)",
        ].join(","),
        backgroundRepeat: "no-repeat",
        "--shell-bottom-offset": SHELL_NAV_HEIGHT,
      }}
    >
      <style>{`
        @keyframes shell-in { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes shell-nav-pop { 0% { transform: scale(.7); } 60% { transform: scale(1.14); } 100% { transform: scale(1); } }
        @keyframes shell-spark { 0% { opacity: 0; transform: translateY(0) scale(.4) rotate(0deg); } 30% { opacity: 1; transform: translateY(-6px) scale(1.1) rotate(15deg); } 100% { opacity: 0; transform: translateY(-16px) scale(.8) rotate(-10deg); } }
      `}</style>

      {/* header: โลโก้+มาสคอตจิ๋ว + อวตารโปรไฟล์ (กดเปิด ProfileDrawer) */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[#FBCFE8] bg-gradient-to-b from-white to-[#FDF2F8] px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <LuiQuestFavicon size={26} />
          <HeaderMascot size={24} />
          <span className="font-heading text-xs font-bold">ลุยเควส</span>
        </div>
        <button
          onClick={() => setProfileOpen(true)}
          aria-label={`เปิดโปรไฟล์ของ ${name}`}
          className="flex items-center gap-1.5 rounded-full border border-[#FBCFE8] bg-white/80 py-0.5 pl-0.5 pr-2.5 transition hover:border-[#8B5CF6]/50 hover:bg-white active:translate-y-px"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-200 to-pink-200 font-heading text-[10px] font-bold text-[#831843]">
              {initial}
            </span>
          )}
          <span className="max-w-[100px] truncate text-[10px] font-bold text-[#831843]">{name}</span>
        </button>
      </header>

      {/* พื้นที่เนื้อหา (หน้าจาก routing) — ซ่อน scrollbar เมาส์แบบแอพมือถือ */}
      <main className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Outlet />
      </main>

      {/* bottom nav — แถบ active ไหลตามหน้า + ประกายเล็ก ๆ ตอนสลับ */}
      <nav
        className="z-10 shrink-0 border-t border-[#FBCFE8] bg-gradient-to-t from-white to-[#FDF2F8] px-2"
        style={{ boxShadow: "0 -6px 16px rgba(139,92,246,.10)", paddingBottom: "max(4px, env(safe-area-inset-bottom))" }}
      >
        <div className="relative grid pt-1" style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0,1fr))` }}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 rounded-2xl bg-[#8B5CF6]/[.10] transition-transform duration-300 ease-out"
            style={{ width: `calc(${100 / NAV_ITEMS.length}% - 8px)`, left: "4px", transform: `translateX(calc(${activeIndex} * (100% + 8px)))` }}
          />
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className="relative flex flex-col items-center gap-0.5 rounded-2xl py-1 transition active:translate-y-px"
            >
              {({ isActive }) => (
                <>
                  <span className="relative flex h-6 w-9 items-center justify-center" style={isActive ? { animation: "shell-nav-pop .3s ease-out" } : undefined}>
                    <Icon paths={item.icon} strokeWidth={isActive ? "2" : "1.5"} className={`h-[18px] w-[18px] transition ${isActive ? "text-[#8B5CF6]" : "text-[#9D5C7C]"}`} />
                    {isActive && (
                      <>
                        <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 text-[10px] text-[#FBBF24]" style={{ animation: "shell-spark .5s ease-out" }}>✦</span>
                        <span aria-hidden="true" className="pointer-events-none absolute -left-1 -top-0.5 text-[8px] text-[#EC4899]" style={{ animation: "shell-spark .5s ease-out .08s" }}>✧</span>
                      </>
                    )}
                  </span>
                  <span className={`text-[9px] font-bold ${isActive ? "text-[#8B5CF6]" : "text-[#9D5C7C]"}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* แถบโปรไฟล์ (รวมสลับหัวข้อ + ชวนเพื่อน) — controlled overlay, mount ค้างไว้เสมอ (ตามโน้ตของ ProfileDrawer เอง) */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} showStateToggle={false} />
    </div>
  );
}
