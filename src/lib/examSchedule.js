const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value, fieldName) {
  const match = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
  if (!match) throw new TypeError(`${fieldName} must be a YYYY-MM-DD string`);

  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const canonical = new Date(timestamp).toISOString().slice(0, 10);
  if (canonical !== value) throw new RangeError(`${fieldName} is not a valid calendar date`);
  return timestamp;
}

function dateFromOffset(startTimestamp, offset) {
  return new Date(startTimestamp + offset * DAY_MS).toISOString().slice(0, 10);
}

function ceilToFive(value) {
  return Math.ceil(value / 5) * 5;
}

function normalizeTopics(topics) {
  if (!Array.isArray(topics)) throw new TypeError('topics must be an array');

  const normalized = topics.map((topic) => {
    if (typeof topic !== 'string') throw new TypeError('every topic must be a string');
    return topic.trim();
  }).filter(Boolean);

  if (normalized.length < 1 || normalized.length > 100) {
    throw new RangeError('topics must contain between 1 and 100 non-blank entries');
  }
  if (normalized.some((topic) => [...topic].length > 200)) {
    throw new RangeError('a topic cannot exceed 200 characters');
  }
  return normalized;
}

function sessionOffsets(phaseDays, sessionCount, kind) {
  if (sessionCount === 1) {
    // รอบทบทวนเดี่ยววางชิดวันสอบ เพื่อไม่กินช่วงอ่านครั้งแรกโดยไม่จำเป็น
    return [kind === 'review' ? phaseDays - 1 : 0];
  }

  return Array.from({ length: sessionCount }, (_unused, index) => (
    Math.round(index * (phaseDays - 1) / (sessionCount - 1))
  ));
}

function buildPhase({
  topics,
  kind,
  minutesPerTopic,
  phaseStartOffset,
  phaseDays,
  selectedMinutesPerDay,
  fits,
  startTimestamp,
}) {
  if (phaseDays === 0) return [];

  const requiredMinutes = topics.length * minutesPerTopic;
  // ถ้าแผนล้นต้องคงงานครบทุกนาที แล้วเปิดเผยงบจริงต่อ session ให้ UI เตือนผู้เรียนได้
  const sessionBudget = fits
    ? selectedMinutesPerDay
    : ceilToFive(requiredMinutes / phaseDays);
  const sessionCount = Math.min(phaseDays, Math.ceil(requiredMinutes / sessionBudget));
  const offsets = sessionOffsets(phaseDays, sessionCount, kind);

  let topicIndex = 0;
  let topicMinutesLeft = minutesPerTopic;

  return offsets.map((offset) => {
    let sessionMinutesLeft = sessionBudget;
    const allocations = [];

    while (sessionMinutesLeft > 0 && topicIndex < topics.length) {
      const minutes = Math.min(sessionMinutesLeft, topicMinutesLeft);
      allocations.push({
        topicIndex: topicIndex + 1,
        topic: topics[topicIndex],
        minutes,
      });
      sessionMinutesLeft -= minutes;
      topicMinutesLeft -= minutes;

      if (topicMinutesLeft === 0) {
        topicIndex += 1;
        topicMinutesLeft = minutesPerTopic;
      }
    }

    return {
      scheduledDate: dateFromOffset(startTimestamp, phaseStartOffset + offset),
      kind,
      allocations,
      plannedMinutes: allocations.reduce((sum, allocation) => sum + allocation.minutes, 0),
    };
  });
}

/**
 * สร้างตารางอ่านสอบแบบ deterministic โดยไม่อ่านเวลา global และไม่เรียก network
 * วันที่สอบไม่นับเป็นวันอ่าน และหัวข้อซ้ำจะเป็นคนละ syllabus unit ตามลำดับที่พิมพ์
 */
export function buildExamSchedule({ topics, examDate, today, minutesPerDay }) {
  if (!Number.isInteger(minutesPerDay)
      || minutesPerDay < 15
      || minutesPerDay > 180
      || minutesPerDay % 15 !== 0) {
    throw new RangeError('minutesPerDay must be 15..180 in 15-minute steps');
  }

  const normalizedTopics = normalizeTopics(topics);
  const startTimestamp = parseDateOnly(today, 'today');
  const examTimestamp = parseDateOnly(examDate, 'examDate');
  const availableDays = (examTimestamp - startTimestamp) / DAY_MS;
  if (!Number.isInteger(availableDays) || availableDays < 1) {
    throw new RangeError('examDate must be after today');
  }

  const reviewDayCount = availableDays === 1
    ? 0
    : Math.min(availableDays - 1, Math.max(1, Math.ceil(availableDays * 0.2)));
  const firstPassDayCount = availableDays - reviewDayCount;
  const firstPassRequired = normalizedTopics.length * 30;
  const reviewRequired = reviewDayCount > 0 ? normalizedTopics.length * 10 : 0;
  const fitsFirstPass = firstPassRequired <= firstPassDayCount * minutesPerDay;
  const fitsReview = reviewDayCount === 0
    || reviewRequired <= reviewDayCount * minutesPerDay;
  const requiredMinutesPerDay = Math.max(
    ceilToFive(firstPassRequired / firstPassDayCount),
    reviewDayCount > 0 ? ceilToFive(reviewRequired / reviewDayCount) : 0,
  );
  const overloaded = !fitsFirstPass || !fitsReview;

  const items = [
    ...buildPhase({
      topics: normalizedTopics,
      kind: 'first_pass',
      minutesPerTopic: 30,
      phaseStartOffset: 0,
      phaseDays: firstPassDayCount,
      selectedMinutesPerDay: minutesPerDay,
      fits: fitsFirstPass,
      startTimestamp,
    }),
    ...buildPhase({
      topics: normalizedTopics,
      kind: 'review',
      minutesPerTopic: 10,
      phaseStartOffset: firstPassDayCount,
      phaseDays: reviewDayCount,
      selectedMinutesPerDay: minutesPerDay,
      fits: fitsReview,
      startTimestamp,
    }),
  ];

  return {
    topics: normalizedTopics,
    today,
    examDate,
    selectedMinutesPerDay: minutesPerDay,
    availableDays,
    firstPassDayCount,
    reviewDayCount,
    firstPassRequired,
    reviewRequired,
    requiredMinutesPerDay,
    fitStatus: overloaded ? 'overloaded' : 'fits',
    overloaded,
    oneDayWithoutReview: reviewDayCount === 0,
    items,
  };
}
