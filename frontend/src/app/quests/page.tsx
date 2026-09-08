"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  Sparkles,
  SortAsc,
  CheckCircle,
  Map,
  List,
  FolderOpen,
  MessageCircle,
  Crown,
  ChevronRight,
  Send,
  Reply,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuests, useMyQuests, useJoinQuest, useQuestMessages, useSendQuestMessage } from "@/hooks/useQuests";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { QuestMapWrapper } from "@/components/QuestMapWrapper";
import type { SideQuest, QuestCategory, QuestStatus, VibeLevel } from "@/types";

const categoryConfig: Record<QuestCategory, { label: string; icon: typeof Dumbbell; color: string }> = {
  gym: { label: "Gym", icon: Dumbbell, color: "bg-red-500/20 text-red-700" },
  food: { label: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-700" },
  study: { label: "Study", icon: BookOpen, color: "bg-blue-500/20 text-blue-700" },
  game: { label: "Game", icon: Gamepad2, color: "bg-purple-500/20 text-purple-700" },
  commute: { label: "Commute", icon: Car, color: "bg-primary/10 text-primary" },
  custom: { label: "Custom", icon: Sparkles, color: "bg-zinc-500/20 text-gray-500" },
};

const vibeLevelLabels: Record<VibeLevel, { label: string; emoji: string }> = {
  chill: { label: "Chill", emoji: "😌" },
  intermediate: { label: "Intermediate", emoji: "👍" },
  high_energy: { label: "High Energy", emoji: "⚡" },
  intense: { label: "Intense", emoji: "🔥" },
  custom: { label: "Custom", emoji: "✨" },
};

const statusLabels: Record<QuestStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-primary/10 text-primary" },
  in_progress: { label: "In Progress", color: "bg-blue-500/20 text-blue-700" },
  full: { label: "Full", color: "bg-yellow-500/20 text-yellow-800" },
  completed: { label: "Completed", color: "bg-zinc-500/20 text-gray-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-700" },
};

