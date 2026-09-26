import { BackToDashboard } from "./BackToDashboard";
import type { IgniteTeam } from "./teams";

// Shared page frame only. Anything team-specific belongs in that team's route folder.
export function TeamPage({ team, children }: { team: IgniteTeam; children?: React.ReactNode }) {
  const Icon = team.icon;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <BackToDashboard />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          <Icon className="h-5 w-5 text-gray-700" />
        </div>
        <div>
          {team.group && (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{team.group}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
        </div>
      </div>
      <div className="mt-6">
        {children ?? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            Nothing here yet.
          </div>
        )}
      </div>
    </div>
  );
}
