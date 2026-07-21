import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DailyQuestPage from '../components/DailyQuestPage.jsx';
import StreakCardPage from '../components/StreakCardPage.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { api } from '../lib/api.js';
import { GRADE_BANDS, GRADE_ORDER } from '../lib/gradeBands.js';

function gradeProgress(streak) {
  const idx = GRADE_BANDS.reduce((acc, b, i) => (streak >= b.min ? i : acc), 0);
  const current = GRADE_BANDS[idx];
  const next = GRADE_BANDS[idx + 1];
  if (!next) return { rank: current.grade, nextRank: current.grade, rankPct: 100, rankXp: `${streak}/${streak}` };
  const span = next.min - current.min;
  const progressed = streak - current.min;
  return {
    rank: current.grade,
    nextRank: next.grade,
    rankPct: Math.min(100, Math.round((progressed / span) * 100)),
    rankXp: `${progressed}/${span}`,
  };
}

const PHASE_LENGTH_DAYS = 6;

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

  const loadQuest = useCallback(async () => {
    if (!token || !roadmapId) return;
    setApiStatus('loading');
    try {
      const data = await api.questToday(token, roadmapId);
      if (data.status === 'ready') {
        setQuest(data.quest);
        setChecklist(data.checklist ?? []);
        setApiStatus('ready');
      } else {
        setApiStatus('not_ready');
      }
    } catch {
      setApiStatus('not_ready');
    }
  }, [token, roadmapId]);

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
      : apiStatus === 'not_ready'
        ? 'notready'
        : !profile.last_quest_date
          ? 'day1'
          : streakBroken
            ? 'broken'
            : 'ready';

  const grade = gradeProgress(effectiveStreak);
  const stats = {
    xp: profile.total_xp,
    streak: effectiveStreak,
    phasePct: quest ? Math.round((((quest.day_number - 1) % PHASE_LENGTH_DAYS) + 1) * (100 / PHASE_LENGTH_DAYS)) : 0,
    rank: grade.rank,
    nextRank: grade.nextRank,
    rankPct: grade.rankPct,
    rankXp: grade.rankXp,
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
    const fromGrade = gradeProgress(effectiveStreak).rank;
    try {
      const res = await api.completeQuest({ quest_id: quest.id, checked_item_ids: checkedIds }, token);
      const newStreak = res.current_streak ?? profile.current_streak;
      const toGrade = gradeProgress(newStreak);
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
        nextGoal: toGrade.nextRank,
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
