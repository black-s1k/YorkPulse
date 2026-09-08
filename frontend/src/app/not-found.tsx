import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
          <SearchX className="w-8 h-8 text-purple-700" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Page not found</h2>
          <p className="text-gray-500">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Button asChild className="bg-purple-600 hover:bg-purple-700">
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
