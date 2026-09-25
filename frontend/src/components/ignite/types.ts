import type { TeamSlug } from "./teams";

export type TaskStatus = "not_started" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface IgniteMember {
  id: string;
  name: string;
  team: TeamSlug;
  is_active: boolean;
}

export interface IgniteTask {
  id: string;
  title: string;
  description: string | null;
  team: TeamSlug;
  status: TaskStatus;
  progress: number;
  priority: TaskPriority;
  due_date: string | null; // YYYY-MM-DD
  assignees: IgniteMember[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title?: string;
  description?: string | null;
  team?: TeamSlug;
  status?: TaskStatus;
  progress?: number;
  priority?: TaskPriority;
  due_date?: string | null;
  assignee_ids?: string[];
  actor?: string | null;
}

export const STATUSES: { value: TaskStatus; label: string; dot: string; bar: string }[] = [
  { value: "not_started", label: "Not started", dot: "bg-gray-400", bar: "bg-gray-400" },
  { value: "in_progress", label: "In progress", dot: "bg-blue-500", bar: "bg-blue-500" },
  { value: "blocked", label: "Blocked", dot: "bg-amber-500", bar: "bg-amber-500" },
  { value: "done", label: "Finished", dot: "bg-green-500", bar: "bg-green-500" },
];

export const PRIORITIES: { value: TaskPriority; label: string; className: string }[] = [
  { value: "high", label: "High", className: "bg-red-50 text-red-700" },
  { value: "medium", label: "Medium", className: "bg-gray-100 text-gray-700" },
  { value: "low", label: "Low", className: "bg-gray-50 text-gray-500" },
];

export function statusMeta(s: TaskStatus) {
  return STATUSES.find((x) => x.value === s)!;
}

export function priorityMeta(p: TaskPriority) {
  return PRIORITIES.find((x) => x.value === p)!;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isOverdue(task: IgniteTask): boolean {
  return !!task.due_date && task.status !== "done" && task.due_date < todayISO();
}

export function formatDue(due: string): string {
  const [y, m, d] = due.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
