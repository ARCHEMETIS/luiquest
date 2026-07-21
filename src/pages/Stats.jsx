import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsPage from '../components/StatsPage.jsx';
import { supabase } from '../lib/supabaseClient.js';

// หน้า /stats สาธารณะ (ไม่ต้องล็อกอิน) — อ่าน view aggregate ตรง ๆ ผ่าน anon (grants เปิดให้แล้ว, 0 PII)
export default function Stats() {
  const navigate = useNavigate();
  const [state, setState] = useState({ stats: null, growth: [], loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: stats, error: statsError }, { data: growth, error: growthError }] = await Promise.all([
        supabase.from('public_stats').select('*').single(),
        supabase.from('stats_daily_growth').select('*').order('day', { ascending: true }),
      ]);
      if (!cancelled) setState({ stats, growth: growth || [], loading: false, error: statsError || growthError || null });
    })();
    return () => { cancelled = true; };
  }, []);
  return <StatsPage {...state} onLogin={() => navigate('/login')} showStateToggle={false} />;
}
