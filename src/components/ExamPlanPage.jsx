import { useEffect, useMemo, useState } from "react";
import GhostMascot from "./GhostMascot.jsx";
import { buildExamSchedule } from "../lib/examSchedule.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const THAI_WEEKDAY = new Intl.DateTimeFormat("th-TH", { weekday: "long", timeZone: "UTC" });
const THAI_DATE = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const THAI_SHORT_DATE = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

const PRIMARY_BUTTON = "rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(139,92,246,.42)] hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BUTTON = "rounded-full border-2 border-[#FBCFE8] bg-white/80 px-4 py-2 font-heading text-xs font-bold text-[#831843] transition hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const FIELD_CLASS = "mt-1.5 w-full min-w-0 rounded-2xl border-2 border-[#FBCFE8] bg-white/90 px-3.5 py-2.5 text-sm text-[#831843] outline-none transition placeholder:text-[#9D5C7C]/60 focus:border-[#8B5CF6]/60 focus:ring-2 focus:ring-[#8B5CF6]/10";

// ป้ายเตือนแบบตั้งพื้น (A-frame) สำหรับหน้าฟีเจอร์ที่ยังไม่เปิด — ขาสองข้างกางออกและมีเงาที่พื้น
// ให้ดูเหมือนป้ายจริงที่วางขวางไว้ ไม่ใช่แบนเนอร์ที่ลอยอยู่
function ConstructionSign() {
  const STRIPES = 'repeating-linear-gradient(45deg, #FBBF24 0 7px, #78350F 7px 14px)';
  return (
    <div aria-hidden="true" className="relative h-[104px] w-[96px] shrink-0">
      {/* เสาเดียวตรงกลาง ตั้งตรง — ยาวจนสุดกล่องเพื่อให้ตีนเสาอยู่ระดับเดียวกับตีนผี
          (ประกาศก่อนกระดานจึงอยู่ชั้นล่าง ซุกหลังป้ายพอดี) */}
      <span className="absolute left-1/2 top-[46px] h-[52px] w-[7px] -translate-x-1/2 rounded-[2px] bg-[#B45309]" />

      {/* กระดานป้าย */}
      <div className="absolute left-1/2 top-0 w-[96px] -translate-x-1/2 overflow-hidden rounded-lg border-[3px] border-[#B45309] bg-amber-50 shadow-[0_5px_12px_rgba(180,83,9,.22)]">
        <span className="block h-2 w-full" style={{ backgroundImage: STRIPES }} />
        <p className="px-1.5 py-1.5 text-center font-heading text-[11px] font-bold leading-tight text-[#78350F]">
          ⚠ กำลัง<br />ก่อสร้าง
        </p>
        <span className="block h-2 w-full" style={{ backgroundImage: STRIPES }} />
      </div>

      {/* เงาที่พื้น */}
      <span className="absolute bottom-[1px] left-1/2 h-[6px] w-[44px] -translate-x-1/2 rounded-[50%] bg-[#831843]/12" />
    </div>
  );
}

const BADGE_STYLE = {
  today: "border-violet-200 bg-violet-50 text-[#8B5CF6]",
  upcoming: "border-pink-200 bg-pink-50 text-[#9D5C7C]",
  missed: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  skipped: "border-slate-200 bg-slate-50 text-slate-500",
  overloaded: "border-red-200 bg-red-50 text-red-600",
  fits: "border-emerald-200 bg-emerald-50 text-emerald-700",
  finished: "border-violet-200 bg-violet-50 text-[#8B5CF6]",
};

function dateTimestamp(value) {
  if (!DATE_ONLY.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function shiftDate(value, amount) {
  const timestamp = dateTimestamp(value);
  return timestamp == null ? "" : new Date(timestamp + amount * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const start = dateTimestamp(from);
  const end = dateTimestamp(to);
  return start == null || end == null ? 0 : Math.max(0, Math.round((end - start) / DAY_MS));
}

function formatDate(value, short = false) {
  const timestamp = dateTimestamp(value);
  if (timestamp == null) return value || "–";
  return (short ? THAI_SHORT_DATE : THAI_DATE).format(new Date(timestamp));
}

function formatWeekday(value) {
  const timestamp = dateTimestamp(value);
  return timestamp == null ? "" : THAI_WEEKDAY.format(new Date(timestamp));
}

function sortedItems(plan) {
  return [...(Array.isArray(plan?.items) ? plan.items : [])].sort((a, b) => (
    String(a.scheduled_date).localeCompare(String(b.scheduled_date))
      || String(a.created_at).localeCompare(String(b.created_at))
  ));
}

function itemAllocations(plan, item) {
  const indexes = Array.isArray(item?.topic_indexes) ? item.topic_indexes : [];
  const minutes = Array.isArray(item?.topic_minutes) ? item.topic_minutes : [];
  return indexes.map((topicIndex, index) => ({
    topicIndex,
    topic: plan?.topics?.[Number(topicIndex) - 1] ?? `หัวข้อที่ ${topicIndex}`,
    minutes: Number(minutes[index]) || 0,
  }));
}

function planProgress(plan) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  const completed = items.filter((item) => item.status === "completed").length;
  const skipped = items.filter((item) => item.status === "skipped").length;
  return {
    completed,
    skipped,
    total: items.length,
    percent: items.length ? Math.round((completed / items.length) * 100) : 0,
  };
}

function itemState(item, learningDate) {
  if (item.status === "completed") return { key: "completed", label: "ทำแล้ว" };
  if (item.status === "skipped") return { key: "skipped", label: "ข้ามแล้ว" };
  if (item.scheduled_date < learningDate) return { key: "missed", label: "ขาด" };
  if (item.scheduled_date === learningDate) return { key: "today", label: "วันนี้" };
  return { key: "upcoming", label: "กำลังจะถึง" };
}

function Badge({ kind, children }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${BADGE_STYLE[kind] || BADGE_STYLE.upcoming}`}>
      {children}
    </span>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-[#FBCFE8]/50 ${className}`} />;
}

function ProgressBar({ progress }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#FBCFE8]/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width] duration-500"
        style={{ width: `${progress.percent}%` }}
      />
    </div>
  );
}

function FitBadge({ plan }) {
  return plan.fit_status === "overloaded"
    ? <Badge kind="overloaded">แน่นเกินเวลา</Badge>
    : <Badge kind="fits">พอดีกับเวลา</Badge>;
}

function ScheduleItemCard({
  plan,
  item,
  learningDate,
  pendingAction,
  showPlanTitle = false,
  onRequestMove,
  onRequestDelete,
  onComplete,
}) {
  const state = itemState(item, learningDate);
  const allocations = itemAllocations(plan, item);
  const overloaded = Number(item.planned_minutes) > Number(plan.minutes_per_day);
  const planActive = plan.status === "active" && plan.exam_date > learningDate;
  const canComplete = planActive && item.status === "scheduled" && item.scheduled_date === learningDate;
  const canMove = planActive && item.status === "scheduled" && item.scheduled_date >= learningDate;
  const canDelete = planActive && item.status === "scheduled";
  const busy = Boolean(pendingAction);

  return (
    <article className={`min-w-0 rounded-2xl border-2 bg-white/80 p-4 ${state.key === "today" ? "border-[#8B5CF6]/50 shadow-[0_8px_20px_rgba(139,92,246,.14)]" : "border-[#FBCFE8]"}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {showPlanTitle && <p className="break-words text-[11px] font-bold text-[#8B5CF6]">{plan.title}</p>}
          <p className="text-xs font-bold text-[#831843]">{formatWeekday(item.scheduled_date)} • {formatDate(item.scheduled_date)}</p>
          <p className="mt-0.5 text-[11px] text-[#9D5C7C]">{item.kind === "review" ? "ทบทวน" : "อ่านครั้งแรก"}</p>
        </div>
        <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
          <Badge kind={state.key}>{state.label}</Badge>
          {overloaded && <Badge kind="overloaded">เกินเวลาที่เลือก</Badge>}
        </div>
      </div>

      <ul className="mt-3 flex min-w-0 flex-col gap-2">
        {allocations.map((allocation, index) => (
          <li key={`${allocation.topicIndex}-${index}`} className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-[#FDF2F8] px-3 py-2 text-xs">
            <span className="min-w-0 break-words leading-relaxed text-[#831843]">{allocation.topic}</span>
            <span className="shrink-0 font-bold text-[#8B5CF6]">{allocation.minutes} นาที</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#FBCFE8] pt-3">
        <p className="text-[11px] text-[#9D5C7C]">
          รวม <span className="font-bold text-[#831843]">{item.planned_minutes} นาที</span>
          {Number(item.reschedule_count) > 0 && ` • ย้ายแล้ว ${item.reschedule_count} ครั้ง`}
        </p>
        {(canComplete || canMove || canDelete) && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {canMove && (
              <button type="button" disabled={busy} onClick={() => onRequestMove(plan, item)} className="rounded-full border border-[#FBCFE8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8B5CF6] disabled:opacity-50">
                ย้ายวัน
              </button>
            )}
            {canDelete && (
              <button type="button" disabled={busy} onClick={() => onRequestDelete(plan, item)} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold text-red-500 disabled:opacity-50">
                ลบวันนี้
              </button>
            )}
            {canComplete && (
              <button type="button" disabled={busy} onClick={() => onComplete(item.id)} className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_6px_14px_rgba(139,92,246,.25)] disabled:opacity-60">
                {pendingAction === `complete:${item.id}` ? "กำลังบันทึก..." : "อ่านครบแล้ว"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function PlanOverviewCard({ plan, learningDate, onOpen }) {
  const progress = planProgress(plan);
  const daysLeft = daysBetween(learningDate, plan.exam_date);
  return (
    <article className="min-w-0 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words font-heading text-base font-bold text-[#831843]">{plan.title}</h2>
          <p className="mt-0.5 text-[11px] text-[#9D5C7C]">สอบ {formatDate(plan.exam_date)} • เหลือ {daysLeft} วัน</p>
        </div>
        <FitBadge plan={plan} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-[#9D5C7C]">ทำแล้ว <strong className="text-[#831843]">{progress.completed}/{progress.total} วัน</strong>{progress.skipped ? ` • ข้าม ${progress.skipped}` : ""}</span>
        <span className="shrink-0 font-bold text-[#8B5CF6]">{progress.percent}%</span>
      </div>
      <ProgressBar progress={progress} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#9D5C7C]">
          เลือก {plan.minutes_per_day} นาที/วัน
          {plan.fit_status === "overloaded" && ` • ต้องประมาณ ${plan.required_minutes_per_day} นาที/วัน`}
        </p>
        <button type="button" onClick={() => onOpen(plan.id)} className="text-[11px] font-bold text-[#8B5CF6] underline underline-offset-2">ดูทั้งตาราง</button>
      </div>
    </article>
  );
}

function EmptyState({ title, copy, mood = "idle", actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#FBCFE8] bg-white/60 px-6 py-8 text-center">
      <GhostMascot mood={mood} className="scale-75" />
      <h2 className="mt-1 font-heading text-base font-bold text-[#831843]">{title}</h2>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#9D5C7C]">{copy}</p>
      {actionLabel && <button type="button" onClick={onAction} className={`${PRIMARY_BUTTON} mt-4`}>{actionLabel}</button>}
    </div>
  );
}

function OverviewTab({ plans, learningDate, archivedCount, onOpenPlan, onCreate, onArchive }) {
  const activePlans = plans.filter((plan) => plan.status === "active");
  const finishedPlans = plans.filter((plan) => plan.status === "finished");
  return (
    <section aria-label="ภาพรวมแผนสอบ" className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold">ภาพรวมทุกวิชา</h2>
          <p className="text-[11px] text-[#9D5C7C]">เช็กว่าวิชาไหนทัน วิชาไหนแน่น ได้จากที่เดียว</p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[#8B5CF6]">{activePlans.length} แผนที่กำลังอ่าน</span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {activePlans.map((plan) => <PlanOverviewCard key={plan.id} plan={plan} learningDate={learningDate} onOpen={onOpenPlan} />)}
        {activePlans.length === 0 && (
          <EmptyState
            title="ยังไม่มีแผนที่กำลังอ่าน"
            copy="ใส่วิชา วันสอบ เวลา และหัวข้อ แล้วลุยตามตารางได้เลย"
            actionLabel="สร้างแผนอ่านสอบ"
            onAction={onCreate}
          />
        )}
      </div>

      {finishedPlans.length > 0 && (
        <div className="mt-6">
          <h3 className="font-heading text-sm font-bold">แผนที่จบแล้ว</h3>
          <div className="mt-2 flex flex-col gap-2">
            {finishedPlans.map((plan) => {
              const progress = planProgress(plan);
              return (
                <article key={plan.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#FBCFE8] bg-white/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold">{plan.title}</p>
                    <p className="text-[10px] text-[#9D5C7C]">สอบ {formatDate(plan.exam_date, true)} • ทำแล้ว {progress.completed}/{progress.total} วัน</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button type="button" onClick={() => onOpenPlan(plan.id)} className="text-[10px] font-bold text-[#8B5CF6]">ดูตาราง</button>
                    <button type="button" onClick={() => onArchive(plan)} className="text-[10px] font-bold text-[#9D5C7C] underline underline-offset-2">เก็บเข้าคลัง</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
      {archivedCount > 0 && <p className="mt-4 text-center text-[10px] text-[#9D5C7C]/80">เก็บไว้ในคลังแล้ว {archivedCount} แผน</p>}
    </section>
  );
}

function SubjectTab({
  plans,
  selectedPlan,
  selectedPlanId,
  learningDate,
  pendingAction,
  onSelectPlan,
  onArchive,
  onRequestMove,
  onRequestDelete,
  onComplete,
  onCreate,
}) {
  if (!selectedPlan) {
    return (
      <section className="mt-4">
        <EmptyState title="ยังไม่มีวิชาให้เปิดดู" copy="สร้างแผนแรก แล้วตารางทุกวันจะมาอยู่ตรงนี้" actionLabel="สร้างแผนอ่านสอบ" onAction={onCreate} />
      </section>
    );
  }

  const progress = planProgress(selectedPlan);
  const items = sortedItems(selectedPlan);
  const daysLeft = daysBetween(learningDate, selectedPlan.exam_date);
  return (
    <section aria-label="ตารางแยกตามวิชา" className="mt-4">
      {plans.length > 1 && (
        <label className="block text-xs font-bold text-[#831843]">
          เลือกวิชา
          <select value={selectedPlanId || ""} onChange={(event) => onSelectPlan(event.target.value)} className={FIELD_CLASS}>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}{plan.status === "finished" ? " (จบแล้ว)" : ""}</option>)}
          </select>
        </label>
      )}

      <article className={`${plans.length > 1 ? "mt-3" : ""} min-w-0 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 p-4`}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-heading text-lg font-bold">{selectedPlan.title}</h2>
            <p className="mt-0.5 text-[11px] text-[#9D5C7C]">สอบ {formatDate(selectedPlan.exam_date)}{selectedPlan.status === "active" ? ` • เหลือ ${daysLeft} วัน` : ""}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {selectedPlan.status === "finished" ? <Badge kind="finished">จบแผนแล้ว</Badge> : <FitBadge plan={selectedPlan} />}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
          <div className="rounded-xl bg-[#FDF2F8] px-2 py-2 text-[#9D5C7C]">เวลาอ่าน<br /><strong className="text-[#831843]">{selectedPlan.minutes_per_day} นาที/วัน</strong></div>
          <div className="rounded-xl bg-[#FDF2F8] px-2 py-2 text-[#9D5C7C]">ความคืบหน้า<br /><strong className="text-[#831843]">{progress.completed}/{progress.total} วัน</strong></div>
        </div>
        <ProgressBar progress={progress} />
        {selectedPlan.fit_status === "overloaded" && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-600">
            แผนนี้ต้องใช้ประมาณ {selectedPlan.required_minutes_per_day} นาที/วัน แต่เลือกไว้ {selectedPlan.minutes_per_day} นาที/วัน — วันที่เกินงบมีป้ายเตือนให้เห็นชัด
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={Boolean(pendingAction)} onClick={() => onArchive(selectedPlan)} className="text-[11px] font-bold text-[#9D5C7C] underline underline-offset-2 disabled:opacity-50">เก็บแผนเข้าคลัง</button>
        </div>
      </article>

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-sm font-bold">ตารางทั้งหมดตามลำดับวัน</h3>
        <span className="text-[10px] text-[#9D5C7C]">{items.length} วันอ่าน</span>
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {items.map((item) => (
          <ScheduleItemCard
            key={item.id}
            plan={selectedPlan}
            item={item}
            learningDate={learningDate}
            pendingAction={pendingAction}
            onRequestMove={onRequestMove}
            onRequestDelete={onRequestDelete}
            onComplete={onComplete}
          />
        ))}
        {items.length === 0 && <EmptyState title="ไม่มีวันอ่านเหลือแล้ว" copy="รายการในแผนนี้ถูกทำ ข้าม หรือลบออกครบแล้ว" mood="celebrate" />}
      </div>
    </section>
  );
}

function DailyTab({
  plans,
  learningDate,
  pendingAction,
  missedCount,
  onReviewMissed,
  onRequestMove,
  onRequestDelete,
  onComplete,
  onCreate,
}) {
  const entries = plans.flatMap((plan) => sortedItems(plan).map((item) => ({ plan, item })));
  const today = entries.filter(({ item }) => item.scheduled_date === learningDate);
  const upcoming = entries
    .filter(({ item }) => item.status === "scheduled" && item.scheduled_date > learningDate)
    .sort((a, b) => a.item.scheduled_date.localeCompare(b.item.scheduled_date) || a.plan.title.localeCompare(b.plan.title, "th"));
  const upcomingGroups = upcoming.reduce((groups, entry) => {
    const existing = groups.find((group) => group.date === entry.item.scheduled_date);
    if (existing) existing.entries.push(entry);
    else groups.push({ date: entry.item.scheduled_date, entries: [entry] });
    return groups;
  }, []);
  const todayDone = today.length > 0 && today.every(({ item }) => item.status !== "scheduled");

  return (
    <section aria-label="แผนอ่านรายวัน" className="mt-4">
      <div>
        <p className="text-[11px] text-[#9D5C7C]">{formatWeekday(learningDate)} • {formatDate(learningDate)}</p>
        <h2 className="font-heading text-base font-bold">วันนี้อ่านอะไรบ้าง</h2>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {today.map(({ plan, item }) => (
          <ScheduleItemCard
            key={item.id}
            plan={plan}
            item={item}
            learningDate={learningDate}
            pendingAction={pendingAction}
            showPlanTitle
            onRequestMove={onRequestMove}
            onRequestDelete={onRequestDelete}
            onComplete={onComplete}
          />
        ))}
        {today.length === 0 && (
          <EmptyState
            title={plans.length ? (missedCount ? "วันนี้ยังไม่มีรายการใหม่" : "วันนี้ไม่มีตารางอ่าน พักได้เต็มที่") : "ยังไม่มีแผนที่กำลังอ่าน"}
            copy={plans.length ? (missedCount ? "ยังมีวันที่ค้างให้ตัดสินใจก่อน แล้วค่อยดูตารางวันถัดไป" : "เลื่อนลงไปดูว่าวันถัดไปต้องอ่านอะไรได้เลย") : "สร้างแผนใหม่ แล้วทุกวิชาของวันนี้จะถูกรวมไว้ตรงนี้"}
            mood={plans.length ? "groove" : "idle"}
            actionLabel={plans.length ? undefined : "สร้างแผนอ่านสอบ"}
            onAction={onCreate}
          />
        )}
        {todayDone && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-xs font-bold text-emerald-700">วันนี้อ่านครบทุกวิชาแล้ว เก่งมาก! 🎉</p>}
      </div>

      {missedCount > 0 && (
        <button type="button" onClick={onReviewMissed} className="mt-4 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs leading-relaxed text-amber-800">
          <strong>มีวันที่ค้าง {missedCount} รายการ</strong><br />แตะเพื่อเลือกว่าจะเลื่อนแผนที่เหลือหรือข้ามวันนั้น
        </button>
      )}

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-sm font-bold">วันถัดไป</h3>
        <span className="text-[10px] text-[#9D5C7C]">รวมทุกวิชา</span>
      </div>
      <div className="mt-2 flex flex-col gap-5">
        {upcomingGroups.map((group) => (
          <div key={group.date}>
            <p className="mb-2 text-[11px] font-bold text-[#9D5C7C]">{formatWeekday(group.date)} • {formatDate(group.date)}</p>
            <div className="flex flex-col gap-3">
              {group.entries.map(({ plan, item }) => (
                <ScheduleItemCard
                  key={item.id}
                  plan={plan}
                  item={item}
                  learningDate={learningDate}
                  pendingAction={pendingAction}
                  showPlanTitle
                  onRequestMove={onRequestMove}
                  onRequestDelete={onRequestDelete}
                  onComplete={onComplete}
                />
              ))}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <p className="rounded-2xl border border-[#FBCFE8] bg-white/60 px-4 py-3 text-center text-xs text-[#9D5C7C]">ยังไม่มีรายการถัดไปในแผนที่กำลังอ่าน</p>}
      </div>
    </section>
  );
}

function CreatePlanForm({ learningDate, pending, canCancel, onCancel, onCreate, onCreated }) {
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [topicText, setTopicText] = useState("");
  const [formError, setFormError] = useState(null);
  const [serverOverload, setServerOverload] = useState(null);
  const [acceptOverload, setAcceptOverload] = useState(false);

  const topics = useMemo(() => topicText.split(/\r?\n/).map((topic) => topic.trim()).filter(Boolean), [topicText]);
  const minutesNumber = Number(minutes);
  const preview = useMemo(() => {
    if (!learningDate || !examDate || examDate <= learningDate || topics.length < 1 || topics.length > 100) return null;
    if (!Number.isInteger(minutesNumber) || minutesNumber < 15 || minutesNumber > 180 || minutesNumber % 15 !== 0) return null;
    if (topics.some((topic) => [...topic].length > 200)) return null;
    try {
      return buildExamSchedule({ topics, examDate, today: learningDate, minutesPerDay: minutesNumber });
    } catch {
      return null;
    }
  }, [examDate, learningDate, minutesNumber, topics]);

  const overload = serverOverload || (preview?.overloaded ? {
    requiredMinutesPerDay: preview.requiredMinutesPerDay,
    selectedMinutesPerDay: preview.selectedMinutesPerDay,
    firstPassRequired: preview.firstPassRequired,
    reviewRequired: preview.reviewRequired,
    reviewDayCount: preview.reviewDayCount,
  } : null);

  const resetCapacityDecision = () => {
    setServerOverload(null);
    setAcceptOverload(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle || [...cleanTitle].length > 120) {
      setFormError("ชื่อวิชา/การสอบต้องมี 1–120 ตัวอักษร");
      return;
    }
    if (!DATE_ONLY.test(examDate) || examDate <= learningDate) {
      setFormError("วันสอบต้องอยู่หลังวันเรียนวันนี้");
      return;
    }
    if (!Number.isInteger(minutesNumber) || minutesNumber < 15 || minutesNumber > 180 || minutesNumber % 15 !== 0) {
      setFormError("เวลาอ่านต่อวันต้องเป็น 15–180 นาที และเพิ่มทีละ 15 นาที");
      return;
    }
    if (topics.length < 1 || topics.length > 100) {
      setFormError("กรุณาใส่หัวข้อ 1–100 หัวข้อ โดยหนึ่งบรรทัดเป็นหนึ่งหัวข้อ");
      return;
    }
    if (topics.some((topic) => [...topic].length > 200)) {
      setFormError("แต่ละหัวข้อต้องยาวไม่เกิน 200 ตัวอักษร");
      return;
    }
    if (!preview && !serverOverload) {
      setFormError("ยังคำนวณตารางไม่ได้ กรุณาตรวจวันสอบ เวลา และหัวข้ออีกครั้ง");
      return;
    }
    if (overload && !acceptOverload) {
      setFormError("ติ๊กยืนยันก่อนว่ารับแผนที่แน่นกว่างบเวลานี้ได้");
      return;
    }

    const result = await onCreate({
      title: cleanTitle,
      examDate,
      minutesPerDay: minutesNumber,
      topics,
      acceptOverload: Boolean(overload && acceptOverload),
    });
    if (result?.code === "PLAN_OVER_CAPACITY") {
      setServerOverload({
        requiredMinutesPerDay: result.required_minutes_per_day,
        selectedMinutesPerDay: result.selected_minutes_per_day,
        firstPassRequired: result.first_pass_required,
        reviewRequired: result.review_required,
        reviewDayCount: result.review_day_count,
      });
      setAcceptOverload(false);
      return;
    }
    if (!result?.ok) {
      if (result?.message) setFormError(result.message);
      return;
    }

    setTitle("");
    setExamDate("");
    setMinutes("30");
    setTopicText("");
    setServerOverload(null);
    setAcceptOverload(false);
    onCreated(result);
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border-2 border-[#FBCFE8] bg-white/85 p-4 shadow-[0_10px_24px_rgba(139,92,246,.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold">สร้างแผนอ่านสอบ</h2>
          <p className="text-[11px] text-[#9D5C7C]">ตารางเริ่มจากวันเรียนวันนี้ของระบบ: {formatDate(learningDate)}</p>
        </div>
        {canCancel && <button type="button" onClick={onCancel} className="shrink-0 text-xs font-bold text-[#9D5C7C]" aria-label="ปิดฟอร์มสร้างแผน">ปิด</button>}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <label className="block text-xs font-bold">
          ชื่อวิชา/การสอบ
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="เช่น แคลคูลัสกลางภาค" className={FIELD_CLASS} />
        </label>
        <label className="block text-xs font-bold">
          วันสอบ
          <input type="date" value={examDate} min={shiftDate(learningDate, 1)} onChange={(event) => { setExamDate(event.target.value); resetCapacityDecision(); }} className={FIELD_CLASS} />
        </label>
        <label className="block text-xs font-bold">
          เวลาอ่านต่อวัน
          <div className="relative">
            <input type="number" value={minutes} min="15" max="180" step="15" inputMode="numeric" onChange={(event) => { setMinutes(event.target.value); resetCapacityDecision(); }} className={`${FIELD_CLASS} pr-14`} />
            <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-xs text-[#9D5C7C]">นาที</span>
          </div>
        </label>
        <label className="block text-xs font-bold">
          บท/หัวข้อ — หนึ่งบรรทัดต่อหนึ่งหัวข้อ
          <textarea value={topicText} onChange={(event) => { setTopicText(event.target.value); resetCapacityDecision(); }} rows={7} placeholder={"ลิมิตและความต่อเนื่อง\nอนุพันธ์\nการประยุกต์อนุพันธ์"} className={`${FIELD_CLASS} resize-y leading-relaxed`} />
          <span className={`mt-1 block text-right text-[11px] ${topics.length > 100 ? "font-bold text-red-500" : "text-[#9D5C7C]"}`}>{topics.length} หัวข้อ</span>
        </label>
      </div>

      <p className="mt-3 rounded-xl bg-[#FDF2F8] px-3 py-2 text-[11px] leading-relaxed text-[#9D5C7C]">
        v1 ประมาณ 30 นาทีต่อหัวข้อ + ทบทวน 10 นาที • ถ้าบทใหญ่ แยกเป็นหลายบรรทัดเพื่อให้น้ำหนักมากขึ้นได้
      </p>

      {preview && !overload && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-relaxed text-emerald-700">
          <strong>เวลาพอดีกับแผน ✓</strong><br />ต้องประมาณ {preview.requiredMinutesPerDay} นาที/วัน จาก {preview.availableDays} วันก่อนสอบ • กันไว้ทบทวน {preview.reviewDayCount} วัน
          {preview.oneDayWithoutReview && <><br /><span className="font-bold">มีวันอ่านเพียง 1 วัน จึงยังไม่มีรอบทบทวน</span></>}
        </div>
      )}

      {overload && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-700">
          <strong>แผนนี้แน่นกว่างบเวลาที่เลือก</strong><br />
          ต้องใช้ประมาณ {overload.requiredMinutesPerDay} นาที/วัน แต่คุณเลือก {overload.selectedMinutesPerDay} นาที/วัน
          <span className="mt-1 block text-[11px] text-red-600/80">อ่านครั้งแรกรวม {overload.firstPassRequired} นาที • ทบทวนรวม {overload.reviewRequired} นาที</span>
          {Number(overload.reviewDayCount) === 0 && <span className="mt-1 block text-[11px] font-bold">มีวันอ่านเพียง 1 วัน จึงยังไม่มีรอบทบทวน</span>}
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl bg-white/70 px-3 py-2 font-bold">
            <input type="checkbox" checked={acceptOverload} onChange={(event) => setAcceptOverload(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8B5CF6]" />
            <span>ยืนยันว่ารับแผนแน่นนี้ และให้บางวันเกิน {overload.selectedMinutesPerDay} นาทีได้</span>
          </label>
        </div>
      )}

      {formError && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">⚠️ {formError}</p>}

      <button type="submit" disabled={pending || Boolean(overload && !acceptOverload)} className={`${PRIMARY_BUTTON} mt-4 w-full`}>
        {pending ? "กำลังสร้างแผน..." : "สร้างแผนอ่านสอบ"}
      </button>
    </form>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#831843]/25 p-3 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-[#FBCFE8] bg-[#FDF2F8] p-5 text-[#831843] shadow-[0_20px_50px_rgba(131,24,67,.25)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FBCFE8] bg-white text-lg text-[#9D5C7C]">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MoveDialog({ plan, item, learningDate, pendingAction, onMove, onClose }) {
  const [date, setDate] = useState(item.scheduled_date);
  const [conflict, setConflict] = useState(null);
  const [localError, setLocalError] = useState(null);
  const minDate = plan.start_date > learningDate ? plan.start_date : learningDate;
  const maxDate = shiftDate(plan.exam_date, -1);
  const conflictingItem = conflict ? plan.items?.find((candidate) => candidate.id === conflict.conflicting_item_id) : null;
  const terminalConflict = conflictingItem && conflictingItem.status !== "scheduled";
  const pending = pendingAction === `move:${item.id}`;

  const submit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    if (!DATE_ONLY.test(date) || date < minDate || date > maxDate) {
      setLocalError("วันใหม่ต้องไม่ก่อนวันเรียนวันนี้และต้องอยู่ก่อนวันสอบ");
      return;
    }
    const result = await onMove(item.id, date, "reject");
    if (result?.ok) onClose();
    else if (result?.conflict === "DATE_OCCUPIED") setConflict(result);
    else setLocalError(result?.message || "ย้ายวันนี้ไม่สำเร็จ กรุณาเลือกวันอื่น");
  };

  const swap = async () => {
    setLocalError(null);
    const result = await onMove(item.id, date, "swap");
    if (result?.ok) onClose();
    else setLocalError(result?.message || "สลับสองวันนี้ไม่สำเร็จ กรุณาเลือกวันอื่น");
  };

  return (
    <Modal title="ย้ายวันอ่าน" onClose={onClose}>
      <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">{plan.title} • จาก {formatWeekday(item.scheduled_date)} {formatDate(item.scheduled_date)}</p>
      <form onSubmit={submit} className="mt-4">
        <label className="block text-xs font-bold">เลือกวันใหม่<input type="date" value={date} min={minDate} max={maxDate} onChange={(event) => { setDate(event.target.value); setConflict(null); setLocalError(null); }} className={FIELD_CLASS} /></label>
        {conflict && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
            <strong>วันนั้นมีรายการอยู่แล้ว</strong>
            {conflictingItem && <span className="block">{conflictingItem.kind === "review" ? "ทบทวน" : "อ่านครั้งแรก"} • {conflictingItem.planned_minutes} นาที</span>}
            {terminalConflict ? (
              <span className="mt-2 block font-bold text-red-600">รายการวันนั้นทำเสร็จหรือข้ามแล้ว จึงสลับไม่ได้ กรุณาเลือกวันอื่น</span>
            ) : (
              <button type="button" disabled={pending} onClick={swap} className={`${PRIMARY_BUTTON} mt-3 w-full`}>{pending ? "กำลังสลับ..." : "สลับสองวันนี้"}</button>
            )}
          </div>
        )}
        {localError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">⚠️ {localError}</p>}
        {!conflict && <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} mt-4 w-full`}>{pending ? "กำลังย้าย..." : "ยืนยันวันใหม่"}</button>}
      </form>
    </Modal>
  );
}