function QuestCard({ quest, joinedQuestIds, pendingQuestIds }: { quest: SideQuest; joinedQuestIds: Set<string>; pendingQuestIds: Set<string> }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const joinMutation = useJoinQuest();
  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;
  const vibeInfo = vibeLevelLabels[quest.vibe_level];

  const isHost = user?.id === quest.host.id;
  const hasJoined = joinedQuestIds.has(quest.id);
  const hasPending = pendingQuestIds.has(quest.id);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await joinMutation.mutateAsync({ id: quest.id });
      toast({
        title: quest.requires_approval ? "Request sent!" : "Joined!",
        description: quest.requires_approval
          ? "The host will review your request"
          : "You've joined the quest",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join quest",
        variant: "destructive",
      });
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    if (isToday) {
      return `Today at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    if (isTomorrow) {
      return `Tomorrow at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const spotsAvailable = quest.max_participants - quest.current_participants;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Link href={`/quests/${quest.id}`} className="h-full block">
        <div className="h-full flex flex-col p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-green-500/30 transition-all hover:shadow-lg hover:shadow-green-500/5">
          {/* Top Row: Category Badge + Vibe */}
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className={cn("text-xs", catConfig.color)}>
              <Icon className="w-3 h-3 mr-1" />
              {quest.category === "custom" && quest.custom_category
                ? quest.custom_category
                : catConfig.label}
            </Badge>
            <Badge variant="outline" className="text-xs border-gray-200">
              {vibeInfo.emoji} {quest.vibe_level === "custom" && quest.custom_vibe_level
                ? quest.custom_vibe_level
                : vibeInfo.label}
            </Badge>
          </div>

          {/* Activity Title */}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{quest.activity}</h3>

          {/* Description if available */}
          {quest.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{quest.description}</p>
          )}

          {/* Meta Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="truncate">{quest.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{formatTime(quest.start_time)}</span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Bottom Row: Host + Participants */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            {/* Host */}
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={quest.host.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {quest.host.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-400 truncate max-w-[100px]">
                {quest.host.name}
              </span>
              {quest.status === "open" && quest.host.avatar_url && (
                <CheckCircle className="w-3 h-3 text-primary" />
              )}
            </div>

            {/* Participants / Status */}
            <div className="flex items-center gap-2">
              {quest.status === "open" ? (
                <>
                  <div className="flex -space-x-1">
                    {Array.from({ length: Math.min(quest.current_participants, 3) }).map((_, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full bg-zinc-700 border border-gray-200"
                      />
                    ))}
                    {quest.current_participants > 3 && (
                      <div className="w-5 h-5 rounded-full bg-zinc-600 border border-gray-200 flex items-center justify-center text-[8px]">
                        +{quest.current_participants - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {spotsAvailable > 0 ? `${spotsAvailable} spot${spotsAvailable !== 1 ? "s" : ""} left` : "Full"}
                  </span>
                </>
              ) : (
                <Badge variant="secondary" className={cn("text-xs", statusLabels[quest.status].color)}>
                  {statusLabels[quest.status].label}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Button */}
          {isHost ? (
            <Button
              className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
              size="sm"
              onClick={(e) => e.preventDefault()}
            >
              <Users className="w-4 h-4 mr-2" />
              Your Quest
            </Button>
          ) : hasJoined ? (
            <Button
              className="w-full mt-3 bg-zinc-600 hover:bg-zinc-700"
              size="sm"
              onClick={(e) => e.preventDefault()}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Joined
            </Button>
          ) : hasPending ? (
            <Button
              className="w-full mt-3 bg-amber-600/80 hover:bg-amber-700/80"
              size="sm"
              onClick={(e) => e.preventDefault()}
            >
              <Clock className="w-4 h-4 mr-2" />
              Requested
            </Button>
          ) : quest.status === "open" && spotsAvailable > 0 ? (
            <Button
              className="w-full mt-3 bg-primary hover:bg-york-red-dark"
              size="sm"
              onClick={handleJoin}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              {joinMutation.isPending
                ? "Joining..."
                : quest.requires_approval
                ? "Request to Join"
                : "Join Quest"}
            </Button>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}

function QuestSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-20 h-5 rounded-full" />
      </div>
      <Skeleton className="w-3/4 h-6 mb-2" />
      <Skeleton className="w-full h-4 mb-3" />
      <div className="space-y-2 mb-4">
        <Skeleton className="w-1/2 h-4" />
        <Skeleton className="w-2/3 h-4" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-20 h-4" />
      </div>
    </div>
  );
}

// Quest Chat Dialog Component
function QuestChatDialog({
  quest,
  isOpen,
  onClose
}: {
  quest: SideQuest;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [messageInput, setMessageInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; content: string } | null>(null);

  const { data: messagesData, fetchNextPage, hasNextPage, isFetchingNextPage } = useQuestMessages(quest.id, isOpen);
  const sendMessageMutation = useSendQuestMessage();

  // Collect all messages and sort by created_at (oldest first for chat display)
  const allMessages = (messagesData?.pages?.flatMap((page) => page.messages) || [])
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && isOpen) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [allMessages.length, isOpen]);

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      await sendMessageMutation.mutateAsync({
        questId: quest.id,
        content: messageInput.trim(),
        replyToId: replyTo?.id,
      });
      setMessageInput("");
      setReplyTo(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl h-[80vh] max-h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-gray-200 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{quest.activity}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Users className="w-3 h-3" />
                <span>{quest.current_participants} participants</span>
                <span className="text-gray-500">•</span>
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", catConfig.color)}>
                  {quest.category === "custom" && quest.custom_category
                    ? quest.custom_category
                    : catConfig.label}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {/* Load more button */}
          {hasNextPage && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Load earlier messages"
                )}
              </Button>
            </div>
          )}

          {allMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                <p className="text-gray-400 text-sm">
                  No messages yet. Start the conversation!
                </p>
              </div>
            </div>
          ) : (
            allMessages.map((message) => {
              const isOwnMessage = message.sender.id === user?.id;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 group",
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {!isOwnMessage && (
                    <Link href={`/profile/${message.sender.id}`}>
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={message.sender.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                          {message.sender.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-3 py-2 relative",
                      isOwnMessage
                        ? "bg-primary text-white"
                        : "bg-gray-100"
                    )}
                  >
                    {!isOwnMessage && (
                      <p className="text-xs text-gray-500 mb-0.5">
                        {message.sender.name}
                        {message.sender.id === quest.host.id && (
                          <span className="ml-1 text-primary">(Host)</span>
                        )}
                      </p>
                    )}
                    {/* Reply Preview */}
                    {message.reply_to && !message.is_deleted && (
                      <div className="mb-1.5 px-2 py-1 rounded border-l-2 border-primary/30 bg-black/20 text-xs">
                        <p className="text-primary font-medium">{message.reply_to.sender.name}</p>
                        <p className="text-gray-500 line-clamp-1">{message.reply_to.content}</p>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.is_deleted ? (
                        <span className="italic text-gray-400">Message deleted</span>
                      ) : (
                        message.content
                      )}
                    </p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        isOwnMessage ? "text-red-200" : "text-gray-400"
                      )}
                    >
                      {timeAgo(message.created_at)}
                    </p>
                    {/* Reply button */}
                    {!message.is_deleted && (
                      <button
                        onClick={() => setReplyTo({ id: message.id, senderName: message.sender.name, content: message.content })}
                        className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-white/90 hover:bg-white shadow-sm border border-gray-100"
                        title="Reply"
                      >
                        <Reply className="w-3 h-3 text-gray-700" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-200 shrink-0"
        >
          {/* Reply Preview */}
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-green-500/20 rounded-lg">
              <Reply className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary">Replying to {replyTo.senderName}</p>
                <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white border-gray-100"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              className="bg-primary hover:bg-york-red-dark"
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quest Item Component for the sheet
function QuestSheetItem({
  quest,
  isHost,
  isPending,
  onNavigate,
  onOpenChat,
  formatTime,
}: {
  quest: SideQuest;
  isHost?: boolean;
  isPending?: boolean;
  onNavigate: () => void;
  onOpenChat: () => void;
  formatTime: (date: string) => string;
}) {
  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        isPending
          ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40"
          : "bg-white border-gray-100 hover:border-green-500/30"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Main clickable area - navigates to quest */}
        <button
          onClick={onNavigate}
          className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className={cn("text-xs", catConfig.color)}>
              <Icon className="w-3 h-3 mr-1" />
              {quest.category === "custom" && quest.custom_category
                ? quest.custom_category
                : catConfig.label}
            </Badge>
            {isHost && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-800 text-xs">
                Host
              </Badge>
            )}
            {isPending && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-xs">
                Pending
              </Badge>
            )}
          </div>
          <p className="font-medium truncate">{quest.activity}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatTime(quest.start_time)}
            </span>
            {!isPending && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {quest.current_participants}/{quest.max_participants}
              </span>
            )}
          </div>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Chat button - only for hosted/joined quests, not pending */}
          {!isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat();
              }}
              className="p-2 rounded-lg bg-primary/10 hover:bg-primary/10 text-primary transition-colors"
              title="Open chat"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          {/* Navigate button */}
          <button
            onClick={onNavigate}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isPending
                ? "hover:bg-amber-500/20 text-gray-400 hover:text-amber-400"
                : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
            )}
            title="View details"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MyQuestsSheet() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [chatQuest, setChatQuest] = useState<SideQuest | null>(null);

  // Fetch hosted quests
  const { data: hostedData, isLoading: loadingHosted } = useMyQuests("host");
  const hostedQuests = hostedData?.pages?.flatMap((page) => page.items) || [];

  // Fetch joined quests (accepted participant)
  const { data: joinedData, isLoading: loadingJoined } = useMyQuests("participant");
  const joinedQuests = joinedData?.pages?.flatMap((page) => page.items) || [];

  // Fetch pending requests
  const { data: pendingData, isLoading: loadingPending } = useMyQuests("pending");
  const pendingQuests = pendingData?.pages?.flatMap((page) => page.items) || [];

  const isLoading = loadingHosted || loadingJoined || loadingPending;
  const totalQuests = hostedQuests.length + joinedQuests.length + pendingQuests.length;

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    if (isToday) {
      return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    if (isTomorrow) {
      return `Tomorrow, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleQuestNavigate = (questId: string) => {
    setIsOpen(false);
    router.push(`/quests/${questId}`);
  };

  const handleOpenChat = (quest: SideQuest) => {
    setChatQuest(quest);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-green-500/30 hover:bg-primary/10"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            My Quests
            {totalQuests > 0 && (
              <Badge variant="secondary" className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5">
                {totalQuests}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              My Quests
            </SheetTitle>
            <SheetDescription>
              Click the chat icon to open group chat, or the arrow to view quest details.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                  <Skeleton className="w-3/4 h-5 mb-2" />
                  <Skeleton className="w-1/2 h-4" />
                </div>
              ))}
            </div>
          ) : totalQuests === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-700 mb-3" />
              <p className="text-gray-400 mb-1">No quests yet</p>
              <p className="text-sm text-gray-500">
                Create or join a quest to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Hosted Quests */}
              {hostedQuests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-800" />
                    Hosting ({hostedQuests.length})
                  </h3>
                  <div className="space-y-2">
                    {hostedQuests.map((quest) => (
                      <QuestSheetItem
                        key={quest.id}
                        quest={quest}
                        isHost
                        onNavigate={() => handleQuestNavigate(quest.id)}
                        onOpenChat={() => handleOpenChat(quest)}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Joined Quests */}
              {joinedQuests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Joined ({joinedQuests.length})
                  </h3>
                  <div className="space-y-2">
                    {joinedQuests.map((quest) => (
                      <QuestSheetItem
                        key={quest.id}
                        quest={quest}
                        onNavigate={() => handleQuestNavigate(quest.id)}
                        onOpenChat={() => handleOpenChat(quest)}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Requests */}
              {pendingQuests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Pending ({pendingQuests.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingQuests.map((quest) => (
                      <QuestSheetItem
                        key={quest.id}
                        quest={quest}
                        isPending
                        onNavigate={() => handleQuestNavigate(quest.id)}
                        onOpenChat={() => {}}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Chat Dialog */}
      {chatQuest && (
        <QuestChatDialog
          quest={chatQuest}
          isOpen={!!chatQuest}
          onClose={() => setChatQuest(null)}
        />
      )}
    </>
  );
}

export default function QuestsPage() {
  const [category, setCategory] = useState<QuestCategory | "all">("all");
  const [status, setStatus] = useState<QuestStatus | "all">("open");
  const [sortBy, setSortBy] = useState<"newest" | "starting_soon" | "most_spots">("starting_soon");
  const [viewMode, setViewMode] = useState<"list" | "map">("map");
  const { openCreateModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useQuests({
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
    sort_by: sortBy,
    per_page: 20,
  });

  // Get quests the user has joined (accepted)
  const { data: myQuestsData } = useMyQuests("participant");
  const joinedQuestIds = new Set(
    myQuestsData?.pages.flatMap((page) => page.items.map((q) => q.id)) || []
  );

  // Get quests the user has pending requests for
  const { data: pendingQuestsData } = useMyQuests("pending");
  const pendingQuestIds = new Set(
    pendingQuestsData?.pages.flatMap((page) => page.items.map((q) => q.id)) || []
  );

  const quests = data?.pages.flatMap((page) => page.items) || [];

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Side Quests</h1>
            <p className="text-sm text-gray-400">Find buddies for any activity</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to access Side Quests</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Find gym partners, study buddies, and more with verified York students.
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
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Side Quests</h1>
            <p className="text-sm text-gray-400">Find buddies for any activity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MyQuestsSheet />
          <Button
            onClick={() => openCreateModal("quest")}
            size="sm"
            className="bg-primary hover:bg-york-red-dark"
          >
            <Plus className="w-4 h-4 mr-1" />
            Quest
          </Button>
        </div>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
          </div>

          {/* Category Filter */}
          <Select value={category} onValueChange={(v) => setCategory(v as QuestCategory | "all")}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <config.icon className="w-4 h-4" />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={status} onValueChange={(v) => setStatus(v as QuestStatus | "all")}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort - only show in list view */}
          {viewMode === "list" && (
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-36">
                <SortAsc className="w-4 h-4 mr-1" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starting_soon">Starting Soon</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="most_spots">Most Spots</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-gray-100 shadow-sm">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all",
              viewMode === "list"
                ? "bg-primary/10 text-primary"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all",
              viewMode === "map"
                ? "bg-primary/10 text-primary"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="relative h-[calc(100vh-280px)] min-h-[400px] rounded-xl overflow-hidden border border-gray-100">
          {isLoading ? (
            <div className="w-full h-full bg-white flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <QuestMapWrapper quests={quests} className="w-full h-full" />
          )}

          {/* Quest count overlay */}
          <div className="absolute top-3 left-3 bg-white shadow-sm rounded-lg px-3 py-1.5 border border-gray-100">
            <p className="text-sm">
              <span className="text-primary font-semibold">
                {quests.filter((q) => q.latitude && q.longitude).length}
              </span>
              <span className="text-gray-500"> quests on map</span>
              {quests.some((q) => !q.latitude || !q.longitude) && (
                <span className="text-gray-400 ml-1">
                  ({quests.filter((q) => !q.latitude || !q.longitude).length} without location)
                </span>
              )}
            </p>
          </div>

          {/* Empty state */}
          {quests.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-500 mb-2">No quests on the map yet</p>
                <Button
                  onClick={() => openCreateModal("quest")}
                  className="bg-primary hover:bg-york-red-dark"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Quest
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            <>
              <QuestSkeleton />
              <QuestSkeleton />
              <QuestSkeleton />
              <QuestSkeleton />
            </>
          ) : quests.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 mx-auto text-gray-700 mb-4" />
              <p className="text-gray-400 mb-2">No quests found</p>
              <p className="text-sm text-gray-500 mb-4">Be the first to start a side quest!</p>
              <Button
                onClick={() => openCreateModal("quest")}
                className="bg-primary hover:bg-york-red-dark"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Quest
              </Button>
            </div>
          ) : (
            <>
              {quests.map((quest) => (
                <QuestCard key={quest.id} quest={quest} joinedQuestIds={joinedQuestIds} pendingQuestIds={pendingQuestIds} />
              ))}

              {hasNextPage && (
                <div className="col-span-full text-center pt-4">
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
      )}
    </div>
  );
}
