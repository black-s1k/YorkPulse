"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Users,
  Compass,
  Inbox,
  MessageSquare,
  Check,
  X,
  Send,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth";
import { useUser } from "@/hooks/useAuth";
import { api } from "@/services/api";
import type {
  PersonaUser,
  PendingRequestItem,
  PersonaConversationItem,
  Message,
} from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {initials(name)}
    </div>
  );
}

// ─── Personas Tab ────────────────────────────────────────────────────────────

function PersonasTab({
  personas,
  loading,
  onRefresh,
  onSelectForQuest,
}: {
  personas: PersonaUser[];
  loading: boolean;
  onRefresh: () => void;
  onSelectForQuest: (id: string) => void;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.adminPersonas.createPersona({
        name: name.trim(),
        program: program.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      toast({ title: "Persona created" });
      setName("");
      setProgram("");
      setBio("");
      setShowForm(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to create persona", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string, personaName: string) => {
    if (!confirm(`Deactivate ${personaName}? Their existing quests will remain visible.`)) return;
    try {
      await api.adminPersonas.deactivatePersona(id);
      toast({ title: `${personaName} deactivated` });
      onRefresh();
    } catch {
      toast({ title: "Failed to deactivate", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{personas.length} persona{personas.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" />
          New Persona
        </Button>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-medium text-gray-700">New Persona</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="Emily Carter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <Input
                placeholder="Psychology, Year 3"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bio</Label>
            <Textarea
              placeholder="Brief bio…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="text-sm min-h-[60px]"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Program</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {personas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={p.name} />
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.program || "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onSelectForQuest(p.id)}
                    >
                      Post Quest <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                    {p.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeactivate(p.id, p.name)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {personas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No personas yet. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Post Quest Tab ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "gym", label: "💪 Gym" },
  { value: "food", label: "🍔 Food" },
  { value: "study", label: "📚 Study" },
  { value: "game", label: "🎮 Game" },
  { value: "commute", label: "🚇 Commute" },
  { value: "custom", label: "✨ Custom" },
];

const VIBES = [
  { value: "chill", label: "😌 Chill" },
  { value: "intermediate", label: "👍 Intermediate" },
  { value: "high_energy", label: "⚡ High Energy" },
  { value: "intense", label: "🔥 Intense" },
];

function PostQuestTab({
  personas,
  selectedPersonaId,
  onSelectPersona,
}: {
  personas: PersonaUser[];
  selectedPersonaId: string;
  onSelectPersona: (id: string) => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState("study");
  const [customCategory, setCustomCategory] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [vibe, setVibe] = useState("chill");
  const [maxParticipants, setMaxParticipants] = useState(3);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPersonaId || !activity.trim() || !location.trim() || !startTime) {
      toast({ title: "Fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const persona = personas.find((p) => p.id === selectedPersonaId);
      await api.adminPersonas.createPersonaQuest(selectedPersonaId, {
        category,
        custom_category: category === "custom" ? customCategory : undefined,
        activity: activity.trim(),
        description: description.trim() || undefined,
        start_time: new Date(startTime).toISOString(),
        location: location.trim(),
        vibe_level: vibe,
        max_participants: maxParticipants,
        requires_approval: requiresApproval,
      });
      toast({ title: `Quest posted as ${persona?.name ?? "persona"}` });
      setActivity("");
      setDescription("");
      setLocation("");
      setStartTime("");
    } catch (e) {
      toast({
        title: "Failed to post quest",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      {/* Persona selector */}
      <div className="space-y-1.5">
        <Label>Post as</Label>
        <select
          value={selectedPersonaId}
          onChange={(e) => onSelectPersona(e.target.value)}
          className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">— select persona —</option>
          {personas.filter((p) => p.is_active).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.program}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                category === c.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {category === "custom" && (
          <Input
            placeholder="Custom category name"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className="mt-1 text-sm"
          />
        )}
      </div>

      {/* Activity */}
      <div className="space-y-1.5">
        <Label>Activity *</Label>
        <Textarea
          placeholder="Write it naturally — as if a real student typed it…"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          maxLength={200}
          className="text-sm min-h-[80px]"
        />
        <p className="text-xs text-gray-400">{activity.length}/200</p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description <span className="text-gray-400 font-normal">(optional)</span></Label>
        <Textarea
          placeholder="Extra context, what to bring, vibes, etc."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          className="text-sm min-h-[60px]"
        />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label>Location *</Label>
        <Input
          placeholder="Scott Library Floor 4, Tait McKenzie Centre…"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="text-sm"
        />
      </div>

      {/* Start time */}
      <div className="space-y-1.5">
        <Label>Start time *</Label>
        <Input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="text-sm"
        />
      </div>

      {/* Vibe */}
      <div className="space-y-1.5">
        <Label>Vibe</Label>
        <div className="flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVibe(v.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                vibe === v.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max participants + approval */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Max participants</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Requires approval</Label>
          <div className="flex items-center gap-2 h-9">
            <input
              type="checkbox"
              id="approval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="approval" className="text-sm text-gray-600">Manual approval</label>
          </div>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || !selectedPersonaId || !activity.trim() || !location.trim() || !startTime}
        className="w-full bg-primary hover:bg-york-red-dark"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Compass className="w-4 h-4 mr-2" />}
        Post Quest
      </Button>
    </div>
  );
}

// ─── Join Requests Tab ───────────────────────────────────────────────────────

function JoinRequestsTab({
  requests,
  loading,
  onRefresh,
}: {
  requests: PendingRequestItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);

  const decide = async (item: PendingRequestItem, action: "accept" | "reject") => {
    setProcessing(item.participant_id);
    try {
      await api.adminPersonas.decideJoinRequest(item.quest_id, item.participant_id, action);
      toast({
        title: action === "accept"
          ? `Accepted ${item.requester_name}`
          : `Rejected ${item.requester_name}`,
      });
      onRefresh();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No pending join requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <div key={req.participant_id} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar name={req.requester_name} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-gray-900">{req.requester_name}</p>
                  <span className="text-gray-400 text-xs">→</span>
                  <Badge variant="outline" className="text-xs">{req.persona_name}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{req.quest_activity}</p>
                {req.message && (
                  <p className="text-sm text-gray-600 mt-1.5 bg-gray-50 rounded-lg px-3 py-2 italic">
                    "{req.message}"
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">{fmtTime(req.requested_at)}</p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button
                size="sm"
                className="h-8 bg-green-600 hover:bg-green-700 text-white"
                disabled={processing === req.participant_id}
                onClick={() => decide(req, "accept")}
              >
                {processing === req.participant_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                disabled={processing === req.participant_id}
                onClick={() => decide(req, "reject")}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DMs Tab ─────────────────────────────────────────────────────────────────

function DMsTab({ conversations, loading, onRefresh }: {
  conversations: PersonaConversationItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [selectedConv, setSelectedConv] = useState<PersonaConversationItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async (conv: PersonaConversationItem) => {
    setLoadingMsgs(true);
    try {
      const data = await api.adminPersonas.getConversationMessages(conv.conversation_id);
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  const selectConv = (conv: PersonaConversationItem) => {
    setSelectedConv(conv);
    setReply("");
    loadMessages(conv);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!selectedConv || !reply.trim()) return;
    setSending(true);
    try {
      await api.adminPersonas.replyAsPersona(
        selectedConv.conversation_id,
        selectedConv.persona_id,
        reply.trim()
      );
      setReply("");
      await loadMessages(selectedConv);
      onRefresh();
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="flex h-[600px] border border-gray-200 rounded-xl overflow-hidden">
      {/* Conversation list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm px-4">
            No DMs to persona accounts yet
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.conversation_id}
            onClick={() => selectConv(conv)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedConv?.conversation_id === conv.conversation_id ? "bg-gray-50" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Avatar name={conv.other_user_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 truncate">{conv.other_user_name}</p>
                </div>
                <p className="text-xs text-gray-400">→ <span className="text-gray-500">{conv.persona_name}</span></p>
                {conv.last_message_content && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message_content}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Message pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <Avatar name={selectedConv.persona_name} size="sm" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Replying as <span className="text-primary">{selectedConv.persona_name}</span>
                </p>
                <p className="text-xs text-gray-500">to {selectedConv.other_user_name}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {loadingMsgs && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              )}
              {messages.map((msg) => {
                const isPersona = msg.sender_id === selectedConv.persona_id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isPersona ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        isPersona
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-bl-sm"
                      }`}
                    >
                      {msg.is_deleted ? (
                        <span className="italic opacity-60">Message deleted</span>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
              <Textarea
                placeholder={`Reply as ${selectedConv.persona_name}…`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="text-sm min-h-[40px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <Button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="bg-primary hover:bg-york-red-dark self-end"
                size="sm"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminReplyPage() {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();
  const { isLoading } = useUser();

  const [activeTab, setActiveTab] = useState("personas");
  const [personas, setPersonas] = useState<PersonaUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequestItem[]>([]);
  const [conversations, setConversations] = useState<PersonaConversationItem[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");

  useEffect(() => {
    if (user && !user.is_admin) router.replace("/");
  }, [user, router]);

  const fetchPersonas = async () => {
    setLoadingPersonas(true);
    try {
      const data = await api.adminPersonas.listPersonas();
      setPersonas(data);
    } finally {
      setLoadingPersonas(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await api.adminPersonas.listPendingRequests();
      setPendingRequests(data);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchConversations = async () => {
    setLoadingConvs(true);
    try {
      const data = await api.adminPersonas.listPersonaConversations();
      setConversations(data);
    } finally {
      setLoadingConvs(false);
    }
  };

  useEffect(() => {
    if (!user?.is_admin) return;
    fetchPersonas();
    fetchRequests();
    fetchConversations();
  }, [user]);

  // Poll requests + conversations every 30s
  useEffect(() => {
    if (!user?.is_admin) return;
    const interval = setInterval(() => {
      fetchRequests();
      fetchConversations();
    }, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  if (!isHydrated || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  const handleSelectForQuest = (personaId: string) => {
    setSelectedPersonaId(personaId);
    setActiveTab("post-quest");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Compass className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Persona Control</h1>
          <p className="text-sm text-gray-500">Manage seeded accounts, post quests, handle inbox</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personas" className="flex items-center gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            Personas
          </TabsTrigger>
          <TabsTrigger value="post-quest" className="flex items-center gap-1.5 text-xs">
            <Compass className="w-3.5 h-3.5" />
            Post Quest
          </TabsTrigger>
          <TabsTrigger value="join-requests" className="flex items-center gap-1.5 text-xs">
            <Inbox className="w-3.5 h-3.5" />
            Requests
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 bg-primary text-white text-[10px] px-1.5 py-0 h-4">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dms" className="flex items-center gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            DMs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personas" className="mt-4">
          <PersonasTab
            personas={personas}
            loading={loadingPersonas}
            onRefresh={fetchPersonas}
            onSelectForQuest={handleSelectForQuest}
          />
        </TabsContent>

        <TabsContent value="post-quest" className="mt-4">
          <PostQuestTab
            personas={personas}
            selectedPersonaId={selectedPersonaId}
            onSelectPersona={setSelectedPersonaId}
          />
        </TabsContent>

        <TabsContent value="join-requests" className="mt-4">
          <JoinRequestsTab
            requests={pendingRequests}
            loading={loadingRequests}
            onRefresh={fetchRequests}
          />
        </TabsContent>

        <TabsContent value="dms" className="mt-4">
          <DMsTab
            conversations={conversations}
            loading={loadingConvs}
            onRefresh={fetchConversations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
