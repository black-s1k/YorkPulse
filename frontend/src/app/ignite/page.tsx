import Link from "next/link";
import { IGNITE_TEAMS } from "@/components/ignite/teams";

export default function IgniteHome() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IGNITE_TEAMS.map((team) => {
          const Icon = team.icon;
          return (
            <Link
              key={team.slug}
              href={team.href}
              className="rounded-lg border border-gray-200 p-5 transition-colors hover:border-gray-400"
            >
              <Icon className="h-5 w-5 text-gray-700" />
              {team.group && (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">{team.group}</p>
              )}
              <h2 className={team.group ? "font-semibold text-gray-900" : "mt-3 font-semibold text-gray-900"}>
                {team.name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{team.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
