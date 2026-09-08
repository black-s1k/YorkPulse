"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Users,
  Hash,
  ArrowLeft,
  Loader2,
  GraduationCap,
  LogOut,
  Vote,
  PanelLeft,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { Course, CourseChannel, CourseMessage, CourseParticipant, VoteStatus } from "@/types";

// View modes
type ViewMode = "browse" | "chat";

export default function CoursesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { data: user } = useUser(); // Fetch user data if not loaded
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaculties, setExpandedFaculties] = useState<Set<string>>(new Set());
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<CourseChannel | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [profNameInput, setProfNameInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string; content: string | null } | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: hierarchy, isLoading: hierarchyLoading } = useQuery({
    queryKey: ["courses", "hierarchy"],
    queryFn: () => api.courses.getHierarchy(),
  });

  const { data: myCourses, isLoading: myCoursesLoading } = useQuery({
    queryKey: ["courses", "my"],
    queryFn: () => api.courses.getMyCourses(),
    enabled: isAuthenticated,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["courses", "search", searchQuery],
    queryFn: () => api.courses.search(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  // Derived: top 8 courses by member count for the popular strip
  const popularCourses = useMemo(() => {
    if (!hierarchy) return [];
    const all: Course[] = [];
    hierarchy.faculties.forEach(f =>
      f.programs.forEach(p =>
        p.years.forEach(y =>
          y.courses.forEach(c => all.push(c as Course))
        )
      )
    );
    const unique = Array.from(new Map(all.map(c => [c.id, c])).values());
    return unique.sort((a, b) => b.member_count - a.member_count).slice(0, 8);
  }, [hierarchy]);

  // Display counts for popular strip: rank 0 → ~59, rank 7 → ~31, with small per-course variation.
  const getPopularDisplayCount = (rank: number, courseId: string) => {
    const base = 59 - rank * 4;
    const variation = courseId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 4;
    return Math.min(59, Math.max(31, base + variation));
  };

  const { data: channels } = useQuery({
    queryKey: ["courses", selectedCourse?.id, "channels"],
    queryFn: () => api.courses.getChannels(selectedCourse!.id),
    enabled: !!selectedCourse && viewMode === "chat",
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["courses", "channels", selectedChannel?.id, "messages"],
    queryFn: () => api.courses.getMessages(selectedChannel!.id),
    enabled: !!selectedChannel,
    refetchInterval: 5000, // Poll for new messages
  });

  const { data: voteStatus } = useQuery({
    queryKey: ["courses", selectedCourse?.id, "vote-status"],
    queryFn: () => api.courses.getVoteStatus(selectedCourse!.id),
    enabled: !!selectedCourse && viewMode === "chat",
  });

  const { data: participantsData, isLoading: participantsLoading } = useQuery({
    queryKey: ["courses", selectedCourse?.id, "participants"],
    queryFn: () => api.courses.getParticipants(selectedCourse!.id),
    enabled: !!selectedCourse && showParticipants,
  });

  // Mutations
  const joinCourseMutation = useMutation({
    mutationFn: (courseId: string) => api.courses.joinCourse(courseId),
    onSuccess: (data) => {
      toast({ title: "Joined!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["courses", "my"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "hierarchy"] });
      setSelectedCourse(data.course);
      setSelectedChannel(data.general_channel);
      setViewMode("chat");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const leaveCourseMutation = useMutation({
    mutationFn: (courseId: string) => api.courses.leaveCourse(courseId),
    onSuccess: () => {
      toast({ title: "Left course" });
      queryClient.invalidateQueries({ queryKey: ["courses", "my"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "hierarchy"] });
      setSelectedCourse(null);
      setSelectedChannel(null);
      setViewMode("browse");
    },
  });

  const joinChannelMutation = useMutation({
    mutationFn: (channelId: string) => api.courses.joinChannel(channelId),
    onSuccess: (data) => {
      toast({ title: "Joined channel", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse?.id, "channels"] });
      setSelectedChannel(data.channel);
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
    }) => api.courses.sendMessage(channelId, message, imageUrl, replyToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", "channels", selectedChannel?.id, "messages"] });
      setReplyTo(null);
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({ courseId, profName }: { courseId: string; profName: string }) =>
      api.courses.voteForProfessor(courseId, profName),
    onSuccess: (data) => {
      toast({
        title: data.channel_created ? "Channel created!" : "Vote recorded",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse?.id, "vote-status"] });
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse?.id, "channels"] });
      setShowVoteDialog(false);
      setProfNameInput("");
      if (data.channel) {
        setSelectedChannel(data.channel);
      }
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.messages]);

  // Refresh channels when messages are loaded (to update unread counts after marking as read)
  useEffect(() => {
    if (messages && selectedCourse) {
      // Invalidate channels after a short delay to let the backend update last_read_at
      const timeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse.id, "channels"] });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [selectedChannel?.id, messages, selectedCourse, queryClient]);

  // Check if user is member of a course
  const isCourseMember = (courseId: string) => {
    return myCourses?.courses.some((m) => m.course.id === courseId);
  };

  // Handle course click
  const handleCourseClick = (course: Course) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join courses",
        variant: "destructive",
      });
      return;
    }

    if (isCourseMember(course.id)) {
      // Already a member, go to chat
      setSelectedCourse(course);
      setViewMode("chat");
    } else {
      // Show join dialog
      setPreviewCourse(course);
      setShowJoinDialog(true);
    }
  };

  // Handle join course from dialog
  const handleJoinCourse = () => {
    if (previewCourse) {
      joinCourseMutation.mutate(previewCourse.id);
      setShowJoinDialog(false);
      setPreviewCourse(null);
    }
  };

  // Handle channel click
  const handleChannelClick = (channel: CourseChannel) => {
    setSidebarOpen(false);
    setShowParticipants(false);
    if (channel.type === "professor") {
      // Check if already a member
      joinChannelMutation.mutate(channel.id);
    } else {
      setSelectedChannel(channel);
    }
  };

  // Handle send message
  const handleSendMessage = async (message: string | null, imageUrl: string | null, replyToId?: string) => {
    if (!selectedChannel) return;
    await sendMessageMutation.mutateAsync({
      channelId: selectedChannel.id,
      message: message || undefined,
      imageUrl: imageUrl || undefined,
      replyToId: replyToId,
    });
  };

  // Handle reply
  const handleReply = (messageId: string, authorName: string, content: string | null) => {
    setReplyTo({ id: messageId, authorName, content });
  };

  // Handle scroll to message (when clicking on reply preview)
  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add highlight effect
      element.classList.add("bg-purple-500/20");
      setTimeout(() => {
        element.classList.remove("bg-purple-500/20");
      }, 2000);
    }
  };

  // Toggle faculty expansion
  const toggleFaculty = (faculty: string) => {
    setExpandedFaculties((prev) => {
      const next = new Set(prev);
      if (next.has(faculty)) {
        next.delete(faculty);
      } else {
        next.add(faculty);
      }
      return next;
    });
  };

  // Toggle program expansion
  const toggleProgram = (key: string) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Render browse view
  const renderBrowseView = () => (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search courses by code or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-gray-100"
        />
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm"
        >
          <h3 className="text-sm font-medium text-gray-500 mb-3">Search Results</h3>
          {searchLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : searchResults?.results.length === 0 ? (
            <p className="text-sm text-gray-400">No courses found</p>
          ) : (
            <div className="space-y-2">
              {searchResults?.results.map((course) => (
                <motion.div
                  key={course.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleCourseClick(course as Course)}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    "bg-white hover:bg-gray-50 border border-gray-100 shadow-sm",
                    isCourseMember(course.id) && "border-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-primary">{course.code}</span>
                        {isCourseMember(course.id) && (
                          <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
                            Joined
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{course.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">{course.member_count}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Popular Courses */}
      {!searchQuery && popularCourses.length > 0 && (
        <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Popular Courses
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {popularCourses.map((course, idx) => (
              <motion.div
                key={course.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleCourseClick(course)}
                className={cn(
                  "flex-shrink-0 w-40 p-3 rounded-xl cursor-pointer border transition-colors",
                  isCourseMember(course.id)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-white hover:bg-gray-50 border-gray-200"
                )}
              >
                <p className="font-mono text-sm text-primary font-bold truncate">{course.code}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{course.name}</p>
                <div className="flex items-center gap-1 mt-2 text-gray-400">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">{getPopularDisplayCount(idx, course.id)}</span>
                  {isCourseMember(course.id) && (
                    <span className="ml-auto text-[10px] text-primary">Joined</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* My Courses */}
      {isAuthenticated && myCourses && myCourses.courses.length > 0 && (
        <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3">My Courses</h3>
          <div className="flex flex-wrap gap-2">
            {myCourses.courses.map((membership) => (
              <motion.div
                key={membership.course.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedCourse(membership.course);
                  setViewMode("chat");
                }}
                className="relative px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 cursor-pointer"
              >
                <span className="font-mono text-sm text-primary">{membership.course.code}</span>
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

      {/* Mind Map Hierarchy */}
      {hierarchyLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {hierarchy?.faculties.map((faculty) => (
            <motion.div
              key={faculty.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Faculty Header */}
              <button
                onClick={() => toggleFaculty(faculty.name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-cyan-400" />
                  <span className="font-medium">{faculty.name}</span>
                  <span className="text-xs text-gray-400">
                    ({faculty.programs.reduce((sum, p) => sum + p.years.reduce((s, y) => s + y.courses.length, 0), 0)})
                  </span>
                </div>
                <ChevronRight
                  className={cn(
                    "w-5 h-5 text-gray-400 transition-transform",
                    expandedFaculties.has(faculty.name) && "rotate-90"
                  )}
                />
              </button>

              {/* Programs */}
              <AnimatePresence>
                {expandedFaculties.has(faculty.name) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-200"
                  >
                    {faculty.programs.map((program) => {
                      const programKey = `${faculty.name}-${program.name}`;
                      return (
                        <div key={program.name} className="border-b border-white/5 last:border-0">
                          {/* Program Header */}
                          <button
                            onClick={() => toggleProgram(programKey)}
                            className="w-full px-6 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-sm text-gray-700">
                              {program.name}
                              <span className="text-xs text-gray-400 ml-1.5">
                                ({program.years.reduce((sum, y) => sum + y.courses.length, 0)})
                              </span>
                            </span>
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 text-gray-400 transition-transform",
                                expandedPrograms.has(programKey) && "rotate-180"
                              )}
                            />
                          </button>

                          {/* Courses by Year */}
                          <AnimatePresence>
                            {expandedPrograms.has(programKey) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-6 pb-3"
                              >
                                {program.years.map((yearGroup) => (
                                  <div key={yearGroup.year} className="mt-2">
                                    <p className="text-xs text-gray-400 mb-2">Year {yearGroup.year}</p>
                                    <div className="flex flex-wrap gap-2">
                                      {yearGroup.courses.map((course) => (
                                        <motion.button
                                          key={course.id}
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => handleCourseClick(course as Course)}
                                          className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-mono transition-colors",
                                            "bg-white hover:bg-white/10 border border-gray-100",
                                            isCourseMember(course.id) && "border-primary/50 bg-primary/10"
                                          )}
                                        >
                                          <span className="text-primary">{course.code}</span>
                                          <span className="ml-2 text-gray-400">{course.member_count}</span>
                                        </motion.button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // Render chat view
  const renderChatView = () => (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-200 rounded-t-xl">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setViewMode("browse");
            setSelectedCourse(null);
            setSelectedChannel(null);
            setShowParticipants(false);
            // Refresh my courses to update unread counts
            queryClient.invalidateQueries({ queryKey: ["courses", "my"] });
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-primary">{selectedCourse?.code}</span>
            {showParticipants ? (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Participants</span>
              </>
            ) : selectedChannel ? (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <Hash className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{selectedChannel.name}</span>
              </>
            ) : null}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{selectedCourse?.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-700 hover:text-red-800"
          onClick={() => selectedCourse && leaveCourseMutation.mutate(selectedCourse.id)}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="md:hidden absolute inset-0 z-[5] bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Channel Sidebar */}
        <div className={cn(
          "flex flex-col bg-white/[0.02] transition-all duration-200",
          "absolute md:relative z-10 h-full",
          sidebarOpen ? "w-48 border-r border-gray-200" : "w-0 overflow-hidden",
          "md:w-48 md:overflow-visible md:border-r md:border-gray-200"
        )}>
          <div className="p-2 border-b border-gray-200">
            <p className="text-xs text-gray-400 px-2">Channels</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Participants tab */}
              <button
                onClick={() => {
                  setShowParticipants(true);
                  setSelectedChannel(null);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full px-2 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                  showParticipants
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-gray-50 text-gray-500"
                )}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">Participants</span>
              </button>

              {channels?.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelClick(channel)}
                  className={cn(
                    "w-full px-2 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                    selectedChannel?.id === channel.id
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-gray-50 text-gray-500"
                  )}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1">{channel.name}</span>
                  {channel.unread_count > 0 && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                      {channel.unread_count > 99 ? "99+" : channel.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Vote Button */}
          <div className="p-2 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowVoteDialog(true)}
            >
              <Vote className="w-3 h-3 mr-1" />
              Request Prof Channel
            </Button>
          </div>
        </div>

        {/* Messages / Participants Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Participants Panel */}
          {showParticipants && (
            <ScrollArea className="flex-1 min-h-0 p-4">
              {participantsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white">
                      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    {participantsData?.total ?? 0} enrolled
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {participantsData?.participants.map((p: CourseParticipant) => (
                      <Link
                        key={p.id}
                        href={`/profile/${p.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white border border-white/5 hover:bg-white/10 hover:border-gray-200 transition-colors"
                      >
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
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

          {/* Channel view (messages + input) */}
          {!showParticipants && (
          <>
          {/* Vote Status Banner (for general channel) */}
          {selectedChannel?.type === "general" && voteStatus && voteStatus.votes.length > 0 && (
            <div className="p-3 bg-purple-500/10 border-b border-purple-500/20">
              <p className="text-xs text-purple-300 mb-2">Current professor channel votes:</p>
              <div className="flex flex-wrap gap-2">
                {voteStatus.votes.map((vote) => (
                  <Badge
                    key={vote.prof_name_normalized}
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      vote.has_voted ? "bg-purple-500/30" : "bg-white/10"
                    )}
                  >
                    {vote.prof_name}: {vote.vote_count}/{vote.threshold}
                    {vote.has_voted && " (voted)"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
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
                {/* Welcome Banner */}
                <div className="max-w-lg mx-auto">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                      <GraduationCap className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">
                      Welcome to {selectedCourse?.code}
                    </h2>
                    <p className="text-gray-500 text-sm">{selectedCourse?.name}</p>
                  </div>

                  {/* Info Cards */}
                  <div className="space-y-3">
                    {/* General Channel Info */}
                    <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Hash className="w-4 h-4 text-purple-700" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-white">General Channel</p>
                          <p className="text-xs text-gray-500 mt-1">
                            This is the main discussion channel for all students in {selectedCourse?.code}.
                            Ask questions, share resources, and connect with your classmates!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Professor Channel Voting */}
                    <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Vote className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-white">Professor Channels</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Want a dedicated channel for your professor's section? Use the
                            <span className="text-primary font-medium"> "Request Prof Channel" </span>
                            button. When <span className="text-white font-medium">5 students</span> vote
                            for the same professor, a channel is automatically created!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Auto-deletion Notice */}
                    <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-yellow-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-yellow-800">Auto-Cleanup</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Professor section channels are automatically archived after
                            <span className="text-yellow-800 font-medium"> 6 months </span>
                            to keep things fresh each semester. The general channel stays forever.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-6 text-center">
                    <p className="text-gray-400 text-sm">Be the first to start the conversation!</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages?.messages.map((msg) => (
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

          {/* Message Input — only shown inside a channel */}
          {selectedChannel && (
            <div className="p-4 border-t border-gray-200">
              <ChatInput
                placeholder={`Message #${selectedChannel.name}`}
                maxLength={500}
                onSend={handleSendMessage}
                getUploadUrl={api.courses.getChatImageUploadUrl}
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

      {/* Vote Dialog */}
      <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Professor Channel</DialogTitle>
            <DialogDescription>
              Enter your professor's name. When 5 students vote for the same professor, a channel
              will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Professor name (e.g., John Smith)"
              value={profNameInput}
              onChange={(e) => setProfNameInput(e.target.value)}
            />
            {voteStatus && voteStatus.votes.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Current votes this semester:</p>
                <div className="space-y-1">
                  {voteStatus.votes.map((vote) => (
                    <div
                      key={vote.prof_name_normalized}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">{vote.prof_name}</span>
                      <Badge variant="secondary">
                        {vote.vote_count}/{vote.threshold}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVoteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedCourse &&
                voteMutation.mutate({
                  courseId: selectedCourse.id,
                  profName: profNameInput,
                })
              }
              disabled={!profNameInput.trim() || voteMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {voteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Vote className="w-4 h-4 mr-2" />
              )}
              Vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Course Chat</h1>
            <p className="text-sm text-gray-400">Browse and join course chat rooms</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to access Course Chat</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Join course chat rooms and connect with classmates at York University.
          </p>
          <Link href="/auth/login">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Course Chat</h1>
          <p className="text-sm text-gray-400">
            {viewMode === "browse"
              ? "Browse and join across 7,706 course chat rooms"
              : `Chatting in ${selectedCourse?.code}`}
          </p>
        </div>
      </motion.div>

      {/* Tab Switcher */}
      {viewMode === "browse" && (
        <div className="flex gap-1 p-1 mb-5 bg-white border border-gray-100 shadow-sm rounded-xl w-fit">
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-500/20 text-cyan-700">
            Courses
          </button>
          <Link href="/residences">
            <button className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:text-gray-900">
              Residence
            </button>
          </Link>
        </div>
      )}

      {/* Disclaimer Banner */}
      {viewMode === "browse" && (
        <div className="mb-5 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-sm text-gray-500 leading-relaxed">
          <span className="font-medium text-blue-300">How courses are organised:</span> Courses are grouped by{" "}
          <span className="text-gray-700">Faculty → Program → Course</span>. Expand a faculty to find your program,
          then select a course to join its chat.{" "}
          <span className="text-gray-700">Can&apos;t find your course?</span> Use the search bar above to look it up
          by name or course code. If it&apos;s still missing,{" "}
          <Link href="/#send-feedback" className="text-blue-700 underline underline-offset-2 hover:text-blue-800 transition-colors">
            report it here
          </Link>
          .
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

      {/* Join Course Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Join Course
            </DialogTitle>
            <DialogDescription>
              Join the chat room for this course to connect with other students.
            </DialogDescription>
          </DialogHeader>

          {previewCourse && (
            <div className="py-4">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-lg text-primary font-bold">
                      {previewCourse.code}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {previewCourse.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{previewCourse.member_count}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Hash className="w-3.5 h-3.5" />
                    <span>General discussion channel</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Vote className="w-3.5 h-3.5" />
                    <span>Vote to create professor section channels</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowJoinDialog(false);
                setPreviewCourse(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinCourse}
              disabled={joinCourseMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              {joinCourseMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Join Course
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
