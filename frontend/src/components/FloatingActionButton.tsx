"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/stores/ui";

const pageConfig: Record<string, { label: string; type: "vault" | "marketplace" | "quest" }> = {
  "/vault": { label: "New Post", type: "vault" },
  "/marketplace": { label: "New Listing", type: "marketplace" },
  "/quests": { label: "New Quest", type: "quest" },
};

export function FloatingActionButton() {
  const pathname = usePathname();
  const { openCreateModal } = useUIStore();

  // Get the base path (e.g., /vault/123 -> /vault)
  const basePath = "/" + (pathname.split("/")[1] || "");
  const config = pageConfig[basePath];

  // Don't show FAB if not on a configured page or on a detail page
  const isDetailPage = pathname.split("/").filter(Boolean).length > 1;

  if (!config || isDetailPage) {
    return null;
  }

  const handleClick = () => {
    openCreateModal(config.type);
  };

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 17,
        }}
        onClick={handleClick}
        className="fixed bottom-8 right-6 md:right-8 z-40 group"
        aria-label={config.label}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-primary blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />

        {/* Button */}
        <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary hover:bg-york-red-dark shadow-lg shadow-red-300/40 border border-white/20">
          <Plus className="w-6 h-6 text-white" />
        </div>

        {/* Tooltip */}
        <motion.span
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-white backdrop-blur-sm text-gray-700 text-sm font-medium whitespace-nowrap border border-gray-100 shadow-sm pointer-events-none"
        >
          {config.label}
        </motion.span>
      </motion.button>
    </AnimatePresence>
  );
}
