import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DailyQuestPage from '../components/DailyQuestPage.jsx';
import StreakCardPage from '../components/StreakCardPage.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabaseClient.js';
import { GRADE_ORDER, gradeForLevel, gradeFromXp, levelProgress, nextRankFrom } from '../lib/gradeBands.js';

// ความก้าวหน้าคิดจาก XP สะสมทั้งหมด (ระบบเลเวลแบบเกม — ดู src/lib/gradeBands.js)
// หลอด = ความคืบหน้าภายในเลเวลปัจจุบัน ทำเควสเสร็จเมื่อไหร่ก็ขยับทันที
// แรงค์ (F/D/C/B/A/S/SS/SSS) ผูกกับหมุดหมายเลเวล จึงไม่มีทางคิดคนละทางกับหลอด
//
// nextRank กับ nextRankGoal เป็นคนละเรื่องกัน (แก้ 4 ส.ค. 2026):
// - nextRank  = แรงค์ "จริง" ของเลเวลถัดไป → ไปคู่กับ Lv.N+1 ที่โชว์ติดกันบนหลอด
//   (เดิมเอาหมุดหมายแรงค์ถัดไปมาแปะคู่เลเวลถัดไป ที่ 25 XP เลยขึ้น "D Lv.2 ▸ C Lv.3" ทั้งที่ Lv.3 ยังเป็น D)
// - nextRankGoal = หมุดหมายแรงค์ถัดไปที่ยังไม่ถึง (null = อยู่ SSS แล้ว ไม่มีเป้าถัดไปให้โชว์)
function gradeProgress(totalXp) {
  const current = gradeFromXp(totalXp);
  const next = nextRankFrom(totalXp);
  const lv = levelProgress(totalXp);
  return {
    rank: current.grade,
    nextRank: gradeForLevel(lv.level + 1),
    level: lv.level,
    nextLevel: lv.level + 1,
    rankPct: lv.pct, // หลอดวิ่งตามเลเวล ไม่ใช่ตามระยะห่างระหว่างแรงค์ (ระยะห่างแรงค์ยาวเกินกว่าจะเห็นขยับ)
    rankXp: `${lv.xpIntoLevel}/${lv.xpForLevel}`,
    xpToNext: lv.xpToNext,
    nextRankGoal: next ? next.grade : null,
    nextRankLevel: next ? next.level : null,
  };
}

const PHASE_LENGTH_DAYS = 6;

// เว้นช่วงก่อนถามซ้ำเมื่อ quest-today ตอบ generation_in_progress (มี request อื่นกำลังสร้างเควสอยู่)
// 3 วินาทีพอดีกับเวลา generate จริง (~5-20 วิ) โดยไม่ถี่จนถล่ม function ตัวเอง
const GENERATING_POLL_MS = 3000;

// % ความคืบหน้าใน phase ปัจจุบันจากเลขวันของเควส (วันที่ 1 ของ phase = 17%, วันที่ 6 = 100%)
function phasePctFromDay(dayNumber) {
  return Math.round((((dayNumber - 1) % PHASE_LENGTH_DAYS) + 1) * (100 / PHASE_LENGTH_DAYS));
}

// วันแบบ "YYYY-MM-DD" ตามเวลาไทย (UTC+7 คงที่ ไม่มี DST) — คู่กับ bangkokDateStr ฝั่ง server ใน _shared/datetime.js
function bangkokDateStr(d = new Date()) {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function prevDateStr(s) {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10);
}

