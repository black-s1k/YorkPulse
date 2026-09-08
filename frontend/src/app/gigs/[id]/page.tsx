"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  Loader2,
  MessageCircle,
  DollarSign,
  Send,
  Check,
  X,
  Trash2,
  MoreHorizontal,
  GraduationCap,
  Package,
  Monitor,
  ShoppingBag,
  Palette,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGig,
  useGigResponses,
  useRespondToGig,
  useAcceptResponse,
  useRejectResponse,
  useDeleteGig,
  useCompleteGig,
} from "@/hooks/useGigs";
import { useStartConversation } from "@/hooks/useMessaging";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { GigCategory, GigLocation, Gig } from "@/types";

const categoryConfig: Record<GigCategory, { label: string; icon: typeof GraduationCap; emoji: string }> = {
  academic: { label: "Academic", icon: GraduationCap, emoji: "🎓" },
  moving: { label: "Moving", icon: Package, emoji: "📦" },
  tech_help: { label: "Tech Help", icon: Monitor, emoji: "💻" },
  errands: { label: "Errands", icon: ShoppingBag, emoji: "🏃" },
  creative: { label: "Creative", icon: Palette, emoji: "🎨" },
  other: { label: "Other", icon: MoreHorizontal, emoji: "🔧" },
};

const locationLabels: Record<GigLocation, string> = {
  on_campus: "On Campus",
  off_campus: "Off Campus",
  online: "Online",
};

