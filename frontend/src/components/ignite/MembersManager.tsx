"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIgniteMembers, useIgniteTasks, useMemberMutations } from "./hooks";
import { MEMBER_GROUPS, type MemberGroup } from "./teams";
import type { IgniteMember } from "./types";

export function MembersManager() {
  const { data: members = [], isLoading } = useIgniteMembers();
  const { data: tasks = [] } = useIgniteTasks();
  const [dialog, setDialog] = useState<{ open: boolean; member: IgniteMember | null }>({ open: false, member: null });

  const openCount = (id: string) =>
    tasks.filter((t) => t.status !== "done" && t.assignees.some((m) => m.id === id)).length;

  const inactive = members.filter((m) => !m.is_active);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">Everyone who can be assigned tasks. People on two teams show up under both.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, member: null })} className="bg-gray-900 text-white hover:bg-gray-800">
          <Plus className="mr-1 h-4 w-4" />
          Add member
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="mt-8 space-y-8">
          {MEMBER_GROUPS.map((g) => {
            const group = members.filter((m) => m.is_active && m.teams.includes(g.slug));
            return (
              <section key={g.slug}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {g.label} <span className="font-normal">({group.length})</span>
                </h2>
                {group.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-400">No members yet.</p>
                ) : (
                  <MemberList members={group} openCount={openCount} onEdit={(m) => setDialog({ open: true, member: m })} />
                )}
              </section>
            );
          })}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Inactive ({inactive.length})</h2>
              <MemberList members={inactive} openCount={openCount} onEdit={(m) => setDialog({ open: true, member: m })} />
            </section>
          )}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => dialog.member && e.preventDefault()}>
          {dialog.open && (
            <MemberForm key={dialog.member?.id ?? "new"} member={dialog.member} onDone={() => setDialog((d) => ({ ...d, open: false }))} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberList({
  members,
  openCount,
  onEdit,
}: {
  members: IgniteMember[];
  openCount: (id: string) => number;
  onEdit: (m: IgniteMember) => void;
}) {
  return (
    <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
      {members.map((m) => {
        const open = openCount(m.id);
        return (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className={cn("min-w-0", !m.is_active && "opacity-50")}>
              <p className="font-medium text-gray-900">{m.name}</p>
              <p className="truncate text-xs text-gray-500">
                {m.role ?? "Member"}
                {m.is_active && ` · ${open} open task${open === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(m)} aria-label={`Edit ${m.name}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function MemberForm({ member, onDone }: { member: IgniteMember | null; onDone: () => void }) {
  const { create, update } = useMemberMutations();
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [teams, setTeams] = useState<MemberGroup[]>(member?.teams ?? []);
  const saving = create.isPending || update.isPending;

  const toggleTeam = (slug: MemberGroup) =>
    setTeams((t) => (t.includes(slug) ? t.filter((x) => x !== slug) : [...t, slug]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: name.trim(), role: role.trim() || null, teams };
    try {
      if (member) await update.mutateAsync({ id: member.id, data });
      else await create.mutateAsync(data);
      onDone();
    } catch {
      // toast shown by onError
    }
  };

  const toggleActive = async () => {
    if (!member) return;
    try {
      await update.mutateAsync({ id: member.id, data: { is_active: !member.is_active } });
      onDone();
    } catch {
      // toast shown by onError
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{member ? "Edit member" : "Add member"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="member-name">Name</Label>
        <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus={!member} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="member-role">Role</Label>
        <Input id="member-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={100} placeholder="e.g. Finance Lead" />
      </div>
      <div className="space-y-1.5">
        <Label>Teams</Label>
        <div className="flex flex-wrap gap-1.5">
          {MEMBER_GROUPS.map((g) => {
            const on = teams.includes(g.slug);
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => toggleTeam(g.slug)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {teams.length === 0 && <p className="text-xs text-gray-500">Pick at least one.</p>}
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        {member ? (
          <Button type="button" variant="ghost" onClick={toggleActive} disabled={saving} className="text-gray-600">
            {member.is_active ? "Deactivate" : "Reactivate"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          <Button type="submit" disabled={saving || !name.trim() || teams.length === 0} className="bg-gray-900 text-white hover:bg-gray-800">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {member ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}
