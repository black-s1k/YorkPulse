import type { Metadata } from "next";
import { TaskBoard } from "@/components/ignite/TaskBoard";
import { TeamPage } from "@/components/ignite/TeamPage";
import { getTeam } from "@/components/ignite/teams";

export const metadata: Metadata = { title: "Forge" };

export default function ForgePage() {
  return (
    <TeamPage team={getTeam("forge")}>
      <TaskBoard team="forge" />
    </TeamPage>
  );
}
