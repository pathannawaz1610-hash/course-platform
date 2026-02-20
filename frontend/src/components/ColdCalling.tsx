import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { fetchColdCallPrompts, postColdCallMessage, postColdCallReply, removeColdCallStar, starColdCallMessage } from '@/lib/binding/actions/coldCallActions';
import type { StoredSession } from "@/types/session";

type ColdCallPrompt = {
  promptId: string;
  courseId: string;
  topicId: string;
  promptText: string;
  helperText?: string | null;
};

type ColdCallMessage = {
  messageId: string;
  body: string;
  parentId: string | null;
  rootId: string | null;
  createdAt: string;
  user: {
    userId: string;
    fullName: string;
  };
  starCount: number;
  starredByMe: boolean;
};

type ColdCallPayload = {
  prompt: ColdCallPrompt;
  cohort: {
    cohortId: string;
    name: string;
  };
  hasSubmitted: boolean;
  messages?: ColdCallMessage[];
};

type ColdCallingProps = {
  topicId?: string | null;
  session: StoredSession | null;
  onTelemetryEvent?: (eventType: string, payload?: Record<string, unknown>) => void;
};

const formatRelativeTime = (timestamp: string): string => {
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) {
    return "Just now";
  }
  const diffMs = Date.now() - value;
  if (diffMs < 60_000) {
    return "Just now";
  }
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hrs ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getInitials = (fullName: string): string => {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "L";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "L";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase();
};

