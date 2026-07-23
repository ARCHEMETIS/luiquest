import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Quest from './pages/Quest.jsx';
import Coach from './pages/Coach.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Profile from './pages/Profile.jsx';
import Stats from './pages/Stats.jsx';
import AppShellLayout from './components/AppShellLayout.jsx';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ProfileProvider, useProfile } from './hooks/useProfile.jsx';
import { api } from './lib/api.js';

// เพจที่ต้องล็อกอินก่อนเท่านั้น — เควสจริง/onboarding/แชทโค้ช/leaderboard/profile ล้วนผูกกับผู้ใช้
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// โครง route ตาม deploy-plan.md — หน้าจริงจะมาจาก components ของเพื่อน (design-brief-ui.md)
// เหลือ Leaderboard/Profile/Stats เป็น placeholder จนกว่าเพื่อนจะส่ง component มา (ticket #09 note)
export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <InviteRedeemer />
        <AppRoutes />
      </ProfileProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/quest" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route element={<RequireAuth><AppShellLayout /></RequireAuth>}>
        <Route path="/quest" element={<Quest />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Route>
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route path="/stats" element={<Stats />} />
      <Route path="/invite/:code" element={<InviteLanding />} />
      <Route path="*" element={<Navigate to="/quest" replace />} />
    </Routes>
  );
}

function InviteLanding() {
  const { code = '' } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode) localStorage.setItem('luiquest_pending_invite', cleanCode);
    navigate(user ? '/quest' : '/login', { replace: true });
  }, [code, user, loading, navigate]);
  return <div className="flex min-h-dvh items-center justify-center bg-[#FDF2F8] font-body text-[#831843]"><p className="rounded-full bg-white px-5 py-3 text-sm font-bold shadow">กำลังพาไปลุยเควส… ✨</p></div>;
}

function InviteRedeemer() {
  const { session } = useAuth();
  const { refetch } = useProfile();
  const location = useLocation();
  const attempted = useRef(new Set());
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = session?.access_token;
    const code = localStorage.getItem('luiquest_pending_invite');
    if (!token || !code || attempted.current.has(code)) return;
    attempted.current.add(code);
    (async () => {
      try {
        await api.redeemReferral(code, token);
        localStorage.removeItem('luiquest_pending_invite'); // สำเร็จ — เคลียร์
        await refetch();
        setError(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2800);
      } catch (err) {
        // 4xx = terminal (ถูกชวนแล้ว/ชวนตัวเอง/บัญชีเก่าเกิน 30 วัน/โค้ดไม่มีจริง) → เคลียร์ทิ้งและโชว์เหตุผลจาก server
        // 5xx / network (ไม่มี status) = ชั่วคราว → เก็บ code ไว้ + ปลดจาก attempted ให้ลองใหม่รอบหน้า
        // (กันลิงก์ชวนหายเพราะเน็ตสะดุดตอน redeem — referral คือ metric ที่วิชานี้เอาไปวัด)
        const status = err?.status;
        if (status >= 400 && status < 500) {
          localStorage.removeItem('luiquest_pending_invite');
          setError(err.message || 'ใช้ลิงก์ชวนไม่สำเร็จ');
          setTimeout(() => setError(null), 4500);
        } else {
          attempted.current.delete(code);
        }
      }
    })();
  }, [session?.access_token, refetch, location.key]);

  return (
    <>
      {success && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg">ได้รับ XP จากลิงก์ชวนแล้ว! ✨</div>}
      {error && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg">{error}</div>}
    </>
  );
}