function formatPrice(gig: Gig): string {
  if (gig.price_type === "negotiable") return "Negotiable";
  if (!gig.price_min && !gig.price_max) return "Negotiable";

  const suffix = gig.price_type === "hourly" ? "/hr" : "";

  if (gig.price_min && gig.price_max && gig.price_min !== gig.price_max) {
    return `$${gig.price_min} - $${gig.price_max}${suffix}`;
  }

  const price = gig.price_min || gig.price_max;
  return `$${price}${suffix}`;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function GigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const { data: gig, isLoading } = useGig(gigId);
  const { data: responsesData } = useGigResponses(gigId);

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Quick Gigs</h1>
          <p className="text-gray-500 text-sm">Find help or offer your services</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-yellow-800" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to view this gig</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Find help or offer your services to verified York University students.
          </p>
          <Link href="/auth/login">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  const respondMutation = useRespondToGig();
  const acceptMutation = useAcceptResponse();
  const rejectMutation = useRejectResponse();
  const deleteMutation = useDeleteGig();
  const completeMutation = useCompleteGig();
  const startConversationMutation = useStartConversation();

  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");

  const responses = responsesData?.items || [];
  const isPoster = user?.id === gig?.poster_id;
  const isOffering = gig?.gig_type === "offering";
  const hasResponded = responses.some((r) => r.responder_id === user?.id);

  const handleRespond = async () => {
    if (!responseMessage.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }

    try {
      await respondMutation.mutateAsync({
        gigId,
        message: responseMessage,
        proposed_price: proposedPrice ? parseFloat(proposedPrice) : undefined,
      });
      toast({ title: "Response sent!" });
      setRespondDialogOpen(false);
      setResponseMessage("");
      setProposedPrice("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to respond",
        variant: "destructive",
      });
    }
  };

  const handleAccept = async (responseId: string) => {
    try {
      await acceptMutation.mutateAsync({ gigId, responseId });
      toast({ title: "Response accepted!" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (responseId: string) => {
    try {
      await rejectMutation.mutateAsync({ gigId, responseId });
      toast({ title: "Response rejected" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(gigId);
      toast({ title: "Gig deleted" });
      router.push("/gigs");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async () => {
    try {
      const result = await completeMutation.mutateAsync(gigId);
      toast({
        title: result.both_confirmed ? "Gig completed!" : "Completion confirmed",
        description: result.both_confirmed
          ? "Both parties have confirmed completion"
          : "Waiting for the other party to confirm",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete",
        variant: "destructive",
      });
    }
  };

  const handleMessagePoster = async () => {
    if (!gig) return;

    try {
      const conversation = await startConversationMutation.mutateAsync({
        recipient_id: gig.poster_id,
        initial_message: `Hi! I'm interested in your gig: "${gig.title}"`,
        context_type: "profile",
        context_id: gig.id,
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
        <Skeleton className="w-full h-64 mb-6" />
        <Skeleton className="w-full h-32" />
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl text-center">
        <p className="text-gray-400">Gig not found</p>
        <Button variant="link" asChild>
          <Link href="/gigs">Back to Gigs</Link>
        </Button>
      </div>
    );
  }

  const cat = categoryConfig[gig.category];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/gigs">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Gig Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "p-6 rounded-xl bg-white border border-gray-100 shadow-sm mb-6",
          isOffering ? "border-green-500/20" : "border-orange-500/20"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-sm",
                  isOffering ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
                )}
              >
                {isOffering ? "Offering" : "Need Help"}
              </Badge>
              <Badge variant="outline" className="text-sm border-gray-200">
                <cat.icon />{cat.label}
              </Badge>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                gig.status === "active" && "bg-green-500/20 text-green-700",
                gig.status === "in_progress" && "bg-blue-500/20 text-blue-700",
                gig.status === "completed" && "bg-zinc-500/20 text-gray-500"
              )}
            >
              {gig.status.replace("_", " ")}
            </Badge>
          </div>

          {isPoster && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {gig.status === "in_progress" && (
                  <DropdownMenuItem onClick={handleComplete}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDelete} className="text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Gig
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Title & Price */}
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold">{gig.title}</h1>
          <span className={cn(
            "text-xl font-bold",
            isOffering ? "text-green-700" : "text-orange-700"
          )}>
            {formatPrice(gig)}
          </span>
        </div>

        {/* Description */}
        <p className="text-gray-700 whitespace-pre-wrap mb-4">{gig.description}</p>

        {/* Meta */}
        <div className="space-y-2 text-sm text-gray-500 mb-4">
          {gig.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-700" />
              <span>{locationLabels[gig.location]}</span>
              {gig.location_details && (
                <span className="text-gray-400">- {gig.location_details}</span>
              )}
            </div>
          )}
          {gig.deadline && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-700" />
              <span>Deadline: {new Date(gig.deadline).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>Posted {timeAgo(gig.created_at)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {isAuthenticated && !isPoster && gig.status === "active" && (
          <div className="flex gap-2">
            {!hasResponded ? (
              <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className={cn(
                      "flex-1",
                      isOffering ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"
                    )}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Respond
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Respond to Gig</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500 mb-1 block">Message</label>
                      <Textarea
                        placeholder="Introduce yourself and explain why you're a good fit..."
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        maxLength={500}
                        rows={4}
                        className="bg-white border-gray-100"
                      />
                    </div>
                    {gig.price_type === "negotiable" && (
                      <div>
                        <label className="text-sm text-gray-500 mb-1 block">Proposed Price (optional)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="number"
                            placeholder="Your price"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                            min="0"
                            step="0.01"
                            className="pl-8 bg-white border-gray-100"
                          />
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={handleRespond}
                      disabled={respondMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {respondMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Response
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Badge variant="secondary" className="flex-1 justify-center py-2">
                Response Sent
              </Badge>
            )}
            <Button variant="outline" onClick={handleMessagePoster}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>
        )}
      </motion.div>

      {/* Poster Card */}
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm mb-6">
        <p className="text-xs text-gray-400 mb-3">Posted by</p>
        <Link href={`/profile/${gig.poster_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Avatar className="w-12 h-12">
            <AvatarImage src={gig.poster.avatar_url || undefined} />
            <AvatarFallback className="bg-gray-100">
              {gig.poster.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{gig.poster.name}</p>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {gig.poster.gig_rating_avg > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                  {gig.poster.gig_rating_avg.toFixed(1)}
                </span>
              )}
              {gig.poster.gigs_completed > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {gig.poster.gigs_completed} completed
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Responses (Poster only) */}
      {isPoster && responses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Responses ({responses.length})</h2>
          {responses.map((response) => (
            <div
              key={response.id}
              className={cn(
                "p-4 rounded-xl bg-white border border-gray-100 shadow-sm",
                response.status === "pending"
                  ? "border-yellow-500/20"
                  : response.status === "accepted"
                  ? "border-green-500/20"
                  : "border-zinc-500/20"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <Link href={`/profile/${response.responder_id}`} className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={response.responder.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                      {response.responder.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{response.responder.name}</p>
                    <p className="text-xs text-gray-400">{timeAgo(response.created_at)}</p>
                  </div>
                </Link>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    response.status === "pending" && "bg-yellow-500/20 text-yellow-800",
                    response.status === "accepted" && "bg-green-500/20 text-green-700",
                    response.status === "rejected" && "bg-red-500/20 text-red-700"
                  )}
                >
                  {response.status}
                </Badge>
              </div>

              {response.message && (
                <p className="text-sm text-gray-700 mb-3">{response.message}</p>
              )}

              {response.proposed_price && (
                <p className="text-sm text-green-700 mb-3">
                  Proposed: ${response.proposed_price}
                </p>
              )}

              {response.status === "pending" && gig.status === "active" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(response.id)}
                    disabled={acceptMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {acceptMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(response.id)}
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
