"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./ProgressBar";
import { groupLabel, teamLabel } from "./teams";
import { formatDue, isOverdue, priorityMeta, statusMeta, type IgniteTask } from "./types";

export function TaskCard({ task, showTeam, onOpen }: { task: IgniteTask; showTeam?: boolean; onOpen: () => void }) {
  const overdue = isOverdue(task);
  const priority = priorityMeta(task.priority);
  const status = statusMeta(task.status);

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-400"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900 break-words">{task.title}</p>
        {task.priority !== "medium" && (
          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-medium", priority.className)}>
            {priority.label}
          </span>
        )}
      </div>
      {showTeam && <p className="mt-0.5 text-xs text-gray-500">{teamLabel(task.team)}</p>}

      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={task.progress} barClassName={status.bar} />
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-500">{task.progress}%</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 flex-wrap gap-1">
          {task.assignees.length === 0 ? (
            <span className="text-gray-400">Unassigned</span>
          ) : (
            task.assignees.map((m) => {
              const outside = !m.teams.includes(task.team);
              return (
                <span
                  key={m.id}
                  title={outside ? `${m.name} (${m.teams.map(groupLabel).join(", ")})` : m.name}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-gray-700",
                    outside ? "border border-dashed border-gray-400" : "bg-gray-100",
                    !m.is_active && "line-through opacity-60"
                  )}
                >
                  {m.name}
                </span>
              );
            })
          )}
        </div>
        {task.due_date && (
          <span className={cn("flex shrink-0 items-center gap-1", overdue ? "font-medium text-red-600" : "text-gray-500")}>
            <CalendarDays className="h-3.5 w-3.5" />
            {overdue ? "Overdue · " : ""}
            {formatDue(task.due_date)}
          </span>
        )}
      </div>
      {task.created_by && <p className="mt-2 text-xs text-gray-400">Created by {task.created_by}</p>}
    </button>
  );
}
