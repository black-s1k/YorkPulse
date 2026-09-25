"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useActingAs, useIgniteMembers, useIgniteTasks } from "./hooks";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { IGNITE_TEAMS, teamLabel, type TeamSlug } from "./teams";
import { isOverdue, PRIORITIES, STATUSES, type IgniteTask } from "./types";

const ALL = "all";
const ME = "me";

// Kanban board of tasks by status. With `team` it shows that team only;
// without it, it's the club-wide view with a team filter.
export function TaskBoard({ team }: { team?: TeamSlug }) {
  const { data: tasks = [], isLoading, isError } = useIgniteTasks();
  const { data: members = [] } = useIgniteMembers();
  const { actingAs } = useActingAs();

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [priority, setPriority] = useState<string>(ALL);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; task: IgniteTask | null }>({ open: false, task: null });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const assigneeId = assignee === ME ? actingAs?.id : assignee;
    return tasks.filter((t) => {
      if (team && t.team !== team) return false;
      if (!team && teamFilter !== ALL && t.team !== teamFilter) return false;
      if (assignee !== ALL && !t.assignees.some((m) => m.id === assigneeId)) return false;
      if (priority !== ALL && t.priority !== priority) return false;
      if (overdueOnly && !isOverdue(t)) return false;
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, team, teamFilter, assignee, priority, overdueOnly, search, actingAs]);

  const activeMembers = members.filter((m) => m.is_active);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" className="pl-8" />
        </div>
        {!team && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {IGNITE_TEAMS.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>{teamLabel(t.slug)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Anyone</SelectItem>
            {actingAs && <SelectItem value={ME}>My tasks</SelectItem>}
            {activeMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any priority</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "h-9 rounded-md border px-3 text-sm transition-colors",
            overdueOnly ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          )}
        >
          Overdue only
        </button>
        <Button onClick={() => setDialog({ open: true, task: null })} className="ml-auto bg-gray-900 text-white hover:bg-gray-800">
          <Plus className="mr-1 h-4 w-4" />
          New task
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-red-600">Couldn&apos;t load tasks. Refresh to try again.</p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => {
            const column = visible.filter((t) => t.status === s.value);
            return (
              <section key={s.value} className="rounded-lg bg-gray-50 p-3">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                  {s.label}
                  <span className="font-normal text-gray-400">{column.length}</span>
                </h3>
                <div className="space-y-2">
                  {column.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-400">No tasks</p>
                  ) : (
                    column.map((t) => (
                      <TaskCard key={t.id} task={t} showTeam={!team} onOpen={() => setDialog({ open: true, task: t })} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        task={dialog.task}
        defaultTeam={team ?? (teamFilter !== ALL ? (teamFilter as TeamSlug) : undefined)}
      />
    </div>
  );
}
