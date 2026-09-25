import type { Metadata } from "next";
import { TaskBoard } from "@/components/ignite/TaskBoard";
import { TeamPage } from "@/components/ignite/TeamPage";
import { getTeam } from "@/components/ignite/teams";

export const metadata: Metadata = { title: "Marketing" };

export default function MarketingPage() {
  return (
    <TeamPage team={getTeam("marketing")}>
      <TaskBoard team="marketing" />
    </TeamPage>
  );
}