export default function ColdCalling({ topicId, session, onTelemetryEvent }: ColdCallingProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState<ColdCallPrompt | null>(null);
  const [messages, setMessages] = useState<ColdCallMessage[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [pendingStars, setPendingStars] = useState<Set<string>>(new Set());

  const accessToken = session?.accessToken ?? null;
  const currentUserId = session?.userId ?? null;

  const emitTelemetry = useCallback(
    (eventType: string, payload?: Record<string, unknown>) => {
      if (!topicId) return;
      onTelemetryEvent?.(eventType, { topicId, ...payload });
    },
    [onTelemetryEvent, topicId],
  );

  const loadPrompt = useCallback(async () => {
    if (!topicId || !accessToken || !session) {
      setPrompt(null);
      setMessages([]);
      setHasSubmitted(false);
      setAccessMessage(null);
      return;
    }

    setLoading(true);
    setAccessMessage(null);
    try {
      // ✅ UPDATED: Use coldCallActions instead of direct fetch
      const payload = await fetchColdCallPrompts(topicId, session);
      setPrompt(payload.prompt);
      setHasSubmitted(payload.hasSubmitted);
      setMessages(payload.messages ?? []);
      emitTelemetry("cold_call.loaded", { promptId: payload.prompt.promptId, hasSubmitted: payload.hasSubmitted });
    } catch (error: any) {
      if (error.status === 403) {
        setAccessMessage(error.message ?? "Cohort access required to participate.");
        setPrompt(null);
        setMessages([]);
        setHasSubmitted(false);
        return;
      }
      if (error.status === 404) {
        setPrompt(null);
        setMessages([]);
        setHasSubmitted(false);
        return;
      }
      toast({
        variant: "destructive",
        title: "Cold calling unavailable",
        description: error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast, topicId, emitTelemetry]);

  useEffect(() => {
    setResponseText("");
    setReplyTargetId(null);
    setReplyText("");
    void loadPrompt();
  }, [loadPrompt, topicId]);

  const messageMap = useMemo(() => {
    const map = new Map<string, ColdCallMessage>();
    messages.forEach((message) => {
      map.set(message.messageId, message);
    });
    return map;
  }, [messages]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, ColdCallMessage[]>();
    messages.forEach((message) => {
      const key = message.parentId ?? null;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(message);
    });
    map.forEach((list) => {
      list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    });
    return map;
  }, [messages]);

  const rootMessages = useMemo(() => {
    const roots = childrenMap.get(null) ?? [];
    const sorted = [...roots].sort((a, b) => {
      const aSelf = currentUserId && a.user.userId === currentUserId;
      const bSelf = currentUserId && b.user.userId === currentUserId;
      if (aSelf && !bSelf) return -1;
      if (!aSelf && bSelf) return 1;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    return sorted;
  }, [childrenMap, currentUserId]);

  const submitResponse = async () => {
    const trimmedResponse = responseText.trim();
    if (!prompt || !accessToken || !session || !trimmedResponse) {
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      // ✅ UPDATED: Use coldCallActions instead of direct fetch
      await postColdCallMessage({ promptId: prompt.promptId, body: responseText.trim() }, session);
      setResponseText("");
      await loadPrompt();
      emitTelemetry("cold_call.submit", { promptId: prompt.promptId, length: trimmedResponse.length });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async () => {
    const trimmedReply = replyText.trim();
    if (!replyTargetId || !trimmedReply || !accessToken || !session) {
      return;
    }
    if (replySubmitting) {
      return;
    }
    setReplySubmitting(true);
    try {
      // ✅ UPDATED: Use coldCallActions instead of direct fetch
      await postColdCallReply({ parentId: replyTargetId, body: replyText.trim() }, session);
      setReplyTargetId(null);
      setReplyText("");
      await loadPrompt();
      emitTelemetry("cold_call.reply", { messageId: replyTargetId, length: trimmedReply.length });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Reply failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setReplySubmitting(false);
    }
  };

  const toggleStar = async (message: ColdCallMessage) => {
    if (!accessToken || !session || pendingStars.has(message.messageId)) {
      return;
    }
    setPendingStars((prev) => new Set(prev).add(message.messageId));
    try {
      if (message.starredByMe) {
        // ✅ UPDATED: Use coldCallActions instead of direct fetch
        await removeColdCallStar(message.messageId, session);
        setMessages((prev) =>
          prev.map((item) =>
            item.messageId === message.messageId
              ? { ...item, starredByMe: false, starCount: Math.max(0, item.starCount - 1) }
              : item,
          ),
        );
        emitTelemetry("cold_call.star", { messageId: message.messageId, action: "remove" });
      } else {
        // ✅ UPDATED: Use coldCallActions instead of direct fetch
        await starColdCallMessage({ messageId: message.messageId }, session);
        setMessages((prev) =>
          prev.map((item) =>
            item.messageId === message.messageId
              ? { ...item, starredByMe: true, starCount: item.starCount + 1 }
              : item,
          ),
        );
        emitTelemetry("cold_call.star", { messageId: message.messageId, action: "add" });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Star failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPendingStars((prev) => {
        const next = new Set(prev);
        next.delete(message.messageId);
        return next;
      });
    }
  };

  if (!topicId) {
    return null;
  }

  if (!accessToken) {
    return (
      <div className="rounded-3xl border border-[#eadfd6] bg-white/80 p-6 shadow-sm">
        <div className="text-sm font-semibold text-[#bf2f1f]">Cold Calling</div>
        <p className="text-sm text-[#4a4845] mt-2">
          Sign in to share your response and join the cohort discussion.
        </p>
      </div>
    );
  }

  if (accessMessage) {
    return (
      <div className="rounded-3xl border border-[#f3d3c2] bg-[#fff4ea] p-6 shadow-sm">
        <div className="text-sm font-semibold text-[#bf2f1f]">Cold Calling</div>
        <p className="text-sm text-[#5c2b18] mt-2">{accessMessage}</p>
      </div>
    );
  }

  if (!prompt && !loading) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-[#f3d3c2] bg-[#fff5f0] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className="rounded-full bg-[#bf2f1f] px-2.5 py-1 text-white">Cold Calling</span>
        <span className="text-[#bf2f1f]">Cohort Interaction</span>
      </div>

      <div className="mt-4">
        <h4 className="text-lg font-bold text-[#1e293b]">{prompt?.promptText ?? "Cold calling prompt"}</h4>
        {prompt?.helperText && (
          <p className="text-sm text-[#4a4845] mt-1">{prompt.helperText}</p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#4a4845] mt-4">Loading cohort responses...</p>
      ) : !hasSubmitted ? (
        <div className="mt-5 space-y-3">
          <textarea
            value={responseText}
            onChange={(event) => setResponseText(event.target.value)}
            placeholder="Share your response with the cohort..."
            className="w-full min-h-[120px] rounded-2xl border-2 border-[#f1d5c8] bg-white px-4 py-3 text-sm text-[#1e293b] focus:outline-none focus:border-[#bf2f1f]"
          />
          <button
            type="button"
            onClick={submitResponse}
            disabled={!responseText.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[#bf2f1f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a62619] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit to Batch"}
          </button>
          <p className="text-xs text-[#a17969]">
            Note: You will see your batchmates&apos; responses only after you submit your own answer.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#4a4845]">
            Cohort responses ({rootMessages.length} members)
          </div>

          <div className="space-y-4">
            {rootMessages.map((message) => (
              <ColdCallMessageCard
                key={message.messageId}
                message={message}
                currentUserId={currentUserId}
                replyTargetId={replyTargetId}
                replyText={replyText}
                onReplyTextChange={setReplyText}
                onReplyTargetChange={setReplyTargetId}
                onSubmitReply={submitReply}
                replySubmitting={replySubmitting}
                childrenMap={childrenMap}
                messageMap={messageMap}
                onToggleStar={toggleStar}
                pendingStars={pendingStars}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type MessageCardProps = {
  message: ColdCallMessage;
  currentUserId: string | null;
  replyTargetId: string | null;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onReplyTargetChange: (value: string | null) => void;
  onSubmitReply: () => void;
  replySubmitting: boolean;
  childrenMap: Map<string | null, ColdCallMessage[]>;
  messageMap: Map<string, ColdCallMessage>;
  onToggleStar: (message: ColdCallMessage) => void;
  pendingStars: Set<string>;
};

function ColdCallMessageCard({
  message,
  currentUserId,
  replyTargetId,
  replyText,
  onReplyTextChange,
  onReplyTargetChange,
  onSubmitReply,
  replySubmitting,
  childrenMap,
  messageMap,
  onToggleStar,
  pendingStars,
}: MessageCardProps) {
  const isSelf = Boolean(currentUserId && message.user.userId === currentUserId);
  const canReply = !isSelf;
  const replies = childrenMap.get(message.messageId) ?? [];
  const parent = message.parentId ? messageMap.get(message.parentId) : null;
  const repliedToName = parent?.user?.fullName ?? null;
  const showReplyBox = replyTargetId === message.messageId;
  const starDisabled = pendingStars.has(message.messageId) || isSelf;

  return (
    <div className="rounded-2xl border border-[#f2e2d8] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 bg-[#f6e6db]">
          <AvatarFallback className="text-xs font-semibold text-[#a8551a]">
            {getInitials(message.user.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#1e293b]">{message.user.fullName}</span>
            {isSelf && (
              <span className="rounded-full bg-[#ffe6dc] px-2 py-0.5 text-[10px] font-semibold text-[#bf2f1f]">
                You
              </span>
            )}
            {repliedToName && (
              <span className="text-xs text-[#a17969]">replied to {repliedToName}</span>
            )}
            <span className="ml-auto text-xs text-[#a3a3a3]">{formatRelativeTime(message.createdAt)}</span>
          </div>
          <p className="text-sm text-[#2c3e50]">{message.body}</p>
          <div className="flex items-center gap-4 text-xs text-[#4a4845]">
            <button
              type="button"
              onClick={() => onToggleStar(message)}
              disabled={starDisabled}
              className={`inline-flex items-center gap-1 font-semibold ${message.starredByMe ? "text-[#f59e0b]" : "text-[#4a4845]"
                }`}
            >
              <Star className={`h-4 w-4 ${message.starredByMe ? "fill-[#f59e0b]" : ""}`} />
              <span>{message.starCount}</span>
            </button>
            {canReply && (
              <button
                type="button"
                className="text-xs font-semibold text-[#bf2f1f] hover:underline"
                onClick={() => onReplyTargetChange(message.messageId)}
              >
                Reply
              </button>
            )}
          </div>

          {showReplyBox && (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-semibold text-[#bf2f1f] uppercase tracking-wide">
                Replying to {message.user.fullName}
                <button
                  type="button"
                  className="ml-2 text-[#4a4845] font-semibold"
                  onClick={() => onReplyTargetChange(null)}
                >
                  Cancel
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={replyText}
                  onChange={(event) => onReplyTextChange(event.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 rounded-full border-2 border-[#f1d5c8] bg-white px-4 py-2 text-sm text-[#1e293b] focus:outline-none focus:border-[#bf2f1f]"
                />
                <button
                  type="button"
                  onClick={onSubmitReply}
                  disabled={!replyText.trim() || replySubmitting}
                  className="inline-flex items-center justify-center rounded-full bg-[#bf2f1f] p-2 text-white shadow-sm transition hover:bg-[#a62619] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="mt-4 space-y-3 border-l border-[#f0d9cb] pl-5">
          {replies.map((reply) => (
            <ColdCallMessageCard
              key={reply.messageId}
              message={reply}
              currentUserId={currentUserId}
              replyTargetId={replyTargetId}
              replyText={replyText}
              onReplyTextChange={onReplyTextChange}
              onReplyTargetChange={onReplyTargetChange}
              onSubmitReply={onSubmitReply}
              replySubmitting={replySubmitting}
              childrenMap={childrenMap}
              messageMap={messageMap}
              onToggleStar={onToggleStar}
              pendingStars={pendingStars}
            />
          ))}
        </div>
      )}
    </div>
  );
}