export default function Quest() {
  const { session } = useAuth();
  const {
    profile,
    activeRoadmap,
    activeRoadmapId: roadmapId,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
    patchProfile,
  } = useProfile();
  const navigate = useNavigate();
  const token = session?.access_token;

  const [quest, setQuest] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [apiStatus, setApiStatus] = useState('loading'); // loading | not_ready | ready
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [showStreakCard, setShowStreakCard] = useState(false);
  // วันพัก (done_today) ไม่มีเควสให้อ่าน day_number — นับเควสที่ทำจบไปแล้วของ roadmap นี้แทน
  // (null = ยังไม่รู้ → หน้าเควสซ่อนหลอด roadmap ไปเลย ดีกว่าโชว์ 0% ทั้งที่ทำมาหลายวันแล้ว)
  const [restDayPhasePct, setRestDayPhasePct] = useState(null);
  // กัน response เก่าแซง: ถ้าสลับหัวข้อ (roadmapId เปลี่ยน) ระหว่างโหลด เควสของหัวข้อเก่าที่ตอบช้ากว่าต้องถูกทิ้ง
  // ไม่งั้นหน้าโชว์ชื่อหัวข้อใหม่แต่เนื้อเควส/quest.id เป็นของเก่า → เคลมผิดเควส
  const latestReq = useRef(null);
  // ถามซ้ำตอนเควสกำลังถูกสร้างโดย request อื่น — เก็บ timer ไว้เคลียร์ตอน unmount/สลับหัวข้อ
  // และเก็บ ref ของ loadQuest เองเพราะ callback อ้างถึงตัวเองไม่ได้ตอนประกาศ
  const retryTimer = useRef(null);
  const loadQuestRef = useRef(null);

  const loadQuest = useCallback(async () => {
    if (!token || !roadmapId) return;
    clearTimeout(retryTimer.current);
    latestReq.current = roadmapId;
    setApiStatus('loading');
    try {
      const data = await api.questToday(token, roadmapId);
      if (latestReq.current !== roadmapId) return; // มีหัวข้อใหม่แซงมาแล้ว ทิ้ง response นี้
      if (data.status === 'ready') {
        setQuest(data.quest);
        setChecklist(data.checklist ?? []);
        setApiStatus('ready');
      } else if (data.status === 'done_today') {
        setApiStatus('done_today'); // ทำเควสครบวันนี้แล้ว → หน้า "พักได้" ไม่ใช่ "ปั่นไม่ทัน"
      } else if (data.status === 'generation_in_progress') {
        // มี request อื่นจับจองการสร้างเควสวันนี้ไปแล้ว (กันยิง Gemini ซ้ำหลายรอบเพื่อเควสเดียว)
        // นี่ไม่ใช่ความล้มเหลว — ของกำลังมา ห้ามโชว์ "ปั่นไม่ทัน ลองใหม่" ให้ผู้ใช้เข้าใจผิด
        // คงหน้า loading ไว้แล้ววนถามซ้ำจนกว่าตัวที่จับจองอยู่จะเขียนเควสเสร็จ
        setApiStatus('loading');
        retryTimer.current = setTimeout(() => loadQuestRef.current?.(), GENERATING_POLL_MS);
      } else {
        setApiStatus('not_ready');
      }
    } catch {
      if (latestReq.current !== roadmapId) return;
      setApiStatus('not_ready');
    }
  }, [token, roadmapId]);

  loadQuestRef.current = loadQuest;
  // เคลียร์ timer ตอนออกจากหน้า/สลับหัวข้อ ไม่งั้นถามซ้ำของหัวข้อเก่าจะยิงต่อหลัง unmount
  useEffect(() => () => clearTimeout(retryTimer.current), []);

  // ห้ามเด้งไป onboarding ตอน /me ล้มเหลว (profileError) — ตอนนั้น roadmapId เป็น null เพราะโหลดไม่สำเร็จ
  // ไม่ใช่เพราะผู้ใช้ยังไม่เคย onboard ถ้าไม่เช็คจะพาผู้ใช้เก่ากลับ onboarding ทั้งที่มี roadmap อยู่แล้ว
  useEffect(() => {
    if (!profileLoading && !profileError && !roadmapId) {
      navigate('/onboarding', { replace: true });
    }
  }, [profileLoading, profileError, roadmapId, navigate]);

  useEffect(() => {
    if (roadmapId) loadQuest();
  }, [roadmapId, loadQuest]);

  // โหลดหน้าใหม่ตอนทำเควสของวันนี้ครบแล้ว: quest-today ตอบ status done_today โดยไม่ส่ง quest มาด้วย
  // หลอด roadmap เลยเคยตกไปเป็น 0% ทุกครั้งที่รีเฟรช — นับแถว quest_completions ของ roadmap นี้เอง
  // (RLS: completions_select_own ให้ผู้ใช้อ่านของตัวเองได้) แล้วใช้จำนวนนั้นเป็นเลขวันล่าสุดที่ทำจบ
  // ยิงเฉพาะตอนอยู่หน้าวันพักจริง ๆ + head:true (นับอย่างเดียว ไม่ดึงแถว) จึงแทบไม่มีต้นทุน
  useEffect(() => {
    const userId = session?.user?.id;
    if (apiStatus !== 'done_today' || !roadmapId || !userId) {
      setRestDayPhasePct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('quest_completions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('roadmap_id', roadmapId);
      if (cancelled || error || typeof count !== 'number' || count < 1) return;
      setRestDayPhasePct(phasePctFromDay(count));
    })();
    return () => {
      cancelled = true;
    };
  }, [apiStatus, roadmapId, session?.user?.id]);

  // /me ล้มเหลว (network/500) — โชว์หน้า "ลองใหม่" แทนที่จะค้าง skeleton ตลอดกาลหรือเด้งไป onboarding ผิด ๆ
  if (profileError && !profile) {
    return <DailyQuestPage showStateToggle={false} status="notready" onRetry={refetchProfile} />;
  }

  // เช็คแค่ "โหลดครั้งแรกยังไม่เสร็จ" เท่านั้น — ห้ามรวม profileLoading เพราะมันกลับมา true ชั่วคราวตอน
  // refetch เบื้องหลัง ถ้าเงื่อนไขนี้ true ตอนนั้น จะ blank ทั้งหน้าและทำให้ prop `quest` เปลี่ยน
  // identity ชั่วคราว (fallback เป็น MOCK) ซึ่งไปสั่งรีเซ็ต claimResult ใน DailyQuestPage ก่อนผู้ใช้ทันเห็นฉากฉลอง
  if (!profile || !activeRoadmap) {
    return <DailyQuestPage showStateToggle={false} status="loading" />;
  }

  // streak ขาดต้องดูจาก last_quest_date ไม่ใช่ current_streak — backend รีเซ็ต streak แบบ lazy ตอน
  // complete-quest ครั้งถัดไปเท่านั้น (nextStreak คืน 1/'increment'/null ไม่เคยเซ็ต 0) ค่าใน DB จึงค้างเป็น
  // เลขเก่าตลอดช่วงที่ขาด ถ้าเช็ค current_streak > 0 หน้า "streak ขาด" จะไม่มีทางโผล่เลย
  const todayStr = bangkokDateStr();
  const streakBroken = !!profile.last_quest_date && profile.last_quest_date < prevDateStr(todayStr);
  const effectiveStreak = streakBroken ? 0 : profile.current_streak;

  const status =
    apiStatus === 'loading'
      ? 'loading'
      : apiStatus === 'done_today'
        ? 'restday'
        : apiStatus === 'not_ready'
          ? 'notready'
          : !profile.last_quest_date
            ? 'day1'
            : streakBroken
              ? 'broken'
              : 'ready';

  const grade = gradeProgress(profile.total_xp);
  const stats = {
    xp: profile.total_xp,
    streak: effectiveStreak,
    // วันพักอ่านจากจำนวนเควสที่ทำจบ (quest ที่ค้างใน state อาจเป็นของหัวข้อก่อนสลับ ห้ามเอามาใช้)
    phasePct: apiStatus === 'done_today' ? restDayPhasePct : quest ? phasePctFromDay(quest.day_number) : null,
    rank: grade.rank,
    nextRank: grade.nextRank,
    level: grade.level,
    nextLevel: grade.nextLevel,
    rankPct: grade.rankPct,
    rankXp: grade.rankXp,
    xpToNext: grade.xpToNext,
    boardRank: null,
    boardTotal: null,
  };

  const dateLabel = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }).format(
    new Date()
  );

  const handleClaim = async (checkedIds) => {
    if (!quest) return { ok: false };
    setClaiming(true);
    setClaimError(null);
    const fromGrade = gradeProgress(profile.total_xp).rank;
    try {
      const res = await api.completeQuest({ quest_id: quest.id, checked_item_ids: checkedIds }, token);

      // ชนเพดาน XP ของหัวข้อนี้ในวันนี้ (ledger xp_awards ฝั่ง server เป็นคนตัดสิน)
      // เควสถูกบันทึกว่าทำเสร็จแล้วจริง แต่ไม่มี XP ให้ → ห้ามเข้าฉากฉลองที่จะโชว์ "+0 XP"
      // ให้บอกตรง ๆ ว่าทำไม แล้วโหลดสถานะเควสใหม่เพื่อพาไปหน้า "พักได้" ตามความจริง
      if (res.dailyLimitReached) {
        setClaimError('วันนี้เก็บ XP ของหัวข้อนี้ครบแล้ว — เควสนี้บันทึกว่าทำเสร็จแล้ว ไว้พรุ่งนี้มาลุยต่อได้เลย');
        loadQuest();
        return { ok: false };
      }

      const newStreak = res.current_streak ?? profile.current_streak;
      const toGrade = gradeProgress(res.total_xp ?? profile.total_xp);
      const rankUp = !res.alreadyCompleted && GRADE_ORDER.indexOf(toGrade.rank) > GRADE_ORDER.indexOf(fromGrade);
      // complete-quest ตอบ total_xp/current_streak/grade กลับมาครบแล้ว — patch state ตรง ๆ พอ
      // ไม่ต้องยิง /me เต็ม ๆ ซ้ำ (ประหยัด invocation ฟรี tier บน action ที่ถี่สุดของแอพ)
      patchProfile({
        total_xp: res.total_xp ?? profile.total_xp,
        current_streak: newStreak,
        longest_streak: res.longest_streak ?? profile.longest_streak,
        grade: res.grade ?? profile.grade,
        last_quest_date: todayStr,
      });
      return {
        ok: true,
        rankUp,
        earnedXp: res.xp_earned,
        newStreak,
        from: fromGrade,
        to: toGrade.rank,
        nextGoal: toGrade.nextRankGoal, // null = ขึ้นถึง SSS แล้ว → ฉากแรงค์อัพซ่อนบรรทัด "เป้าหมายถัดไป"
      };
    } catch (err) {
      setClaimError(err.message || 'เคลม XP ไม่สำเร็จ ลองใหม่อีกครั้ง');
      return { ok: false };
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
    <DailyQuestPage
      showStateToggle={false}
      status={status}
      dateLabel={dateLabel}
      topicTitle={activeRoadmap.topic_title}
      userInitial={(profile.display_name || '?').charAt(0).toUpperCase()}
      quest={
        quest
          ? {
              id: quest.id,
              title: quest.title,
              desc: quest.description,
              minutes: activeRoadmap.minutes_per_day,
              xp: quest.xp_reward,
            }
          : { id: null, title: '', desc: '', minutes: activeRoadmap.minutes_per_day, xp: 0 }
      }
      checklistItems={checklist.map((c) => ({ id: c.id, label: c.label, link_url: c.link_url }))}
      stats={stats}
      onRetry={loadQuest}
      onClaim={handleClaim}
      claiming={claiming}
      claimError={claimError}
      onOpenCoach={() => navigate('/coach')}
      onShareStreak={() => setShowStreakCard(true)}
      onInvite={() => window.dispatchEvent(new Event('luiquest-open-profile'))}
      onCoach={() => navigate('/coach')}
      heightClass="min-h-full"
    />
    {showStreakCard && (
      <div className="fixed inset-0 z-50">
        <StreakCardPage
          streak={effectiveStreak}
          totalXp={profile.total_xp}
          userName={profile.display_name}
          referralLink={profile.referral_code ? `${window.location.origin}/invite/${profile.referral_code}` : ''}
          onShare={() => {
            const url = profile.referral_code ? `${window.location.origin}/invite/${profile.referral_code}` : window.location.origin;
            if (navigator.share) navigator.share({ title: 'ลุยเควส', text: 'มาลุยเควสเก็บ XP/streak กัน!', url }).catch(() => {});
          }}
          onBack={() => setShowStreakCard(false)}
          showStateToggle={false}
        />
      </div>
    )}
    </>
  );
}
