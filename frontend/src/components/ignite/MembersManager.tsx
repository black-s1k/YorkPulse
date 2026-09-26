"use client";

import { useState } from "react";
import { Loader2, Lock, LockOpen, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { BackToDashboard } from "./BackToDashboard";
import { useIgniteMembers, useIgniteTasks, useMemberMutations } from "./hooks";
import { MEMBER_GROUPS, type MemberGroup } from "./teams";
import type { IgniteMember } from "./types";

// Viewing the roster is open; editing needs the members passcode. Once
// entered it's kept for this browser tab only (sessionStorage).
const PASSCODE_KEY = "ignite-members-passcode";

function readPasscode(): string | null {
  try {
    return sessionStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

function writePasscode(value: string | null) {
  try {
    if (value) sessionStorage.setItem(PASSCODE_KEY, value);
    else sessionStorage.removeItem(PASSCODE_KEY);
  } catch {
    // storage unavailable: stays unlocked until the page is left
  }
}

const isWrongPasscode = (e: unknown) => e instanceof Error && /passcode/i.test(e.message);

export function MembersManager() {
  const { data: members = [], isLoading } = useIgniteMembers();
  const { data: tasks = [] } = useIgniteTasks();
  const [dialog, setDialog] = useState<{ open: boolean; member: IgniteMember | null }>({ open: false, member: null });
  // This page only renders after hydration (SandboxGate), so sessionStorage is safe here
  const [passcode, setPasscode] = useState<string | null>(readPasscode);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const unlock = (code: string) => {
    writePasscode(code);
    setPasscode(code);
  };
  const lock = () => {
    writePasscode(null);
    setPasscode(null);
    setDialog((d) => ({ ...d, open: false }));
  };

  const openCount = (id: string) =>
    tasks.filter((t) => t.status !== "done" && t.assignees.some((m) => m.id === id)).length;

  const inactive = members.filter((m) => !m.is_active);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackToDashboard />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">Everyone who can be assigned tasks. People on two teams show up under both.</p>
        </div>
        {passcode ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={lock}>
              <Lock className="mr-1 h-4 w-4" />
              Lock
            </Button>
            <Button onClick={() => setDialog({ open: true, member: null })} className="bg-gray-900 text-white hover:bg-gray-800">
              <Plus className="mr-1 h-4 w-4" />
              Add member
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setUnlockOpen(true)}>
            <LockOpen className="mr-1 h-4 w-4" />
            Edit members
          </Button>
        )}
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
                  <MemberList members={group} openCount={openCount} onEdit={passcode ? (m) => setDialog({ open: true, member: m }) : undefined} />
                )}
              </section>
            );
          })}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Inactive ({inactive.length})</h2>
              <MemberList members={inactive} openCount={openCount} onEdit={passcode ? (m) => setDialog({ open: true, member: m }) : undefined} />
            </section>
          )}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => dialog.member && e.preventDefault()}>
          {dialog.open && passcode && (
            <MemberForm
              key={dialog.member?.id ?? "new"}
              member={dialog.member}
              passcode={passcode}
              onDone={() => setDialog((d) => ({ ...d, open: false }))}
              onWrongPasscode={lock}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent className="sm:max-w-sm">
          {unlockOpen && (
            <UnlockForm
              onUnlocked={(code) => {
                unlock(code);
                setUnlockOpen(false);
              }}
            />
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
  onEdit?: (m: IgniteMember) => void; // omitted while the page is locked
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
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(m)} aria-label={`Edit ${m.name}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MemberForm({
  member,
  passcode,
  onDone,
  onWrongPasscode,
}: {
  member: IgniteMember | null;
  passcode: string;
  onDone: () => void;
  onWrongPasscode: () => void;
}) {
  const { create, update } = useMemberMutations();
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [teams, setTeams] = useState<MemberGroup[]>(member?.teams ?? []);
  const saving = create.isPending || update.isPending;

  const toggleTeam = (slug: MemberGroup) =>
    setTeams((t) => (t.includes(slug) ? t.filter((x) => x !== slug) : [...t, slug]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { passcode, name: name.trim(), role: role.trim() || null, teams };
    try {
      if (member) await update.mutateAsync({ id: member.id, data });
      else await create.mutateAsync(data);
      onDone();
    } catch (e) {
      // toast shown by onError; a changed passcode relocks the page
      if (isWrongPasscode(e)) onWrongPasscode();
    }
  };

  const toggleActive = async () => {
    if (!member) return;
    try {
      await update.mutateAsync({ id: member.id, data: { passcode, is_active: !member.is_active } });
      onDone();
    } catch (e) {
      if (isWrongPasscode(e)) onWrongPasscode();
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

function UnlockForm({ onUnlocked }: { onUnlocked: (passcode: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      await api.ignite.unlockMembers(code.trim());
      onUnlocked(code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the passcode");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Enter passcode</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-gray-500">Anyone can view members. Adding or editing them needs the passcode.</p>
      <div className="space-y-1.5">
        <Label htmlFor="members-passcode">Passcode</Label>
        <Input
          id="members-passcode"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <Button type="submit" disabled={checking || !code.trim()} className="w-full bg-gray-900 text-white hover:bg-gray-800">
        {checking && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        Unlock
      </Button>
    </form>
  );
}
