import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Code2,
  Lightbulb,
  Lock,
  PlayCircle,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { fetchCourse, fetchCourseTopics, enrollInCourse, checkEnrollment } from '@/lib/binding/actions/courseActions';
import { buildApiUrl } from "@/lib/api"; // Still needed for navigation
import { useToast } from "@/hooks/use-toast";
import { ensureSessionFresh, readStoredSession } from "@/utils/session";

type ContentType = "video" | "quiz";

interface SubModule {
  id: string;
  title: string;
  duration?: string;
  type: ContentType;
  mandatory?: boolean;
}

interface Module {
  id: number;
  title: string;
  submodules: SubModule[];
  locked?: boolean;
}

interface CourseData {
  title: string;
  modules: Module[];
}

interface CourseMeta {
  subtitle: string;
  displayPriceCents: number | null;
  compareAtCents: number | null;
  originalPriceCents: number | null;
  rating: number | null;
  students: number | null;
  badge: string;
  category?: string;
  promoActive: boolean;
}

interface TopicApi {
  topicId: string;
  moduleNo: number;
  moduleName: string;
  topicNumber: number;
  topicName: string;
  videoUrl: string | null;
  textContent: string | null;
  contentType: string;
}

interface ProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const DEFAULT_SUBTITLE = "Complete bootcamp for job-ready AI engineers.";
const DEFAULT_BADGE = "New for 2025";
const PROMO_PRICING: Record<
  string,
  {
    priceCents: number;
    compareAtCents?: number;
    badge?: string;
  }
> = {
  "ai-native-fullstack-developer": {
    priceCents: 0,
    compareAtCents: 49900,
    badge: "Limited time: free cohort",
  },
};

const formatCurrency = (cents: number | null | undefined, fallback: string): string => {
  if (typeof cents === "number" && Number.isFinite(cents)) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }
  return fallback;
};

const formatCount = (value: number | null | undefined, fallback: string): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("en-IN");
  }
  return fallback;
};

const ProtocolModal: React.FC<ProtocolModalProps> = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/90 backdrop-blur-sm">
      <div className="bg-[#f8f1e6] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-[#000000]">
        <div className="bg-[#000000] p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#bf2f1f]/20 mb-3 border border-[#bf2f1f]">
            <Lock className="w-6 h-6 text-[#bf2f1f]" />
          </div>
          <h2 className="text-2xl font-bold text-white">The Ottolearn Protocol</h2>
          <p className="text-[#f8f1e6]/70 text-sm mt-1">Strict Enrollment Validation</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center text-[#000000] font-bold text-lg">
            Are you ready to commit? This is not just a video course.
          </div>

          <div className="space-y-4 bg-white/50 p-4 rounded-lg border border-[#4a4845]/30">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#000000] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#000000] font-medium">
                <span className="font-bold">Structured Path:</span> 6 Modules. No skipping ahead.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#bf2f1f] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#000000] font-medium">
                <span className="font-bold">The Gauntlet:</span> Mandatory Quiz every 2 sub-modules. Score &lt; 70% means you do <strong>not</strong> proceed.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#000000] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#000000] font-medium">
                <span className="font-bold">Certification:</span> Issued ONLY upon 100% completion and passing all gauntlets.
              </p>
            </div>
          </div>

          <button
            onClick={onAccept}
            className="w-full bg-[#bf2f1f] hover:bg-[#a62619] text-white font-bold py-4 rounded-lg shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
          >
            I Accept the Challenge &amp; Start Learning
          </button>

          <button
            onClick={onClose}
            className="w-full text-[#4a4845] text-sm hover:text-[#000000] transition font-bold"
          >
            I'm not ready yet
          </button>
        </div>
      </div>
    </div>
  );
};

