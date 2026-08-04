import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const API_BASE = 'https://luiquest.netlify.app/.netlify/functions';
const SITE_BASE = 'https://luiquest.netlify.app';
const PASSWORD = 'QA!2307-LuiQuest-2026';

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_ANON_KEY');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const createdUsers = [];
const createdRoadmaps = [];
const cases = [];
const notes = [];
let quotaHit = false;

function jsonBrief(value, max = 500) {
  const text = JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function addCase(name, status, evidence, details = {}) {
  cases.push({ name, status, evidence, ...details });
  console.log(`CASE|${status}|${name}|${evidence}`);
}

function addNote(text) {
  notes.push(text);
  console.log(`NOTE|${text}`);
}

function markQuotaIfNeeded(response, label) {
  if (response?.status === 429) {
    quotaHit = true;
    addNote(`HTTP 429 at ${label}; no retry was attempted for that line.`);
  }
}

async function callFn(name, { method = 'POST', body, token, query } = {}) {
  const url = new URL(`${API_BASE}/${name}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const started = Date.now();
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Keep non-JSON SPA/function output as text.
  }
  const result = { status: response.status, ms: Date.now() - started, body: parsed, raw };
  markQuotaIfNeeded(result, `${method} ${name}`);
  return result;
}

async function createQaUser(tag) {
  const slug = String(tag).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const email = `qa2307-${slug}-${Date.now().toString(36)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `QA ${tag}` },
  });
  if (error || !data?.user) throw new Error(`createUser ${tag}: ${error?.message || 'no user returned'}`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data: profile } = await admin.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
    if (profile) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError || !signedIn?.session?.access_token) {
    throw new Error(`signIn ${tag}: ${signInError?.message || 'no access token returned'}`);
  }

  const user = {
    tag,
    email,
    id: data.user.id,
    token: signedIn.session.access_token,
    created_at: data.user.created_at,
  };
  createdUsers.push(user);
  console.log(`USER|${tag}|${user.id}`);
  return user;
}

