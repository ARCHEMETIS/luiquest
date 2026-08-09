import { useCallback, useEffect, useRef, useState } from 'react';
import ExamPlanPage from '../components/ExamPlanPage.jsx';
import { useProfile } from '../hooks/useProfile.jsx';
import { supabase } from '../lib/supabaseClient.js';

const RPC_ERROR_COPY = [
  ['EXAM_PLAN_RESPONSE_INVALID', 'ข้อมูลแผนสอบที่ได้รับมาไม่ครบ กรุณาลองโหลดใหม่'],
  ['AUTH_REQUIRED', 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง'],
  ['PROFILE_NOT_FOUND', 'ไม่พบโปรไฟล์ผู้เรียน กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่'],
  ['INVALID_EXAM_TITLE', 'ชื่อวิชา/การสอบต้องมี 1–120 ตัวอักษร'],
  ['INVALID_EXAM_DATE', 'วันสอบต้องอยู่หลังวันเรียนวันนี้'],
  ['INVALID_EXAM_MINUTES', 'เวลาอ่านต่อวันต้องเป็น 15–180 นาที และเพิ่มทีละ 15 นาที'],
  ['INVALID_EXAM_TOPICS', 'กรุณาใส่หัวข้อ 1–100 หัวข้อ โดยหนึ่งบรรทัดเป็นหนึ่งหัวข้อ'],
  ['EXAM_TOPIC_TOO_LONG', 'แต่ละหัวข้อต้องยาวไม่เกิน 200 ตัวอักษร'],
  ['EXAM_PLAN_LIMIT', 'สร้างแผนได้สูงสุด 20 แผน — เก็บแผนเก่าเข้าคลังก่อน'],
  ['EXAM_PLAN_TOPICS_IMMUTABLE', 'หัวข้อของแผนที่สร้างแล้วแก้ไม่ได้ กรุณาสร้างแผนใหม่แทน'],
  ['EXAM_PLAN_ARCHIVED', 'แผนนี้อยู่ในคลังแล้ว จึงแก้ตารางอ่านไม่ได้'],
  ['EXAM_PLAN_NOT_FOUND', 'ไม่พบแผนสอบนี้แล้ว กรุณาโหลดรายการใหม่'],
  ['EXAM_PLAN_ITEM_DATE_OUT_OF_RANGE', 'วันที่อ่านต้องอยู่ตั้งแต่วันเริ่มแผนและก่อนวันสอบ'],
  ['EXAM_PLAN_ITEM_TOPIC_OUT_OF_RANGE', 'หัวข้อของวันนี้ไม่ตรงกับแผน กรุณาโหลดรายการใหม่'],
  ['EXAM_PLAN_ITEM_MINUTES_INVALID', 'เวลาของหัวข้อในวันนี้ไม่ถูกต้อง กรุณาโหลดรายการใหม่'],
  ['EXAM_PLAN_ITEM_MINUTES_MISMATCH', 'เวลารวมของวันนี้ไม่ตรงกับรายการหัวข้อ กรุณาโหลดรายการใหม่'],
  ['INVALID_CONFLICT_ACTION', 'ตัวเลือกจัดการวันที่ซ้ำไม่ถูกต้อง กรุณาลองย้ายวันใหม่'],
  ['EXAM_PLAN_ITEM_NOT_MOVABLE', 'ย้ายวันนี้ไม่ได้ เพราะวันผ่านไปแล้วหรือรายการไม่ได้รออ่านอยู่'],
  ['EXAM_PLAN_MOVE_DATE_OUT_OF_RANGE', 'วันใหม่ต้องไม่ก่อนวันเรียนวันนี้และต้องอยู่ก่อนวันสอบ'],
  ['EXAM_PLAN_ITEM_NOT_DELETABLE', 'ลบวันนี้ไม่ได้ เพราะรายการเปลี่ยนสถานะหรือแผนสิ้นสุดแล้ว'],
  ['INVALID_MISSED_DAY_ACTION', 'ตัวเลือกจัดการวันที่ขาดไม่ถูกต้อง กรุณาลองอีกครั้ง'],
  ['EXAM_PLAN_ITEM_NOT_MISSED', 'วันนี้ไม่ได้ค้างแล้ว กรุณาโหลดตารางล่าสุด'],
  ['EXAM_PLAN_ITEM_NOT_COMPLETABLE', 'ทำเครื่องหมายวันนี้ไม่ได้ ต้องเป็นรายการของวันเรียนวันนี้ที่ยังรออ่านอยู่'],
  ['EXAM_PLAN_ITEM_CHANGED', 'รายการวันนี้เพิ่งเปลี่ยนจากอีกหน้าจอ กรุณาโหลดใหม่แล้วลองอีกครั้ง'],
  ['EXAM_PLAN_ITEM_NOT_FOUND', 'ไม่พบวันอ่านนี้แล้ว กรุณาโหลดตารางล่าสุด'],
];

const RESULT_ERROR_COPY = {
  DATE_OCCUPIED_TERMINAL: 'วันนั้นมีรายการที่ทำเสร็จหรือข้ามแล้ว จึงย้ายไปทับไม่ได้',
  RESCHEDULE_DOES_NOT_FIT: 'เลื่อนไม่ได้ เพราะวันสุดท้ายจะชนวันสอบ กรุณาข้ามวันนี้ หรือลบ/ย้ายวันอื่นด้วยตัวเอง',
};

function rpcErrorMessage(error, fallback) {
  const detail = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(' ');
  const match = RPC_ERROR_COPY.find(([code]) => detail.includes(code));
  return match?.[1] || fallback;
}

function resultErrorMessage(code, fallback) {
  return RESULT_ERROR_COPY[code] || fallback;
}

export default function Plan() {
  const { patchProfile } = useProfile();
  const [state, setState] = useState({ plans: [], learningDate: null, loading: true, error: null });
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [actionState, setActionState] = useState({ pending: null, error: null, notice: null });
  const requestNumber = useRef(0);
  const pendingAction = useRef(null);

  const loadPlans = useCallback(async ({ showLoading = false } = {}) => {
    const request = ++requestNumber.current;
    if (showLoading) setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const { data, error } = await supabase.rpc('list_exam_plans');
      if (error) throw error;
      if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.learning_date) || !Array.isArray(data.plans)) {
        throw new Error('EXAM_PLAN_RESPONSE_INVALID');
      }
      if (request !== requestNumber.current) return false;
      setState({ plans: data.plans, learningDate: data.learning_date, loading: false, error: null });
      return true;
    } catch (error) {
      if (request !== requestNumber.current) return false;
      setState((current) => ({
        ...current,
        loading: false,
        error: rpcErrorMessage(error, 'โหลดแผนสอบไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่'),
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    loadPlans({ showLoading: true });
    return () => {
      requestNumber.current += 1;
    };
  }, [loadPlans]);

  useEffect(() => {
    const selectable = state.plans.filter((plan) => plan.status !== 'archived');
    setSelectedPlanId((current) => (
      selectable.some((plan) => plan.id === current)
        ? current
        : selectable.find((plan) => plan.status === 'active')?.id ?? selectable[0]?.id ?? null
    ));
  }, [state.plans]);

  const beginAction = (key) => {
    if (pendingAction.current) return false;
    pendingAction.current = key;
    setActionState({ pending: key, error: null, notice: null });
    return true;
  };

  const finishAction = ({ error = null, notice = null } = {}) => {
    pendingAction.current = null;
    setActionState({ pending: null, error, notice });
  };

  const busyResult = () => ({ ok: false, message: 'กำลังบันทึกรายการก่อนหน้าอยู่ รอสักครู่แล้วลองอีกครั้ง' });

  const createPlan = async (input) => {
    if (!beginAction('create')) return busyResult();
    try {
      const { data, error } = await supabase.rpc('create_exam_plan', {
        p_title: input.title,
        p_exam_date: input.examDate,
        p_minutes_per_day: input.minutesPerDay,
        p_topics: input.topics,
        p_accept_overload: input.acceptOverload,
      });
      if (error) throw error;
      if (!data?.created) {
        finishAction();
        if (data?.code === 'PLAN_OVER_CAPACITY') return { ok: false, ...data };
        const message = resultErrorMessage(data?.code, 'ฐานข้อมูลยังไม่สร้างแผน กรุณาตรวจข้อมูลแล้วลองใหม่');
        finishAction({ error: message });
        return { ok: false, message };
      }

      await loadPlans();
      setSelectedPlanId(data.plan?.id ?? null);
      finishAction({ notice: `สร้างแผน “${data.plan?.title || input.title}” เรียบร้อยแล้ว` });
      return { ok: true, planId: data.plan?.id ?? null };
    } catch (error) {
      const message = rpcErrorMessage(error, 'สร้างแผนอ่านสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      finishAction({ error: message });
      return { ok: false, message };
    }
  };

  const completeItem = async (itemId) => {
    if (!beginAction(`complete:${itemId}`)) return busyResult();
    try {
      const { data, error } = await supabase.rpc('complete_exam_plan_item', { p_item_id: itemId });
      if (error) throw error;
      if (!data || typeof data.xp_earned !== 'number') throw new Error('EXAM_PLAN_RESPONSE_INVALID');

      patchProfile({
        ...(typeof data.total_xp === 'number' ? { total_xp: data.total_xp } : {}),
        ...(typeof data.current_streak === 'number' ? { current_streak: data.current_streak } : {}),
        ...(typeof data.longest_streak === 'number' ? { longest_streak: data.longest_streak } : {}),
        ...(data.last_quest_date ? { last_quest_date: data.last_quest_date } : {}),
      });
      await loadPlans();

      let notice;
      if (data.already_completed) {
        notice = 'วันนี้ถูกบันทึกว่าทำเสร็จไว้แล้ว ไม่มีการให้ XP ซ้ำ';
      } else if (data.study_xp_limit_reached) {
        notice = `บันทึกว่าทำเสร็จแล้ว • วันนี้รับ XP จากแผนสอบครบ 3 วันแล้ว • streak ${data.current_streak} วัน`;
      } else {
        notice = `ทำวันนี้เสร็จแล้ว +${data.xp_earned} XP • streak ${data.current_streak} วัน${data.streak_frozen ? ' • ใช้สิทธิ์รักษา streak แล้ว' : ''}`;
      }
      if (data.plan_finished) notice += ' • แผนนี้ครบแล้ว 🎉';
      finishAction({ notice });
      return { ok: true, ...data };
    } catch (error) {
      const message = rpcErrorMessage(error, 'บันทึกว่าวันนี้ทำเสร็จไม่สำเร็จ กรุณาลองใหม่');
      finishAction({ error: message });
      return { ok: false, message };
    }
  };

  const moveItem = async (itemId, scheduledDate, conflictAction = 'reject') => {
    if (!beginAction(`move:${itemId}`)) return busyResult();
    try {
      const { data, error } = await supabase.rpc('move_exam_plan_day', {
        p_item_id: itemId,
        p_scheduled_date: scheduledDate,
        p_conflict_action: conflictAction,
      });
      if (error) throw error;
      if (!data?.moved) {
        finishAction();
        if (data?.code === 'DATE_OCCUPIED') return { ok: false, conflict: data.code, ...data };
        const message = resultErrorMessage(data?.code, 'ย้ายวันนี้ไม่สำเร็จ กรุณาเลือกวันอื่น');
        finishAction({ error: message });
        return { ok: false, message, code: data?.code };
      }

      await loadPlans();
      const notice = data.swapped ? 'ย้ายและสลับสองวันเรียบร้อยแล้ว' : 'ย้ายวันอ่านเรียบร้อยแล้ว';
      finishAction({ notice });
      return { ok: true, ...data };
    } catch (error) {
      const message = rpcErrorMessage(error, 'ย้ายวันอ่านไม่สำเร็จ กรุณาลองใหม่');
      finishAction({ error: message });
      return { ok: false, message };
    }
  };

  const deleteItem = async (itemId) => {
    if (!beginAction(`delete:${itemId}`)) return busyResult();
    try {
      const { data, error } = await supabase.rpc('delete_exam_plan_day', { p_item_id: itemId });
      if (error) throw error;
      if (!data?.deleted) throw new Error('EXAM_PLAN_RESPONSE_INVALID');
      await loadPlans();
      finishAction({ notice: `ลบวันอ่านแล้ว${data.plan_finished ? ' • แผนนี้ไม่มีวันที่รออ่านเหลือแล้ว' : ''}` });
      return { ok: true, ...data };
    } catch (error) {
      const message = rpcErrorMessage(error, 'ลบวันอ่านไม่สำเร็จ กรุณาลองใหม่');
      finishAction({ error: message });
      return { ok: false, message };
    }
  };

  const resolveMissedItem = async (itemId, action) => {
    if (!beginAction(`missed:${itemId}`)) return busyResult();
    try {
      const { data, error } = await supabase.rpc('resolve_missed_exam_day', {
        p_item_id: itemId,
        p_action: action,
      });
      if (error) throw error;
      if (!data?.resolved) {
        const message = resultErrorMessage(data?.code, 'จัดการวันที่ขาดไม่สำเร็จ กรุณาลองอีกครั้ง');
        finishAction({ error: message });
        return { ok: false, message, code: data?.code };
      }

      await loadPlans();
      const notice = action === 'shift'
        ? `เลื่อนแผนที่เหลือออกไป ${data.delta_days} วันเรียบร้อยแล้ว`
        : `ข้ามวันที่ค้างแล้ว${data.plan_finished ? ' • แผนนี้ครบแล้ว' : ''}`;
      finishAction({ notice });
      return { ok: true, ...data };
    } catch (error) {
      const message = rpcErrorMessage(error, 'จัดการวันที่ขาดไม่สำเร็จ กรุณาลองอีกครั้ง');
      finishAction({ error: message });
      return { ok: false, message };
    }
  };

  const archivePlan = async (planId) => {
    if (!beginAction(`archive:${planId}`)) return busyResult();
    try {
      const { data, error } = await supabase.rpc('archive_exam_plan', { p_plan_id: planId });
      if (error) throw error;
      if (!data?.archived) throw new Error('EXAM_PLAN_RESPONSE_INVALID');
      await loadPlans();
      finishAction({ notice: data.already_archived ? 'แผนนี้อยู่ในคลังแล้ว' : 'เก็บแผนเข้าคลังเรียบร้อยแล้ว' });
      return { ok: true, ...data };
    } catch (error) {
      const message = rpcErrorMessage(error, 'เก็บแผนเข้าคลังไม่สำเร็จ กรุณาลองใหม่');
      finishAction({ error: message });
      return { ok: false, message };
    }
  };

  return (
    <ExamPlanPage
      plans={state.plans}
      learningDate={state.learningDate}
      loading={state.loading}
      loadError={state.error}
      selectedPlanId={selectedPlanId}
      pendingAction={actionState.pending}
      actionError={actionState.error}
      actionNotice={actionState.notice}
      onSelectPlan={setSelectedPlanId}
      onRetry={() => loadPlans({ showLoading: true })}
      onDismissMessage={() => setActionState((current) => ({ ...current, error: null, notice: null }))}
      onCreate={createPlan}
      onComplete={completeItem}
      onMove={moveItem}
      onDelete={deleteItem}
      onResolveMissed={resolveMissedItem}
      onArchive={archivePlan}
    />
  );
}
