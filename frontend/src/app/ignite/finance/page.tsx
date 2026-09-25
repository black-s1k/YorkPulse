import type { Metadata } from "next";
import { TaskBoard } from "@/components/ignite/TaskBoard";
import { TeamPage } from "@/components/ignite/TeamPage";
import { getTeam } from "@/components/ignite/teams";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <TeamPage team={getTeam("finance")}>
      <TaskBoard team="finance" />
    </TeamPage>
  );
}