const CourseDetailsPage: React.FC = () => {
  const params = useParams();
  const courseId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<number[]>([1]);
  const [courseTitle, setCourseTitle] = useState("AI Engineer Bootcamp");
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLessonSlug, setFirstLessonSlug] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [courseMeta, setCourseMeta] = useState<CourseMeta>({
    subtitle: DEFAULT_SUBTITLE,
    displayPriceCents: null,
    compareAtCents: null,
    originalPriceCents: null,
    rating: null,
    students: null,
    badge: DEFAULT_BADGE,
    category: "Hands-on projects",
    promoActive: false,
  });

  useEffect(() => {
    let mounted = true;
    const loadCourse = async () => {
      try {
        // ✅ UPDATED: Use courseActions instead of direct fetch
        const payload = await fetchCourse(courseId) as any;
        if (mounted) {
          const course = payload?.course || payload;
          const slug = course?.slug ?? courseId;
          setCourseTitle(course?.title ?? course?.courseName ?? "AI Engineer Bootcamp");
          const normalizedPrice =
            typeof course?.priceCents === "number" && Number.isFinite(course.priceCents)
              ? course.priceCents
              : null;
          const promo = slug && typeof slug === "string" ? PROMO_PRICING[slug] : undefined;
          const displayPriceCents = promo?.priceCents ?? normalizedPrice;
          const compareAtFromPromo =
            promo?.compareAtCents ?? (normalizedPrice ? Math.round(normalizedPrice * 1.8) : null);
          setCourseMeta({
            subtitle: course?.description ?? DEFAULT_SUBTITLE,
            displayPriceCents,
            compareAtCents: compareAtFromPromo,
            originalPriceCents: normalizedPrice,
            rating:
              typeof course?.rating === "number" && Number.isFinite(course.rating) ? course.rating : null,
            students:
              typeof course?.students === "number" && Number.isFinite(course.students)
                ? course.students
                : null,
            badge: promo?.badge ?? (course?.level ? `${course.level} level` : DEFAULT_BADGE),
            category: course?.category ?? "Hands-on projects",
            promoActive: Boolean(promo),
          });
        }
      } catch (err) {
        // Ignore course metadata errors, continue with topics
      }

      try {
        // ✅ UPDATED: Use courseActions instead of direct fetch
        const data = await fetchCourseTopics(courseId, null);

        const grouped = new Map<number, TopicApi[]>();
        data.forEach((t) => {
          const list = grouped.get(t.moduleNo) ?? [];
          list.push(t);
          grouped.set(t.moduleNo, list);
        });

        const builtModules: Module[] = Array.from(grouped.entries())
          .sort(([a], [b]) => a - b)
          .map(([moduleNo, topics]) => ({
            id: moduleNo,
            title: topics[0]?.moduleName ?? `Module ${moduleNo}`,
            submodules: topics
              .sort((a, b) => a.topicNumber - b.topicNumber)
              .map((topic) => ({
                id: topic.topicId,
                title: topic.topicName,
                duration: undefined,
                type: topic.contentType === "quiz" ? "quiz" : "video",
                mandatory: topic.contentType === "quiz",
              })),
          }));

        if (mounted) {
          setModules(builtModules);
          if (expandedModules.length === 0 && builtModules.length > 0) {
            setExpandedModules([builtModules[0].id]);
          }
          const firstTopic = builtModules[0]?.submodules?.[0];
          if (firstTopic) {
            setFirstLessonSlug(slugify(firstTopic.title));
          }
        }
      } catch (error) {
        if (mounted) {
          toast({
            variant: "destructive",
            title: "Could not load course",
            description: error instanceof Error ? error.message : "Please try again.",
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadCourse();
    return () => {
      mounted = false;
    };
  }, [courseId, toast, expandedModules.length]);

  const toggleModule = (id: number) => {
    setExpandedModules((prev) => (prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]));
  };

  const handleExpandAll = () => {
    if (expandedModules.length === modules.length) {
      setExpandedModules([]);
    } else {
      setExpandedModules(modules.map((m) => m.id));
    }
  };

  const courseData: CourseData = useMemo(
    () => ({
      title: courseTitle,
      modules,
    }),
    [courseTitle, modules],
  );

  const showCohortBlockedToast = (message?: string) => {
    toast({
      title: "Cohort access required",
      description: message ?? "You are not in this cohort batch. Please register first.",
      className: "border-[#f3d3c2] bg-[#fff4ea] text-[#5c2b18]",
    });
  };

  const checkCohortEligibility = async (): Promise<{ allowed: boolean }> => {
    const stored = readStoredSession();
    const session = await ensureSessionFresh(stored);
    if (!session?.accessToken) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "Please sign in before enrolling.",
      });
      return { allowed: false };
    }

    try {
      // ✅ UPDATED: Use courseActions instead of direct fetch
      const result = await checkEnrollment(courseId, session);
      return { allowed: true };
    } catch (error: any) {
      if (error.status === 403) {
        const message = error.message || "You are not in this cohort batch. Please register first.";
        showCohortBlockedToast(message);
        return { allowed: false };
      }
      toast({
        variant: "destructive",
        title: "Enrollment check failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return { allowed: false };
    }
  };

  const enrollLearner = async (): Promise<{ success: boolean; token?: string }> => {
    try {
      const stored = readStoredSession();
      const session = await ensureSessionFresh(stored);
      if (!session?.accessToken) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "Please sign in before enrolling.",
        });
        return { success: false };
      }

      // ✅ UPDATED: Use courseActions instead of direct fetch
      const result = await enrollInCourse(courseId, session);
      return { success: true, token: session.accessToken };
    } catch (error: any) {
      if (error.status === 403) {
        const message = error.message || "You are not in this cohort batch. Please register first.";
        showCohortBlockedToast(message);
        return { success: false };
      }
      toast({
        variant: "destructive",
        title: "Enrollment failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return { success: false };
    }
  };

  const navigateToPlayer = () => {
    if (firstLessonSlug) {
      setLocation(`/course/${courseId}/learn/${firstLessonSlug}`);
    } else {
      setLocation(`/course/${courseId}/learn/welcome-to-ai-journey`);
    }
  };

  const handleEnrollAccept = () => {
    if (enrolling) {
      return;
    }
    setEnrolling(true);
    void (async () => {
      const result = await enrollLearner();
      if (result.success) {
        setIsModalOpen(false);
        navigateToPlayer();
      } else {
        setIsModalOpen(false);
      }
      setEnrolling(false);
    })();
  };

  const handleEnrollStart = () => {
    if (enrolling) {
      return;
    }
    setEnrolling(true);
    void (async () => {
      const result = await checkCohortEligibility();
      setEnrolling(false);
      if (result.allowed) {
        setIsModalOpen(true);
      }
    })();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#f8f1e6] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white mx-auto mb-4" />
          <p className="text-lg">Loading course details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f1e6] text-[#000000] font-sans relative">
      <style>{`
         @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
      `}</style>

      <nav className="bg-[#000000] p-4 sticky top-0 z-40 border-b border-[#4a4845]">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-sm font-semibold text-[#f8f1e6]/80 hover:text-white transition"
            >
              <ChevronLeft size={18} /> Home
            </button>
            <div className="text-2xl font-extrabold text-[#f8f1e6] tracking-tight">
              Meta<span className="text-[#bf2f1f]">Learn</span>
            </div>
          </div>
          <div className="hidden md:flex gap-6 text-[#f8f1e6]/70 text-sm font-medium">
            <span className="cursor-pointer hover:text-[#f8f1e6] transition">Curriculum</span>
            <span className="cursor-pointer hover:text-[#f8f1e6] transition">Mentors</span>
            <span className="cursor-pointer hover:text-[#f8f1e6] transition">Reviews</span>
          </div>
          <button className="md:hidden text-[#f8f1e6]">Menu</button>
        </div>
      </nav>

      <header className="bg-[#000000] text-[#f8f1e6] pt-12 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
          <svg viewBox="0 0 1440 800" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="fluidGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#bf2f1f" stopOpacity="0" />
                <stop offset="50%" stopColor="#bf2f1f" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#bf2f1f" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="shineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f8f1e6" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#f8f1e6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f8f1e6" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glassGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
                <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -7" />
              </filter>
            </defs>
            <g filter="url(#glassGlow)">
              <path d="M0,500 C300,450 600,650 900,600 C1200,550 1440,700 1440,700 L1440,800 L0,800 Z" fill="url(#fluidGradient)" opacity="0.7" />
              <path d="M-50,520 C300,420 600,680 950,580 C1250,500 1500,720 1500,720" stroke="url(#fluidGradient)" strokeWidth="120" fill="none" opacity="0.5" strokeLinecap="round" />
              <path d="M-50,520 C300,420 600,680 950,580 C1250,500 1500,720 1500,720" stroke="url(#shineGradient)" strokeWidth="20" fill="none" opacity="0.8" strokeLinecap="round" />
              <path d="M-50,620 C300,520 600,780 950,680 C1250,600 1500,820 1500,820" stroke="url(#fluidGradient)" strokeWidth="120" fill="none" opacity="0.3" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        <div className="relative z-10 container mx-auto px-6 md:px-12">
          <div className="inline-flex items-center gap-2 bg-[#4a4845] text-[#f8f1e6] px-3 py-1 rounded-full text-xs font-semibold mb-4">
            {courseMeta.badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight max-w-3xl">{courseTitle}</h1>
          <p className="mt-3 text-lg text-[#f8f1e6]/80 max-w-2xl">{courseMeta.subtitle}</p>
          <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-[#f8f1e6]/80">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-300" />
              <span className="font-semibold text-[#f8f1e6]">
                {courseMeta.rating != null ? courseMeta.rating.toFixed(1) : "4.8"}
              </span>
              <span className="text-[#f8f1e6]/60">
                ({formatCount(courseMeta.students, "3,369")} ratings)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{formatCount(courseMeta.students, "8,485")} students</span>
            </div>
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <span>{courseMeta.category ?? "Hands-on projects"}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <button
              className="bg-[#bf2f1f] hover:bg-[#a62619] text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleEnrollStart}
              disabled={enrolling}
            >
              {enrolling ? "Processing..." : "Enroll Now"}
            </button>
            <button
              className="bg-white hover:bg-gray-50 text-[#bf2f1f] border-2 border-[#bf2f1f] px-6 py-3 rounded-lg font-semibold shadow-lg transition active:scale-95"
              onClick={() => {
                const slug = courseId || 'ai-native-fullstack-developer';
                setLocation(`/registration/cohort/${slug}`);
              }}
            >
              Register Now
            </button>
            <div className="text-[#f8f1e6]">
              <div className="text-3xl font-black">
                {formatCurrency(courseMeta.displayPriceCents, "₹1,499")}
              </div>
              <div className="text-sm text-[#f8f1e6]/60 line-through">
                {formatCurrency(courseMeta.compareAtCents ?? courseMeta.originalPriceCents, "₹3,999")}
              </div>
              {courseMeta.promoActive && (
                <div className="text-xs font-semibold text-[#bf2f1f] mt-1">Limited-time enrollment</div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-12 space-y-10">
        <section className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3 text-sm text-[#000000]/80">
              <Check className="text-[#bf2f1f] h-4 w-4" />
              Interactive build weeks that mirror real client briefs
            </div>
            <div className="flex items-center gap-3 text-sm text-[#000000]/80">
              <Check className="text-[#bf2f1f] h-4 w-4" />
              Simulation exercises to pressure-test AI features end-to-end
            </div>
            <div className="flex items-center gap-3 text-sm text-[#000000]/80">
              <Check className="text-[#bf2f1f] h-4 w-4" />
              Mandatory quizzes to unlock each module and earn certificate
            </div>
            <div className="flex items-center gap-3 text-sm text-[#000000]/80">
              <Check className="text-[#bf2f1f] h-4 w-4" />
              Pay only when you’re ready for the completion certificate
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#000000]/70">Skills you'll gain</p>
            <div className="flex flex-wrap gap-2">
              {["Next.js Automation", "Tailwind Systems", "Prompt Engineering", "LangChain Agents", "AI QA Pipelines", "Edge Deployments"].map(
                (skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 rounded-full border-2 border-[#000000] text-xs font-bold uppercase tracking-wide bg-white hover:bg-[#000000] hover:text-white transition"
                  >
                    {skill}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-2xl border-2 border-[#000000]">
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#000000]">
            <div>
              <p className="text-sm font-semibold text-[#000000]/70">Course content</p>
              <h3 className="text-2xl font-black text-[#000000]">{modules.length} modules</h3>
            </div>
            <button
              className="text-[#bf2f1f] font-semibold text-sm hover:underline"
              onClick={handleExpandAll}
            >
              {expandedModules.length === modules.length ? "Collapse all" : "Expand all sections"}
            </button>
          </div>
          <div className="divide-y-2 divide-[#000000]/5">
            {courseData.modules.map((module) => {
              const isOpen = expandedModules.includes(module.id);
              return (
                <div key={module.id} className="bg-[#f8f1e6]">
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#000000] text-[#f8f1e6] flex items-center justify-center font-bold text-sm">
                        {module.id}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#4a4845]">Module {module.id}</p>
                        <h4 className="text-lg font-bold text-[#000000] group-hover:text-[#bf2f1f] transition">
                          {module.title}
                        </h4>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-[#000000] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`transition-all duration-200 ${isOpen ? "max-h-[1000px]" : "max-h-0 overflow-hidden"}`}
                  >
                    <div className="px-6 pb-4 space-y-2 animate-fade-in">
                      {module.submodules?.map((sub, idx) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-[#000000]/5"
                        >
                          <div className="flex items-center gap-3">
                            {sub.type === "quiz" ? (
                              <Lightbulb className="h-5 w-5 text-[#bf2f1f]" />
                            ) : (
                              <PlayCircle className="h-5 w-5 text-[#bf2f1f]" />
                            )}
                            <div>
                              <p className="text-xs text-[#4a4845]">Topic {idx + 1}</p>
                              <p className="font-semibold text-[#000000]">{sub.title}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#4a4845]">
                            {sub.type === "quiz" && (
                              <span className="inline-flex items-center gap-1 text-[#bf2f1f] font-semibold">
                                <Lock className="h-4 w-4" />
                                Mandatory
                              </span>
                            )}
                            {sub.duration && <span>{sub.duration}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <ProtocolModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAccept={handleEnrollAccept} />
    </div>
  );
};

export default CourseDetailsPage;
