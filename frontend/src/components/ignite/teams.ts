import { Hammer, LifeBuoy, Megaphone, Sparkles, Wallet, type LucideIcon } from "lucide-react";

// AI Ignite club teams. Each team owns its own route folder under
// src/app/ignite/<slug>; put team-specific code in that folder
// (e.g. src/app/ignite/marketing/_components) so teams never touch each other's files.
export type TeamSlug = "marketing" | "spark" | "forge" | "support" | "finance";

export interface IgniteTeam {
  slug: TeamSlug;
  name: string;
  group?: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export const IGNITE_TEAMS: IgniteTeam[] = [
  {
    slug: "marketing",
    name: "Marketing",
    href: "/ignite/marketing",
    description: "Campaigns, socials, and event promotion.",
    icon: Megaphone,
  },
  {
    slug: "spark",
    name: "Spark",
    group: "Tech",
    href: "/ignite/tech/spark",
    description: "Tech team: Spark.",
    icon: Sparkles,
  },
  {
    slug: "forge",
    name: "Forge",
    group: "Tech",
    href: "/ignite/tech/forge",
    description: "Tech team: Forge.",
    icon: Hammer,
  },
  {
    slug: "support",
    name: "Support Management",
    href: "/ignite/support",
    description: "Member support, requests, and operations.",
    icon: LifeBuoy,
  },
  {
    slug: "finance",
    name: "Finance",
    href: "/ignite/finance",
    description: "Budgets, sponsorships, and expenses.",
    icon: Wallet,
  },
];

export function teamLabel(slug: TeamSlug): string {
  const team = getTeam(slug);
  return team.group ? `${team.group} · ${team.name}` : team.name;
}

export function getTeam(slug: TeamSlug): IgniteTeam {
  const team = IGNITE_TEAMS.find((t) => t.slug === slug);
  if (!team) throw new Error(`Unknown AI Ignite team: ${slug}`);
  return team;
}

// Groups a member can belong to: every team, plus Executive (no team page).
export type MemberGroup = TeamSlug | "exec";

export const MEMBER_GROUPS: { slug: MemberGroup; label: string }[] = [
  { slug: "exec", label: "Executive" },
  ...IGNITE_TEAMS.map((t) => ({ slug: t.slug as MemberGroup, label: teamLabel(t.slug) })),
];

export function groupLabel(slug: MemberGroup): string {
  return MEMBER_GROUPS.find((g) => g.slug === slug)?.label ?? slug;
}