function authedClient(user) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${user.token}` } },
  });
}

async function profileRow(userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, total_xp, current_streak, longest_streak, last_quest_date, grade, referral_code, referred_by')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function userRoadmaps(userId) {
  const { data, error } = await admin
    .from('roadmaps')
    .select('id, user_id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function countRows(table, filter = () => {}) {
  let query = admin.from(table).select('id', { count: 'exact', head: true });
  query = filter(query) || query;
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function registerRoadmap(user, response, label) {
  const roadmap = response?.body?.roadmap;
  if (roadmap?.id) {
    createdRoadmaps.push({ label, id: roadmap.id, user_id: user.id, topic_title: roadmap.topic_title, status: roadmap.status });
  }
  return roadmap;
}

function validCuratedResponse(response) {
  const body = response?.body;
  return response?.status === 200 && !!body?.roadmap?.id && body?.quest?.id && body.quest.day_number === 1 && Array.isArray(body.checklist) && body.checklist.length > 0;
}

function allChecklistIds(response) {
  return (response?.body?.checklist ?? []).map((item) => item.id).filter(Boolean);
}

function previousBangkokDate() {
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() - 1)).toISOString().slice(0, 10);
}

async function topicsBySlug() {
  const { data, error } = await admin.from('topics').select('id, slug, title').eq('is_active', true).order('sort_order', { ascending: true });
  if (error) throw error;
  const map = new Map((data ?? []).map((topic) => [topic.slug, topic]));
  return { data: data ?? [], map };
}

async function runCurated(topics) {
  const combos = [
    ['beginner', 15], ['beginner', 30], ['beginner', 60],
    ['intermediate', 15], ['intermediate', 30], ['intermediate', 60],
    ['advanced', 15], ['advanced', 30], ['advanced', 60],
  ];
  const results = [];
  for (const [level, minutes] of combos) {
    const user = await createQaUser(`curated-${level}-${minutes}`);
    const response = await callFn('start-roadmap', {
      token: user.token,
      body: { topic_id: topics.map.get('python').id, level, minutes_per_day: minutes },
    });
    const roadmap = registerRoadmap(user, response, `curated-${level}-${minutes}`);
    results.push({ user, level, minutes, response, roadmap });
  }
  const first = results[0];
  const repeat = await callFn('start-roadmap', {
    token: first.user.token,
    body: { topic_id: topics.map.get('python').id, level: first.level, minutes_per_day: first.minutes },
  });
  const repeatRoadmap = registerRoadmap(first.user, repeat, 'curated-repeat');
  const valid = results.every((item) => validCuratedResponse(item.response));
  const reused = repeat.status === 200 && repeat.body?.reused === true && repeatRoadmap?.id === first.roadmap?.id && repeat.body?.quest?.id === first.response.body?.quest?.id;
  const dbChecks = await Promise.all(results.map(async (item) => {
    const rows = await userRoadmaps(item.user.id);
    return rows.length === 1 && rows[0].topic_id === topics.map.get('python').id;
  }));
  const ok = valid && reused && dbChecks.every(Boolean);
  addCase(
    '1. Onboarding — curated path',
    ok ? 'PASS' : 'FAIL',
    `${results.length}/9 combinations returned day-1 quest + checklist; repeat returned same roadmap=${reused}`,
    { combinations: results.map((item) => ({ level: item.level, minutes: item.minutes, user_id: item.user.id, roadmap_id: item.roadmap?.id, status: item.response.status, body: item.response.body })), repeat: repeat.body }
  );
}

async function runFreeform() {
  const user = await createQaUser('freeform-normal');
  const title = 'เรียน JavaScript';
  const first = await callFn('generate-quest', {
    token: user.token,
    body: { topic_title: title, level: 'beginner', minutes_per_day: 30 },
  });
  const firstRoadmap = registerRoadmap(user, first, 'freeform-normal-first');
  if (first.status === 429) {
    addCase('2. Onboarding — freeform reuse', 'BLOCKED', 'first normal-topic request returned HTTP 429; stopped without retry');
    return;
  }
  if (first.status !== 200 || first.body?.failed || !firstRoadmap?.id) {
    addCase('2. Onboarding — freeform reuse', 'BLOCKED', `normal-topic generation did not complete: HTTP ${first.status} ${jsonBrief(first.body)}`, { first: first.body });
    return;
  }
  const second = await callFn('generate-quest', {
    token: user.token,
    body: { topic_title: '  เรียน javascript  ', level: 'advanced', minutes_per_day: 60 },
  });
  const secondRoadmap = registerRoadmap(user, second, 'freeform-normal-reuse');
  const rows = await userRoadmaps(user.id);
  const ok = second.status === 200 && second.body?.reused === true && secondRoadmap?.id === firstRoadmap.id && rows.filter((r) => r.status !== 'failed').length === 1;
  addCase(
    '2. Onboarding — freeform reuse',
    ok ? 'PASS' : 'FAIL',
    `first=${first.status}; normalized spacing/case second=${second.status}, reused=${second.body?.reused}, saved ready roadmaps=${rows.filter((r) => r.status !== 'failed').length}`,
    { user_id: user.id, first_roadmap_id: firstRoadmap.id, second: second.body, rows }
  );
}

async function runModeration() {
  const user = await createQaUser('moderation');
  const before = await userRoadmaps(user.id);
  const layer1 = await callFn('generate-quest', {
    token: user.token,
    body: { topic_title: 'เหี้ย', level: 'beginner', minutes_per_day: 15 },
  });
  const afterLayer1 = await userRoadmaps(user.id);
  const layer1Ok = layer1.status === 400 && layer1.body?.code === 'TOPIC_NOT_ALLOWED' && afterLayer1.length === before.length;

  const layer2 = await callFn('generate-quest', {
    token: user.token,
    body: { topic_title: 'แฮกเฟซบุ๊กแฟนเก่า', level: 'beginner', minutes_per_day: 15 },
  });
  const afterLayer2 = await userRoadmaps(user.id);
  if (layer2.status === 429) {
    addCase('3. Moderation — layer 1 + layer 2', layer1Ok ? 'BLOCKED' : 'FAIL', `layer 1 ${layer1.status}/${layer1.body?.code}; layer 2 returned HTTP 429; no retry`, { layer1: layer1.body, layer2: layer2.body });
    return;
  }
  const layer2Ok = layer2.status === 400 && layer2.body?.code === 'TOPIC_NOT_ALLOWED' && afterLayer2.length === before.length;
  addCase(
    '3. Moderation — layer 1 + layer 2',
    layer1Ok && layer2Ok ? 'PASS' : 'FAIL',
    `layer1 HTTP ${layer1.status}/${layer1.body?.code} in ${layer1.ms}ms; layer2 HTTP ${layer2.status}/${layer2.body?.code}; roadmap rows before/after=${before.length}/${afterLayer1.length}/${afterLayer2.length}`,
    { user_id: user.id, layer1: layer1.body, layer2: layer2.body }
  );
}

async function runDaily(topics) {
  const user = await createQaUser('daily-loop');
  const start = await callFn('start-roadmap', {
    token: user.token,
    body: { topic_id: topics.map.get('data-ml').id, level: 'beginner', minutes_per_day: 15 },
  });
  const roadmap = registerRoadmap(user, start, 'daily-loop');
  const questId = start.body?.quest?.id;
  const checklistIds = allChecklistIds(start);
  const beforeProfile = await profileRow(user.id);
  const beforeQuest = await callFn('quest-today', { method: 'GET', token: user.token, query: { roadmap_id: roadmap?.id } });
  const incomplete = await callFn('complete-quest', { token: user.token, body: { quest_id: questId, checked_item_ids: [] } });
  const afterIncompleteProfile = await profileRow(user.id);
  const claimed = await callFn('complete-quest', { token: user.token, body: { quest_id: questId, checked_item_ids: checklistIds } });
  const afterQuest = await callFn('quest-today', { method: 'GET', token: user.token, query: { roadmap_id: roadmap?.id } });
  const doubleClaim = await callFn('complete-quest', { token: user.token, body: { quest_id: questId, checked_item_ids: checklistIds } });
  const afterProfile = await profileRow(user.id);
  const completionCount = await countRows('quest_completions', (q) => q.eq('user_id', user.id).eq('quest_id', questId));
  const ok =
    start.status === 200 &&
    beforeQuest.status === 200 && beforeQuest.body?.status === 'ready' && beforeQuest.body?.quest?.id === questId &&
    incomplete.status === 400 && afterIncompleteProfile.total_xp === beforeProfile.total_xp &&
    claimed.status === 200 && claimed.body?.alreadyCompleted === false && claimed.body?.xp_earned === start.body.quest.xp_reward && claimed.body?.current_streak === 1 && claimed.body?.grade === 'D' &&
    afterQuest.status === 200 && afterQuest.body?.status === 'done_today' && afterQuest.body?.quest === null &&
    doubleClaim.status === 200 && doubleClaim.body?.alreadyCompleted === true && doubleClaim.body?.total_xp === afterProfile.total_xp &&
    completionCount === 1 && afterProfile.total_xp === beforeProfile.total_xp + start.body.quest.xp_reward;
  addCase(
    '4. Daily loop — states, gating, XP, double claim',
    ok ? 'PASS' : 'FAIL',
    `before=${beforeQuest.body?.status}; incomplete HTTP ${incomplete.status}; claim=${claimed.status}/${claimed.body?.current_streak}/${claimed.body?.grade}; after=${afterQuest.body?.status}; double=${doubleClaim.body?.alreadyCompleted}; completions=${completionCount}`,
    { user_id: user.id, roadmap_id: roadmap?.id, quest_id: questId, incomplete: incomplete.body, claimed: claimed.body, after: afterQuest.body, double: doubleClaim.body }
  );
}

async function runRace(topics) {
  const user = await createQaUser('daily-race');
  const start = await callFn('start-roadmap', {
    token: user.token,
    body: { topic_id: topics.map.get('web').id, level: 'beginner', minutes_per_day: 30 },
  });
  const roadmap = registerRoadmap(user, start, 'daily-race');
  const questId = start.body?.quest?.id;
  const checked = allChecklistIds(start);
  const responses = await Promise.all([
    callFn('complete-quest', { token: user.token, body: { quest_id: questId, checked_item_ids: checked } }),
    callFn('complete-quest', { token: user.token, body: { quest_id: questId, checked_item_ids: checked } }),
  ]);
  const profile = await profileRow(user.id);
  const completionCount = await countRows('quest_completions', (q) => q.eq('user_id', user.id).eq('quest_id', questId));
  const successCount = responses.filter((r) => r.status === 200).length;
  const alreadyCount = responses.filter((r) => r.body?.alreadyCompleted === true).length;
  const freshCount = responses.filter((r) => r.body?.alreadyCompleted === false).length;
  const ok = start.status === 200 && successCount === 2 && alreadyCount === 1 && freshCount === 1 && completionCount === 1 && profile.total_xp === start.body.quest.xp_reward;
  addCase(
    '4b. Daily loop — parallel same-quest claim',
    ok ? 'PASS' : 'FAIL',
    `parallel responses=${responses.map((r) => `${r.status}/${r.body?.alreadyCompleted}`).join(',')}; completion rows=${completionCount}; total_xp=${profile.total_xp}`,
    { user_id: user.id, roadmap_id: roadmap?.id, quest_id: questId, responses: responses.map((r) => r.body) }
  );
}

async function runGradeTransitions(topics) {
  const scenarios = [
    { startingStreak: 1, expectedStreak: 2, expectedGrade: 'D' },
    { startingStreak: 2, expectedStreak: 3, expectedGrade: 'C' },
    { startingStreak: 6, expectedStreak: 7, expectedGrade: 'B' },
    { startingStreak: 13, expectedStreak: 14, expectedGrade: 'A' },
  ];
  const outcomes = [];
  for (const scenario of scenarios) {
    const user = await createQaUser(`grade-${scenario.startingStreak}-to-${scenario.expectedStreak}`);
    const start = await callFn('start-roadmap', {
      token: user.token,
      body: { topic_id: topics.map.get('excel').id, level: 'beginner', minutes_per_day: 15 },
    });
    const roadmap = registerRoadmap(user, start, `grade-${scenario.startingStreak}`);
    const update = await admin
      .from('profiles')
      .update({ current_streak: scenario.startingStreak, longest_streak: scenario.startingStreak, last_quest_date: previousBangkokDate(), total_xp: 0, grade: 'F' })
      .eq('id', user.id);
    if (update.error) throw update.error;
    const response = await callFn('complete-quest', {
      token: user.token,
      body: { quest_id: start.body?.quest?.id, checked_item_ids: allChecklistIds(start) },
    });
    outcomes.push({ scenario, user_id: user.id, roadmap_id: roadmap?.id, response: response.body, status: response.status });
  }
  const ok = outcomes.every((outcome) => outcome.status === 200 && outcome.response?.current_streak === outcome.scenario.expectedStreak && outcome.response?.grade === outcome.scenario.expectedGrade);
  addCase(
    '4c. Daily loop — streak/grade transitions',
    ok ? 'PASS' : 'FAIL',
    `controlled previous-day QA profiles crossed ${outcomes.map((o) => `${o.scenario.startingStreak}->${o.response?.current_streak}/${o.response?.grade}`).join(', ')}`,
    { outcomes, setup: 'service-role changed only QA profiles to emulate prior-day streaks; completion used production endpoint' }
  );
}

async function runChat(topics) {
  const user = await createQaUser('chat-quota');
  const start = await callFn('start-roadmap', {
    token: user.token,
    body: { topic_id: topics.map.get('finance').id, level: 'beginner', minutes_per_day: 15 },
  });
  const roadmap = registerRoadmap(user, start, 'chat-quota');
  const questId = start.body?.quest?.id;
  const responses = [];
  for (let i = 1; i <= 10; i += 1) {
    if (quotaHit) break;
    const response = await callFn('chat', { token: user.token, body: { message: `ข้อความทดสอบโควตา ${i}`, quest_id: questId } });
    responses.push(response);
    if (response.status === 429) break;
    if (response.status !== 200) break;
  }
  const beforeEleven = await countRows('chat_messages', (q) => q.eq('user_id', user.id).eq('role', 'user'));
  let eleventh = null;
  if (responses.length === 10 && !quotaHit) {
    eleventh = await callFn('chat', { token: user.token, body: { message: 'ข้อความทดสอบโควตา 11', quest_id: questId } });
  }
  const afterEleven = await countRows('chat_messages', (q) => q.eq('user_id', user.id).eq('role', 'user'));
  const remainingSequence = responses.map((r) => r.body?.remaining);
  const ok = responses.length === 10 && responses.every((r) => r.status === 200) && (remainingSequence.filter((v) => typeof v === 'number').length === 10 ? remainingSequence[0] === 9 && remainingSequence[9] === 0 : true) && eleventh?.status === 200 && eleventh.body?.limited === true && eleventh.body?.remaining === 0 && beforeEleven === 10 && afterEleven === 10;
  const status = quotaHit ? 'BLOCKED' : ok ? 'PASS' : 'FAIL';
  addCase(
    '5. Coach chat — ten-message quota',
    status,
    `successful attempts=${responses.length}; remaining=${remainingSequence.join(',')}; message11=${eleventh ? `${eleventh.status}/${jsonBrief(eleventh.body)}` : 'not sent'}; user rows=${beforeEleven}->${afterEleven}`,
    { user_id: user.id, roadmap_id: roadmap?.id, quest_id: questId, responses: responses.map((r) => r.body), eleventh: eleventh?.body }
  );
}

async function runSwitch(topics) {
  const user = await createQaUser('topic-switch');
  const topicSlugs = ['python', 'data-ml', 'web'];
  const starts = [];
  for (const slug of topicSlugs) {
    const response = await callFn('start-roadmap', {
      token: user.token,
      body: { topic_id: topics.map.get(slug).id, level: 'beginner', minutes_per_day: 15 },
    });
    const roadmap = registerRoadmap(user, response, `switch-${slug}`);
    starts.push({ slug, response, roadmap });
  }
  const fourth = await callFn('start-roadmap', {
    token: user.token,
    body: { topic_id: topics.map.get('excel').id, level: 'beginner', minutes_per_day: 15 },
  });
  const first = starts[0];
  const second = starts[1];
  const switchToFirst = await callFn('switch-roadmap', { token: user.token, body: { roadmap_id: first.roadmap?.id } });
  const firstComplete = await callFn('complete-quest', {
    token: user.token,
    body: { quest_id: first.response.body?.quest?.id, checked_item_ids: allChecklistIds(first.response) },
  });
  const switchToSecond = await callFn('switch-roadmap', { token: user.token, body: { roadmap_id: second.roadmap?.id } });
  const switchBack = await callFn('switch-roadmap', { token: user.token, body: { roadmap_id: first.roadmap?.id } });
  const firstToday = await callFn('quest-today', { method: 'GET', token: user.token, query: { roadmap_id: first.roadmap?.id } });
  const rows = await userRoadmaps(user.id);
  const completionCount = await countRows('quest_completions', (q) => q.eq('user_id', user.id).eq('quest_id', first.response.body?.quest?.id));
  const ok = starts.every((s) => validCuratedResponse(s.response)) && fourth.status === 409 && fourth.body?.code === 'FREE_PLAN_SAVED_ROADMAP_LIMIT' && switchToFirst.status === 200 && firstComplete.status === 200 && switchToSecond.status === 200 && switchBack.status === 200 && firstToday.status === 200 && firstToday.body?.status === 'done_today' && completionCount === 1 && rows.length === 3 && rows.filter((r) => r.is_active).length === 1;
  addCase(
    '6. Topic switching — saved cap + progress survival',
    ok ? 'PASS' : 'FAIL',
    `saved=${rows.length}, active=${rows.filter((r) => r.is_active).length}; fourth=${fourth.status}/${fourth.body?.code}; switches=${switchToFirst.status},${switchToSecond.status},${switchBack.status}; prior topic after return=${firstToday.body?.status}; completion=${completionCount}`,
    { user_id: user.id, roadmaps: rows, fourth: fourth.body, first_today: firstToday.body }
  );
}

async function getInvitePage(code) {
  const started = Date.now();
  const response = await fetch(`${SITE_BASE}/invite/${encodeURIComponent(code)}`);
  const text = await response.text();
  return { status: response.status, ms: Date.now() - started, contentType: response.headers.get('content-type'), length: text.length, startsWithDoctype: /^\s*<!doctype html/i.test(text), containsRoot: text.includes('<div id="root">') };
}

async function runReferrals() {
  const beforeReferralRows = await countRows('referrals');
  const referrer = await createQaUser('referral-a');
  const meA = await callFn('me', { method: 'GET', token: referrer.token });
  const code = meA.body?.profile?.referral_code;
  const invitePage = code ? await getInvitePage(code) : null;
  const referred = await createQaUser('referral-b');
  const beforeA = await profileRow(referrer.id);
  const beforeB = await profileRow(referred.id);
  const redeem = await callFn('redeem-referral', { token: referred.token, body: { referral_code: code?.toLowerCase() } });
  const afterA = await profileRow(referrer.id);
  const afterB = await profileRow(referred.id);
  const { data: referralRows, error: referralError } = await admin
    .from('referrals')
    .select('id, referrer_id, referred_id, referrer_xp_awarded, referred_xp_awarded, created_at')
    .eq('referrer_id', referrer.id)
    .eq('referred_id', referred.id);
  if (referralError) throw referralError;
  const clientA = authedClient(referrer);
  const clientB = authedClient(referred);
  const countA = await clientA.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', referrer.id);
  const countB = await clientB.from('referrals').select('id', { count: 'exact', head: true }).eq('referred_id', referred.id);
  const duplicate = await callFn('redeem-referral', { token: referred.token, body: { referral_code: code } });
  const selfRedeem = await callFn('redeem-referral', { token: referrer.token, body: { referral_code: code } });
  const ok = beforeReferralRows === 0 && meA.status === 200 && !!code && invitePage?.status === 200 && invitePage?.startsWithDoctype && redeem.status === 200 && afterA.total_xp === beforeA.total_xp + 20 && afterB.total_xp === beforeB.total_xp + 20 && afterB.referred_by === referrer.id && referralRows.length === 1 && referralRows[0].referrer_xp_awarded === 20 && referralRows[0].referred_xp_awarded === 20 && countA.count === 1 && countB.count === 1 && duplicate.status === 400 && selfRedeem.status === 400;
  addCase(
    '7. Referrals — invite, redeem, XP, count',
    ok ? 'PASS' : 'FAIL',
    `initial referrals=${beforeReferralRows}; me code=${code}; invite=${invitePage?.status}/${invitePage?.length} HTML; redeem=${redeem.status}; XP A/B ${beforeA.total_xp}->${afterA.total_xp}/${beforeB.total_xp}->${afterB.total_xp}; row=${referralRows.length}; drawer-query counts A/B=${countA.count}/${countB.count}; duplicate/self=${duplicate.status}/${selfRedeem.status}`,
    { referrer_id: referrer.id, referred_id: referred.id, referral_code: code, referral_row: referralRows[0], invite_page: invitePage, redeem: redeem.body, duplicate: duplicate.body, self: selfRedeem.body }
  );

  const oldCandidate = await createQaUser('referral-old-window');
  const oldBefore = await admin.auth.admin.getUserById(oldCandidate.id);
  const oldUpdate = await admin.auth.admin.updateUserById(oldCandidate.id, { created_at: '2026-07-01T00:00:00.000Z' });
  const oldAfter = await admin.auth.admin.getUserById(oldCandidate.id);
  const oldChanged = oldAfter.data?.user?.created_at !== oldBefore.data?.user?.created_at;
  let windowEvidence = `Supabase admin created_at override accepted=${oldChanged}; before=${oldBefore.data?.user?.created_at}; after=${oldAfter.data?.user?.created_at}`;
  if (oldChanged && !oldUpdate.error) {
    const oldRedeem = await callFn('redeem-referral', { token: oldCandidate.token, body: { referral_code: code } });
    windowEvidence += `; old-account redeem=${oldRedeem.status}/${jsonBrief(oldRedeem.body)}`;
    addCase('7b. Referrals — seven-day redeem window', oldRedeem.status === 403 ? 'PASS' : 'FAIL', windowEvidence, { old_user_id: oldCandidate.id, response: oldRedeem.body });
  } else {
    addCase('7b. Referrals — seven-day redeem window', 'BLOCKED', `${windowEvidence}; live old-account boundary could not be created without direct auth DB access; source constant/check inspected separately`, { old_user_id: oldCandidate.id, admin_update_error: oldUpdate.error?.message || null });
  }
}

async function runSecurity(topics) {
  const attacker = await createQaUser('security-attacker');
  const victim = await createQaUser('security-victim');
  const victimStart = await callFn('start-roadmap', {
    token: victim.token,
    body: { topic_id: topics.map.get('ai-tools').id, level: 'beginner', minutes_per_day: 15 },
  });
  const victimRoadmap = registerRoadmap(victim, victimStart, 'security-victim');
  const victimQuest = victimStart.body?.quest?.id;
  const functionProbes = {
    attackerMe: await callFn('me', { method: 'GET', token: attacker.token }),
    foreignToday: await callFn('quest-today', { method: 'GET', token: attacker.token, query: { roadmap_id: victimRoadmap?.id } }),
    foreignSwitch: await callFn('switch-roadmap', { token: attacker.token, body: { roadmap_id: victimRoadmap?.id } }),
    foreignComplete: await callFn('complete-quest', { token: attacker.token, body: { quest_id: victimQuest, checked_item_ids: allChecklistIds(victimStart) } }),
    foreignChat: await callFn('chat', { token: attacker.token, body: { message: 'ขโมยบริบท', quest_id: victimQuest } }),
  };

  const client = authedClient(attacker);
  const rls = {};
  rls.profileRead = await client.from('profiles').select('id, display_name, total_xp').eq('id', victim.id);
  rls.roadmapRead = await client.from('roadmaps').select('id, user_id, topic_title').eq('user_id', victim.id);
  rls.questRead = await client.from('daily_quests').select('id, roadmap_id, title').eq('id', victimQuest);
  rls.chatRead = await client.from('chat_messages').select('id, user_id, message').eq('user_id', victim.id);
  rls.profileModify = await client.from('profiles').update({ display_name: 'SHOULD-NOT-WRITE' }).eq('id', victim.id).select('id');
  rls.roadmapModify = await client.from('roadmaps').update({ topic_title: 'SHOULD-NOT-WRITE' }).eq('id', victimRoadmap.id).select('id');
  rls.questModify = await client.from('daily_quests').update({ title: 'SHOULD-NOT-WRITE' }).eq('id', victimQuest).select('id');
  rls.chatModify = await client.from('chat_messages').insert({ user_id: victim.id, role: 'user', message: 'SHOULD-NOT-WRITE' }).select('id');
  const victimAfter = { profile: await profileRow(victim.id), roadmaps: await userRoadmaps(victim.id) };

  const unauthClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const anon = {
    leaderboard: await unauthClient.from('leaderboard').select('*').limit(5),
    profiles: await unauthClient.from('profiles').select('id, display_name, total_xp').limit(5),
    chat: await unauthClient.from('chat_messages').select('id, user_id, message').limit(5),
    storage: await unauthClient.storage.from('payment-slips').list('', { limit: 5 }),
  };

  const functionOk = functionProbes.attackerMe.status === 200 && functionProbes.attackerMe.body?.profile?.id === attacker.id && functionProbes.foreignToday.status === 200 && functionProbes.foreignToday.body?.status === 'no_roadmap' && functionProbes.foreignSwitch.status === 404 && functionProbes.foreignComplete.status === 404 && functionProbes.foreignChat.status === 404;
  const rlsNoData = [rls.profileRead, rls.roadmapRead, rls.questRead, rls.chatRead].every((x) => !x.error && Array.isArray(x.data) && x.data.length === 0);
  const rlsWritesBlocked = [rls.profileModify, rls.roadmapModify, rls.questModify, rls.chatModify].every((x) => !!x.error || !x.data || x.data.length === 0);
  const victimUntouched = victimAfter.profile.display_name === 'QA security-victim' && victimAfter.roadmaps[0]?.topic_title !== 'SHOULD-NOT-WRITE';
  const anonNoData = [anon.profiles, anon.chat].every((x) => !x.error && Array.isArray(x.data) && x.data.length === 0);
  const anonLeaderboardDenied = !!anon.leaderboard.error || !anon.leaderboard.data || anon.leaderboard.data.length === 0;
  const anonStorageDenied = !!anon.storage.error || !Array.isArray(anon.storage.data) || anon.storage.data.length === 0;
  const ok = functionOk && rlsNoData && rlsWritesBlocked && victimUntouched && anonNoData && anonLeaderboardDenied && anonStorageDenied;
  addCase(
    '9. Security — cross-user functions, RLS, anon reads/storage',
    ok ? 'PASS' : 'FAIL',
    `functions foreign today/switch/complete/chat=${functionProbes.foreignToday.status}/${functionProbes.foreignSwitch.status}/${functionProbes.foreignComplete.status}/${functionProbes.foreignChat.status}; authenticated foreign read rows=${[rls.profileRead, rls.roadmapRead, rls.questRead, rls.chatRead].map((x) => x.data?.length ?? 'err').join('/')}; writes blocked=${rlsWritesBlocked}; anon leaderboard/profiles/chat/storage=${anon.leaderboard.error?.code || anon.leaderboard.data?.length}/${anon.profiles.data?.length}/${anon.chat.data?.length}/${anon.storage.error?.message || anon.storage.data?.length}`,
    { attacker_id: attacker.id, victim_id: victim.id, victim_roadmap_id: victimRoadmap?.id, victim_quest_id: victimQuest, function_probes: Object.fromEntries(Object.entries(functionProbes).map(([k, v]) => [k, { status: v.status, body: v.body }])), rls: Object.fromEntries(Object.entries(rls).map(([k, v]) => [k, { data: v.data, error: v.error?.message || null }])), anon: Object.fromEntries(Object.entries(anon).map(([k, v]) => [k, { data: v.data, error: v.error?.message || v.error?.code || null }])) }
  );
}

async function runPublicPages() {
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const [{ data: stats, error: statsError }, { data: growth, error: growthError }, { data: leaderboard, error: leaderboardError }] = await Promise.all([
    anonClient.from('public_stats').select('*').single(),
    anonClient.from('stats_daily_growth').select('*').order('day', { ascending: true }),
    anonClient.from('leaderboard').select('*').order('rank', { ascending: true }).limit(50),
  ]);
  const registered = await countRows('profiles');
  const activated = await countRows('quest_completions', (q) => q); // distinct check below
  const { data: completionUsers } = await admin.from('quest_completions').select('user_id');
  const { data: allCompletions } = await admin.from('quest_completions').select('id');
  const { data: allProfiles } = await admin.from('profiles').select('current_streak, longest_streak');
  const { data: allActivity } = await admin.from('activity_log').select('user_id, created_at');
  const utcStart = new Date();
  utcStart.setUTCHours(0, 0, 0, 0);
  const expected = {
    registered_total: registered,
    activated_total: new Set((completionUsers ?? []).map((row) => row.user_id)).size,
    quests_completed_total: (allCompletions ?? []).length,
    max_streak: Math.max(0, ...(allProfiles ?? []).map((row) => row.longest_streak ?? 0)),
    avg_active_streak: (() => {
      const active = (allProfiles ?? []).map((row) => row.current_streak ?? 0).filter((value) => value > 0);
      return active.length ? Math.round((active.reduce((sum, value) => sum + value, 0) / active.length) * 10) / 10 : 0;
    })(),
    dau_today: new Set((allActivity ?? []).filter((row) => new Date(row.created_at) >= utcStart).map((row) => row.user_id)).size,
  };
  const statsAddUp = !statsError && stats && Object.entries(expected).every(([key, value]) => Number(stats[key]) === Number(value));
  const growthRows = growth ?? [];
  const growthMonotonic = growthRows.every((row, i) => i === 0 || Number(row.cumulative_users) >= Number(growthRows[i - 1].cumulative_users));
  const finalGrowth = growthRows.length ? Number(growthRows[growthRows.length - 1].cumulative_users) : null;
  const growthAddsUp = !growthError && growthRows.length > 0 && growthMonotonic && finalGrowth === expected.registered_total;
  const noEmailOrReferralInLeaderboard = Array.isArray(leaderboard) && leaderboard.every((row) => !Object.prototype.hasOwnProperty.call(row, 'email') && !Object.prototype.hasOwnProperty.call(row, 'referral_code'));
  const ok = statsAddUp && growthAddsUp && !!leaderboardError;
  addCase(
    '10. Public pages — /stats aggregates and /leaderboard anon exposure',
    ok ? 'PASS' : 'FAIL',
    `public_stats=${statsError ? statsError.message : jsonBrief(stats)}; expected=${jsonBrief(expected)}; growth rows=${growthRows.length}, monotonic=${growthMonotonic}, final=${finalGrowth}; anon leaderboard=${leaderboardError?.code || leaderboardError?.message || `returned ${leaderboard?.length}`}; authenticated-only row PII keys absent=${noEmailOrReferralInLeaderboard}`,
    { stats, expected, growth_tail: growthRows.slice(-3), leaderboard_error: leaderboardError?.message || leaderboardError?.code || null, leaderboard_sample: leaderboard?.slice(0, 3) }
  );
}

async function runMultiUser(topics) {
  const users = [];
  for (let i = 1; i <= 21; i += 1) users.push(await createQaUser(`multi-${String(i).padStart(2, '0')}`));
  const started = await Promise.all(users.map((user) => callFn('start-roadmap', {
    token: user.token,
    body: { topic_id: topics.map.get('python').id, level: 'beginner', minutes_per_day: 15 },
  })));
  started.forEach((response, index) => registerRoadmap(users[index], response, `multi-${String(index + 1).padStart(2, '0')}`));
  const startsOk = started.filter((response) => validCuratedResponse(response)).length;
  const completed = await Promise.all(started.map((response, index) => {
    if (!validCuratedResponse(response)) return null;
    return callFn('complete-quest', { token: users[index].token, body: { quest_id: response.body.quest.id, checked_item_ids: allChecklistIds(response) } });
  }));
  const completionOk = completed.filter(Boolean).filter((response) => response.status === 200 && response.body?.alreadyCompleted === false).length;
  const activeReady = await admin.from('roadmaps').select('id, user_id, created_at').eq('is_active', true).eq('status', 'ready').order('created_at', { ascending: true });
  const ourIds = new Set(users.map((user) => user.id));
  const candidates = [];
  for (const roadmap of activeReady.data ?? []) {
    const { data: latest } = await admin.from('daily_quests').select('id, day_number').eq('roadmap_id', roadmap.id).order('day_number', { ascending: false }).limit(1);
    if (!latest?.[0]) continue;
    const { data: done } = await admin.from('quest_completions').select('quest_id').eq('quest_id', latest[0].id).limit(1);
    if (done?.length) {
      const { data: next } = await admin.from('daily_quests').select('id').eq('roadmap_id', roadmap.id).eq('day_number', latest[0].day_number + 1).limit(1);
      if (!next?.length) candidates.push({ ...roadmap, eligible: true, ours: ourIds.has(roadmap.user_id) });
    }
  }
  let pregen = null;
  if (candidates.length === 0 || candidates.every((candidate) => candidate.ours)) {
    pregen = await callFn('pre-generate-quests', { method: 'POST', body: { next_run: 'qa-2026-07-23' } });
  } else {
    addNote(`Skipped live pre-generate invocation because eligible non-QA roadmaps existed: ${candidates.filter((candidate) => !candidate.ours).length}`);
  }
  const startPass = startsOk === 21;
  const completionPass = completionOk === 21;
  const pregenEvidence = pregen ? `pre-generate=${pregen.status}/${jsonBrief(pregen.body)}` : `pre-generate skipped; eligible=${candidates.length}, non-QA eligible=${candidates.filter((candidate) => !candidate.ours).length}`;
  const ok = startPass && completionPass && (!pregen || (pregen.status === 200 && Number(pregen.body?.processed ?? 0) <= 3));
  const status = quotaHit && pregen?.status === 429 ? 'BLOCKED' : ok ? 'PASS' : 'FAIL';
  addCase(
    '8. Multi-user reality — 21 concurrent curated starts/claims + nightly scan',
    status,
    `21 concurrent starts passed=${startsOk}/21; concurrent claims passed=${completionOk}/21; active ready=${activeReady.data?.length ?? 'error'}; eligible scan candidates=${candidates.length}; ${pregenEvidence}`,
    { user_ids: users.map((user) => user.id), start_statuses: started.map((r) => r.status), completion_statuses: completed.map((r) => r?.status ?? null), pregen: pregen?.body ?? null, eligible_candidates: candidates }
  );
}

async function runInputValidation() {
  const noAuth = await callFn('me', { method: 'GET' });
  const user = await createQaUser('input-validation');
  const badLevel = await callFn('start-roadmap', { token: user.token, body: { topic_id: 'not-a-uuid', level: 'expert', minutes_per_day: 15 } });
  const tooLong = await callFn('generate-quest', { token: user.token, body: { topic_title: 'x'.repeat(81), level: 'beginner', minutes_per_day: 15 } });
  const ok = noAuth.status === 401 && badLevel.status === 400 && tooLong.status === 400;
  addCase('11. Input validation/auth smoke', ok ? 'PASS' : 'FAIL', `unauthenticated /me=${noAuth.status}; bad level=${badLevel.status}; 81-char topic=${tooLong.status}`, { noAuth: noAuth.body, badLevel: badLevel.body, tooLong: tooLong.body, user_id: user.id });
}

async function main() {
  const preflight = {};
  for (const table of ['profiles', 'roadmaps', 'daily_quests', 'quest_completions', 'referrals', 'chat_messages']) {
    try { preflight[table] = await countRows(table); } catch (error) { preflight[table] = `error:${error.message}`; }
  }
  console.log(`PREFLIGHT|${JSON.stringify(preflight)}`);
  const topics = await topicsBySlug();
  console.log(`TOPICS|${JSON.stringify(topics.data)}`);

  await runCurated(topics);
  await runFreeform();
  await runModeration();
  await runDaily(topics);
  await runRace(topics);
  await runGradeTransitions(topics);
  await runChat(topics);
  await runSwitch(topics);
  await runReferrals();
  await runSecurity(topics);
  await runPublicPages();
  await runMultiUser(topics);
  await runInputValidation();

  console.log('=== CASE SUMMARY ===');
  for (const item of cases) console.log(`${item.status}\t${item.name}\t${item.evidence}`);
  console.log('=== CREATED USERS ===');
  for (const user of createdUsers) console.log(`${user.tag}\t${user.id}\t${user.email}\tcreated_at=${user.created_at}`);
  console.log('=== CREATED ROADMAPS ===');
  for (const roadmap of createdRoadmaps) console.log(`${roadmap.label}\t${roadmap.id}\tuser_id=${roadmap.user_id}\ttopic=${roadmap.topic_title}\tstatus=${roadmap.status}`);
  console.log('=== NOTES ===');
  for (const note of notes) console.log(note);
  console.log('=== MACHINE JSON (no tokens/passwords) ===');
  console.log(JSON.stringify({ preflight, cases, createdUsers: createdUsers.map(({ tag, id, email, created_at }) => ({ tag, id, email, created_at })), createdRoadmaps, notes }, null, 2));
}

main().catch((error) => {
  console.error(`FATAL|${error?.stack || error}`);
  console.log('=== PARTIAL CREATED USERS ===');
  for (const user of createdUsers) console.log(`${user.tag}\t${user.id}\t${user.email}\tcreated_at=${user.created_at}`);
  console.log('=== PARTIAL CREATED ROADMAPS ===');
  for (const roadmap of createdRoadmaps) console.log(`${roadmap.label}\t${roadmap.id}\tuser_id=${roadmap.user_id}\ttopic=${roadmap.topic_title}\tstatus=${roadmap.status}`);
  process.exitCode = 1;
});
