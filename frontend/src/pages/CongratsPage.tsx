import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Trophy, Star } from "lucide-react";
import { fetchCourse } from '@/lib/binding/actions/courseActions';
import { readStoredSession } from "@/utils/session";

type CourseSummary = {
  title?: string;
};

const Confetti = () => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    const items = Array.from({ length: 50 }, (_, idx) => ({
      id: idx,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      size: 4 + Math.random() * 4,
    }));
    setParticles(items);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-[fall_linear_infinite]"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            borderRadius: "9999px",
            backgroundColor: "rgba(230,72,51,0.2)",
            boxShadow: "0 0 8px rgba(230,72,51,0.18)",
            opacity: 0.2,
          }}
        />
      ))}
      <style>
        {`@keyframes fall { to { transform: translateY(110vh) rotate(360deg); opacity: 0; } }`}
      </style>
    </div>
  );
};

const FireworkBurst = () => {
  const [particles, setParticles] = useState<
    Array<{ id: string; angle: number; velocity: number; color: string; size: number; opacity: number; duration: number }>
  >([]);
  const palette = ["#E64833", "#874F41", "#90AEAD", "#FBE9D0"];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const createBurst = () => {
      const count = 120 + Math.floor(Math.random() * 40);
      const burst = Array.from({ length: count }, (_, idx) => {
        const angle = (idx / count) * Math.PI * 2 + Math.random() * 0.12;
        return {
          id: `${Date.now()}-${idx}`,
          angle,
          velocity: 800 + Math.random() * 400,
          color: palette[Math.floor(Math.random() * palette.length)],
          size: 4 + Math.random() * 6,
          opacity: 0.3 + Math.random() * 0.35,
          duration: 10 + Math.random() * 2,
        };
      });
      setParticles(burst);
      timers.push(setTimeout(() => setParticles([]), 12000));
    };

    createBurst();
    timers.push(setTimeout(createBurst, 5000));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-10">
      <div className="absolute inset-0 flex items-center justify-center">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: "9999px",
              backgroundColor: particle.color,
              left: "50%",
              top: "50%",
              opacity: particle.opacity,
              boxShadow: `0 0 14px ${particle.color}55`,
              transform: "translate(-50%, -50%)",
              animation: `burst ${particle.duration}s cubic-bezier(0.22, 0.68, 0.12, 1) forwards`,
              // @ts-expect-error custom property for animation
              "--angle": `${particle.angle}rad`,
              "--velocity": `${particle.velocity}px`,
            }}
          />
        ))}
      </div>
      <style>
        {`
          @keyframes burst {
            0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
            35% { opacity: 0.8; }
            100% {
              transform:
                translate(-50%, -50%)
                translate(calc(cos(var(--angle)) * var(--velocity)), calc(sin(var(--angle)) * var(--velocity)))
                scale(0.85);
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
};

const CongratsPage = () => {
  const { id: courseKey } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [course, setCourse] = useState<CourseSummary>({});

  const learnerName = useMemo(() => {
    const stored = readStoredSession();
    return stored?.fullName ?? stored?.email ?? "Learner";
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCourse = async () => {
      try {
        // ✅ UPDATED: Use courseActions
        if (courseKey) {
          const courseData = await fetchCourse(courseKey);
          if (mounted) {
            setCourse(courseData);
          }
        }
      } catch {
        // ignore – fallback strings already provided
      }
    };
    void loadCourse();
    return () => {
      mounted = false;
    };
  }, [courseKey]);

  const handleSubmit = () => {
    if (!rating) {
      alert("Please provide a rating before continuing.");
      return;
    }
    localStorage.setItem("courseFeedbackRating", rating.toString());
    localStorage.setItem("courseFeedbackText", feedback);
    localStorage.setItem("courseCertificateName", learnerName);
    localStorage.setItem("courseCertificateTitle", course?.title ?? "AI in Web Development Masterclass");
    setLocation(`/course/${courseKey}/congrats/feedback`);
  };

  const courseTitle = course?.title ?? "Advanced Web Development Masterclass";

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundColor: "#244855",
        backgroundImage: `
          radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 35%),
          linear-gradient(135deg, rgba(29,59,72,0.75) 0%, rgba(29,59,72,0.35) 55%, transparent 100%),
          linear-gradient(0deg, #244855 0%, #244855 100%)
        `,
      }}
    >
      <FireworkBurst />
      <Confetti />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(251,233,208,0.04) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
        }}
      />

      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-4xl space-y-10 rounded-3xl border border-white/5 bg-[#1f3440]/80 p-6 shadow-2xl sm:p-10 backdrop-blur">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="text-4xl text-[#FBE9D0] drop-shadow-lg sm:text-5xl">
              <Trophy size={56} strokeWidth={1.5} />
            </div>
            <p className="text-xs uppercase tracking-[0.6em] text-[#F5C26B]">Certificate Unlocked</p>
            <h1 className="text-4xl font-black leading-tight text-[#FBE9D0] sm:text-5xl">Congratulations!</h1>
            <h2 className="text-2xl font-bold text-[#FBE9D0] sm:text-3xl">{learnerName}</h2>
            <p className="text-base text-[#90AEAD] sm:text-lg">has successfully completed</p>
            <h3 className="text-xl font-semibold text-[#FBE9D0] sm:text-2xl">{courseTitle}</h3>
            <p className="text-sm text-[#90AEAD] sm:text-base">Credential earned — add it to your profile and showcase your expertise.</p>
          </div>

          <div
            className="space-y-6 rounded-2xl border border-[#90AEAD] bg-[#1c303b]/80 p-6 sm:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-xl font-bold text-[#FBE9D0]">Share Your Experience</h4>
              <p className="text-xs font-medium text-[#90AEAD] uppercase tracking-wide">
                Issued {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-[#90AEAD] sm:text-base">
              Your insight keeps our curriculum sharp and industry-ready. Tell us what resonated and what could be even better.
            </p>

            <div className="space-y-3">
              <p className="font-semibold text-[#FBE9D0]">How would you rate this learning experience?</p>
              <div className="flex flex-wrap justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      size={40}
                      fill={(hoverRating || rating) >= star ? "#E64833" : "transparent"}
                      color={(hoverRating || rating) >= star ? "#E64833" : "#90AEAD"}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-[#FBE9D0]">Optional reflection</p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share highlights, outcomes, or next steps we should explore..."
                className="min-h-[120px] w-full resize-none rounded-2xl border border-[#90AEAD] bg-[#FBE9D0] px-4 py-3 text-base text-[#244855] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#E64833]"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-2xl border border-[#fbe9d0]/20 bg-[#E64833] py-4 text-lg font-semibold text-[#FBE9D0] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#cf3c28]"
            >
              Submit feedback &amp; view certificate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CongratsPage;
