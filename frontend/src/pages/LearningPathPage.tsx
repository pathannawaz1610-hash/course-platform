import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { ensureSessionFresh, readStoredSession } from "@/utils/session";
import { useToast } from "@/hooks/use-toast";
import { updatePersonalization, fetchPersonalization } from '@/lib/binding/actions/lessonActions';

type StudyPersona = "normal" | "sports" | "cooking" | "adventure";
type PersonalizedPersona = Exclude<StudyPersona, "normal">;

interface Question {
  id: string;
  prompt: string;
  emphasis?: string;
  choices: Array<{
    option: string;
    helper: string;
    persona: PersonalizedPersona;
  }>;
}

const personalizedQuestions: Question[] = [
  {
    id: "downtime",
    prompt: "When you unwind after work, what feels most natural?",
    choices: [
      {
        option: "Watching or playing sports, competing with friends",
        helper: "You like clear goals, scoreboards, and fast feedback.",
        persona: "sports",
      },
      {
        option: "Cooking a new recipe or experimenting in the kitchen",
        helper: "You enjoy step-by-step craft with room to improvise.",
        persona: "cooking",
      },
      {
        option: "Planning the next adventure or exploring a new city",
        helper: "You thrive in discovery and big-picture experiences.",
        persona: "adventure",
      },
    ],
  },
  {
    id: "teamwork",
    prompt: "How do you prefer to tackle a tough project?",
    choices: [
      {
        option: "Break it into drills and measure each sprint",
        helper: "Structured practice and coaching energize you.",
        persona: "sports",
      },
      {
        option: "Lay out ingredients, prep carefully, then plate beautifully",
        helper: "Process, patience, and presentation matter to you.",
        persona: "cooking",
      },
      {
        option: "Map a route, pack essentials, and learn along the way",
        helper: "You learn best while exploring real terrain.",
        persona: "adventure",
      },
    ],
  },
  {
    id: "celebration",
    prompt: "What does a win look like to you?",
    choices: [
      {
        option: "Hitting the final buzzer with a packed arena watching",
        helper: "Public recognition and performance fuel you.",
        persona: "sports",
      },
      {
        option: "Serving a perfect dish and seeing everyone enjoy it",
        helper: "You love delighting others with thoughtful craft.",
        persona: "cooking",
      },
      {
        option: "Seeing a passport full of stamps and stories",
        helper: "You collect milestones through exploration.",
        persona: "adventure",
      },
    ],
  },
  {
    id: "vision",
    prompt: "When you imagine your ideal project, it feels like…",
    choices: [
      {
        option: "Training a team that executes perfectly under pressure",
        helper: "You focus on playbooks, practice, and momentum.",
        persona: "sports",
      },
      {
        option: "Designing an experience that engages all five senses",
        helper: "You obsess over ingredients, plating, and pacing.",
        persona: "cooking",
      },
      {
        option: "Charting a quest that unlocks new landscapes and levels",
        helper: "You love epic arcs with twists and discoveries.",
        persona: "adventure",
      },
    ],
  },
];

const personaDescriptions: Record<PersonalizedPersona, string> = {
  sports: "Analogies from coaching, practice drills, and competitive momentum.",
  cooking: "Step-by-step flows inspired by prep, plating, and flavor pairing.",
  adventure: "Exploration framed as expeditions, missions, and gear upgrades.",
};

const defaultLessonSlug = "start-your-revolutionary-learning-journey";

