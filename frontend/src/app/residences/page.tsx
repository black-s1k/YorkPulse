"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ArrowLeft,
  Loader2,
  Building2,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUser } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { Residence, ResidenceChannel, ResidenceMessage, ResidenceParticipant } from "@/types";

type ViewMode = "browse" | "chat";

export default function ResidencesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [selectedResidence, setSelectedResidence] = useState<Residence | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ResidenceChannel | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [previewResidence, setPreviewResidence] = useState<Residence | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string; content: string | null } | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: residenceList, isLoading: listLoading } = useQuery({
    queryKey: ["residences", "list"],
    queryFn: () => api.residences.list(),
  });

  const { data: myResidences, isLoading: myResidencesLoading } = useQuery({
    queryKey: ["residences", "my"],
    queryFn: () => api.residences.getMyResidences(),
    enabled: isAuthenticated,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["residences", "messages", selectedChannel?.id],
    queryFn: () => api.residences.getMessages(selectedChannel!.id),
    enabled: !!selectedChannel,
    refetchInterval: 5000,
  });

  const { data: participantsData, isLoading: participantsLoading } = useQuery({
    queryKey: ["residences", selectedResidence?.id, "participants"],
    queryFn: () => api.residences.getParticipants(selectedResidence!.id),
    enabled: !!selectedResidence && showParticipants,
  });

  const joinMutation = useMutation({
    mutationFn: (residenceId: string) => api.residences.join(residenceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["residences", "my"] });
      queryClient.invalidateQueries({ queryKey: ["residences", "list"] });
      setSelectedResidence(data.residence);
      setSelectedChannel(data.channel);
      setViewMode("chat");
      toast({ title: "Joined!", description: `Welcome to ${data.residence.name}` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to join", description: error.message, variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (residenceId: string) => api.residences.leave(residenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residences", "my"] });
      queryClient.invalidateQueries({ queryKey: ["residences", "list"] });
      setViewMode("browse");
      setSelectedResidence(null);
      setSelectedChannel(null);
      toast({ title: "Left residence" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave", description: error.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({
      channelId,
      message,
      imageUrl,
      replyToId,
    }: {
      channelId: string;
      message?: string;
      imageUrl?: string;
      replyToId?: string;
    }) => api.residences.sendMessage(channelId, message, imageUrl, replyToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residences", "messages", selectedChannel?.id] });
      setReplyTo(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.messages]);

  useEffect(() => {
    if (messages && selectedResidence) {
      const timeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["residences", "my"] });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [selectedChannel?.id, messages, selectedResidence, queryClient]);

  const isResidenceMember = (residenceId: string) =>
    myResidences?.residences.some((m) => m.residence.id === residenceId);

  const handleResidenceClick = (residence: Residence) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to join residences", variant: "destructive" });
      return;
    }
    if (isResidenceMember(residence.id)) {
      const membership = myResidences?.residences.find((m) => m.residence.id === residence.id);
      setSelectedResidence(residence);
      setSelectedChannel(membership?.channel ?? null);
      setViewMode("chat");
    } else {
      setPreviewResidence(residence);
      setShowJoinDialog(true);
    }
  };

  const handleJoin = () => {
    if (previewResidence) {
      joinMutation.mutate(previewResidence.id);
      setShowJoinDialog(false);
      setPreviewResidence(null);
    }
  };

  const handleSendMessage = async (message: string | null, imageUrl: string | null, replyToId?: string) => {
    if (!selectedChannel) return;
    await sendMessageMutation.mutateAsync({
      channelId: selectedChannel.id,
      message: message || undefined,
      imageUrl: imageUrl || undefined,
      replyToId,
    });
  };

  const handleReply = (messageId: string, authorName: string, content: string | null) => {
    setReplyTo({ id: messageId, authorName, content });
  };

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-purple-500/20");
      setTimeout(() => element.classList.remove("bg-purple-500/20"), 2000);
    }
  };

  const renderBrowseView = () => (
    <div className="space-y-6">
      {/* My Residences */}
      {isAuthenticated && myResidences && myResidences.residences.length > 0 && (
        <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3">My Residences</h3>
          <div className="flex flex-wrap gap-2">
            {myResidences.residences.map((membership) => (
              <motion.div
                key={membership.residence.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedResidence(membership.residence);
                  setSelectedChannel(membership.channel);
                  setViewMode("chat");
                }}
                className="relative px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 cursor-pointer"
              >
                <span className="text-sm text-purple-300">{membership.residence.name}</span>
                {membership.unread_count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {membership.unread_count > 99 ? "99+" : membership.unread_count}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Residence List */}
      {listLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {[...(residenceList?.keele ?? []), ...(residenceList?.glendon ?? [])].map((residence) => {
            const joined = isResidenceMember(residence.id);
            return (
              <motion.div
                key={residence.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleResidenceClick(residence)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-colors",
                  joined
                    ? "bg-purple-500/5 border-purple-500/30"
                    : "bg-white/5 hover:bg-white/10 border-gray-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    joined ? "bg-purple-500/20" : "bg-white/5"
                  )}>
                    <Building2 className={cn("w-4 h-4", joined ? "text-purple-700" : "text-gray-500")} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{residence.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                      <Users className="w-3 h-3" />
                      <span className="text-xs">{residence.member_count} members</span>
                    </div>
                  </div>
                </div>
                {joined && (
                  <span className="text-[10px] text-purple-700 font-medium">Joined</span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderChatView = () => (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-gray-200 rounded-t-xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setViewMode("browse");
            setSelectedResidence(null);
            setSelectedChannel(null);
            setShowParticipants(false);
            queryClient.invalidateQueries({ queryKey: ["residences", "my"] });
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-700" />
            <span className="font-medium text-sm">{selectedResidence?.name}</span>
            {showParticipants && (
              <>
                <span className="text-gray-400">/</span>
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-500">Participants</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{selectedResidence?.campus} Campus</p>
        </div>

        {/* Participants button */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(showParticipants ? "text-purple-700" : "text-gray-500")}
          onClick={() => setShowParticipants((v) => !v)}
        >
          <Users className="w-4 h-4" />
        </Button>

        {/* Leave button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-red-700 hover:text-red-800"
          onClick={() => selectedResidence && leaveMutation.mutate(selectedResidence.id)}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Participants Panel */}
        {showParticipants && (
          <ScrollArea className="flex-1 min-h-0 p-4">
            {participantsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  {participantsData?.total ?? 0} residents
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {participantsData?.participants.map((p: ResidenceParticipant) => (
                    <Link
                      key={p.id}
                      href={`/profile/${p.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-gray-200 transition-colors"
                    >
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs bg-purple-500/10 text-purple-700">
                          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-700 truncate">{p.name}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </ScrollArea>
        )}

        {/* Messages + Input */}
        {!showParticipants && (
          <>
            <ScrollArea className="flex-1 min-h-0 p-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="w-24 h-4" />
                        <Skeleton className="w-48 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !messages?.messages?.length ? (
                <div className="py-8 px-4">
                  <div className="max-w-lg mx-auto text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                      <Building2 className="w-8 h-8 text-purple-700" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">{selectedResidence?.name}</h2>
                    <p className="text-gray-500 text-sm mb-6">{selectedResidence?.campus} Campus</p>
                    <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-left">
                      <p className="text-sm text-gray-500">
                        This is the general chat for your residence. Say hi to your neighbours!
                      </p>
                    </div>
                    <p className="text-gray-400 text-sm mt-6">Be the first to start the conversation!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.messages.map((msg: ResidenceMessage) => (
                    <ChatMessage
                      key={msg.id}
                      id={msg.id}
                      message={msg.message}
                      imageUrl={msg.image_url}
                      authorName={msg.author.name}
                      authorAvatarUrl={msg.author.avatar_url}
                      authorId={msg.author.id}
                      currentUserId={user?.id}
                      timestamp={msg.created_at}
                      replyTo={msg.reply_to}
                      onReply={handleReply}
                      onScrollToMessage={handleScrollToMessage}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {selectedChannel && (
              <div className="p-4 border-t border-gray-200">
                <ChatInput
                  placeholder="Message your neighbours..."
                  maxLength={500}
                  onSend={handleSendMessage}
                  getUploadUrl={api.residences.getChatImageUploadUrl}
                  disabled={sendMessageMutation.isPending}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Residence Chat</h1>
          <p className="text-sm text-gray-400">Connect with your on-campus neighbours</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-purple-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to access Residence Chat</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Join your residence chat room and connect with students living in the same building.
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">Residence Chat</h1>
          <p className="text-sm text-gray-400">
            {viewMode === "browse"
              ? "Connect with on-campus neighbours"
              : `Chatting in ${selectedResidence?.name}`}
          </p>
        </div>
      </motion.div>

      {/* Tab Switcher */}
      {viewMode === "browse" && (
        <div className="flex gap-1 p-1 mb-5 bg-white border border-gray-100 shadow-sm rounded-xl w-fit">
          <Link href="/courses">
            <button className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:text-gray-900">
              Courses
            </button>
          </Link>
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-500/20 text-purple-700">
            Residence
          </button>
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: viewMode === "chat" ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: viewMode === "chat" ? -20 : 20 }}
          transition={{ duration: 0.2 }}
        >
          {viewMode === "browse" ? renderBrowseView() : renderChatView()}
        </motion.div>
      </AnimatePresence>

      {/* Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-700" />
              Join Residence Chat
            </DialogTitle>
            <DialogDescription>
              Join the general chat room for this residence to connect with your neighbours.
            </DialogDescription>
          </DialogHeader>

          {previewResidence && (
            <div className="py-4">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <p className="font-medium">{previewResidence.name}</p>
                <p className="text-sm text-gray-500 mt-1">{previewResidence.campus} Campus</p>
                <div className="flex items-center gap-1 mt-2 text-gray-400">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">{previewResidence.member_count} members</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              disabled={joinMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {joinMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4 mr-2" />
              )}
              Join Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
