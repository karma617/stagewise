import { useSyncExternalStore } from 'react';
import type { KartonContract } from '@shared/karton-contracts/ui';

type UserAccountProcedures = KartonContract['serverProcedures']['userAccount'];

export type BatchTaskStatus = Awaited<
  ReturnType<UserAccountProcedures['getBatchTaskStatus']>
>;

export type BatchTaskStartParams = Parameters<
  UserAccountProcedures['autoRegisterBatch']
>[0];

export type BatchTaskProcedures = Pick<
  UserAccountProcedures,
  'autoRegisterBatch' | 'getBatchTaskStatus' | 'cancelBatchTask'
>;

const listeners = new Set<() => void>();

let taskSnapshot: BatchTaskStatus | null = null;
let proceduresSnapshot: BatchTaskProcedures | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function setTaskSnapshot(next: BatchTaskStatus | null) {
  taskSnapshot = next;
  emit();
}

function clearPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollTask(taskId: string) {
  const procedures = proceduresSnapshot;
  if (!procedures || pollInFlight) return;
  pollInFlight = true;
  try {
    const next = await procedures.getBatchTaskStatus(taskId);
    setTaskSnapshot(next);
    if (next.status !== 'running') clearPollTimer();
  } catch {
    // ignore transient poll errors; the next tick may recover.
  } finally {
    pollInFlight = false;
  }
}

function startPolling(taskId: string) {
  clearPollTimer();
  void pollTask(taskId);
  pollTimer = setInterval(() => void pollTask(taskId), 2000);
}

export function subscribeAccountPoolBatchTask(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAccountPoolBatchTaskSnapshot() {
  return taskSnapshot;
}

export function useAccountPoolBatchTask() {
  return useSyncExternalStore(
    subscribeAccountPoolBatchTask,
    getAccountPoolBatchTaskSnapshot,
    getAccountPoolBatchTaskSnapshot,
  );
}

export async function startAccountPoolBatchTask(
  params: BatchTaskStartParams,
  procedures: BatchTaskProcedures,
) {
  proceduresSnapshot = procedures;
  clearPollTimer();
  const { taskId } = await procedures.autoRegisterBatch(params);
  setTaskSnapshot({
    taskId,
    status: 'running',
    total: params.total,
    done: 0,
    failed: 0,
    logs: [],
    emails: [],
  });
  startPolling(taskId);
}

export async function cancelAccountPoolBatchTask() {
  const task = taskSnapshot;
  const procedures = proceduresSnapshot;
  if (!task?.taskId || task.status !== 'running' || !procedures) return;
  await procedures.cancelBatchTask(task.taskId);
  try {
    setTaskSnapshot(await procedures.getBatchTaskStatus(task.taskId));
  } catch {
    setTaskSnapshot({ ...task, status: 'cancelled' });
  } finally {
    clearPollTimer();
  }
}

export function failAccountPoolBatchTask(log: string) {
  clearPollTimer();
  setTaskSnapshot({
    taskId: '',
    status: 'error',
    total: 0,
    done: 0,
    failed: 0,
    logs: [log],
    emails: [],
  });
}

export function dismissAccountPoolBatchTask() {
  if (taskSnapshot?.status === 'running') return;
  clearPollTimer();
  setTaskSnapshot(null);
}
