import { useEffect, useState } from 'react';
import LeaderboardPage from '../components/LeaderboardPage.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { supabase } from '../lib/supabaseClient.js';
export default function Leaderboard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: topRows, error } = await supabase.from('leaderboard').select('*').order('rank', { ascending: true }).limit(50);
      if (error) { if (!cancelled) setState({ rows: [], loading: false, error }); return; }
      let rows = topRows || [];
      if (!rows.some((row) => row.user_id === user.id)) {
        const { data: mine } = await supabase.from('leaderboard').select('*').eq('user_id', user.id).maybeSingle();
        if (mine) rows = [...rows, mine].sort((a, b) => Number(a.rank) - Number(b.rank));
      }
      if (!cancelled) setState({ rows, loading: false, error: null });
    })();
    return () => { cancelled = true; };
  }, [user]);
  return <LeaderboardPage {...state} currentUserId={user?.id} currentUserName={profile?.display_name} onInvite={() => window.dispatchEvent(new Event('luiquest-open-profile'))} heightClass="min-h-full" showStateToggle={false} />;
}
