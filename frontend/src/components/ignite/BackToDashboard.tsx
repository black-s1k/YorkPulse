import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToDashboard() {
  return (
    <Link
      href="/ignite"
      className="mb-4 inline-flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-gray-500 hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Dashboard
    </Link>
  );
}
