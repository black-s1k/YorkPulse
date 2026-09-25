import type { Metadata } from "next";
import { MembersManager } from "@/components/ignite/MembersManager";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return <MembersManager />;
}
