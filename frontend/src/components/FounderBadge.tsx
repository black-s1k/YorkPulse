import { Award } from "lucide-react";

export default function FounderBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: "linear-gradient(135deg, #6d28d9, #0891b2)",
        color: "white",
      }}
      title="Founder — Early member of YorkPulse"
    >
      <Award className="w-3 h-3" />
      Founder
    </span>
  );
}
