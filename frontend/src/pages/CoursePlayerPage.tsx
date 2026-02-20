import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Menu,
  Play,
  Pause,
  SkipForward,
  MessageSquare,
  FileText,
  ChevronLeft,
  Lock,
  Book,
  Maximize,
  Minimize,
  X,
  Send,
  ArrowUpLeftFromCircle,
  BookOpen,
  ArrowDown,
  Move,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchAssistantSession, queryAssistant } from '@/lib/binding/actions/assistantActions';
import { fetchCourse, fetchCourseTopics, checkEnrollment, enrollInCourse, fetchCohortProject as fetchCohortProjectAction } from '@/lib/binding/actions/courseActions';
import { fetchPromptSuggestions as fetchPromptSuggestionsAction } from '@/lib/binding/actions/lessonActions';
import { fetchQuizSections, startQuizAttempt, submitQuizAttempt } from '@/lib/binding/actions/quizActions';
import { buildApiUrl } from "@/lib/api"; // Still needed for cohort projects and other calls
import { streamJobResult } from "@/lib/streamJob";
import { subscribeToSession } from "@/utils/session";
import { recordTelemetryEvent, updateTelemetryAccessToken } from "@/utils/telemetry";
import type { StoredSession } from "@/types/session";
import SimulationExercise, { SimulationPayload } from "@/components/SimulationExercise";
import ColdCalling from "@/components/ColdCalling";
import CohortProjectModal, { type CohortProjectPayload } from "@/components/CohortProjectModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";

const buildOfficeViewerUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(trimmed)}`;
};

const normalizeVideoUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    const toEmbed = (id: string | null) => (id ? `https://www.youtube.com/embed/${id}` : trimmed);

    if (host.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        return `https://www.youtube.com${parsed.pathname}`;
      }
      if (parsed.pathname === "/watch") {
        return toEmbed(parsed.searchParams.get("v"));
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return toEmbed(parsed.pathname.split("/").pop() ?? null);
      }
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\/+/, "");
      return toEmbed(id || null);
    }

    return trimmed;
  } catch {
    return trimmed;
  }
};

type ContentBlock = {
  id?: string;
  type: "text" | "image" | "video" | "ppt";
  data?: Record<string, unknown>;
};

type ContentBlockPayload = {
  version?: string;
  blocks: ContentBlock[];
};

const parseContentBlocks = (raw?: string | null): ContentBlockPayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const blocksRaw = (parsed as Record<string, unknown>).blocks;
    if (!Array.isArray(blocksRaw)) return null;
    const blocks = blocksRaw
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const node = entry as Record<string, unknown>;
        const rawType = typeof node.type === "string" ? node.type : "";
        if (rawType !== "text" && rawType !== "image" && rawType !== "video" && rawType !== "ppt") return null;
        return {
          id: typeof node.id === "string" ? node.id : undefined,
          type: rawType as ContentBlock["type"],
          data: typeof node.data === "object" && node.data ? (node.data as Record<string, unknown>) : undefined,
        } as ContentBlock;
      })
      .filter((block): block is ContentBlock => Boolean(block));
    if (blocks.length === 0) return null;
    const version = typeof (parsed as Record<string, unknown>).version === "string"
      ? ((parsed as Record<string, unknown>).version as string)
      : undefined;
    return { version, blocks };
  } catch {
    return null;
  }
};

const resolveTextVariant = (data: Record<string, unknown> | undefined) => {
  if (!data) return "";
  const variants =
    typeof data.variants === "object" && data.variants
      ? (data.variants as Record<string, unknown>)
      : null;
  const fromVariants =
    variants && typeof variants.default === "string"
      ? (variants.default as string)
      : variants && typeof variants.normal === "string"
        ? (variants.normal as string)
        : variants
          ? (Object.values(variants).find((value) => typeof value === "string") as string | undefined)
          : null;
  const content = typeof data.content === "string" ? data.content : "";
  return (fromVariants ?? content).trim();
};

const parseCohortProjectPayload = (value: unknown): CohortProjectPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const tagline = typeof record.tagline === "string" ? record.tagline.trim() : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  if (!title || !tagline || !description) {
    return null;
  }
  const notes = typeof record.notes === "string" ? record.notes.trim() : null;
  return { title, tagline, description, notes };
};

type ContentType = "video" | "quiz";

interface Lesson {
  topicId: string;
  courseId: string;
  moduleNo: number;
  moduleName: string;
  topicNumber: number;
  topicName: string;
  videoUrl: string | null;
  textContent: string | null;
  contentType: string;
  pptUrl?: string | null;
  slug: string;
  simulation?: SimulationPayload | null;
}

interface SubModule {
  id: string;
  title: string;
  type: ContentType;
  slug?: string;
  moduleNo: number;
  topicPairIndex?: number;
  topicNumber?: number;
  unlocked?: boolean;
  lockedDueToCooldown?: boolean;
  lockedDueToQuiz?: boolean;
  cooldownUnlockAt?: string | null;
  simulation?: SimulationPayload | null;
}

interface Module {
  id: number;
  title: string;
  submodules: SubModule[];
  unlocked: boolean;
  passed: boolean;
}

interface QuizSection {
  moduleNo: number;
  topicPairIndex: number;
  title: string;
  unlocked: boolean;
  passed: boolean;
  questionCount: number;
  lockedDueToCooldown?: boolean;
  lockedDueToQuiz?: boolean;
  cooldownUnlockAt?: string | null;
  moduleUnlockedAt?: string | null;
  moduleWindowEndsAt?: string | null;
}

interface QuizQuestion {
  questionId: string;
  prompt: string;
  options: { optionId: string; text: string }[];
}

interface QuizAttemptResult {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  passed: boolean;
  thresholdPercent: number;
}

type ChatMessage = {
  id: string;
  text: string;
  isBot: boolean;
  error?: boolean;
  suggestionContext?: PromptSuggestion | null;
};

interface PromptSuggestion {
  id: string;
  promptText: string;
  answer?: string | null;
}

const makeId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const pickRandomSubset = <T,>(items: T[], count: number): T[] => {
  if (items.length <= count) {
    return items;
  }
  const pool = [...items];
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
};

const PASSING_PERCENT_THRESHOLD = 70;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

const buildTopicGreeting = (lesson?: Lesson | null) => {
  if (!lesson) {
    return "Hi! Ask anything about this course.";
  }
  return `Learning about "${lesson.topicName}"? I can summarize the takeaways or offer a quick practice prompt.`;
};

const DEFAULT_STUDY_FALLBACK =
  "### Study material coming soon\nWe'll keep this lesson updated with fresh guidance. Check back later or explore the simulation exercise below.";

const noteRegex = /^note[:\-]\s*/i;
const transitionRegex = /^(transition|tip)[:\-]\s*/i;

