"use client";

import { ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MEMBER_GROUPS, teamLabel, type MemberGroup, type TeamSlug } from "./teams";
import type { IgniteMember } from "./types";

interface AssigneePickerProps {
  members: IgniteMember[];
  team: TeamSlug;
  selected: string[];
  onChange: (ids: string[]) => void;
}

// Two dropdowns: people on the task's team, and everyone else (for when
// another team, or an exec, is helping out).
export function AssigneePicker({ members, team, selected, onChange }: AssigneePickerProps) {
  const inTeam = members.filter((m) => m.teams.includes(team));
  const outside = members.filter((m) => !m.teams.includes(team));

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const chosen = members.filter((m) => selected.includes(m.id));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <MemberDropdown
          label={`${teamLabel(team)} team`}
          empty="No one on this team yet"
          groups={[{ label: null, members: inTeam }]}
          selected={selected}
          onToggle={toggle}
        />
        <MemberDropdown
          label="Other members"
          empty="No other members"
          groups={MEMBER_GROUPS.filter((g) => g.slug !== team).map((g) => ({
            label: g.label,
            // someone on several teams is listed once, under their first group
            members: outside.filter((m) => firstGroup(m, team) === g.slug),
          }))}
          selected={selected}
          onToggle={toggle}
        />
      </div>

      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((m) => {
            const isOutside = !m.teams.includes(team);
            return (
              <span
                key={m.id}
                className={
                  isOutside
                    ? "flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2 py-0.5 text-xs text-gray-700"
                    : "flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                }
              >
                {m.name}
                {isOutside && <span className="text-gray-400">(outside)</span>}
                <button type="button" onClick={() => toggle(m.id)} aria-label={`Remove ${m.name}`} className="text-gray-400 hover:text-gray-700">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function firstGroup(m: IgniteMember, excludeTeam: TeamSlug): MemberGroup | undefined {
  return MEMBER_GROUPS.find((g) => g.slug !== excludeTeam && m.teams.includes(g.slug))?.slug;
}

function MemberDropdown({
  label,
  empty,
  groups,
  selected,
  onToggle,
}: {
  label: string;
  empty: string;
  groups: { label: string | null; members: IgniteMember[] }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const all = groups.flatMap((g) => g.members);
  const count = all.filter((m) => selected.includes(m.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs"
        >
          <span className="truncate">
            {label}
            {count > 0 && <span className="ml-1 text-gray-500">({count})</span>}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
        {all.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-gray-500">{empty}</p>
        ) : (
          groups.map((g, i) =>
            g.members.length === 0 ? null : (
              <div key={g.label ?? i}>
                {g.label && <DropdownMenuLabel className="text-xs text-gray-500">{g.label}</DropdownMenuLabel>}
                {g.members.map((m) => (
                  <DropdownMenuCheckboxItem
                    key={m.id}
                    checked={selected.includes(m.id)}
                    onCheckedChange={() => onToggle(m.id)}
                    onSelect={(e) => e.preventDefault()} // keep open for multi-select
                  >
                    <div className="min-w-0">
                      <p className="truncate">{m.name}</p>
                      {m.role && <p className="truncate text-xs text-gray-500">{m.role}</p>}
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            )
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
