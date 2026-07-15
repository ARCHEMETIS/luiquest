import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Quest from './pages/Quest.jsx';
import Coach from './pages/Coach.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Profile from './pages/Profile.jsx';
import Stats from './pages/Stats.jsx';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ProfileProvider } from './hooks/useProfile.jsx';

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
      <Route
        path="/quest"
        element={
          <RequireAuth>
            <Quest />
          </RequireAuth>
        }
      />
      <Route
        path="/coach"
        element={
          <RequireAuth>
            <Coach />
          </RequireAuth>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <RequireAuth>
            <Leaderboard />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route path="/stats/:handle" element={<Stats />} />
      <Route path="*" element={<Navigate to="/quest" replace />} />
    </Routes>
  );
}
