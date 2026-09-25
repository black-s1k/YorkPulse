"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIgniteMembers, useIgniteTasks, useMemberMutations } from "./hooks";
import { IGNITE_TEAMS, teamLabel, type TeamSlug } from "./teams";

export function MembersManager() {
  const { data: members = [], isLoading } = useIgniteMembers();
  const { data: tasks = [] } = useIgniteTasks();
  const { create, update } = useMemberMutations();
  const [name, setName] = useState("");
  const [team, setTeam] = useState<TeamSlug>("marketing");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ name: name.trim(), team });
      setName("");
    } catch {
      // toast shown by onError
    }
  };

  const openCount = (id: string) =>
    tasks.filter((t) => t.status !== "done" && t.assignees.some((m) => m.id === id)).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Members</h1>
      <p className="mt-1 text-sm text-gray-500">Everyone who can be assigned tasks.</p>

      <form onSubmit={add} className="mt-6 flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" maxLength={100} className="w-full sm:w-64" required />
        <Select value={team} onValueChange={(v) => setTeam(v as TeamSlug)}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {IGNITE_TEAMS.map((t) => (
              <SelectItem key={t.slug} value={t.slug}>{teamLabel(t.slug)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={create.isPending || !name.trim()} className="bg-gray-900 text-white hover:bg-gray-800">
          {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
          Add member
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="mt-8 space-y-8">
          {IGNITE_TEAMS.map((t) => {
            const group = members.filter((m) => m.team === t.slug);
            return (
              <section key={t.slug}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {teamLabel(t.slug)} <span className="font-normal">({group.filter((m) => m.is_active).length})</span>
                </h2>
                {group.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-400">No members yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {group.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <div className={cn(!m.is_active && "opacity-50")}>
                          <p className="font-medium text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-500">
                            {m.is_active ? `${openCount(m.id)} open task${openCount(m.id) === 1 ? "" : "s"}` : "Inactive"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={m.team} onValueChange={(v) => update.mutate({ id: m.id, data: { team: v as TeamSlug } })}>
                            <SelectTrigger className="h-8 w-[170px] text-sm" aria-label={`Team for ${m.name}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {IGNITE_TEAMS.map((x) => (
                                <SelectItem key={x.slug} value={x.slug}>{teamLabel(x.slug)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => update.mutate({ id: m.id, data: { is_active: !m.is_active } })}
                          >
                            {m.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