function ConfirmDialog({ title, copy, warning, confirmLabel, pending, danger = false, onConfirm, onClose }) {
  const [localError, setLocalError] = useState(null);
  const confirm = async () => {
    setLocalError(null);
    const result = await onConfirm();
    if (result?.ok) onClose();
    else setLocalError(result?.message || "บันทึกรายการนี้ไม่สำเร็จ กรุณาลองใหม่");
  };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mt-2 break-words text-sm font-bold">{copy}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#9D5C7C]">{warning}</p>
      {localError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">⚠️ {localError}</p>}
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={confirm} className={danger ? "rounded-full bg-red-500 px-4 py-2.5 font-heading text-sm font-bold text-white shadow-[0_8px_18px_rgba(239,68,68,.22)] disabled:opacity-60" : PRIMARY_BUTTON}>{pending ? "กำลังบันทึก..." : confirmLabel}</button>
        <button type="button" disabled={pending} onClick={onClose} className={SECONDARY_BUTTON}>ยังไม่ทำตอนนี้</button>
      </div>
    </Modal>
  );
}

function MissedDialog({ plan, item, pendingAction, actionError, onResolve, onDismiss }) {
  const [localError, setLocalError] = useState(null);
  const pending = pendingAction === `missed:${item.id}`;
  const resolve = async (action) => {
    setLocalError(null);
    const result = await onResolve(item.id, action);
    if (!result?.ok) setLocalError(result?.message || "จัดการวันที่ขาดไม่สำเร็จ กรุณาลองอีกครั้ง");
  };
  return (
    <Modal title="เลื่อนหรือข้าม?" onClose={onDismiss}>
      <p className="mt-1 text-xs leading-relaxed text-[#9D5C7C]">มีตารางที่ยังไม่ได้ทำจาก {formatWeekday(item.scheduled_date)} {formatDate(item.scheduled_date)}</p>
      <div className="mt-3 rounded-2xl border border-[#FBCFE8] bg-white/80 p-3.5">
        <p className="break-words text-sm font-bold">{plan.title}</p>
        <p className="mt-0.5 text-[11px] text-[#9D5C7C]">{item.kind === "review" ? "ทบทวน" : "อ่านครั้งแรก"} • {item.planned_minutes} นาที</p>
        <ul className="mt-2 flex flex-col gap-1">
          {itemAllocations(plan, item).map((allocation, index) => <li key={`${allocation.topicIndex}-${index}`} className="break-words text-xs text-[#831843]">• {allocation.topic} — {allocation.minutes} นาที</li>)}
        </ul>
      </div>
      {(localError || actionError) && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">⚠️ {localError || actionError}</p>}
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={() => resolve("shift")} className={PRIMARY_BUTTON}>{pending ? "กำลังจัดการ..." : "เลื่อนแผนที่เหลือ"}</button>
        <button type="button" disabled={pending} onClick={() => resolve("skip")} className={SECONDARY_BUTTON}>ข้ามวันนี้</button>
      </div>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-[#9D5C7C]">ปิดไว้ก่อนได้โดยไม่เปลี่ยนแผน คำถามนี้จะกลับมาอีกครั้งภายหลัง</p>
    </Modal>
  );
}

export default function ExamPlanPage({
  plans = [],
  learningDate,
  loading = false,
  loadError = null,
  notReady = false,
  selectedPlanId,
  pendingAction,
  actionError,
  actionNotice,
  onSelectPlan,
  onRetry,
  onDismissMessage,
  onCreate,
  onComplete,
  onMove,
  onDelete,
  onResolveMissed,
  onArchive,
}) {
  const [tab, setTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [dismissedMissedId, setDismissedMissedId] = useState(null);

  const selectablePlans = plans.filter((plan) => plan.status !== "archived");
  const activePlans = plans.filter((plan) => plan.status === "active");
  const selectedPlan = selectablePlans.find((plan) => plan.id === selectedPlanId) ?? null;
  const archivedCount = plans.filter((plan) => plan.status === "archived").length;
  const missedEntries = useMemo(() => activePlans
    .flatMap((plan) => sortedItems(plan).filter((item) => item.status === "scheduled" && item.scheduled_date < learningDate).map((item) => ({ plan, item })))
    .sort((a, b) => a.item.scheduled_date.localeCompare(b.item.scheduled_date)), [activePlans, learningDate]);
  const missed = missedEntries[0] ?? null;

  useEffect(() => {
    if (!loading && selectablePlans.length === 0) setShowCreate(true);
  }, [loading, selectablePlans.length]);

  const openPlan = (planId) => {
    onSelectPlan(planId);
    setTab("subject");
  };

  if (loading && !learningDate) {
    return (
      <div className="min-h-full px-6 pb-8 pt-6 font-body text-[#831843]">
        <div className="flex items-center justify-between"><div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-36" /></div><Skeleton className="h-9 w-28 rounded-full" /></div>
        <div className="mt-5 grid grid-cols-3 gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        <div className="mt-5 flex flex-col gap-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      </div>
    );
  }

  // ฟีเจอร์ยังไม่เปิด (ฝั่งฐานข้อมูลยังไม่ได้รัน migration) — ไม่ใช่ error ห้ามขึ้นการ์ดแดง
  // พอรัน migration แล้ว RPC จะมีจริง notReady กลายเป็น false เอง หน้านี้หายไปโดยไม่ต้องแก้โค้ด
  if (notReady) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-8 pb-12 pt-6 text-center font-body text-[#831843]">
        {/* ผีกับป้ายยืนอยู่บนเส้นพื้นเดียวกัน — items-end + origin-bottom กันไม่ให้ผีลอยสูงกว่าป้าย
            (GhostMascot ย่อด้วย h-/w- ไม่ได้ ต้องใช้ scale เท่านั้น) */}
        <div className="flex items-end justify-center gap-1">
          <GhostMascot mood="building" className="origin-bottom scale-[.68]" />
          <ConstructionSign />
        </div>

        <h1 className="mt-4 font-heading text-xl font-bold">แผนอ่านสอบ</h1>
        <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-[#9D5C7C]">
          บอกแค่วันสอบกับบทที่ต้องอ่าน แล้วให้ลุยเควสจัดตารางอ่านให้เอง
        </p>

        <ul className="mt-5 w-full max-w-[320px] space-y-2 text-left">
          {[
            'แบ่งบทที่ต้องอ่านลงแต่ละวัน จนถึงวันสอบ',
            'ทุกเช้าบอกว่าวันนี้อ่านบทไหน กี่นาที',
            'วันไหนอ่านไม่ทัน เลื่อนตารางให้ใหม่ทั้งแผน',
          ].map((line) => (
            <li
              key={line}
              className="flex min-w-0 items-start gap-2 rounded-2xl border-2 border-[#FBCFE8] bg-white/80 px-3.5 py-2.5 text-[13px] leading-snug"
            >
              <span aria-hidden="true" className="text-[#8B5CF6]">◆</span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs text-[#9D5C7C]">ระหว่างนี้ลุยเควสประจำวันไปก่อนได้เลย</p>
      </div>
    );
  }

  if (loadError && !learningDate) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-8 pb-12 text-center font-body text-[#831843]">
        <GhostMascot mood="sad" className="scale-75" />
        <h1 className="mt-1 font-heading text-xl font-bold">โหลดแผนสอบไม่สำเร็จ</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#9D5C7C]">{loadError}</p>
        <button type="button" onClick={onRetry} className={`${PRIMARY_BUTTON} mt-5 w-full max-w-[260px]`}>ลองโหลดอีกครั้ง</button>
      </div>
    );
  }

  const tabs = [
    { id: "all", label: "ทั้งหมด" },
    { id: "subject", label: "แยกตามวิชา" },
    { id: "daily", label: "แผนรายวัน" },
  ];

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-5 font-body text-[#831843] sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[#9D5C7C]">วันเรียนของระบบ • {formatDate(learningDate)}</p>
            <h1 className="font-heading text-xl font-bold">แผนอ่านสอบ</h1>
          </div>
          <button type="button" onClick={() => setShowCreate((open) => !open)} className={`${SECONDARY_BUTTON} shrink-0 px-3.5`}>
            {showCreate ? "ปิดฟอร์ม" : "+ สร้างแผน"}
          </button>
        </header>

        {loadError && (
          <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
            <span>{loadError} • ข้อมูลด้านล่างอาจยังไม่ล่าสุด</span>
            <button type="button" onClick={onRetry} className="shrink-0 font-bold underline underline-offset-2">ลองใหม่</button>
          </div>
        )}
        {(actionNotice || actionError) && (
          <div aria-live="polite" className={`mt-3 flex items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-xs leading-relaxed ${actionError ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            <span>{actionError ? "⚠️ " : "✓ "}{actionError || actionNotice}</span>
            <button type="button" onClick={onDismissMessage} className="shrink-0 font-bold" aria-label="ปิดข้อความ">×</button>
          </div>
        )}

        {showCreate && (
          <CreatePlanForm
            learningDate={learningDate}
            pending={pendingAction === "create"}
            canCancel={selectablePlans.length > 0}
            onCancel={() => setShowCreate(false)}
            onCreate={onCreate}
            onCreated={() => { setShowCreate(false); setTab("subject"); }}
          />
        )}

        <nav aria-label="มุมมองแผนสอบ" className="mt-4 grid grid-cols-3 rounded-2xl border border-[#FBCFE8] bg-white/70 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`min-w-0 rounded-xl px-1 py-2 text-[11px] font-bold transition ${tab === item.id ? "bg-[#8B5CF6] text-white shadow-[0_5px_12px_rgba(139,92,246,.22)]" : "text-[#9D5C7C]"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "all" && (
          <OverviewTab
            plans={selectablePlans}
            learningDate={learningDate}
            archivedCount={archivedCount}
            onOpenPlan={openPlan}
            onCreate={() => setShowCreate(true)}
            onArchive={setArchiveTarget}
          />
        )}
        {tab === "subject" && (
          <SubjectTab
            plans={selectablePlans}
            selectedPlan={selectedPlan}
            selectedPlanId={selectedPlanId}
            learningDate={learningDate}
            pendingAction={pendingAction}
            onSelectPlan={onSelectPlan}
            onArchive={setArchiveTarget}
            onRequestMove={(plan, item) => setMoveTarget({ plan, item })}
            onRequestDelete={(plan, item) => setDeleteTarget({ plan, item })}
            onComplete={onComplete}
            onCreate={() => setShowCreate(true)}
          />
        )}
        {tab === "daily" && (
          <DailyTab
            plans={activePlans}
            learningDate={learningDate}
            pendingAction={pendingAction}
            missedCount={missedEntries.length}
            onReviewMissed={() => setDismissedMissedId(null)}
            onRequestMove={(plan, item) => setMoveTarget({ plan, item })}
            onRequestDelete={(plan, item) => setDeleteTarget({ plan, item })}
            onComplete={onComplete}
            onCreate={() => setShowCreate(true)}
          />
        )}
      </div>

      {moveTarget && (
        <MoveDialog
          key={moveTarget.item.id}
          plan={moveTarget.plan}
          item={moveTarget.item}
          learningDate={learningDate}
          pendingAction={pendingAction}
          onMove={onMove}
          onClose={() => setMoveTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="ลบวันอ่านนี้?"
          copy={`${deleteTarget.plan.title} • ${formatWeekday(deleteTarget.item.scheduled_date)} ${formatDate(deleteTarget.item.scheduled_date)}`}
          warning="หัวข้อและนาทีของวันนี้จะถูกลบออกถาวร โดยระบบจะไม่ย้ายหรือกระจายเนื้อหาให้อัตโนมัติ"
          confirmLabel="ลบวันอ่าน"
          pending={pendingAction === `delete:${deleteTarget.item.id}`}
          danger
          onConfirm={() => onDelete(deleteTarget.item.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {archiveTarget && (
        <ConfirmDialog
          title="เก็บแผนเข้าคลัง?"
          copy={archiveTarget.title}
          warning="แผนจะหายจากมุมมองที่ใช้งานและนำกลับมาไม่ได้ในเวอร์ชันนี้ แต่ประวัติวันที่ทำและ XP ที่เคยได้จะยังอยู่"
          confirmLabel="เก็บเข้าคลัง"
          pending={pendingAction === `archive:${archiveTarget.id}`}
          onConfirm={() => onArchive(archiveTarget.id)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
      {missed && dismissedMissedId !== missed.item.id && (
        <MissedDialog
          key={missed.item.id}
          plan={missed.plan}
          item={missed.item}
          pendingAction={pendingAction}
          actionError={actionError}
          onResolve={onResolveMissed}
          onDismiss={() => setDismissedMissedId(missed.item.id)}
        />
      )}
    </div>
  );
}
