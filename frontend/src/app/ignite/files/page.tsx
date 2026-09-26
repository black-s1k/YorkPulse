import type { Metadata } from "next";
import { ExternalLink, FolderOpen } from "lucide-react";
import { BackToDashboard } from "@/components/ignite/BackToDashboard";

export const metadata: Metadata = { title: "Files" };

// Main shared Google Drive folder where the club keeps all its docs
const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1jokw_4h7aXtQlhWKM9hx_OWCnhZ7PcxI";

export default function FilesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackToDashboard />
      <h1 className="text-2xl font-bold text-gray-900">Files</h1>
      <p className="mt-1 text-sm text-gray-500">All AI Ignite docs live in the shared Google Drive folder.</p>

      <a
        href={DRIVE_FOLDER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center gap-4 rounded-lg border border-gray-200 p-5 transition-colors hover:border-gray-400"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <FolderOpen className="h-6 w-6 text-gray-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">AI Ignite Drive</p>
          <p className="text-sm text-gray-500">Main folder for all club documents</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-gray-900">
          Open
          <ExternalLink className="h-4 w-4" />
        </span>
      </a>
    </div>
  );
}
