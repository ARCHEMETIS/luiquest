// POST /.netlify/functions/start-roadmap — onboarding เส้นทางหัวข้อ curated (#06, ไม่แตะ Gemini)
// body: { topic_id, level: beginner|intermediate|advanced, minutes_per_day: 15|30|60 }
// หัวข้อพิมพ์อิสระ (ไม่มี topic_id) ต้อง generate สดด้วย Gemini -> เรียก /generate-quest แทน (#07)
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { createCuratedRoadmap, FREE_PLAN_LIMIT_MESSAGE } from './_shared/questGenerator.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const MINUTES = [15, 30, 60];

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { topic_id: topicId, level, minutes_per_day: minutesPerDay } = body;

  if (!topicId) {
    return json(400, {
      error: 'หัวข้อพิมพ์อิสระต้องใช้ /.netlify/functions/generate-quest แทน (ต้อง generate สดด้วย AI)',
    });
  }
  if (!LEVELS.includes(level)) return json(400, { error: 'level ต้องเป็น beginner/intermediate/advanced' });
  if (!MINUTES.includes(minutesPerDay)) return json(400, { error: 'minutes_per_day ต้องเป็น 15/30/60' });

  const admin = getAdminClient();

  const { data: topic, error: topicErr } = await admin
    .from('topics')
    .select('id, slug, title')
    .eq('id', topicId)
    .eq('is_active', true)
    .maybeSingle();
  if (topicErr) return json(500, { error: topicErr.message });
  if (!topic) return json(404, { error: 'ไม่พบหัวข้อนี้' });

  try {
    const result = await createCuratedRoadmap(admin, {
      userId: user.id,
      topicId: topic.id,
      topicSlug: topic.slug,
      topicTitle: topic.title,
      level,
      minutesPerDay,
    });

    if (!result.reused) {
      await admin.from('activity_log').insert({
        user_id: user.id,
        event_type: 'roadmap_start',
        metadata: { topic_id: topic.id, topic_slug: topic.slug, level },
      });
    }

    return json(200, result);
  } catch (err) {
    if (err.code === 'FREE_PLAN_ACTIVE_ROADMAP_LIMIT') {
      return json(409, { error: FREE_PLAN_LIMIT_MESSAGE, code: err.code });
    }
    return json(500, { error: String(err.message || err) });
  }
};
