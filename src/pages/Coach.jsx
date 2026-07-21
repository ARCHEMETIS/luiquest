import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CoachChatPage from '../components/CoachChatPage.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabaseClient.js';

const FREE_QUOTA_TOTAL = 10;
const PREMIUM_QUOTA_TOTAL = 100;

// เวลาไทยไม่มี DST — offset +7 ชม.คงที่ พอสำหรับคำนวณ "เที่ยงคืนวันนี้" ฝั่ง client (ของจริงยึด server เสมอ)
function startOfBangkokDayISO() {
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const startUtcMs = Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - 7 * 60 * 60 * 1000;
  return new Date(startUtcMs).toISOString();
}

export default function Coach() {
  const { session, user } = useAuth();
  const {
    profile,
    activeRoadmap,
    activeRoadmapId: roadmapId,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile();
  const navigate = useNavigate();
  const token = session?.access_token;

  const [questId, setQuestId] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [initialQuotaUsed, setInitialQuotaUsed] = useState(0);
  const [ready, setReady] = useState(false);

  // ห้ามเด้งไป onboarding ตอน /me ล้มเหลว — roadmapId null เพราะโหลดพัง ไม่ใช่เพราะยังไม่เคย onboard
  useEffect(() => {
    if (!profileLoading && !profileError && !roadmapId) navigate('/onboarding', { replace: true });
  }, [profileLoading, profileError, roadmapId, navigate]);

  useEffect(() => {
    if (!token || !roadmapId || !user) return;
    (async () => {
      const [questRes, historyRes] = await Promise.all([
        api.questToday(token, roadmapId).catch(() => null),
        // เอา "ล่าสุด 50 แถว" — ต้อง order desc แล้วค่อย reverse (ถ้า order asc + limit จะได้เก่าสุด 50 แถวแทน
        // ทำให้ตัวนับโควต้าวันนี้อ่านจากข้อความโบราณแล้วเพี้ยนเป็น 0 ทั้งที่แชทไปแล้ว) — แพทเทิร์นเดียวกับ chat.js ฝั่ง server
        supabase
          .from('chat_messages')
          .select('role, message, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (questRes?.status === 'ready') setQuestId(questRes.quest.id);

      const rows = (historyRes?.data ?? []).slice().reverse();
      const todayStart = startOfBangkokDayISO();
      const usedToday = rows.filter((r) => r.role === 'user' && r.created_at >= todayStart).length;
      setInitialQuotaUsed(usedToday);
      setInitialMessages(
        rows.map((r) => ({
          role: r.role === 'assistant' ? 'coach' : 'user',
          text: r.message,
          time: new Date(r.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        }))
      );
      setReady(true);
    })();
  }, [token, roadmapId, user]);

  const handleSend = async (text) => {
    try {
      const data = await api.chat({ message: text, quest_id: questId }, token);
      if (data.limited) return { ok: false, limited: true };
      return { ok: true, reply: data.reply, remaining: data.remaining };
    } catch {
      return { ok: false };
    }
  };

  // /me ล้มเหลว (network/500) — โชว์ปุ่มลองใหม่แทนจอขาวถาวร (เดิม return null ค้างเพราะ activeRoadmap เป็น null ตลอด)
  if (profileError && !profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center font-body text-[#831843]">
        <p className="text-sm font-bold">โหลดข้อมูลไม่สำเร็จ 😢</p>
        <button
          onClick={refetchProfile}
          className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-2 text-sm font-bold text-white shadow-[0_8px_18px_rgba(139,92,246,.28)] transition hover:-translate-y-0.5 active:translate-y-px"
        >
          ลองใหม่
        </button>
      </div>
    );
  }
  if (profileLoading || !activeRoadmap || !ready) return null;

  return (
    <CoachChatPage
      topicTitle={activeRoadmap.topic_title}
      initialMessages={initialMessages}
      initialQuotaUsed={initialQuotaUsed}
      quotaTotal={profile?.is_premium ? PREMIUM_QUOTA_TOTAL : FREE_QUOTA_TOTAL}
      onSend={handleSend}
      onBack={() => navigate('/quest')}
      onGoToQuest={() => navigate('/quest')}
      heightClass="h-full"
    />
  );
}
