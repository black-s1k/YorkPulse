"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  MapPin,
  Calendar,
  Clock,
  MoreHorizontal,
  Trash2,
  UserPlus,
  UserMinus,
  Check,
  X,
  Loader2,
  Zap,
  Edit,
  CheckCircle2,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  Sparkles,
  MessageCircle,
  Send,
  Reply,
} from "lucide-react";
import { QuestLocationMapWrapper } from "@/components/QuestLocationMapWrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useQuest,
  useQuestParticipants,
  useJoinQuest,
  useLeaveQuest,
  useDeleteQuest,
  useCompleteQuest,
  useApproveParticipant,
  useRemoveParticipant,
  useMyQuests,
  useQuestMessages,
  useSendQuestMessage,
} from "@/hooks/useQuests";
import { useStartConversation } from "@/hooks/useMessaging";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { QuestCategory, VibeLevel, ParticipantStatus, QuestMessage } from "@/types";

const categoryConfig: Record<QuestCategory, { label: string; icon: typeof Dumbbell; color: string }> = {
  gym: { label: "Gym", icon: Dumbbell, color: "bg-red-500/20 text-red-700" },
  food: { label: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-700" },
  study: { label: "Study", icon: BookOpen, color: "bg-blue-500/20 text-blue-700" },
  game: { label: "Game", icon: Gamepad2, color: "bg-purple-500/20 text-purple-700" },
  commute: { label: "Commute", icon: Car, color: "bg-green-500/20 text-green-700" },
  custom: { label: "Custom", icon: Sparkles, color: "bg-zinc-500/20 text-gray-500" },
};

const vibeLevelLabels: Record<VibeLevel, { label: string; emoji: string }> = {
  chill: { label: "Chill", emoji: "😌" },
  intermediate: { label: "Intermediate", emoji: "👍" },
  high_energy: { label: "High Energy", emoji: "⚡" },
  intense: { label: "Intense", emoji: "🔥" },
  custom: { label: "Custom", emoji: "✨" },
};

export default function QuestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const questId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const { data: quest, isLoading } = useQuest(questId);
  const { data: participantsData } = useQuestParticipants(questId);

  // Also check my-quests to reliably determine if user has joined
  const { data: myParticipantQuests } = useMyQuests("participant");
  const { data: myPendingQuests } = useMyQuests("pending");

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Side Quests</h1>
            <p className="text-sm text-gray-400">Find buddies for any activity</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-green-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to view this quest</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Find gym partners, study buddies, and more with verified York students.
          </p>
          <Link href="/auth/login">
            <Button className="bg-green-600 hover:bg-green-700">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const joinMutation = useJoinQuest();
  const leaveMutation = useLeaveQuest();
  const deleteMutation = useDeleteQuest();
  const completeMutation = useCompleteQuest();
  const approveMutation = useApproveParticipant();
  const removeMutation = useRemoveParticipant();
  const startConversationMutation = useStartConversation();

  const participants = participantsData?.items || [];
  const isHost = user?.id === quest?.host.id;

  // Check if user is a quest member (host or accepted participant)
  const isQuestMember = isHost || participants.some(
    (p) => p.user.id === user?.id && p.status === "accepted"
  );

  // Quest chat
  const { data: messagesData, fetchNextPage, hasNextPage, isFetchingNextPage } = useQuestMessages(questId, isQuestMember);
  const sendMessageMutation = useSendQuestMessage();
  const [messageInput, setMessageInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; content: string } | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showChat, setShowChat] = useState(false);

  // Get all messages in chronological order
  const allMessages = messagesData?.pages?.flatMap((page) => page.messages).reverse() || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && showChat) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [allMessages.length, showChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      await sendMessageMutation.mutateAsync({
        questId,
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

  const handleReplyToMessage = (messageId: string, senderName: string, content: string) => {
    setReplyTo({ id: messageId, senderName, content });
  };

  // Check join status from multiple sources for reliability
  const myParticipation = participants.find((p) => p.user.id === user?.id);
  const myJoinedQuestIds = new Set(
    myParticipantQuests?.pages?.flatMap((page) => page.items.map((q) => q.id)) || []
  );
  const myPendingQuestIds = new Set(
    myPendingQuests?.pages?.flatMap((page) => page.items.map((q) => q.id)) || []
  );

  const isJoined = !!myParticipation || myJoinedQuestIds.has(questId) || myPendingQuestIds.has(questId);
  const isPending = myParticipation?.status === "pending" || myPendingQuestIds.has(questId);
  const isAccepted = myParticipation?.status === "accepted" || myJoinedQuestIds.has(questId);

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleJoin = async () => {
    try {
      const result = await joinMutation.mutateAsync({ id: questId });
      toast({
        title: result.status === "pending" ? "Request sent" : "Joined quest!",
        description:
          result.status === "pending"
            ? "Waiting for host approval"
            : "You have joined this quest!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join",
        variant: "destructive",
      });
    }
  };

  const handleLeave = async () => {
    try {
      await leaveMutation.mutateAsync(questId);
      toast({ title: "Left quest" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(questId);
      toast({ title: "Quest cancelled" });
      router.push("/quests");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync(questId);
      toast({ title: "Quest marked as completed!" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete",
        variant: "destructive",
      });
    }
  };

  const handleParticipantAction = async (
    participantId: string,
    action: "accept" | "reject"
  ) => {
    try {
      await approveMutation.mutateAsync({
        questId,
        participantId,
        action,
      });
      toast({ title: action === "accept" ? "Approved!" : "Rejected" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive",
      });
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      await removeMutation.mutateAsync({ questId, userId });
      toast({ title: "Participant removed" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove",
        variant: "destructive",
      });
    }
  };

  const handleMessageHost = async () => {
    if (!quest) return;

    try {
      const conversation = await startConversationMutation.mutateAsync({
        recipient_id: quest.host.id,
        initial_message: `Hi! I'm interested in your quest: "${quest.activity}"`,
        context_type: "buddy",
        context_id: quest.id,
      });
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="w-24 h-8 mb-6" />
        <Skeleton className="w-full h-48 mb-6" />
        <Skeleton className="w-full h-32" />
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl text-center">
        <p className="text-gray-400">Quest not found</p>
        <Button variant="link" asChild>
          <Link href="/quests">Back to Side Quests</Link>
        </Button>
      </div>
    );
  }

  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;
  const vibeInfo = vibeLevelLabels[quest.vibe_level];
  const acceptedParticipants = participants.filter((p) => p.status === "accepted");
  const pendingParticipants = participants.filter((p) => p.status === "pending");
  const spotsAvailable = quest.max_participants - quest.current_participants;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/quests">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Quest Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white border border-gray-100 shadow-sm mb-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn("text-sm", catConfig.color)}>
                <Icon className="w-4 h-4 mr-1" />
                {quest.category === "custom" && quest.custom_category
                  ? quest.custom_category
                  : catConfig.label}
              </Badge>
              <Badge variant="outline" className="text-sm border-gray-200">
                {vibeInfo.emoji} {quest.vibe_level === "custom" && quest.custom_vibe_level
                  ? quest.custom_vibe_level
                  : vibeInfo.label}
              </Badge>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                quest.status === "open" && "bg-green-500/20 text-green-700",
                quest.status === "in_progress" && "bg-blue-500/20 text-blue-700",
                quest.status === "full" && "bg-yellow-500/20 text-yellow-800",
                quest.status === "completed" && "bg-zinc-500/20 text-gray-500"
              )}
            >
              {quest.status === "open"
                ? `${spotsAvailable} spot${spotsAvailable !== 1 ? "s" : ""} left`
                : quest.status.replace("_", " ")}
            </Badge>
          </div>

          {isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/quests/${questId}/edit`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit quest
                  </Link>
                </DropdownMenuItem>
                {quest.status !== "completed" && (
                  <DropdownMenuItem onClick={handleComplete}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as completed
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel quest
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Activity Title */}
        <h1 className="text-2xl font-bold mb-4">{quest.activity}</h1>

        {/* Description */}
        {quest.description && (
          <p className="text-gray-700 whitespace-pre-wrap mb-4">{quest.description}</p>
        )}

        {/* Location with Map */}
        <div className="mb-4">
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
            <MapPin className="w-5 h-5 text-green-700" />
            <span>{quest.location}</span>
          </div>
          {quest.latitude && quest.longitude && (
            <QuestLocationMapWrapper
              latitude={quest.latitude}
              longitude={quest.longitude}
              locationName={quest.location}
              category={quest.category}
            />
          )}
        </div>

        {/* Meta */}
        <div className="space-y-3 text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-green-700" />
            <span>{formatTime(quest.start_time)}</span>
          </div>
          {quest.end_time && (
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-green-700" />
              <span>Until {formatTime(quest.end_time)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-green-700" />
            <span>{vibeInfo.emoji} {quest.vibe_level === "custom" && quest.custom_vibe_level
              ? quest.custom_vibe_level
              : vibeInfo.label} vibe</span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-green-700" />
            <span>
              {quest.current_participants}/{quest.max_participants} participants
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <span>Posted {timeAgo(quest.created_at)}</span>
          </div>
        </div>

        {/* Join/Leave Button */}
        {isAuthenticated && !isHost && quest.status !== "completed" && quest.status !== "cancelled" && (
          <div className="mt-6">
            {isJoined ? (
              <Button
                onClick={handleLeave}
                variant="outline"
                className="w-full"
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserMinus className="w-4 h-4 mr-2" />
                )}
                {isPending ? "Cancel Request" : "Leave Quest"}
              </Button>
            ) : quest.status === "open" ? (
              <Button
                onClick={handleJoin}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {quest.requires_approval ? "Request to Join" : "Join Quest"}
              </Button>
            ) : null}
          </div>
        )}
      </motion.div>

      {/* Host Card */}
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm mb-6">
        <p className="text-xs text-gray-400 mb-3">Host</p>
        <div className="flex items-center gap-3">
          <Link href={`/profile/${quest.host.id}`} className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity">
            <Avatar className="w-12 h-12">
              <AvatarImage src={quest.host.avatar_url || undefined} />
              <AvatarFallback className="bg-green-500/20 text-green-700">
                {quest.host.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium hover:text-purple-700 transition-colors">{quest.host.name}</p>
            </div>
          </Link>
          {isAuthenticated && !isHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMessageHost}
              disabled={startConversationMutation.isPending}
            >
              {startConversationMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Message
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-green-700" />
          Participants ({acceptedParticipants.length + 1})
        </h2>

        {/* Host as first participant */}
        <Link href={`/profile/${quest.host.id}`} className="block">
          <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center gap-3 hover:border-gray-300 transition-colors">
            <Avatar className="w-8 h-8">
              <AvatarImage src={quest.host.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-green-500/20 text-green-700">
                {quest.host.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 text-sm hover:text-purple-700 transition-colors">{quest.host.name}</span>
            <Badge variant="secondary" className="bg-green-500/20 text-green-700 text-xs">
              Host
            </Badge>
          </div>
        </Link>

        {acceptedParticipants.length === 0 ? (
          <p className="text-gray-400 text-sm pl-2">No other participants yet</p>
        ) : (
          <div className="space-y-2">
            {acceptedParticipants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm"
              >
                <Link href={`/profile/${p.user.id}`} className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={p.user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                      {p.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm hover:text-purple-700 transition-colors">{p.user.name}</span>
                </Link>
                <span className="text-xs text-gray-400">
                  Joined {timeAgo(p.created_at)}
                </span>
                {isHost && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-700 hover:text-red-800 hover:bg-red-500/20"
                    onClick={() => handleRemoveParticipant(p.user.id)}
                    disabled={removeMutation.isPending}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests (Host only) */}
        {isHost && pendingParticipants.length > 0 && (
          <>
            <h3 className="font-semibold text-yellow-800 mt-6 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Requests ({pendingParticipants.length})
            </h3>
            <div className="space-y-2">
              {pendingParticipants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={p.user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-yellow-500/20 text-yellow-800">
                      {p.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-sm">{p.user.name}</span>
                    {p.message && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.message}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-700 hover:text-green-800 hover:bg-green-500/20"
                      onClick={() => handleParticipantAction(p.id, "accept")}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-700 hover:text-red-800 hover:bg-red-500/20"
                      onClick={() => handleParticipantAction(p.id, "reject")}
                      disabled={approveMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Group Chat - Only visible to quest members */}
      {isQuestMember && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden"
        >
          {/* Chat Header */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-700" />
              <span className="font-semibold">Group Chat</span>
              {allMessages.length > 0 && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-700 text-xs">
                  {allMessages.length}
                </Badge>
              )}
            </div>
            <span className="text-gray-400 text-sm">
              {showChat ? "Hide" : "Show"}
            </span>
          </button>

          {/* Chat Body */}
          {showChat && (
            <div className="border-t border-gray-200">
              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="h-80 overflow-y-auto p-4 space-y-3"
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
                    <p className="text-gray-400 text-sm">
                      No messages yet. Start the conversation!
                    </p>
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
                              {message.sender.id === quest?.host.id && (
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
                              onClick={() => handleReplyToMessage(message.id, message.sender.name, message.content)}
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
                className="p-4 border-t border-gray-200"
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
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
