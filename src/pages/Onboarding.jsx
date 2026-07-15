import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingFlow from '../components/OnboardingFlow.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { api } from '../lib/api.js';
import { fetchTopics, TOPIC_ID_TO_SLUG, LEVEL_ID_TO_LEVEL } from '../lib/topics.js';

export default function Onboarding() {
  const { session } = useAuth();
  const { activeRoadmapId: roadmapId, loading } = useProfile();
  const navigate = useNavigate();
  const token = session?.access_token;

  // มี active roadmap อยู่แล้ว (เคย onboard ไปแล้ว) — ไม่ต้องทำซ้ำ ส่งกลับไปหน้าเควสเลย
  useEffect(() => {
    if (!loading && roadmapId) navigate('/quest', { replace: true });
  }, [loading, roadmapId, navigate]);

  if (loading || roadmapId) return null;

  const handleComplete = async ({ topicId, topicTitle, level, minutesPerDay }) => {
    const mappedLevel = LEVEL_ID_TO_LEVEL[level];
    if (topicId) {
      const slug = TOPIC_ID_TO_SLUG[topicId];
      const topics = await fetchTopics();
      const topic = topics.find((t) => t.slug === slug);
      if (!topic) throw new Error('ไม่พบหัวข้อนี้ในระบบ');
      await api.startRoadmap({ topic_id: topic.id, level: mappedLevel, minutes_per_day: minutesPerDay }, token);
    } else {
      const result = await api.generateQuest(
        { topic_title: topicTitle, level: mappedLevel, minutes_per_day: minutesPerDay },
        token
      );
      // generate-quest ตอบ 200 เสมอแม้ Gemini หมด chain ทั้งหมด (roadmap ถูก mark failed) — ต้องเช็ค flag เอง
      if (result.failed) throw new Error('สร้างเควสไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง');
    }
    // ปล่อยให้หน้า "พร้อมลุย" โชว์แป๊บนึงก่อนค่อยพาไปหน้าเควสจริง
    setTimeout(() => navigate('/quest', { replace: true }), 1200);
  };

  return <OnboardingFlow showStateToggle={false} onComplete={handleComplete} />;
}