const normalizeStudyMarkdown = (raw?: string | null): string => {
  const text = raw?.trim();
  if (!text) {
    return "";
  }

  if (/#\s|<h[1-6]/i.test(text)) {
    return text;
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const bulletRegex = /^[-*\u2022]\s+/;
  const numberedRegex = /^\d+\.\s+/;
  const transformed: string[] = [];

  lines.forEach((line, index) => {
    if (!line) {
      transformed.push("");
      return;
    }

    if (noteRegex.test(line)) {
      transformed.push(`> **Note:** ${line.replace(noteRegex, "").trim()}`);
      return;
    }

    if (transitionRegex.test(line)) {
      transformed.push(`> **Tip:** ${line.replace(transitionRegex, "").trim()}`);
      return;
    }

    if (bulletRegex.test(line)) {
      transformed.push(line.replace(bulletRegex, "- "));
      return;
    }

    if (numberedRegex.test(line)) {
      transformed.push(line.replace(numberedRegex, (match) => `${match.trim()} `));
      return;
    }

    const looksLikeHeading = /^[A-Z0-9][A-Za-z0-9\s'"-]*$/.test(line) && line.length <= 90;
    const endsWithColon = line.endsWith(":");

    if (index === 0 && looksLikeHeading) {
      transformed.push(`# ${line.replace(/:$/, "")}`);
    } else if (looksLikeHeading && endsWithColon) {
      transformed.push(`### ${line.replace(/:$/, "")}`);
    } else if (looksLikeHeading) {
      transformed.push(`## ${line}`);
    } else {
      transformed.push(line);
    }
  });

  const result = transformed.join("\n\n").trim();
  return result || "";
};

const studyMarkdownComponents: Components = {
  h1: (props) => (
    <h1 className="text-3xl font-black text-[#1c242c] mb-6 tracking-tight" {...props} />
  ),
  h2: (props) => (
    <h2
      className="text-2xl font-bold text-[#bf2f1f] mt-8 mb-4 border-l-4 border-[#bf2f1f] pl-3"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="text-xl font-semibold text-[#1e3a47] mt-6 mb-3 uppercase tracking-wide" {...props} />
  ),
  p: (props) => (
    <p className="text-base sm:text-lg leading-7 text-[#2c3e50] mb-4" {...props} />
  ),
  ul: (props) => (
    <ul className="list-disc marker:text-[#bf2f1f] pl-6 space-y-2 text-[#2c3e50]" {...props} />
  ),
  ol: (props) => (
    <ol className="list-decimal pl-6 space-y-2 text-[#2c3e50]" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-[#bf2f1f]/60 bg-white/80 rounded-r-2xl px-4 py-3 text-[#4a4845] italic shadow-sm"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-semibold text-[#111827]" {...props} />,
  em: (props) => <em className="italic text-[#374151]" {...props} />,
};

const CoursePlayerPage: React.FC = () => {
  const { id: courseKey, lesson: lessonSlugParam } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [session, setSession] = useState<StoredSession | null>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [sections, setSections] = useState<QuizSection[]>([]);
  const [courseProgress, setCourseProgress] = useState(0);
  const isComplete = useMemo(() => Math.round(courseProgress) >= 100, [courseProgress]);
  const [activeSlug, setActiveSlug] = useState<string | null>(lessonSlugParam ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  const lastProgressSnapshotRef = useRef<number | null>(null);
  const [passedQuizzes, setPassedQuizzes] = useState<Set<string>>(new Set());

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Widgets
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRect, setChatRect] = useState({ x: 0, y: 0, width: 350, height: 450, initialized: false });
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesRect, setNotesRect] = useState({ x: 0, y: 0, width: 350, height: 300, initialized: false });
  const [studyWidgetOpen, setStudyWidgetOpen] = useState(false);
  const [studyWidgetRect, setStudyWidgetRect] = useState({ x: 0, y: 0, width: 600, height: 450, initialized: false });
  const [viewport, setViewport] = useState({ isMobile: false, isTablet: false });
  const isCompactLayout = viewport.isMobile || viewport.isTablet;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      const width = window.innerWidth;
      const nextMobile = width < 640;
      const nextTablet = width >= 640 && width < 1024;
      setViewport((prev) => {
        if (prev.isMobile === nextMobile && prev.isTablet === nextTablet) {
          return prev;
        }
        const wasCompact = prev.isMobile || prev.isTablet;
        const nextCompact = nextMobile || nextTablet;
        if (wasCompact !== nextCompact) {
          setSidebarOpen(nextCompact ? false : true);
        }
        return { isMobile: nextMobile, isTablet: nextTablet };
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [cohortProjectOpen, setCohortProjectOpen] = useState(false);
  const [cohortProject, setCohortProject] = useState<CohortProjectPayload | null>(null);
  const [cohortProjectBatch, setCohortProjectBatch] = useState<number | null>(null);
  const [cohortProjectLoading, setCohortProjectLoading] = useState(false);
  const [cohortProjectError, setCohortProjectError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "welcome", text: buildTopicGreeting(), isBot: true },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [starterSuggestions, setStarterSuggestions] = useState<PromptSuggestion[]>([]);
  const [inlineFollowUps, setInlineFollowUps] = useState<Record<string, PromptSuggestion[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [usedSuggestionIds, setUsedSuggestionIds] = useState<Set<string>>(new Set());
  const [pendingSuggestion, setPendingSuggestion] = useState<PromptSuggestion | null>(null);
  const [visibleStarterSuggestions, setVisibleStarterSuggestions] = useState<PromptSuggestion[]>([]);
  const [shouldRefreshStarterBatch, setShouldRefreshStarterBatch] = useState(true);
  const [starterAnchorMessageId, setStarterAnchorMessageId] = useState<string | null>(null);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null);
  const [quizPhase, setQuizPhase] = useState<"intro" | "active" | "result">("intro");
  const [quizTimer, setQuizTimer] = useState(60);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizAttemptResult | null>(null);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [selectedSection, setSelectedSection] = useState<{ moduleNo: number; topicPairIndex: number } | null>(null);

  const dragInfo = useRef<{
    isDragging: boolean;
    widget: "study" | "chat" | "notes" | null;
    type: string | null;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    mouseX: number;
    mouseY: number;
  }>({
    isDragging: false,
    widget: null,
    type: null,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    mouseX: 0,
    mouseY: 0,
  });

  const activeLesson = useMemo(
    () => lessons.find((l) => l.slug === activeSlug) ?? lessons[0],
    [lessons, activeSlug],
  );
  const emitTelemetry = useCallback(
    (
      eventType: string,
      payload?: Record<string, unknown>,
      context?: { courseId?: string | null; moduleNo?: number | null; topicId?: string | null },
    ) => {
      const resolvedCourseId = context?.courseId ?? activeLesson?.courseId ?? lessons[0]?.courseId ?? null;
      if (!resolvedCourseId) {
        return;
      }
      recordTelemetryEvent({
        courseId: resolvedCourseId,
        moduleNo: context?.moduleNo ?? activeLesson?.moduleNo ?? null,
        topicId: context?.topicId ?? activeLesson?.topicId ?? null,
        eventType,
        payload,
      });
    },
    [activeLesson?.courseId, activeLesson?.moduleNo, activeLesson?.topicId, lessons],
  );
  const activePptEmbedUrl = useMemo(() => buildOfficeViewerUrl(activeLesson?.pptUrl), [activeLesson?.pptUrl]);
  const currentModuleId = activeLesson?.moduleNo ?? modules[0]?.id ?? 1;
  const realModules = useMemo(() => modules.filter((m) => m.id > 0), [modules]);
  const currentModuleDisplay = useMemo(() => {
    if (currentModuleId === 0) return 0;
    const idx = realModules.findIndex((m) => m.id === currentModuleId);
    return idx >= 0 ? idx + 1 : currentModuleId;
  }, [realModules, currentModuleId]);
  const greetingMessage = useMemo(() => buildTopicGreeting(activeLesson), [activeLesson]);
  const availableStarterSuggestions = useMemo(() => {
    if (starterSuggestions.length === 0) return [];
    return starterSuggestions.filter((suggestion) => !usedSuggestionIds.has(suggestion.id));
  }, [starterSuggestions, usedSuggestionIds]);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const container = chatListRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!shouldRefreshStarterBatch) {
      return;
    }

    if (starterSuggestions.length === 0) {
      setVisibleStarterSuggestions([]);
      setShouldRefreshStarterBatch(false);
      return;
    }

    if (availableStarterSuggestions.length === 0) {
      if (starterSuggestions.length > 0) {
        setVisibleStarterSuggestions([]);
        setUsedSuggestionIds(new Set());
      } else {
        setVisibleStarterSuggestions([]);
        setShouldRefreshStarterBatch(false);
      }
      return;
    }

    setVisibleStarterSuggestions(pickRandomSubset(availableStarterSuggestions, 3));
    setShouldRefreshStarterBatch(false);
  }, [availableStarterSuggestions, shouldRefreshStarterBatch, starterSuggestions]);

  useEffect(() => {
    const welcomeId = `welcome-${activeLesson?.slug ?? "welcome"}`;
    setChatMessages([{ id: welcomeId, text: greetingMessage, isBot: true }]);
    setUsedSuggestionIds(new Set());
    setPendingSuggestion(null);
    setInlineFollowUps({});
    setVisibleStarterSuggestions([]);
    setShouldRefreshStarterBatch(true);
    setStarterAnchorMessageId(welcomeId);
    setChatSessionId(null);
    setChatHistoryLoading(false);
  }, [activeLesson?.slug, greetingMessage]);

  const loadChatHistory = useCallback(async () => {
    if (!chatOpen) {
      return;
    }
    if (!session?.accessToken) {
      return;
    }
    const courseIdForChat = (courseKey ?? activeLesson?.courseId ?? "").trim();
    const topicIdForChat = activeLesson?.topicId ?? null;
    if (!courseIdForChat || !topicIdForChat) {
      return;
    }

    setChatHistoryLoading(true);
    try {
      // ✅ UPDATED: Use assistantActions instead of direct fetch
      const payload = await fetchAssistantSession(courseIdForChat, topicIdForChat, session);
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      if (history.length > 0) {
        const welcomeId = `welcome-${activeLesson?.slug ?? "welcome"}`;
        const mapped: ChatMessage[] = history.map((message: any) => ({
          id: typeof message?.messageId === "string" ? message.messageId : makeId(),
          text: typeof message?.content === "string" ? message.content : "",
          isBot: message?.role !== "user",
        }));
        setChatMessages([{ id: welcomeId, text: greetingMessage, isBot: true }, ...mapped]);
        const lastBot = [...mapped].reverse().find((msg) => msg.isBot);
        setStarterAnchorMessageId(lastBot?.id ?? welcomeId);
      }
      setChatSessionId(typeof payload?.sessionId === "string" ? payload.sessionId : null);
    } finally {
      setChatHistoryLoading(false);
    }
  }, [
    activeLesson?.courseId,
    activeLesson?.slug,
    activeLesson?.topicId,
    chatOpen,
    courseKey,
    greetingMessage,
    session?.accessToken,
  ]);

  useEffect(() => {
    void loadChatHistory();
  }, [loadChatHistory]);

  const fetchTopics = useCallback(async () => {
    if (!courseKey) return;
    try {
      // ✅ UPDATED: Use courseActions instead of direct fetch
      const data = await fetchCourseTopics(courseKey, session);
      const mapped: Lesson[] = (data ?? []).map((t: any) => ({
        topicId: t.topicId,
        courseId: t.courseId,
        moduleNo: t.moduleNo,
        moduleName: t.moduleName,
        topicNumber: t.topicNumber,
        topicName: t.topicName,
        videoUrl: t.videoUrl,
        textContent: t.textContent,
        contentType: t.contentType,
        pptUrl: t.pptUrl ?? null,
        slug: slugify(t.topicName),
        simulation: t.simulation ?? null,
      }));
      const sorted = mapped.sort((a, b) => a.moduleNo - b.moduleNo || a.topicNumber - b.topicNumber);
      setLessons(sorted);
      if (!activeSlug && sorted.length > 0) {
        setActiveSlug(sorted[0].slug);
        setLocation(`/course/${courseKey}/learn/${sorted[0].slug}`);
      }
      // Modules will be built once sections arrive; nothing else here
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load course",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [courseKey, session?.accessToken, setLocation, toast]);

  const loadStarterSuggestions = useCallback(async () => {
    if (!courseKey || !session?.accessToken) return;
    const topicId = activeLesson?.topicId;
    setSuggestionsLoading(true);
    try {
      // ✅ UPDATED: Use lessonActions instead of direct fetch
      const data = await fetchPromptSuggestionsAction(courseKey, topicId, session);
      const list = Array.isArray(data) ? data : [];
      setStarterSuggestions(list);
    } catch (error) {
      console.error("Failed to load prompt suggestions", error);
      setStarterSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [courseKey, session?.accessToken, activeLesson?.topicId]);

  useEffect(() => {
    setShouldRefreshStarterBatch(true);
  }, [starterSuggestions]);

  // Lock system disabled: keep sections empty and progress at 0
  const fetchSections = useCallback(async () => {
    if (!courseKey || !session?.accessToken) return;
    try {
      // ✅ UPDATED: Use quizActions instead of direct fetch
      const data = await fetchQuizSections(courseKey, session);
      const list: QuizSection[] = (data ?? []).map((s: any) => ({
        moduleNo: s.moduleNo,
        topicPairIndex: s.topicPairIndex,
        title: s.title ?? `Module ${s.moduleNo} - Topic pair ${s.topicPairIndex}`,
        unlocked: Boolean(s.unlocked),
        passed: Boolean(s.passed),
        questionCount: s.questionCount ?? 5,
        lockedDueToCooldown: Boolean(s.moduleLockedDueToCooldown),
        lockedDueToQuiz: Boolean(s.moduleLockedDueToQuiz),
        cooldownUnlockAt: s.moduleCooldownUnlockAt ?? null,
        moduleUnlockedAt: s.moduleUnlockedAt ?? null,
        moduleWindowEndsAt: s.moduleWindowEndsAt ?? null,
      }));
      setSections(list);
      const total = list.length;
      const passed = list.filter((s) => s.passed).length;
      setCourseProgress(total > 0 ? Math.round((passed / total) * 100) : 0);
    } catch (error) {
      console.error("Failed to load quiz sections", error);
    }
  }, [courseKey, session?.accessToken]);

  const fetchCohortProject = useCallback(async () => {
    if (!courseKey || !session?.accessToken) {
      setCohortProject(null);
      setCohortProjectBatch(null);
      setCohortProjectError("Sign in to view cohort project details.");
      return;
    }

    setCohortProjectLoading(true);
    setCohortProjectError(null);
    try {
      // ✅ UPDATED: Use fetchCohortProject action
      const data = await fetchCohortProjectAction(courseKey, session);

      const parsed = parseCohortProjectPayload(data.project);
      setCohortProject(parsed);
      setCohortProjectBatch(typeof data.batchNo === "number" ? data.batchNo : null);
      if (!parsed) {
        setCohortProjectError("Project details are incomplete.");
      }
    } catch (error) {
      setCohortProject(null);
      setCohortProjectBatch(null);
      setCohortProjectError(error instanceof Error ? error.message : "Unable to load cohort project.");
    } finally {
      setCohortProjectLoading(false);
    }
  }, [courseKey, session?.accessToken]);

  const handleOpenCohortProject = useCallback(() => {
    setCohortProjectOpen(true);
    void fetchCohortProject();
  }, [fetchCohortProject]);

  const handleCloseCohortProject = useCallback(() => {
    setCohortProjectOpen(false);
  }, []);

  const fetchProgress = useCallback(async () => {
    // courseProgress derived from sections
  }, []);

  // Hydrate modules with quizzes when lessons/sections change
  useEffect(() => {
    if (lessons.length === 0) return;
    const grouped = new Map<number, Lesson[]>();
    lessons.forEach((lesson) => {
      const list = grouped.get(lesson.moduleNo) ?? [];
      list.push(lesson);
      grouped.set(lesson.moduleNo, list);
    });
    const moduleEntries = Array.from(grouped.entries()).sort(([a], [b]) => a - b);

    const newModules: Module[] = moduleEntries.map(([moduleNo, lessonsForModule]) => {
      const sortedLessons = lessonsForModule.sort((a, b) => a.topicNumber - b.topicNumber);
      const submodules: SubModule[] = [];

      if (moduleNo === 0) {
        sortedLessons.forEach((lesson) => {
          submodules.push({
            id: lesson.topicId,
            title: lesson.topicName,
            type: "video",
            slug: lesson.slug,
            moduleNo: lesson.moduleNo,
            topicNumber: lesson.topicNumber,
            unlocked: true,
            simulation: lesson.simulation,
          });
        });
        return {
          id: moduleNo,
          title: sortedLessons[0]?.moduleName ?? "Introduction",
          submodules,
          unlocked: true,
          passed: true,
        };
      }

      const sectionForModule = sections.filter((s) => s.moduleNo === moduleNo).sort((a, b) => a.topicPairIndex - b.topicPairIndex);
      const moduleUnlocked =
        moduleNo === 0
          ? true
          : sectionForModule.some((s) => s.unlocked) || moduleNo === 1;
      const modulePassed = sectionForModule.length === 0 || sectionForModule.every((s) => s.passed);
      const moduleLockedDueToCooldown = sectionForModule.some((s) => s.lockedDueToCooldown);
      const moduleLockedDueToQuiz = sectionForModule.some((s) => s.lockedDueToQuiz);
      const moduleCooldownUnlockAt =
        sectionForModule.find((s) => s.cooldownUnlockAt)?.cooldownUnlockAt ?? null;

      sortedLessons.forEach((lesson, idx) => {
        const pairIdx = Math.ceil((idx + 1) / 2);
        const section = sectionForModule.find((s) => s.topicPairIndex === pairIdx);
        const unlocked = moduleUnlocked && (section?.unlocked ?? true);
        submodules.push({
          id: lesson.topicId,
          title: lesson.topicName,
          type: "video",
          slug: lesson.slug,
          moduleNo: lesson.moduleNo,
          topicNumber: lesson.topicNumber,
          topicPairIndex: pairIdx,
          unlocked,
          lockedDueToCooldown: moduleLockedDueToCooldown,
          lockedDueToQuiz: moduleLockedDueToQuiz,
          cooldownUnlockAt: moduleCooldownUnlockAt,
          simulation: lesson.simulation,
        });
        if ((idx + 1) % 2 === 0) {
          submodules.push({
            id: `quiz-${moduleNo}-${pairIdx}`,
            title: `Quiz ${pairIdx}`,
            type: "quiz",
            moduleNo,
            topicPairIndex: pairIdx,
            unlocked,
            lockedDueToCooldown: moduleLockedDueToCooldown,
            lockedDueToQuiz: moduleLockedDueToQuiz,
            cooldownUnlockAt: moduleCooldownUnlockAt,
          });
        }
      });

      return {
        id: moduleNo,
        title: sortedLessons[0]?.moduleName ?? `Module ${moduleNo}`,
        submodules,
        unlocked: moduleUnlocked,
        passed: modulePassed,
      };
    });
    setModules(newModules);

    // If no active slug set yet, jump to first unlocked lesson
    if (!activeSlug) {
      const firstUnlockedLesson = newModules
        .flatMap((m) => m.submodules)
        .find((s) => s.type === "video" && s.unlocked && s.slug);
      if (firstUnlockedLesson?.slug) {
        setActiveSlug(firstUnlockedLesson.slug);
        setLocation(`/course/${courseKey}/learn/${firstUnlockedLesson.slug}`);
      }
    }
  }, [lessons, sections]);

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    void fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    setInlineFollowUps({});
    void loadStarterSuggestions();
  }, [loadStarterSuggestions]);

  useEffect(() => {
    if (!activeLesson?.topicId) {
      return;
    }
    emitTelemetry("lesson.view", {
      slug: activeLesson.slug,
      moduleNo: activeLesson.moduleNo,
      topicNumber: activeLesson.topicNumber,
    });
  }, [activeLesson?.topicId, activeLesson?.moduleNo, activeLesson?.topicNumber, activeLesson?.slug, emitTelemetry]);

  useEffect(() => {
    const unsubscribe = subscribeToSession((nextSession) => {
      setSession(nextSession);
      updateTelemetryAccessToken(nextSession?.accessToken ?? null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    updateTelemetryAccessToken(session?.accessToken ?? null);
  }, [session?.accessToken]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined" || !activeLesson?.topicId) {
      return;
    }
    let idle = false;
    let idleTimer: number | null = null;

    const markActive = () => {
      if (idle) {
        idle = false;
        emitTelemetry("idle.end");
      }
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        idle = true;
        emitTelemetry("idle.start", { reason: "no_interaction" });
      }, 30_000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!idle) {
          idle = true;
          emitTelemetry("idle.start", { reason: "tab_hidden" });
        }
      } else {
        idle = false;
        emitTelemetry("idle.end", { reason: "tab_visible" });
        markActive();
      }
    };

    markActive();
    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeLesson?.topicId, emitTelemetry]);

  useEffect(() => {
    if (!activeLesson?.courseId) {
      return;
    }
    const rounded = Math.round(courseProgress);
    if (
      lastProgressSnapshotRef.current === null ||
      Math.abs(rounded - lastProgressSnapshotRef.current) >= 5 ||
      rounded === 0 ||
      rounded === 100
    ) {
      lastProgressSnapshotRef.current = rounded;
      emitTelemetry("progress.snapshot", { percent: rounded });
    }
  }, [courseProgress, activeLesson?.courseId, emitTelemetry]);

  // Quiz timer
  useEffect(() => {
    let interval: number;
    if (isQuizMode && quizPhase === "active" && quizTimer > 0) {
      interval = window.setInterval(() => setQuizTimer((t) => t - 1), 1000);
    } else if (isQuizMode && quizPhase === "active" && quizTimer === 0) {
      void handleSubmitQuiz();
    }
    return () => clearInterval(interval);
  }, [isQuizMode, quizPhase, quizTimer]);

  // Widget positioning
  const centerWidget = (widget: "study" | "chat" | "notes") => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    if (widget === "study") setStudyWidgetRect({ x: winW / 2 - 300, y: winH / 2 - 225, width: 600, height: 450, initialized: true });
    if (widget === "chat") setChatRect({ x: winW - 374, y: winH - 546, width: 350, height: 450, initialized: true });
    if (widget === "notes") setNotesRect({ x: 24, y: winH - 374, width: 350, height: 300, initialized: true });
  };

  useEffect(() => {
    if (studyWidgetOpen && !studyWidgetRect.initialized) centerWidget("study");
  }, [studyWidgetOpen, studyWidgetRect.initialized]);
  useEffect(() => {
    if (chatOpen && !chatRect.initialized) centerWidget("chat");
  }, [chatOpen, chatRect.initialized]);
  useEffect(() => {
    if (notesOpen && !notesRect.initialized) centerWidget("notes");
  }, [notesOpen, notesRect.initialized]);

  // Drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo.current.isDragging) return;
      const dx = e.clientX - dragInfo.current.mouseX;
      const dy = e.clientY - dragInfo.current.mouseY;
      const type = dragInfo.current.type;
      const updateRect = (prev: typeof studyWidgetRect) => {
        const r = { ...prev };
        if (type === "move") {
          r.x = dragInfo.current.startX + dx;
          r.y = dragInfo.current.startY + dy;
        }
        if (type === "resize-r" || type === "resize-br") r.width = Math.max(250, dragInfo.current.startW + dx);
        if (type === "resize-b" || type === "resize-br") r.height = Math.max(200, dragInfo.current.startH + dy);
        return r;
      };
      if (dragInfo.current.widget === "study") setStudyWidgetRect((p) => updateRect(p));
      if (dragInfo.current.widget === "chat") setChatRect((p) => updateRect(p));
      if (dragInfo.current.widget === "notes") setNotesRect((p) => updateRect(p));
    };
    const handleMouseUp = () => {
      dragInfo.current.isDragging = false;
      dragInfo.current.widget = null;
      document.body.style.cursor = "default";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const formatUnlockDate = useCallback((iso?: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }, []);

  const handleMouseDown = (e: React.MouseEvent, type: string, widget: "study" | "chat" | "notes") => {
    e.preventDefault();
    const rect = widget === "study" ? studyWidgetRect : widget === "chat" ? chatRect : notesRect;
    dragInfo.current = {
      isDragging: true,
      widget,
      type,
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.x,
      startY: rect.y,
      startW: rect.width,
      startH: rect.height,
    };
    if (type === "move") document.body.style.cursor = "move";
    if (type === "resize-r") document.body.style.cursor = "ew-resize";
    if (type === "resize-b") document.body.style.cursor = "ns-resize";
    if (type === "resize-br") document.body.style.cursor = "nwse-resize";
  };

  const handleGlobalMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setIsControlsVisible(false);
    }, 3000);
  };

  const handleSubmoduleSelect = (sub: SubModule) => {
    if (!sub.unlocked) {
      emitTelemetry("lesson.locked_click", {
        moduleNo: sub.moduleNo,
        reason: sub.lockedDueToCooldown ? "cooldown" : sub.lockedDueToQuiz ? "quiz" : "sequence",
        topicPairIndex: sub.topicPairIndex,
      });
    } else {
      if (sub.type === "quiz") {
        emitTelemetry(
          "lesson.quiz_select",
          { moduleNo: sub.moduleNo, topicPairIndex: sub.topicPairIndex },
          { moduleNo: sub.moduleNo, topicId: null },
        );
      } else if (sub.slug) {
        const targetLesson = lessons.find((lesson) => lesson.slug === sub.slug);
        emitTelemetry(
          "lesson.navigate",
          { moduleNo: sub.moduleNo, topicPairIndex: sub.topicPairIndex, slug: sub.slug },
          { moduleNo: sub.moduleNo, topicId: targetLesson?.topicId ?? null, courseId: targetLesson?.courseId ?? null },
        );
      }
    }
    if (!sub.unlocked) {
      if (sub.lockedDueToCooldown) {
        const unlockLabel = formatUnlockDate(sub.cooldownUnlockAt);
        toast({
          title: "Module unlock pending",
          description: unlockLabel
            ? `Module ${sub.moduleNo} unlocks on ${unlockLabel}. Use this window to finish the simulation exercise in your current module.`
            : "This module will unlock after the current study window closes. Focus on the simulation exercise to get ready.",
        });
      } else if (sub.lockedDueToQuiz) {
        toast({
          title: "Pass the quiz to proceed",
          description: "Complete and pass the current module quiz to unlock the next set of lessons.",
        });
      } else {
        toast({
          title: "Locked lesson",
          description: "Finish the previous lessons before opening this module.",
        });
      }
      return;
    }
    if (isQuizMode && quizPhase !== "result" && sub.type !== "quiz") return;
    if (sub.type === "quiz") {
      void handleStartQuiz(sub.moduleNo, sub.topicPairIndex ?? 1);
    } else if (sub.slug) {
      setIsQuizMode(false);
      setQuizPhase("intro");
      setActiveSlug(sub.slug);
      setLocation(`/course/${courseKey}/learn/${sub.slug}`);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  const handleStartQuiz = async (moduleNo: number, topicPairIndex: number) => {
    if (!courseKey || !session) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    emitTelemetry("quiz.start", { topicPairIndex }, { moduleNo, topicId: null });
    try {
      // ✅ UPDATED: Use quizActions instead of direct fetch
      const data = await startQuizAttempt(
        { courseId: courseKey, moduleNo, topicPairIndex },
        session
      );
      setSelectedSection({ moduleNo, topicPairIndex });
      setQuizAttemptId(data.attemptId ?? null);
      setQuizQuestions(data.questions ?? []);
      setAnswers({});
      setQuizResult(null);
      setIsQuizMode(true);
      setQuizPhase("intro");
      setQuizTimer(150);
      setSidebarOpen(false);
      setChatOpen(false);
      setNotesOpen(false);
      setStudyWidgetOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Quiz unavailable",
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  const handleSubmitQuiz = async () => {
    if (!quizAttemptId || !session) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    try {
      const payload = Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId }));
      emitTelemetry(
        "quiz.submit",
        { answered: payload.length, totalQuestions: quizQuestions.length },
        { moduleNo: selectedSection?.moduleNo ?? activeLesson?.moduleNo ?? null },
      );
      // ✅ UPDATED: Use quizActions instead of direct fetch
      const data = await submitQuizAttempt(quizAttemptId, payload, session);
      const base = data?.result ?? {};
      emitTelemetry(
        base.passed ? "quiz.pass" : "quiz.fail",
        {
          scorePercent: base.scorePercent,
          correctCount: base.correctCount,
          totalQuestions: base.totalQuestions,
        },
        { moduleNo: selectedSection?.moduleNo ?? activeLesson?.moduleNo ?? null },
      );
      const progressModules: {
        moduleNo: number;
        unlocked?: boolean;
        lockedDueToCooldown?: boolean;
        unlockAvailableAt?: string | null;
        cooldownUntil?: string | null;
      }[] = Array.isArray(data?.progress) ? data.progress : [];
      const currentModuleNo = selectedSection?.moduleNo ?? null;
      const nextModuleNo = currentModuleNo ? currentModuleNo + 1 : null;
      const nextModuleProgress = nextModuleNo
        ? progressModules.find((module) => module?.moduleNo === nextModuleNo)
        : null;
      setQuizResult({
        correctCount: base.correctCount ?? 0,
        totalQuestions: base.totalQuestions ?? quizQuestions.length,
        scorePercent: base.scorePercent ?? 0,
        passed: Boolean(base.passed),
        thresholdPercent: base.thresholdPercent ?? PASSING_PERCENT_THRESHOLD,
      });
      setQuizPhase("result");
      if (base?.passed) {
        let toastTitle = "Quiz passed";
        let toastDescription: string | undefined;
        if (nextModuleProgress && nextModuleNo) {
          if (nextModuleProgress.lockedDueToCooldown) {
            const unlockIso = nextModuleProgress.unlockAvailableAt ?? nextModuleProgress.cooldownUntil;
            const unlockLabel = formatUnlockDate(unlockIso);
            toastTitle = "Keep building momentum";
            toastDescription = unlockLabel
              ? `Module ${nextModuleNo} unlocks on ${unlockLabel}. Use this time to master the simulation exercise in Module ${currentModuleNo}.`
              : `Module ${nextModuleNo} will unlock soon. Focus on the simulation exercise in Module ${currentModuleNo} until then.`;
          } else if (nextModuleProgress.unlocked) {
            toastTitle = `Module ${nextModuleNo} unlocked`;
            toastDescription = "Jump in whenever you're ready.";
          }
        }
        toast({ title: toastTitle, description: toastDescription });
        void fetchSections();
      } else {
        toast({ title: "Quiz submitted" });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not submit quiz",
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  const handleSendChat = useCallback(
    async (options?: { suggestion?: PromptSuggestion }) => {
      const suggestion = options?.suggestion ?? null;
      const questionSource = suggestion?.promptText ?? chatInput;
      const question = questionSource.trim();
      if (!question || chatLoading) return;
      const courseIdForChat = (courseKey ?? activeLesson?.courseId ?? "").trim();
      if (!courseIdForChat) {
        toast({ variant: "destructive", title: "No course context", description: "Select a lesson before chatting." });
        return;
      }
      const topicIdForChat = activeLesson?.topicId ?? null;
      if (!topicIdForChat) {
        toast({ variant: "destructive", title: "No topic context", description: "Open a lesson before chatting." });
        return;
      }
      const moduleNoForChat = activeLesson?.moduleNo ?? null;
      if (!suggestion && (moduleNoForChat === null || moduleNoForChat === undefined)) {
        toast({
          variant: "destructive",
          title: "No module context",
          description: "Open a module lesson before asking the tutor.",
        });
        return;
      }

      const userMsg: ChatMessage = { id: makeId(), text: question, isBot: false, suggestionContext: suggestion };
      setChatMessages((prev) => [...prev, userMsg]);
      if (!suggestion) {
        setChatInput("");
      } else {
        setUsedSuggestionIds((prev) => {
          const next = new Set(prev);
          next.add(suggestion.id);
          return next;
        });
        setPendingSuggestion(suggestion);
      }
      setChatLoading(true);
      setInlineFollowUps((prev) => {
        const next = { ...prev };
        if (suggestion) {
          next[userMsg.id] = [];
        }
        return next;
      });
      emitTelemetry(
        suggestion ? "tutor.prompt_suggestion" : "tutor.prompt_typed",
        { questionLength: question.length, suggestionId: suggestion?.id },
        { moduleNo: moduleNoForChat, topicId: activeLesson?.topicId ?? null },
      );

      let botMessageId: string | null = null;
      try {
        if (!session?.accessToken) {
          throw new Error("Please sign in to chat with the tutor.");
        }
        const body: Record<string, unknown> = {
          question,
          courseId: courseIdForChat,
          courseTitle: activeLesson?.moduleName ?? undefined,
          topicId: topicIdForChat,
        };
        if (suggestion) {
          body.suggestionId = suggestion.id;
        } else if (moduleNoForChat !== null && moduleNoForChat !== undefined) {
          body.moduleNo = moduleNoForChat;
        }
        // ✅ UPDATED: Use assistantActions instead of direct fetch
        const result = await queryAssistant(
          question,
          {
            courseId: courseIdForChat,
            topicId: topicIdForChat,
            moduleNo: moduleNoForChat ?? undefined,
            sessionId: chatSessionId || null,
          },
          session
        );
        if (!result) {
          throw new Error("Tutor unavailable");
        }

        let answer: string;
        let sessionId: string | undefined;
        let nextSuggestions: Array<{ id: string; promptText: string; answer: string | null }> = [];

        // Handle response - queryAssistant returns { answer, sessionId }
        answer = result.answer;
        sessionId = result.sessionId;

        const botId = makeId();
        botMessageId = botId;
        setStarterAnchorMessageId(botId);
        setChatMessages((prev) => [...prev, { id: botId, text: answer, isBot: true, suggestionContext: suggestion }]);
        if (sessionId) {
          setChatSessionId(sessionId);
        }
        if (suggestion) {
          setInlineFollowUps((prev) => ({
            ...prev,
            [botId]: nextSuggestions,
          }));
        } else {
          setInlineFollowUps((prev) => ({
            ...prev,
            [botId]: nextSuggestions,
          }));
        }
        emitTelemetry(
          "tutor.response_received",
          { suggestionId: suggestion?.id, followUps: nextSuggestions.length },
          { moduleNo: moduleNoForChat, topicId: activeLesson?.topicId ?? null },
        );
      } catch (error) {
        const raw = error instanceof Error ? error.message : "Tutor unavailable";
        const friendly = raw.toLowerCase().includes("internal server error")
          ? "Tutor is unavailable right now. Please try again soon."
          : raw;
        setChatMessages((prev) => [...prev, { id: makeId(), text: friendly, isBot: true, error: true }]);
        if (suggestion) {
          setInlineFollowUps((prev) => {
            const updated = { ...prev };
            delete updated[userMsg.id];
            return updated;
          });
        }
      } finally {
        setPendingSuggestion(null);
        setChatLoading(false);
        if (botMessageId) {
          setShouldRefreshStarterBatch(true);
        }
      }
    },
    [
      chatInput,
      chatLoading,
      courseKey,
      activeLesson?.courseId,
      activeLesson?.moduleName,
      activeLesson?.moduleNo,
      activeLesson?.topicId,
      session?.accessToken,
      toast,
      emitTelemetry,
    ],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: PromptSuggestion) => {
      if (chatLoading) return;
      void handleSendChat({ suggestion });
    },
    [handleSendChat, chatLoading],
  );

  const activeStudyText = useMemo(() => activeLesson?.textContent ?? "", [activeLesson?.textContent]);
  const formattedStudyText = useMemo(() => {
    const normalized = normalizeStudyMarkdown(activeStudyText);
    if (normalized) {
      return normalized;
    }
    return normalizeStudyMarkdown(DEFAULT_STUDY_FALLBACK);
  }, [activeStudyText]);
  const contentBlocks = useMemo(() => parseContentBlocks(activeLesson?.textContent), [activeLesson?.textContent]);
  const hasBlockLayout = Boolean(contentBlocks?.blocks?.length);
  const firstBlockIsVideo = hasBlockLayout && contentBlocks?.blocks?.[0]?.type === "video";
  const firstTextBlockIndex = useMemo(() => {
    if (!contentBlocks?.blocks) return null;
    const index = contentBlocks.blocks.findIndex((block) => block.type === "text");
    return index >= 0 ? index : null;
  }, [contentBlocks?.blocks]);
  const hasStudyContent = hasBlockLayout ? Boolean(contentBlocks?.blocks?.length) : Boolean(formattedStudyText);
  const blockVideoMaxHeightClass = isCompactLayout ? "max-h-[40vh]" : "max-h-[65vh]";
  const scrollMainToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = contentScrollRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior });
      return;
    }
    window.scrollTo({ top: 0, behavior });
  }, []);
  const handleToggleReadMode = useCallback(() => {
    setIsReadingMode((prev) => {
      const next = !prev;
      if (next) {
        scrollMainToTop("smooth");
      }
      return next;
    });
  }, [scrollMainToTop]);
  const renderStudyHeader = useCallback(
    () => (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b-2 border-[#4a4845]/20 pb-4">
        <div className="flex items-start gap-3 text-left">
          <div className="p-2 bg-[#000000] text-[#f8f1e6] rounded-lg flex-shrink-0">
            <Book size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-[#000000]">Study Material</h3>
            <p className="text-sm text-[#4a4845]">
              Companion reading for {activeLesson?.topicName ?? ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            onClick={handleToggleReadMode}
            className={`flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 font-bold text-sm transition ${isReadingMode
              ? "bg-[#bf2f1f] text-white border-[#bf2f1f] hover:bg-[#a62619]"
              : "bg-white text-[#000000] border-[#000000] hover:bg-[#4a4845]/10"
              }`}
          >
            {isReadingMode ? (
              <>
                <ArrowUpLeftFromCircle size={16} /> Restore Video
              </>
            ) : (
              <>
                <BookOpen size={16} /> Read Mode
              </>
            )}
          </button>
        </div>
      </div>
    ),
    [activeLesson?.topicName, handleToggleReadMode, isReadingMode],
  );
  const renderContentBlocks = useCallback(
    (blocks: ContentBlock[], variant: "main" | "widget") => {
      const output: React.ReactNode[] = [];
      let headerInserted = false;

      const buildImageNode = (imageBlock: ContentBlock, nodeKey: string) => {
        const imageData = imageBlock.data;
        const url = typeof imageData?.url === "string" ? imageData.url.trim() : "";
        if (!url) return null;
        const alt =
          typeof imageData?.alt === "string" && imageData.alt.trim() ? imageData.alt.trim() : "Lesson visual";
        const caption =
          typeof imageData?.caption === "string" && imageData.caption.trim() ? imageData.caption.trim() : "";
        return (
          <figure key={nodeKey} className="rounded-3xl border border-[#e8e1d8] bg-white overflow-hidden shadow-sm">
            <img src={url} alt={alt} className="w-full object-cover" loading="lazy" />
            {caption && (
              <figcaption className="px-5 py-3 text-xs text-[#4a4845] bg-[#f8f1e6]/60 border-t border-[#f2ebe0]">
                {caption}
              </figcaption>
            )}
          </figure>
        );
      };

      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const key = block.id ?? `${block.type}-${index}`;
        const data = block.data;

        if (block.type === "text") {
          const content = resolveTextVariant(data);
          if (!content) {
            continue;
          }
          const isFirstTextBlock = firstTextBlockIndex !== null && index === firstTextBlockIndex;
          if (variant === "main" && !headerInserted) {
            output.push(<div key={`study-header-${key}`}>{renderStudyHeader()}</div>);
            headerInserted = true;
          }

          const containerClass =
            variant === "main"
              ? "rounded-3xl border border-[#e8e1d8] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]"
              : "rounded-2xl border border-[#000000]/10 bg-white shadow-sm";
          const paddingClass = variant === "main" ? "p-6 sm:p-8" : "p-4";

          let attachedImage: React.ReactNode | null = null;
          if (variant === "main" && isFirstTextBlock) {
            const nextBlock = blocks[index + 1];
            if (nextBlock?.type === "image") {
              attachedImage = buildImageNode(nextBlock, `${key}-attached-image`);
              if (attachedImage) {
                index += 1;
              }
            }
          }

          output.push(
            <div
              key={key}
              id={isFirstTextBlock ? "study-text-start" : undefined}
              className={containerClass}
            >
              <div className={`${paddingClass} prose prose-base max-w-none text-[#1e293b]`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={studyMarkdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </div>
              {attachedImage && <div className="px-6 pb-6">{attachedImage}</div>}
            </div>,
          );
          continue;
        }

        if (block.type === "image") {
          const imageNode = buildImageNode(block, key);
          if (imageNode) {
            output.push(imageNode);
          }
          continue;
        }

        if (block.type === "video") {
          const rawUrl = typeof data?.url === "string" ? data.url : "";
          const videoUrl = normalizeVideoUrl(rawUrl);
          if (!videoUrl) {
            continue;
          }
          const title =
            typeof data?.title === "string" && data.title.trim()
              ? data.title.trim()
              : activeLesson?.topicName ?? "Lesson video";
          const videoWrapperClass = `transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${isReadingMode
            ? "max-h-0 opacity-0 pointer-events-none"
            : `${blockVideoMaxHeightClass} opacity-100`
            }`;
          output.push(
            <div key={key} className={videoWrapperClass} style={isReadingMode ? { marginTop: 0 } : undefined}>
              <div className="space-y-2">
                <div className="rounded-3xl border border-[#e8e1d8] bg-white shadow-sm overflow-hidden">
                  <div className="w-full bg-black aspect-video">
                    <iframe
                      className="w-full h-full"
                      src={videoUrl}
                      title={title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
                {variant === "main" && firstBlockIsVideo && firstTextBlockIndex !== null && index === 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("study-text-start")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="text-xs font-semibold text-[#bf2f1f] hover:underline"
                  >
                    Skip to reading
                  </button>
                )}
              </div>
            </div>,
          );
          continue;
        }

        if (block.type === "ppt") {
          const rawUrl = typeof data?.url === "string" ? data.url : "";
          const pptUrl = buildOfficeViewerUrl(rawUrl);
          if (!pptUrl) {
            continue;
          }
          const title =
            typeof data?.title === "string" && data.title.trim()
              ? data.title.trim()
              : "Slides Viewer";
          output.push(
            <div key={key} className="rounded-2xl border border-[#e8e1d8] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#f4ece3] text-[#1E3A47] font-semibold">
                <FileText size={16} className="text-[#bf2f1f]" />
                <span>{title}</span>
              </div>
              <div className="w-full bg-[#000000]/5 h-[260px] sm:h-[360px] lg:h-[500px] rounded-b-2xl overflow-hidden">
                <iframe
                  title={title}
                  src={pptUrl}
                  className="w-full h-full border-0"
                  referrerPolicy="no-referrer"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>,
          );
        }
      }

      return output;
    },
    [
      activeLesson?.topicName,
      blockVideoMaxHeightClass,
      firstBlockIsVideo,
      firstTextBlockIndex,
      isReadingMode,
      renderStudyHeader,
    ],
  );
  const activeVideoUrl = activeLesson?.videoUrl ?? "";
  const rootClassName = `${isCompactLayout ? "flex flex-col" : "flex"} h-screen bg-[#000000] text-[#f8f1e6] overflow-hidden font-sans relative`;
  const videoHeightClass = isCompactLayout ? "w-full h-[40vh]" : "w-full h-[65vh]";
  const studySectionPadding = isCompactLayout ? "px-4 py-6 sm:px-6" : "p-8 md:p-12";
  const sidebarBaseClasses = "bg-[#000000] transition-all duration-300 ease-in-out flex flex-col overflow-hidden";
  const sidebarClassName = isCompactLayout
    ? `${sidebarBaseClasses} fixed top-0 left-0 h-full w-72 max-w-[85vw] transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
    } border-r border-[#4a4845]/70 shadow-2xl z-40`
    : `${sidebarBaseClasses} shrink-0 relative z-30 ${isFullScreen ? "absolute h-full z-40" : ""} ${!isControlsVisible && isFullScreen ? "opacity-0 pointer-events-none" : "opacity-100"
    } ${sidebarOpen ? "w-80 border-r border-[#4a4845]" : "w-12 border-r border-[#4a4845]"}`;

  return (
    <div
      className={rootClassName}
      onMouseMove={handleGlobalMouseMove}
      onClick={handleGlobalMouseMove}
    >
      <style>{`
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
          .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
          input[type=range] { -webkit-appearance: none; background: transparent; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #bf2f1f; margin-top: -6px; cursor: pointer; border: 2px solid #f8f1e6; }
          input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #4a4845; border-radius: 2px; }
      `}</style>

      {/* Sidebar */}
      <div className={sidebarClassName}>
        <div className="h-14 flex items-center justify-between px-3 border-b border-[#4a4845]/50 bg-white/5 min-w-[3rem]">
          {sidebarOpen && <h2 className="font-bold text-sm text-[#f8f1e6] truncate">Course Content</h2>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-[#4a4845]/30 rounded text-[#f8f1e6]"
            title={sidebarOpen ? "Minimize Sidebar" : "Expand Sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <Book size={20} />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="p-4 border-b border-[#4a4845]/20">
            <div className="flex justify-between items-center text-xs text-[#f8f1e6] mb-1">
              <span className="font-bold">
                {currentModuleId === 0
                  ? `Intro (of ${realModules.length})`
                  : `Module ${currentModuleDisplay} of ${realModules.length}`}
              </span>
              {isComplete ? (
                <button
                  onClick={() => setLocation(`/course/${courseKey}/congrats`)}
                  className="px-2 py-1 rounded-md bg-[#bf2f1f] text-white text-[11px] font-bold hover:bg-[#a02a19] transition"
                >
                  Certificate
                </button>
              ) : (
                <span className="text-[#f8f1e6]/60">{Math.round(courseProgress)}%</span>
              )}
            </div>
            <div className="h-1.5 bg-[#4a4845]/30 rounded-full overflow-hidden">
              <div className="h-full bg-[#bf2f1f] transition-all duration-500" style={{ width: `${courseProgress}%` }}></div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4">
          {modules.map((module) => {
            const isExpanded = expandedModules.includes(module.id);
            return (
              <div key={module.id} className={!sidebarOpen ? "hidden" : ""}>
                <div
                  className="flex items-center justify-between cursor-pointer p-2 hover:bg-white/5 rounded group"
                  onClick={() =>
                    setExpandedModules((prev) =>
                      prev.includes(module.id) ? prev.filter((m) => m !== module.id) : [...prev, module.id],
                    )
                  }
                >
                  <div className="text-[10px] uppercase tracking-wider text-white font-bold transition-colors whitespace-normal break-words">
                    {module.id > 0 ? `Module ${module.id}: ${module.title}` : module.title}
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-white/70 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>

                <div
                  className={`space-y-1 transition-all duration-300 ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                    }`}
                >
                  {module.submodules?.map((sub) => {
                    const active = sub.slug ? sub.slug === activeLesson?.slug : false;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSubmoduleSelect(sub)}
                        aria-disabled={!sub.unlocked}
                        className={`w-full flex items-center gap-3 p-2 rounded-md text-xs transition text-left border ${active
                          ? "bg-[#bf2f1f] border-[#bf2f1f] text-white"
                          : "hover:bg-white/5 border-transparent text-[#f8f1e6]/70"
                          } ${!sub.unlocked ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
                      >
                        {sub.type === "quiz" ? <FileText size={14} className="flex-shrink-0" /> : <Play size={14} className="flex-shrink-0" />}
                        <span className="truncate flex-1">{sub.title}</span>
                        {sub.type === "quiz" && !sub.slug && <span className="text-[10px] text-[#f8f1e6]/50">Quiz</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!sidebarOpen && (
          <div className="flex flex-col items-center mt-4 gap-4">
            <div className="w-8 h-8 rounded bg-[#bf2f1f] flex items-center justify-center text-white shadow-lg">
              <span className="font-bold text-xs">{currentModuleId}</span>
            </div>
            <div className="space-y-2">
              {modules
                .filter((m) => m.id !== currentModuleId)
                .map((m) => (
                  <div key={m.id} className="w-1.5 h-1.5 rounded-full bg-[#4a4845]/50 mx-auto"></div>
                ))}
            </div>
          </div>
        )}
      </div>

      {isCompactLayout && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          role="button"
          aria-label="Close course navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main stage */}
      <div className="flex-1 flex flex-col h-full relative scroll-smooth overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[#4a4845]/60 bg-[#050505] z-20">
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            {isCompactLayout && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex items-center justify-center rounded-full border border-white/20 text-white/80 p-2"
                aria-label="Open course navigation"
              >
                <Menu size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-sm font-semibold text-[#f8f1e6]/80 hover:text-white transition"
            >
              <ChevronLeft size={18} /> Home
            </button>
            <div>
              <p className="text-xs text-[#f8f1e6]/60">
                Module {activeLesson?.moduleNo} - Topic {activeLesson?.topicNumber}
              </p>
              <h1 className="text-xl md:text-2xl font-black leading-tight">{activeLesson?.topicName ?? "Loading..."}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-[#f8f1e6]/70">
            <button
              type="button"
              onClick={handleOpenCohortProject}
              className="inline-flex items-center gap-2 rounded-full border border-[#4a4845]/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f8f1e6]/80 transition hover:border-[#f8f1e6]/60 hover:bg-white/5 hover:text-white"
            >
              <ClipboardList size={14} />
              Cohort Project
            </button>
            <span>Progress {Math.round(courseProgress)}%</span>
          </div>
        </div>
        <div
          ref={contentScrollRef}
          className={`${isFullScreen ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto"} relative`}
        >
          {/* Video */}
          {!isQuizMode && !hasBlockLayout && (
            <div
              className={`relative bg-black transition-all duration-300 shrink-0 flex justify-center items-center ${isFullScreen ? "flex-1 h-full" : isReadingMode ? "h-0 overflow-hidden" : videoHeightClass
                }`}
            >
              <div
                className={`relative aspect-video group bg-black shadow-2xl max-w-full max-h-full ${isFullScreen ? "w-auto h-auto" : "w-full h-full"
                  }`}
              >
                {activeVideoUrl ? (
                  <iframe
                    className="w-full h-full"
                    src={activeVideoUrl}
                    title={activeLesson?.topicName ?? "Lesson video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#f8f1e6]/60">
                    No video for this lesson.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Study section */}
          {!isFullScreen && !isQuizMode && (
            <div className="bg-[#f8f1e6] border-t-4 border-[#000000] w-full text-[#000000]">
              <div className={`w-full ${studySectionPadding} space-y-8`}>
                {!hasBlockLayout && renderStudyHeader()}

                <div className="space-y-4 text-left">
                  {hasBlockLayout && contentBlocks ? (
                    <div className="space-y-6">{renderContentBlocks(contentBlocks.blocks, "main")}</div>
                  ) : formattedStudyText ? (
                    <div className="rounded-3xl border border-[#e8e1d8] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                      <div className="p-6 sm:p-8 prose prose-base max-w-none text-[#1e293b]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSanitize]}
                          components={studyMarkdownComponents}
                        >
                          {formattedStudyText}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#4a4845]">No study material for this lesson.</p>
                  )}
                </div>

                {hasStudyContent && activeLesson?.topicId && (
                  <ColdCalling topicId={activeLesson.topicId} session={session} onTelemetryEvent={emitTelemetry} />
                )}

                {!hasBlockLayout && activePptEmbedUrl && activeLesson?.pptUrl && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[#e8e1d8] bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#f4ece3] text-[#1E3A47] font-semibold">
                        <FileText size={16} className="text-[#bf2f1f]" />
                        <span>Slides Viewer</span>
                      </div>
                      <div className="w-full bg-[#000000]/5 h-[260px] sm:h-[360px] lg:h-[500px] rounded-b-2xl overflow-hidden">
                        <iframe
                          title={`Slides for ${activeLesson.topicName}`}
                          src={activePptEmbedUrl}
                          className="w-full h-full border-0"
                          referrerPolicy="no-referrer"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    </div>

                  </div>
                )}

                {activeLesson?.simulation && (
                  <div className="space-y-4">
                    <SimulationExercise simulation={activeLesson.simulation} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quiz overlay */}
          {isQuizMode && (
            <div className="flex-1 bg-[#000000] flex flex-col items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#bf2f1f]/10 to-transparent pointer-events-none" />
              <div className="max-w-2xl w-full bg-[#f8f1e6] text-[#000000] rounded-xl p-8 shadow-2xl border-2 border-[#bf2f1f] z-10">
                {quizPhase === "intro" && (
                  <div className="text-center space-y-6 animate-fade-in">
                    <div className="inline-flex p-4 rounded-full bg-[#bf2f1f]/10 text-[#bf2f1f] mb-2 border border-[#bf2f1f]">
                      <Lock size={48} />
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter text-[#000000]">The Gauntlet</h2>
                    <p className="text-lg text-[#4a4845] font-medium">
                      You are about to enter a mandatory evaluation.
                      <br />
                      <span className="text-[#bf2f1f] font-bold">Rules are strict:</span>
                    </p>
                    <ul className="text-left max-w-sm mx-auto space-y-3 text-sm font-bold bg-white/50 p-6 rounded-lg border border-[#000000]/10">
                      <li className="flex gap-2">
                        <ArrowDown size={16} className="text-[#bf2f1f]" /> 5 Random Questions
                      </li>
                      <li className="flex gap-2">
                        <ArrowDown size={16} className="text-[#bf2f1f]" /> 60 Seconds Timer
                      </li>
                      <li className="flex gap-2">
                        <ArrowDown size={16} className="text-[#bf2f1f]" /> Must score 70% to pass
                      </li>
                      <li className="flex gap-2 text-[#bf2f1f]">
                        <X size={16} /> Failure = Reset to Module 1
                      </li>
                    </ul>
                    <button
                      onClick={() => setQuizPhase("active")}
                      className="w-full py-4 bg-[#bf2f1f] hover:bg-[#a62619] text-white font-bold text-xl rounded-lg shadow-lg transform transition hover:scale-[1.02] active:scale-95"
                    >
                      I Accept the Challenge
                    </button>
                  </div>
                )}

                {quizPhase === "active" && (
                  <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-8 border-b-2 border-[#000000]/10 pb-4">
                      <span className="font-bold text-[#4a4845]">Question {Object.keys(answers).length + 1} / {quizQuestions.length}</span>
                      <span className={`font-mono text-xl font-bold ${quizTimer < 10 ? "text-[#bf2f1f] animate-pulse" : "text-[#000000]"}`}>
                        {Math.floor(quizTimer / 60).toString().padStart(2, "0")}:
                        {(quizTimer % 60).toString().padStart(2, "0")}
                      </span>
                    </div>

                    <div className="space-y-8">
                      {quizQuestions.map((q, idx) => (
                        <div key={q.questionId} className="space-y-4">
                          <h3 className="text-xl font-bold">{idx + 1}. {q.prompt}</h3>
                          <div className="grid gap-3">
                            {q.options.map((opt) => (
                              <button
                                key={opt.optionId}
                                onClick={() => setAnswers((prev) => ({ ...prev, [q.questionId]: opt.optionId }))}
                                className={`p-4 text-left rounded-lg border-2 font-medium transition-all ${answers[q.questionId] === opt.optionId
                                  ? "bg-[#000000] text-white border-[#000000]"
                                  : "bg-white border-[#4a4845]/20 hover:border-[#000000]"
                                  }`}
                              >
                                {opt.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled={quizQuestions.some((q) => !answers[q.questionId])}
                      onClick={handleSubmitQuiz}
                      className="mt-8 w-full py-3 bg-[#000000] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg hover:bg-gray-800 transition"
                    >
                      Submit Assessment
                    </button>
                  </div>
                )}

                {quizPhase === "result" && quizResult && (
                  <div className="text-center animate-fade-in space-y-6">
                    <div
                      className={`inline-flex p-6 rounded-full border-4 mb-4 ${quizResult.passed
                        ? "bg-green-100 border-green-500 text-green-600"
                        : "bg-red-100 border-red-500 text-red-600"
                        }`}
                    >
                      {quizResult.passed ? <BookOpen size={48} /> : <X size={48} />}
                    </div>
                    <h2 className="text-4xl font-black uppercase">{quizResult.passed ? "Gauntlet Passed" : "Protocol Failed"}</h2>
                    <p className="text-xl font-bold">Score: {quizResult.scorePercent}%</p>
                    <p className="text-sm text-[#4a4845]">Correct: {quizResult.correctCount} / {quizResult.totalQuestions}</p>
                    <button
                      onClick={() => {
                        setIsQuizMode(false);
                        setQuizPhase("intro");
                        setQuizQuestions([]);
                        setAnswers({});
                        setSelectedSection(null);
                        setQuizAttemptId(null);
                        setQuizResult(null);
                      }}
                      className="w-full py-3 bg-[#000000] text-white font-bold rounded-lg hover:bg-gray-800 transition"
                    >
                      Back to course
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat widget */}
      {chatOpen && !isQuizMode && (
        <div
          className="fixed bg-[#000000]/95 backdrop-blur-md border border-[#4a4845] rounded-xl shadow-2xl flex flex-col transition-shadow duration-300 overflow-hidden z-[60]"
          style={{ left: chatRect.x, top: chatRect.y, width: chatRect.width, height: chatRect.height }}
        >
          <div
            className="p-3 bg-[#bf2f1f] flex justify-between items-center cursor-move select-none"
            onMouseDown={(e) => handleMouseDown(e, "move", "chat")}
          >
            <div className="flex items-center gap-2 text-white font-bold text-sm"><MessageSquare size={16} /> AI Tutor</div>
            <div className="flex items-center gap-1">
              <button onClick={() => centerWidget("chat")} className="p-1 hover:bg-white/20 rounded" title="Reset Position"><Move size={14} className="text-white" /></button>
              <button onClick={() => setChatOpen(false)} className="p-1 hover:bg-white/20 rounded"><X size={14} className="text-white" /></button>
            </div>
          </div>
          <div
            ref={chatListRef}
            className="flex-1 overflow-y-auto p-3 space-y-3 bg-black/40 text-sm text-[#f8f1e6]/80"
          >
            {chatMessages.map((msg, index) => {
              const followUpsForMessage = inlineFollowUps[msg.id] ?? [];
              const showInlineChip =
                !!msg.suggestionContext && msg.isBot && Boolean(inlineFollowUps[msg.id]?.length);

              return (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`p-2 rounded-lg ${msg.isBot ? "bg-white/5 border border-white/10" : "bg-[#bf2f1f]/20 border border-[#bf2f1f]/40"} ${msg.error ? "border-red-500/60 text-red-200" : ""
                      }`}
                  >
                    <div className="text-[11px] uppercase tracking-wide opacity-70">{msg.isBot ? "Tutor" : "You"}</div>
                    <div className="whitespace-pre-line">{msg.text}</div>
                  </div>
                  {starterAnchorMessageId === msg.id && (
                    <div className="pl-3 border-l border-white/10 space-y-2">
                      <p className="text-xs text-[#f8f1e6]/70">
                        Hello! Curious about this topic? Not sure what to ask? Choose one of these to get started.
                      </p>
                      {suggestionsLoading ? (
                        <div className="space-y-2">
                          <div className="h-7 w-40 rounded-full bg-white/10 animate-pulse" />
                          <div className="h-7 w-48 rounded-full bg-white/10 animate-pulse" />
                          <div className="h-7 w-36 rounded-full bg-white/10 animate-pulse" />
                        </div>
                      ) : visibleStarterSuggestions.length > 0 ? (
                        <div className="flex flex-col gap-2 items-start">
                          {visibleStarterSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              disabled={chatLoading}
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className={`px-4 py-1.5 rounded-full text-xs border transition ${chatLoading
                                ? "opacity-40 cursor-not-allowed border-[#4a4845]/40 text-[#f8f1e6]/40"
                                : "border-white/25 text-white/80 hover:border-white hover:text-white"
                                }`}
                            >
                              {suggestion.promptText}
                            </button>
                          ))}
                        </div>
                      ) : availableStarterSuggestions.length === 0 ? (
                        <p className="text-xs text-[#f8f1e6]/50">Starter prompts will appear when this topic loads.</p>
                      ) : (
                        <p className="text-xs text-[#f8f1e6]/50">Refreshing prompts...</p>
                      )}
                    </div>
                  )}
                  {showInlineChip && (
                    <div className="flex justify-end">
                      <span className="px-3 py-1 rounded-full bg-white text-[#bf2f1f] text-xs font-semibold">
                        {msg.suggestionContext?.promptText}
                      </span>
                    </div>
                  )}
                  {followUpsForMessage.length > 0 && (
                    <div className="pl-2 border-l border-white/10 space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-[#f8f1e6]/60">More to explore</div>
                      <div className="flex flex-wrap gap-2">
                        {followUpsForMessage.map((suggestion) => (
                          <button
                            key={`${msg.id}-${suggestion.id}`}
                            type="button"
                            disabled={chatLoading}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className={`px-3 py-1 rounded-full text-xs border transition ${chatLoading
                              ? "opacity-50 cursor-not-allowed border-[#4a4845]/40 text-[#f8f1e6]/40"
                              : "border-[#f8f1e6]/30 text-[#f8f1e6]/80 hover:border-white hover:text-white"
                              }`}
                          >
                            {suggestion.promptText}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {chatLoading && (
              <div className="text-xs text-[#f8f1e6]/60">Tutor is thinking...</div>
            )}
          </div>
          <div className="p-3 bg-white/5 border-t border-[#4a4845]/30 flex gap-2">
            <input
              className="flex-1 bg-transparent border border-[#4a4845]/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#bf2f1f]"
              placeholder="Ask AI..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSendChat();
                }
              }}
              disabled={chatLoading}
            />
            <button className="p-2" disabled={chatLoading} onClick={() => void handleSendChat()}>
              <Send size={16} className="text-[#bf2f1f]" />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-white/20" onMouseDown={(e) => handleMouseDown(e, "resize-r", "chat")} />
          <div className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize hover:bg-white/20" onMouseDown={(e) => handleMouseDown(e, "resize-b", "chat")} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-white/20 hover:bg-white/40 rounded-tl" onMouseDown={(e) => handleMouseDown(e, "resize-br", "chat")} />
        </div>
      )}

      {/* Notes widget */}
      {notesOpen && !isQuizMode && (
        <div
          className="fixed bg-[#f8f1e6]/95 backdrop-blur-md border-2 border-[#000000] rounded-xl shadow-2xl flex flex-col overflow-hidden z-[60]"
          style={{ left: notesRect.x, top: notesRect.y, width: notesRect.width, height: notesRect.height }}
        >
          <div
            className="p-3 bg-[#000000] flex justify-between items-center cursor-move select-none"
            onMouseDown={(e) => handleMouseDown(e, "move", "notes")}
          >
            <div className="flex items-center gap-2 text-[#f8f1e6] font-bold text-sm"><FileText size={16} /> My Notes</div>
            <div className="flex items-center gap-1 text-[#f8f1e6]">
              <button onClick={() => centerWidget("notes")} className="p-1 hover:bg-white/20 rounded" title="Reset Position"><Move size={14} /></button>
              <button onClick={() => setNotesOpen(false)} className="p-1 hover:bg-white/20 rounded"><X size={14} /></button>
            </div>
          </div>
          <textarea className="flex-1 p-3 bg-transparent resize-none text-[#000000] text-sm focus:outline-none font-mono" placeholder="Type notes here..."></textarea>
          <div className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-[#bf2f1f]/20" onMouseDown={(e) => handleMouseDown(e, "resize-r", "notes")} />
          <div className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize hover:bg-[#bf2f1f]/20" onMouseDown={(e) => handleMouseDown(e, "resize-b", "notes")} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-[#000000]/20 hover:bg-[#000000]/40 rounded-tl" onMouseDown={(e) => handleMouseDown(e, "resize-br", "notes")} />
        </div>
      )}

      {/* Study widget */}
      {studyWidgetOpen && !isQuizMode && (
        <div
          className="fixed bg-[#f8f1e6]/95 backdrop-blur-md border-2 border-[#000000] rounded-xl shadow-2xl flex flex-col overflow-hidden z-[60]"
          style={{ left: studyWidgetRect.x, top: studyWidgetRect.y, width: studyWidgetRect.width, height: studyWidgetRect.height }}
        >
          <div
            className="p-3 bg-[#000000] flex justify-between items-center cursor-move select-none"
            onMouseDown={(e) => handleMouseDown(e, "move", "study")}
          >
            <div className="flex items-center gap-2 text-[#f8f1e6] font-bold text-sm">
              <Book size={16} /> Study Material
            </div>
            <div className="flex items-center gap-1 text-[#f8f1e6]">
              <button onClick={() => centerWidget("study")} className="p-1 hover:bg-white/20 rounded" title="Reset Position"><Move size={14} /></button>
              <button onClick={() => setStudyWidgetOpen(false)} className="p-1 hover:bg-white/20 rounded"><X size={14} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-[#f8f1e6] text-[#000000]">
            {hasBlockLayout && contentBlocks ? (
              <div className="space-y-4">{renderContentBlocks(contentBlocks.blocks, "widget")}</div>
            ) : formattedStudyText ? (
              <div className="rounded-2xl border border-[#000000]/10 bg-white shadow-sm">
                <div className="p-4 prose prose-sm max-w-none text-[#1e293b]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    components={studyMarkdownComponents}
                  >
                    {formattedStudyText}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#4a4845]">No study material for this lesson.</p>
            )}
            {!hasBlockLayout && activePptEmbedUrl && activeLesson?.pptUrl && (
              <div className="mt-6 space-y-2">
                <div className="rounded-xl border-2 border-[#000000] bg-white overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#000000]/10 text-sm font-semibold">
                    <FileText size={14} />
                    <span>Slides Viewer</span>
                  </div>
                  <div className="bg-[#f6f2eb] h-[360px] rounded-b-xl overflow-hidden">
                    <iframe
                      title={`Slides for ${activeLesson.topicName} (Study widget)`}
                      src={activePptEmbedUrl}
                      className="w-full h-full border-0"
                      referrerPolicy="no-referrer"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#4a4845]">Use the embedded Microsoft viewer controls to move between slides.</p>
              </div>
            )}
            {activeLesson?.simulation && (
              <SimulationExercise simulation={activeLesson.simulation} />
            )}
          </div>
          <div className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-[#bf2f1f]/50" onMouseDown={(e) => handleMouseDown(e, "resize-r", "study")} />
          <div className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize hover:bg-[#bf2f1f]/50" onMouseDown={(e) => handleMouseDown(e, "resize-b", "study")} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-[#4a4845]/20 hover:bg-[#bf2f1f] rounded-tl" onMouseDown={(e) => handleMouseDown(e, "resize-br", "study")} />
        </div>
      )}

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-8 right-8 z-50 p-4 bg-[#bf2f1f] text-white rounded-full shadow-2xl hover:bg-[#a62619] hover:scale-110 transition-all border-2 border-white ${isFullScreen || isQuizMode ? "hidden" : ""
          }`}
        title="Chat with AI Tutor"
      >
        {chatOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      <CohortProjectModal
        isOpen={cohortProjectOpen}
        project={cohortProject}
        batchNo={cohortProjectBatch}
        isLoading={cohortProjectLoading}
        error={cohortProjectError}
        onClose={handleCloseCohortProject}
      />

    </div>
  );
};

export default CoursePlayerPage;
