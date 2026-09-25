import type { Metadata } from "next";
import { TeamPage } from "@/components/ignite/TeamPage";
import { getTeam } from "@/components/ignite/teams";

export const metadata: Metadata = { title: "Support Management" };

export default function SupportPage() {
  return <TeamPage team={getTeam("support")} />;
}
