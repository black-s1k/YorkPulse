import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-100", className)}
    >
      <div className={cn("h-full rounded-full transition-all", barClassName ?? "bg-blue-500")} style={{ width: `${value}%` }} />
    </div>
  );
}
