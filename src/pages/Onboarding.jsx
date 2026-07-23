import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import OnboardingFlow from '../components/OnboardingFlow.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { api } from '../lib/api.js';
import { fetchTopics, TOPIC_ID_TO_SLUG, LEVEL_ID_TO_LEVEL } from '../lib/topics.js';

export default function Onboarding() {
  const { session } = useAuth();
  const { activeRoadmapId: roadmapId, loading, refetch } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = session?.access_token;
  // ?mode=new = ตั้งใจมาเพิ่มหัวข้อใหม่จากปุ่มใน ProfileDrawer (ไม่ใช่ onboarding ครั้งแรก)
  // ต้องข้าม guard ด้านล่าง ไม่งั้นโดนเด้งกลับ /quest ทันทีเพราะมี active roadmap อยู่แล้ว
  const addingNewTopic = searchParams.get('mode') === 'new';

  // มี active roadmap อยู่แล้ว (เคย onboard ไปแล้ว) — ไม่ต้องทำซ้ำ ส่งกลับไปหน้าเควสเลย
  useEffect(() => {
    if (!loading && roadmapId && !addingNewTopic) navigate('/quest', { replace: true });
  }, [loading, roadmapId, addingNewTopic, navigate]);

  if (loading || (roadmapId && !addingNewTopic)) return null;

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
    // ปล่อยให้หน้า "พร้อมลุย" โชว์แป๊บนึง แล้วค่อย refetch + พาไปหน้าเควสจริง
    //
    // ต้อง refetch เสมอ: useProfile เป็น context ที่ fetch /me ตอนล็อกอินครั้งเดียว ถ้าไม่โหลดใหม่
    // หน้า /quest จะยังเห็นข้อมูลเก่าที่ "ยังไม่มี roadmap" แล้วขึ้นว่าไม่มีเควส/เด้งกลับ onboarding
    // จนกว่าผู้ใช้จะรีเฟรชหน้าเอง (เจ้าของเจอตอนใช้จริง 23 ก.ค.: ต้องรีเฟรชทุกครั้งหลังสร้างเควส)
    // วางไว้ใน timeout ไม่ใช่ก่อนหน้านี้ เพราะ refetch ทำให้ roadmapId มีค่า -> guard ด้านบนเด้งออกทันที
    // ฉากฉลอง "เควสแรกพร้อมแล้ว 🎉" จะโดนข้ามไป
    setTimeout(async () => {
      await refetch();
      navigate('/quest', { replace: true });
    }, 1200);
  };

  return (
    <OnboardingFlow
      showStateToggle={false}
      onComplete={handleComplete}
      // มีทางออกกลับหน้าเควสเฉพาะตอนเข้ามาเพิ่มหัวข้อใหม่ (onboarding ครั้งแรกยังไม่มีเควสให้กลับไป)
      onExit={addingNewTopic ? () => navigate('/quest', { replace: true }) : undefined}
    />
  );
}
