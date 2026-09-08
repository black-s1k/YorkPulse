"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Plus,
  Filter,
  MessageCircle,
  Flag,
  User,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVaultPosts } from "@/hooks/useVault";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { VaultPost } from "@/types";

const categories = [
  { value: "all", label: "All Posts" },
  { value: "academics", label: "Academics" },
  { value: "social", label: "Social" },
  { value: "housing", label: "Housing" },
  { value: "safety", label: "Safety" },
  { value: "mental_health", label: "Mental Health" },
  { value: "general", label: "General" },
];

function PostCard({ post }: { post: VaultPost }) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const hasImages = post.images && post.images.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden">
        <Link href={`/vault/${post.id}`}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Author & Time */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    {post.is_anonymous ? (
                      <Shield className="w-3 h-3 text-primary" />
                    ) : (
                      <User className="w-3 h-3 text-primary" />
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {post.is_anonymous ? "Anonymous" : post.author?.name || "Unknown"}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(post.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold mb-1 line-clamp-2">{post.title}</h3>

                {/* Content Preview */}
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                  {post.content}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {categories.find((c) => c.value === post.category)?.label || post.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <MessageCircle className="w-3 h-3" />
                    {post.comment_count}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Image scroll strip — outside Link so swipe doesn't navigate */}
        {hasImages && (
          <div
            className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide"
            style={{ scrollSnapType: "x mandatory" }}
            onClick={(e) => e.stopPropagation()}
          >
            {post.images!.map((url, i) => (
              <Link key={i} href={`/vault/${post.id}`} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                <div className="relative">
                  <img
                    src={url}
                    alt={`Image ${i + 1}`}
                    className="h-48 w-auto max-w-[240px] rounded-lg object-cover"
                  />
                  {post.images!.length > 1 && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                      {i + 1}/{post.images!.length}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PostSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-24 h-4" />
      </div>
      <Skeleton className="w-3/4 h-5 mb-2" />
      <Skeleton className="w-full h-4 mb-1" />
      <Skeleton className="w-2/3 h-4 mb-3" />
      <Skeleton className="w-20 h-5 rounded-full" />
    </div>
  );
}

export default function VaultPage() {
  const [category, setCategory] = useState<string>("all");
  const { openCreateModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useVaultPosts({
      category: category === "all" ? undefined : category,
      per_page: 20,
    });

  const posts = data?.pages.flatMap((page) => page.items) || [];

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">The Vault</h1>
            <p className="text-sm text-gray-400">Anonymous community forum</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to access The Vault</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Join anonymous discussions with verified York University students.
          </p>
          <Link href="/auth/login">
            <Button className="bg-primary hover:bg-york-red-dark">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">The Vault</h1>
            <p className="text-sm text-gray-400">Anonymous community forum</p>
          </div>
        </div>
        <Button
          onClick={() => openCreateModal("vault")}
          size="sm"
          className="bg-primary hover:bg-york-red-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 mx-auto text-gray-700 mb-4" />
            <p className="text-gray-400">No posts yet</p>
            {isAuthenticated && (
              <Button
                onClick={() => openCreateModal("vault")}
                variant="link"
                className="text-primary"
              >
                Be the first to post
              </Button>
            )}
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {hasNextPage && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
