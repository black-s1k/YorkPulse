"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Clock,
  MessageCircle,
  Flag,
  Send,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useVaultPost,
  useVaultComments,
  useCreateVaultComment,
  useDeleteVaultPost,
  useFlagVaultPost,
} from "@/hooks/useVault";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

const categories = [
  { value: "academics", label: "Academics" },
  { value: "social", label: "Social" },
  { value: "housing", label: "Housing" },
  { value: "safety", label: "Safety" },
  { value: "mental_health", label: "Mental Health" },
  { value: "general", label: "General" },
];

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const scale = useRef(1);
  const lastDist = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const translate = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${translate.current.x}px, ${translate.current.y}px) scale(${scale.current})`;
    }
  }, []);

  const resetTransform = useCallback(() => {
    scale.current = 1;
    translate.current = { x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.hypot(dx, dy);
      origin.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist / lastDist.current;
      scale.current = Math.min(Math.max(scale.current * delta, 1), 5);
      lastDist.current = dist;
      applyTransform();
    }
  }, [applyTransform]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) lastDist.current = null;
    if (scale.current <= 1.05) resetTransform();
  }, [resetTransform]);

  // Reset transform on image change
  const handleNavigate = (i: number) => {
    resetTransform();
    onNavigate(i);
  };

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        style={{ zIndex: 10000 }}
        onClick={onClose}
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm font-semibold px-3 py-1 rounded-full"
          style={{ zIndex: 10000 }}
        >
          {index + 1} / {images.length}
        </div>
      )}

      {/* Pinch-zoomable image */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imgRef}
          src={images[index]}
          alt={`Image ${index + 1}`}
          className="max-w-full max-h-full object-contain select-none"
          style={{ transformOrigin: `${origin.current.x}px ${origin.current.y}px`, willChange: "transform", transition: "none" }}
          draggable={false}
        />
      </div>

      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          style={{ zIndex: 10000 }}
          onClick={(e) => { e.stopPropagation(); handleNavigate(index - 1); }}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Next */}
      {index < images.length - 1 && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          style={{ zIndex: 10000 }}
          onClick={(e) => { e.stopPropagation(); handleNavigate(index + 1); }}
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}

export default function VaultPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: post, isLoading: postLoading } = useVaultPost(postId);

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold">The Vault</h1>
            <p className="text-sm text-gray-400">Anonymous community forum</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
            <Shield className="w-10 h-10 text-purple-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to view this post</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Join anonymous discussions with verified York University students.
          </p>
          <Link href="/auth/login">
            <Button className="bg-purple-600 hover:bg-purple-700">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  const { data: commentsData, isLoading: commentsLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVaultComments(postId);
  const createCommentMutation = useCreateVaultComment();
  const deletePostMutation = useDeleteVaultPost();
  const flagPostMutation = useFlagVaultPost();

  const comments = commentsData?.pages.flatMap((page) => page.items) || [];

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        postId,
        data: { content: comment, is_anonymous: isAnonymous },
      });
      setComment("");
      toast({ title: "Comment posted" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post comment",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async () => {
    try {
      if (isAdminUser && user?.id !== post?.author?.id) {
        await api.admin.deleteVaultPost(postId);
      } else {
        await deletePostMutation.mutateAsync(postId);
      }
      toast({ title: "Post deleted" });
      router.push("/vault");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const handleFlagPost = async () => {
    try {
      await flagPostMutation.mutateAsync(postId);
      toast({ title: "Post flagged", description: "Thanks for helping keep the community safe" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to flag post",
        variant: "destructive",
      });
    }
  };

  if (postLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="w-24 h-8 mb-6" />
        <Skeleton className="w-full h-40 mb-6" />
        <Skeleton className="w-full h-32" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl text-center">
        <p className="text-gray-400">Post not found</p>
        <Button variant="link" asChild>
          <Link href="/vault">Back to The Vault</Link>
        </Button>
      </div>
    );
  }

  const isAdminUser = user?.is_admin === true || user?.email?.toLowerCase() === "yorkpulse.app@gmail.com";
  const isAuthor = user?.id === post.author?.id || isAdminUser;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/vault">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Post */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white border border-gray-100 shadow-sm mb-6"
      >
        {/* Author & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              {post.is_anonymous ? (
                <Shield className="w-4 h-4 text-purple-700" />
              ) : (
                <User className="w-4 h-4 text-purple-700" />
              )}
            </div>
            <div>
              <span className="text-sm font-medium">
                {post.is_anonymous ? "Anonymous" : post.author?.name || "Unknown"}
              </span>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {timeAgo(post.created_at)}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && (
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  className="text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              )}
              {!isAuthor && (
                <DropdownMenuItem onClick={handleFlagPost}>
                  <Flag className="w-4 h-4 mr-2" />
                  Report post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <h1 className="text-xl font-bold mb-3">{post.title}</h1>
        <p className="text-gray-700 whitespace-pre-wrap mb-4">{post.content}</p>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto mb-4 scrollbar-hide -mx-6 px-6"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {post.images.map((url, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 cursor-pointer"
                style={{ scrollSnapAlign: "start" }}
                onClick={() => setLightboxIndex(i)}
              >
                <img
                  src={url}
                  alt={`Image ${i + 1}`}
                  className="h-64 w-auto max-w-[85vw] rounded-lg object-cover"
                />
                {post.images!.length > 1 && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {i + 1}/{post.images!.length}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {categories.find((c) => c.value === post.category)?.label || post.category}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <MessageCircle className="w-4 h-4" />
            {post.comment_count} comments
          </div>
        </div>
      </motion.div>

      {/* Comment Form */}
      {isAuthenticated && (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <Textarea
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-3 min-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
              />
              <Label htmlFor="anonymous" className="text-sm text-gray-500 cursor-pointer">
                Post anonymously
              </Label>
            </div>
            <Button
              type="submit"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={createCommentMutation.isPending || !comment.trim()}
            >
              {createCommentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Comment
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && post.images && (
        <Lightbox
          images={post.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Comments</h2>

        {commentsLoading ? (
          <div className="space-y-3">
            <Skeleton className="w-full h-20" />
            <Skeleton className="w-full h-20" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">No comments yet. Be the first to comment!</p>
        ) : (
          <>
            {comments.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-lg bg-white border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  {c.is_anonymous ? (
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-purple-700" />
                    </div>
                  ) : (
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={c.author?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-gray-100 text-gray-500">
                        {c.author?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="text-sm text-gray-500">
                    {c.is_anonymous ? "Anonymous" : c.author?.name || "Unknown"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{c.content}</p>
              </motion.div>
            ))}

            {hasNextPage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Load more comments"
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
