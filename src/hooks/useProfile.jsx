import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './useAuth.jsx';
import { api } from '../lib/api.js';

// ดึงโปรไฟล์ + roadmaps จาก /.netlify/functions/me — เดิม useProfile เป็น hook เปล่าที่แต่ละหน้าเรียกเอง
// (ยิง /me ซ้ำทุก navigation) ย้ายมาเป็น context แบบเดียวกับ AuthProvider เพราะหน้าที่ต้องใช้โปรไฟล์
// กำลังเพิ่มจาก 4 เป็น 10 หน้า (ticket #09 follow-up) — ต้อง mount ProfileProvider ใต้ AuthProvider เท่านั้น
// เพราะ provider นี้อ่าน session จาก useAuth() เอง ไม่ต้องส่ง session เข้ามาจากผู้เรียกอีกต่อไป
//
// ข้อควรรู้สำหรับผู้เรียกใช้ useProfile():
// - refetch ทุกครั้งสร้าง object/array ใหม่เสมอ (JSON ใหม่จาก network) — effect ฝั่งผู้เรียกห้าม depend กับ
//   `activeRoadmap`/`roadmaps` ตรง ๆ ให้ใช้ `activeRoadmapId` (primitive เสถียร) ที่ hook เตรียมให้แทน
// - `error` ต้องเช็คก่อนตีความ "ไม่มี roadmap" — ตอน /me ล้มเหลว roadmaps ว่างเพราะโหลดไม่สำเร็จ
//   ไม่ใช่เพราะผู้ใช้ยังไม่เคย onboard (เด้ง redirect ผิดหน้าได้)
const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = session?.access_token ?? null;

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.me(token);
      setProfile(data.profile);
      setRoadmaps(data.roadmaps ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      refetch();
    } else {
      setProfile(null);
      setRoadmaps([]);
      setLoading(false);
    }
  }, [token, refetch]);

  // merge ฟิลด์ที่ API อื่นตอบกลับมาแล้ว (เช่น complete-quest ให้ total_xp/streak/grade ครบ)
  // เข้า state ตรง ๆ — ถูกกว่ายิง /me เต็ม ๆ ซ้ำทั้งที่ข้อมูลอยู่ในมือแล้ว
  const patchProfile = useCallback((fields) => {
    setProfile((p) => (p ? { ...p, ...fields } : p));
  }, []);

  const activeRoadmap = roadmaps.find((r) => r.is_active) ?? null;
  const activeRoadmapId = activeRoadmap?.id ?? null;

  const value = { profile, roadmaps, activeRoadmap, activeRoadmapId, loading, error, refetch, patchProfile };
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile ต้องถูกเรียกใต้ <ProfileProvider>');
  return ctx;
}
