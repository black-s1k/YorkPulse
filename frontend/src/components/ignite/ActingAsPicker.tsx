"use client";

import { UserCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useActingAs, useIgniteMembers } from "./hooks";

const NOBODY = "__none__";

// Lets whoever is at this device say who they are, so their changes are credited.
export function ActingAsPicker() {
  const { data: members = [] } = useIgniteMembers();
  const { actingAs, setActingAs } = useActingAs();
  const active = members.filter((m) => m.is_active);

  return (
    <Select
      value={actingAs?.id ?? NOBODY}
      onValueChange={(id) => setActingAs(id === NOBODY ? null : members.find((m) => m.id === id) ?? null)}
    >
      <SelectTrigger
        className={cn("h-8 w-[170px] text-sm", !actingAs && "border-amber-300 bg-amber-50 text-amber-800")}
        aria-label="Who are you?"
      >
        <UserCircle className="h-4 w-4 shrink-0" />
        <SelectValue placeholder="Who are you?" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOBODY}>Who are you?</SelectItem>
        {active.map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
        ))}
        {actingAs && !active.some((m) => m.id === actingAs.id) && (
          <SelectItem value={actingAs.id}>{actingAs.name}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