const LearningPathPage: React.FC = () => {
  const params = useParams();
  const courseId = params?.id ?? "";
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const search = useMemo(() => {
    const [, query = ""] = location.split("?");
    return new URLSearchParams(query);
  }, [location]);

  const lessonSlug = search.get("lesson") ?? defaultLessonSlug;

  const [phase, setPhase] = useState<"loading" | "choose" | "quiz">("loading");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [scores, setScores] = useState<Record<PersonalizedPersona, number>>({
    sports: 0,
    cooking: 0,
    adventure: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToDetails = useCallback(() => {
    setLocation(`/course/${courseId}`);
  }, [courseId, setLocation]);

  const goToPlayer = useCallback(() => {
    setLocation(`/course/${courseId}/learn/${lessonSlug}`);
  }, [courseId, lessonSlug, setLocation]);

  const persistPersona = useCallback(
    async (persona: StudyPersona) => {
      const ensureToken = async () => {
        if (sessionToken) return sessionToken;
        const stored = readStoredSession();
        const refreshed = await ensureSessionFresh(stored);
        if (!refreshed?.accessToken) {
          toast({
            variant: "destructive",
            title: "Session expired",
            description: "Please sign in again to continue.",
          });
          goToDetails();
          return null;
        }
        setSessionToken(refreshed.accessToken);
        return refreshed.accessToken;
      };

      const token = await ensureToken();
      if (!token) return false;

      try {
        setIsSubmitting(true);
        // ✅ UPDATED: Use lessonActions instead of direct fetch
        await updatePersonalization(courseId, { persona }, { accessToken: token });
        return true;
      } catch (error) {
        console.error("Failed to save personalization", error);
        if ((error as any).status === 401) {
          goToDetails();
          return false;
        }
        toast({
          variant: "destructive",
          title: "Unable to save preference",
          description: "Please try again.",
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [courseId, goToDetails, sessionToken, toast],
  );

  const finalizeQuiz = useCallback(
    async (finalScores: Record<PersonalizedPersona, number>) => {
      const entries = Object.entries(finalScores) as Array<[PersonalizedPersona, number]>;
      const winning = entries.reduce(
        (acc, curr) => (curr[1] > acc[1] ? curr : acc),
        entries[0],
      );
      const persona = winning?.[0] ?? "sports";
      const saved = await persistPersona(persona);
      if (saved) {
        goToPlayer();
      }
    },
    [goToPlayer, persistPersona],
  );

  const handleAnswer = (persona: PersonalizedPersona) => {
    const nextScores = { ...scores, [persona]: scores[persona] + 1 };
    setScores(nextScores);
    const nextIndex = questionIndex + 1;
    if (nextIndex >= personalizedQuestions.length) {
      void finalizeQuiz(nextScores);
    } else {
      setQuestionIndex(nextIndex);
    }
  };

  const handleStandardFlow = async () => {
    const saved = await persistPersona("normal");
    if (saved) {
      goToPlayer();
    }
  };

  const startQuestionnaire = () => {
    setScores({ sports: 0, cooking: 0, adventure: 0 });
    setQuestionIndex(0);
    setPhase("quiz");
  };

  useEffect(() => {
    const bootstrap = async () => {
      const stored = readStoredSession();
      const refreshed = await ensureSessionFresh(stored);
      if (!refreshed?.accessToken) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "Please sign in before choosing your learning path.",
        });
        goToDetails();
        return;
      }
      setSessionToken(refreshed.accessToken);

      try {
        // ✅ UPDATED: Use lessonActions instead of direct fetch
        const data = await fetchPersonalization(courseId, { accessToken: refreshed.accessToken });
        if (data?.hasPreference) {
          goToPlayer();
          return;
        }
      } catch (error) {
        if ((error as any).status === 401) {
          goToDetails();
          return;
        }
        console.error("Failed to verify personalization status", error);
      }

      setPhase("choose");
    };

    void bootstrap();
  }, [courseId, goToDetails, goToPlayer, toast]);

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#bf2f1f]" />
          <p className="text-sm text-white/70">Preparing your learning path...</p>
        </div>
      </div>
    );
  }

  const activeQuestion = personalizedQuestions[questionIndex];

  return (
    <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0b1221] rounded-3xl border border-white/10 shadow-2xl p-6 md:p-10 space-y-8">
        <button
          onClick={goToDetails}
          className="text-sm text-white/70 hover:text-white inline-flex items-center gap-2"
          type="button"
        >
          ← Back to course
        </button>

        {phase === "choose" && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#bf2f1f]">Ottolearn onboarding</p>
              <h1 className="text-3xl font-bold mt-2">Choose your learning path</h1>
              <p className="text-white/70 text-sm mt-2">
                Tell us how you want the lessons narrated. You can always review standard copy inside the
                course, but this choice locks your personalized analogies.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={startQuestionnaire}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left hover:border-[#bf2f1f] transition space-y-3"
              >
                <Sparkles className="h-8 w-8 text-[#bf2f1f]" />
                <div>
                  <h2 className="text-xl font-semibold">Personalized learning</h2>
                  <p className="text-sm text-white/70">
                    Answer a few quick questions so we can choose analogies that match how your brain likes to
                    learn.
                  </p>
                </div>
                <p className="text-xs text-white/60 font-semibold">Start questionnaire →</p>
              </button>

              <button
                onClick={handleStandardFlow}
                disabled={isSubmitting}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left hover:border-white/60 transition space-y-3 disabled:opacity-60"
              >
                <ShieldCheck className="h-8 w-8 text-white" />
                <div>
                  <h2 className="text-xl font-semibold">Standard learning</h2>
                  <p className="text-sm text-white/70">
                    Skip the quiz and jump right into the classic academic narration used across Ottolearn.
                  </p>
                </div>
                <p className="text-xs text-white/60 font-semibold">
                  {isSubmitting ? "Saving..." : "Continue with standard →"}
                </p>
              </button>
            </div>
          </div>
        )}

        {phase === "quiz" && activeQuestion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span>Question {questionIndex + 1} of {personalizedQuestions.length}</span>
              <button
                onClick={() => setPhase("choose")}
                className="text-white/70 hover:text-white text-xs font-semibold"
                type="button"
              >
                Change learning path
              </button>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#bf2f1f]">Question</p>
                <h2 className="text-2xl font-bold mt-2">{activeQuestion.prompt}</h2>
                {activeQuestion.emphasis && <p className="text-white/60 mt-2">{activeQuestion.emphasis}</p>}
              </div>
              <div className="space-y-3">
                {activeQuestion.choices.map((choice) => (
                  <button
                    key={choice.option}
                    onClick={() => handleAnswer(choice.persona)}
                    disabled={isSubmitting}
                    className="w-full text-left border border-white/10 rounded-2xl p-4 hover:border-[#bf2f1f] transition bg-white/5 disabled:opacity-60"
                  >
                    <div className="font-semibold">{choice.option}</div>
                    <p className="text-sm text-white/70">{choice.helper}</p>
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/50">
                We’ll use your answers to permanently set your narration style. You can still toggle back to
                the standard copy in the course.
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-white/50 flex items-center gap-2">
          <Target className="h-4 w-4" />
          This choice is stored for the AI in Web Development course and keeps your study material consistent.
        </div>
      </div>
    </div>
  );
};

export default LearningPathPage;
