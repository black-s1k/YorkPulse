import type { Metadata } from "next";
import { TeamPage } from "@/components/ignite/TeamPage";
import { getTeam } from "@/components/ignite/teams";

export const metadata: Metadata = { title: "Spark" };

export default function SparkPage() {
  return <TeamPage team={getTeam("spark")} />;
}
