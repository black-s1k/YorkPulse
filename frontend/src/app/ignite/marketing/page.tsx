import type { Metadata } from "next";
import { TeamPage } from "@/components/ignite/TeamPage";
import { getTeam } from "@/components/ignite/teams";

export const metadata: Metadata = { title: "Marketing" };

export default function MarketingPage() {
  return <TeamPage team={getTeam("marketing")} />;
}
