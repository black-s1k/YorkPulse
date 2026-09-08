"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Check,
  CheckCheck,
  Loader2,
  Inbox,
  Clock,
  Sparkles,
  Users,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  MapPin,
  Calendar,
  Send,
  Reply,
  X,
  ChevronRight,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConversations, usePendingRequests } from "@/hooks/useMessaging";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useRealtimeConversations } from "@/hooks/useRealtimeMessages";
import { useMyQuests, useQuest, useQuestMessages, useSendQuestMessage, useQuestParticipants } from "@/hooks/useQuests";
import { useUser } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Conversation, SideQuest, QuestCategory } from "@/types";

// Category config for quest icons
const categoryConfig: Record<QuestCategory, { label: string; icon: typeof Dumbbell; color: string }> = {
  gym: { label: "Gym", icon: Dumbbell, color: "bg-red-500/20 text-red-700" },
  food: { label: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-700" },
  study: { label: "Study", icon: BookOpen, color: "bg-blue-500/20 text-blue-700" },
  game: { label: "Game", icon: Gamepad2, color: "bg-violet-100 text-violet-600" },
  commute: { label: "Commute", icon: Car, color: "bg-green-500/20 text-green-700" },
  custom: { label: "Custom", icon: Sparkles, color: "bg-gray-100 text-gray-500" },
};

function ConversationCard({ conversation, userId }: { conversation: Conversation; userId?: string }) {
  const otherUser = conversation.participants.find((p) => p.id !== userId);

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const isUnread = conversation.unread_count > 0;
  const isPending = conversation.status === "pending";
  const isInitiator = conversation.initiator_id === userId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link href={`/messages/${conversation.id}`}>
        <div
          className={cn(
            "p-4 rounded-2xl border transition-all duration-200 group",
            isUnread
              ? "bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30 shadow-lg shadow-red-500/5"
              : "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/50"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className={cn(
                "w-12 h-12 ring-2 transition-all",
                isUnread ? "ring-red-500/50" : "ring-green-500/30 group-hover:ring-green-500/50"
              )}>
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className={cn(
                  "font-semibold",
                  isUnread
                    ? "bg-gradient-to-br from-red-500/30 to-orange-500/30 text-red-300"
                    : "bg-gradient-to-br from-green-500/30 to-emerald-500/30 text-green-300"
                )}>
                  {otherUser?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </AvatarFallback>
              </Avatar>
              {isUnread && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold shadow-lg shadow-red-500/30"
                >
                  {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium truncate",
                    isUnread && "text-gray-900 font-semibold"
                  )}>
                    {otherUser?.name || "Unknown"}
                  </span>
                  {isPending && isInitiator && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {conversation.last_message_at
                    ? timeAgo(conversation.last_message_at)
                    : ""}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {conversation.last_message && (
                  <>
                    {conversation.last_message.sender_id === userId && (
                      <span className="text-gray-400 flex-shrink-0">
                        {conversation.last_message.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-green-700" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                    <p
                      className={cn(
                        "text-sm truncate",
                        isUnread ? "text-gray-700 font-medium" : "text-gray-400"
                      )}
                    >
                      {conversation.last_message.is_deleted
                        ? "Message deleted"
                        : conversation.last_message.content}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function RequestCard({ conversation, userId }: { conversation: Conversation; userId?: string }) {
  const otherUser = conversation.participants.find((p) => p.id !== userId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link href={`/messages/${conversation.id}`}>
        <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-200 shadow-lg shadow-yellow-500/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-12 h-12 ring-2 ring-yellow-500/50">
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-300 font-semibold">
                  {otherUser?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                <Sparkles className="w-3 h-3 text-black" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate text-yellow-100">
                  {otherUser?.name || "Unknown"}
                </span>
                <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-800 border-yellow-500/30">
                  New Request
                </Badge>
              </div>
              {conversation.last_message && (
                <p className="text-sm text-yellow-200/60 truncate">
                  {conversation.last_message.content}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="w-1/3 h-5 mb-2" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      </div>
    </div>
  );
}

// Quest Chat Dialog for Messages page
function QuestChatDialogInMessages({
  quest,
  isOpen,
  onClose
}: {
  quest: SideQuest;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: user } = useUser();
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messageInput, setMessageInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; content: string } | null>(null);
  const [showQuestInfo, setShowQuestInfo] = useState(false);

  // Fetch fresh quest data
  const { data: freshQuest } = useQuest(quest.id);
  const currentQuest = freshQuest || quest;

  // Fetch participants separately
  const { data: participantsData } = useQuestParticipants(quest.id);
  const participants = participantsData?.items || [];

  const { data: messagesData, fetchNextPage, hasNextPage, isFetchingNextPage } = useQuestMessages(quest.id, isOpen);
  const sendMessageMutation = useSendQuestMessage();

  // Collect all messages and sort by created_at (oldest first for chat display)
  const allMessages = (messagesData?.pages?.flatMap((page) => page.messages) || [])
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && isOpen && !showQuestInfo) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [allMessages.length, isOpen, showQuestInfo]);

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (isOpen && !showQuestInfo) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showQuestInfo]);

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
      // Refocus the input after sending
      inputRef.current?.focus();
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
  const isHost = user?.id === currentQuest.host.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl h-[80vh] max-h-[600px] flex flex-col p-0 gap-0">
        {/* Header - Clickable */}
        <DialogHeader className="px-4 py-3 border-b border-gray-200 shrink-0">
          <DialogTitle asChild>
            <button
              onClick={() => setShowQuestInfo(!showQuestInfo)}
              className="flex items-center gap-3 w-full text-left hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
            >
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", catConfig.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{currentQuest.activity}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 font-normal">
                  <Users className="w-3 h-3" />
                  <span>{currentQuest.current_participants} participants</span>
                  <span className="text-gray-500">•</span>
                  <span className="truncate">{currentQuest.location}</span>
                </div>
              </div>
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                showQuestInfo ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-700"
              )}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </button>
          </DialogTitle>
        </DialogHeader>

        {/* Quest Info Panel */}
        {showQuestInfo ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Quest Details */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quest Details</h3>

              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-violet-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">When</p>
                    <p className="text-gray-900 font-medium">{formatDateTime(currentQuest.start_time)}</p>
                    {currentQuest.end_time && (
                      <p className="text-xs text-gray-400">Until {formatDateTime(currentQuest.end_time)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-700 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Where</p>
                    <p className="text-gray-900 font-medium">{currentQuest.location}</p>
                  </div>
                </div>

                {currentQuest.description && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-gray-700 text-sm">{currentQuest.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="secondary" className={cn("text-xs", catConfig.color)}>
                    {catConfig.label}
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                    {currentQuest.vibe_level.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Participants ({currentQuest.current_participants}/{currentQuest.max_participants})
              </h3>

              <div className="space-y-2">
                {/* Host */}
                <Link
                  href={`/profile/${currentQuest.host.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors group"
                  onClick={() => onClose()}
                >
                  <Avatar className="w-10 h-10 ring-2 ring-blue-500/30">
                    <AvatarImage src={currentQuest.host.avatar_url || undefined} />
                    <AvatarFallback className="bg-violet-100 text-violet-600">
                      {currentQuest.host.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{currentQuest.host.name}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-600 border-violet-200">
                        Host
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">Quest organizer</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-500 transition-colors" />
                </Link>

                {/* Other Participants from API */}
                {participants
                  .filter((p) => p.user.id !== currentQuest.host.id && p.status === "accepted")
                  .map((participant) => (
                    <Link
                      key={participant.user.id}
                      href={`/profile/${participant.user.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors group"
                      onClick={() => onClose()}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={participant.user.avatar_url || undefined} />
                        <AvatarFallback className="bg-gray-200">
                          {participant.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate">{participant.user.name}</span>
                        <p className="text-xs text-gray-400">Participant</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-500 transition-colors" />
                    </Link>
                  ))}

                {/* Empty state for no other participants */}
                {participants.filter((p) => p.user.id !== currentQuest.host.id && p.status === "accepted").length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">No other participants yet</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* Edit Button for Host */}
              {isHost && (
                <Link href={`/quests/${quest.id}/edit`} onClick={() => onClose()}>
                  <Button variant="outline" className="w-full border-gray-200 hover:bg-gray-100 hover:border-zinc-600">
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Quest
                  </Button>
                </Link>
              )}

              {/* View Full Quest Page */}
              <Link href={`/quests/${quest.id}`} onClick={() => onClose()}>
                <Button variant="ghost" className="w-full text-gray-500 hover:text-gray-900 hover:bg-gray-50">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Full Quest Page
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}

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
                        ? "bg-green-600 text-white"
                        : "bg-gray-100"
                    )}
                  >
                    {!isOwnMessage && (
                      <p className="text-xs text-gray-500 mb-0.5">
                        {message.sender.name}
                        {message.sender.id === quest.host.id && (
                          <span className="ml-1 text-green-700">(Host)</span>
                        )}
                      </p>
                    )}
                    {/* Reply Preview */}
                    {message.reply_to && !message.is_deleted && (
                      <div className="mb-1.5 px-2 py-1 rounded border-l-2 border-green-400/50 bg-black/20 text-xs">
                        <p className="text-green-300 font-medium">{message.reply_to.sender.name}</p>
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
                        isOwnMessage ? "text-green-200" : "text-gray-400"
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
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Reply className="w-4 h-4 text-green-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-700">Replying to {replyTo.senderName}</p>
                <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="p-1 hover:bg-gray-50 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white border-gray-100"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              className="bg-green-600 hover:bg-green-700"
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper to get viewed quest timestamps from localStorage
const getViewedQuestTimestamps = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("viewedQuestTimestamps");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Helper to mark a quest as viewed
const markQuestAsViewed = (questId: string) => {
  if (typeof window === "undefined") return;
  try {
    const timestamps = getViewedQuestTimestamps();
    timestamps[questId] = Date.now();
    localStorage.setItem("viewedQuestTimestamps", JSON.stringify(timestamps));
  } catch {
    // Ignore localStorage errors
  }
};

// Quest Chat Card with unread tracking - fetches messages to determine unread status
function QuestChatCardWithUnread({
  quest,
  onOpenChat,
  viewedTimestamp,
  onUnreadCountChange,
}: {
  quest: SideQuest;
  onOpenChat: () => void;
  viewedTimestamp: number | undefined;
  onUnreadCountChange: (questId: string, count: number) => void;
}) {
  const { data: user } = useUser();
  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;

  // Fetch fresh quest data to get updated participant count
  const { data: freshQuest } = useQuest(quest.id);

  // Use fresh data if available, otherwise fall back to prop
  const currentParticipants = freshQuest?.current_participants ?? quest.current_participants;

  // Fetch messages to determine unread count
  const { data: messagesData, fetchNextPage, hasNextPage } = useQuestMessages(quest.id, true);

  // Fetch all pages to ensure we count all messages
  useEffect(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  const allMessages = messagesData?.pages?.flatMap((page) => page.messages) || [];

  // Calculate unread messages from OTHER users since last viewed
  const unreadCount = allMessages.filter((msg) => {
    // Skip if user data not loaded yet
    if (!user?.id) return false;
    // Only count messages from other users
    if (msg.sender.id === user.id) return false;
    // If never viewed, all messages from others are unread
    if (!viewedTimestamp) return true;
    // Check if message is newer than last viewed time (with small buffer for timing issues)
    return new Date(msg.created_at).getTime() > (viewedTimestamp - 1000);
  }).length;

  // Report unread count to parent for badge total
  useEffect(() => {
    onUnreadCountChange(quest.id, unreadCount);
  }, [quest.id, unreadCount, onUnreadCountChange]);

  const isRead = unreadCount === 0;

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <button
        onClick={onOpenChat}
        className={cn(
          "w-full p-4 rounded-2xl border transition-all duration-200 text-left group",
          isRead
            ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/50"
            : "bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30 hover:border-red-500/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center relative", catConfig.color)}>
            <Icon className="w-6 h-6" />
            {!isRead && unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "font-medium truncate",
                isRead ? "text-gray-400" : "text-gray-700"
              )}>
                {quest.activity}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatTime(quest.start_time)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users className={cn("w-3 h-3", isRead ? "text-green-700" : "text-red-700")} />
              <span>{currentParticipants} participants</span>
              <span className="text-gray-500">•</span>
              <MapPin className="w-3 h-3" />
              <span className="truncate">{quest.location}</span>
            </div>
          </div>

          <div className={cn(
            "p-2 rounded-lg transition-colors",
            isRead
              ? "bg-green-500/20 group-hover:bg-green-500/30"
              : "bg-red-500/20 group-hover:bg-red-500/30"
          )}>
            <MessageCircle className={cn("w-5 h-5", isRead ? "text-green-700" : "text-red-700")} />
          </div>
        </div>
      </button>
    </motion.div>
  );
}

export default function MessagesPage() {
  const { isAuthenticated } = useAuthStore();
  const { data: user } = useUser();
  const [selectedQuest, setSelectedQuest] = useState<SideQuest | null>(null);
  const [viewedTimestamps, setViewedTimestamps] = useState<Record<string, number>>({});
  const [questUnreadCounts, setQuestUnreadCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("all");
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(true); // start hidden, reveal after mount
  const { subscribe, isSupported, currentPermission } = usePushNotifications();

  // All hooks must be called before any conditional returns (Rules of Hooks)
  // Real-time subscription for conversations
  useRealtimeConversations(user?.id || null);

  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversations(isAuthenticated);

  const { data: pendingData, isLoading: pendingLoading } = usePendingRequests(isAuthenticated);

  // Fetch user's quest chats (hosted + joined)
  const { data: hostedData, isLoading: loadingHosted } = useMyQuests("host", isAuthenticated);
  const { data: joinedData, isLoading: loadingJoined } = useMyQuests("participant", isAuthenticated);

  // Load viewed timestamps on mount and check notification banner state
  useEffect(() => {
    setViewedTimestamps(getViewedQuestTimestamps());
    // Show banner if notifications are supported, default permission, and not dismissed
    if (isSupported && currentPermission() === "default") {
      const dismissed = localStorage.getItem("push_banner_dismissed");
      if (!dismissed) {
        setNotifBannerDismissed(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback for quest cards to report their unread count
  const handleUnreadCountChange = useCallback((questId: string, count: number) => {
    setQuestUnreadCounts(prev => {
      if (prev[questId] === count) return prev;
      return { ...prev, [questId]: count };
    });
  }, []);

  // Derived state (computed after hooks)
  const hostedQuests = hostedData?.pages?.flatMap((page) => page.items) || [];
  const joinedQuests = joinedData?.pages?.flatMap((page) => page.items) || [];
  const allQuestChats = [...hostedQuests, ...joinedQuests];
  const questsLoading = loadingHosted || loadingJoined;

  const conversations = conversationsData?.pages.flatMap((page) => page.items) || [];
  const pendingRequests = pendingData?.requests || [];

  // Calculate total unread (for future notification feature)
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Calculate total unread quest messages
  const totalUnreadQuestMessages = Object.values(questUnreadCounts).reduce((sum, count) => sum + count, 0);

  // Handle opening a quest chat - marks it as viewed
  const handleOpenQuestChat = (quest: SideQuest) => {
    markQuestAsViewed(quest.id);
    setViewedTimestamps(prev => ({ ...prev, [quest.id]: Date.now() }));
    setSelectedQuest(quest);
  };

  // Auth guard - MUST be after all hooks
  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Messages</h1>
            <p className="text-sm text-gray-400">Your conversations</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
            <MessageCircle className="w-10 h-10 text-blue-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to access Messages</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Chat with verified York University students and manage your conversations.
          </p>
          <Link href="/auth/login">
            <Button className="bg-blue-600 hover:bg-blue-700">
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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-sm text-gray-400">Your private conversations</p>
        </div>
      </div>

      {/* Notification opt-in banner */}
      {!notifBannerDismissed && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <MessageCircle className="w-4 h-4 text-blue-700 shrink-0" />
          <p className="text-sm text-blue-300 flex-1">
            Enable notifications to get alerted when someone messages you.
          </p>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
            onClick={async () => {
              await subscribe();
              setNotifBannerDismissed(true);
              localStorage.setItem("push_banner_dismissed", "true");
            }}
          >
            Enable
          </Button>
          <button
            onClick={() => {
              setNotifBannerDismissed(true);
              localStorage.setItem("push_banner_dismissed", "true");
            }}
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-gray-300"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-4 bg-white border border-gray-100 shadow-sm p-1 rounded-xl">
          <TabsTrigger
            value="all"
            className="flex-1 rounded-lg data-[state=active]:bg-primary/10 transition-all"
          >
            All
            {totalUnread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold"
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </motion.span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="quests"
            className="flex-1 rounded-lg data-[state=active]:bg-primary/10 transition-all relative"
          >
            Quests
            {totalUnreadQuestMessages > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white"
              >
                {totalUnreadQuestMessages > 99 ? "99+" : totalUnreadQuestMessages}
              </motion.span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="flex-1 rounded-lg data-[state=active]:bg-primary/10 transition-all relative"
          >
            Requests
            {pendingRequests.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold"
              >
                {pendingRequests.length}
              </motion.span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-0">
          {conversationsLoading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : conversations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Inbox className="w-10 h-10 text-blue-700" />
              </div>
              <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Start a conversation from a marketplace listing or side quest to connect with other students
              </p>
            </motion.div>
          ) : (
            <>
              {conversations.map((conversation, i) => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ConversationCard conversation={conversation} userId={user?.id} />
                </motion.div>
              ))}

              {hasNextPage && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="text-sm text-gray-400 hover:text-gray-700 transition-colors inline-flex items-center gap-2"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="quests" className="space-y-3 mt-0" forceMount hidden={activeTab !== "quests"}>
          {questsLoading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : allQuestChats.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-10 h-10 text-blue-700" />
              </div>
              <h3 className="text-lg font-medium mb-2">No quest chats yet</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Join or create a Side Quest to start group chatting with other participants
              </p>
            </motion.div>
          ) : (
            allQuestChats.map((quest, i) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <QuestChatCardWithUnread
                  quest={quest}
                  onOpenChat={() => handleOpenQuestChat(quest)}
                  viewedTimestamp={viewedTimestamps[quest.id]}
                  onUnreadCountChange={handleUnreadCountChange}
                />
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-3 mt-0">
          {pendingLoading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : pendingRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-blue-700" />
              </div>
              <h3 className="text-lg font-medium mb-2">No pending requests</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                When someone sends you a message request, it will appear here
              </p>
            </motion.div>
          ) : (
            pendingRequests.map((request, i) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <RequestCard conversation={request} userId={user?.id} />
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Quest Chat Dialog */}
      {selectedQuest && (
        <QuestChatDialogInMessages
          quest={selectedQuest}
          isOpen={!!selectedQuest}
          onClose={() => setSelectedQuest(null)}
        />
      )}
    </div>
  );
}
