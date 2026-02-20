import { useEffect, useState } from "react";
import { Sparkles, Target, Users2, ShieldCheck, TrendingUp } from "lucide-react";
import { fetchPageContent } from '@/lib/binding/actions/pageActions';
import type { PageContentEntry, PageContentResponse } from "@/types/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { SiteLayout } from "@/components/layout/SiteLayout";

const COURSE_PLAYER_PATH = "/course/ai-native-fullstack-developer/learn/welcome-to-ai-journey";

export default function AboutPage() {
  const [location, setLocation] = useLocation();
  const [content, setContent] = useState<PageContentEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        // ✅ UPDATED: Use pageActions
        const pageContent = await fetchPageContent("about", controller.signal);
        setContent(pageContent as unknown as PageContentEntry);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        console.error("Failed to fetch about page", err);
        setError("Unable to load the platform story right now.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();
    return () => controller.abort();
  }, []);

  const stats = (content?.sections.stats ?? []) as Array<{ label: string; value: string }>;
  const highlights = (content?.sections.highlights ?? []) as Array<{ title: string; description: string }>;
  const values = (content?.sections.values ?? []) as Array<{ title: string; description: string }>;
  const faqs = (content?.sections.faqs ?? []) as Array<{ question: string; answer: string }>;

  return (
    <SiteLayout
      headerProps={{
        currentPath: location,
        onNavigate: (href) => setLocation(href),
        showSearch: false,
        onLoginClick: () => setLocation(COURSE_PLAYER_PATH),
      }}
      contentClassName="space-y-10"
    >
      <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-8 sm:p-12">
        {content?.heroImage ? (
          <img
            src={content.heroImage}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10"
          />
        ) : null}
        <div className="relative z-10 space-y-6">
          <Badge variant="secondary" className="w-fit bg-white text-slate-700">
            {content?.updatedAt ? `Updated ${new Date(content.updatedAt).toLocaleDateString()}` : "Built with mentors"}
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">{content?.title ?? "About Ottolearn"}</h1>
            <p className="text-lg text-slate-600">
              {content?.subtitle ?? "Ottolearn is a learner-obsessed platform blending AI copilots with human mentorship."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200/60 hover:from-emerald-400 hover:to-teal-400"
              onClick={() => setLocation("/courses")}
            >
              Explore courses
            </Button>
            <Button
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setLocation("/become-a-tutor")}
            >
              Partner as tutor
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl bg-slate-100" />)
          : stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
              <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm uppercase tracking-wide text-slate-500">{stat.label}</p>
            </div>
          ))}
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h2 className="text-xl font-semibold text-slate-900">Why learners choose Ottolearn</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {isLoading && highlights.length === 0
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl bg-slate-100" />)
            : highlights.map((highlight) => (
              <Card key={highlight.title} className="border-slate-100 bg-white shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <p className="text-lg font-semibold text-slate-900">{highlight.title}</p>
                  <p className="text-sm text-slate-600">{highlight.description}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 text-slate-600">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <h2 className="text-xl font-semibold text-slate-900">Our values</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-base font-semibold text-slate-900">{value.title}</p>
              <p className="mt-2 text-sm text-slate-600">{value.description}</p>
            </div>
          ))}
          {values.length === 0 && !isLoading ? (
            <p className="text-sm text-slate-500">Values are being updated.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-slate-100 bg-white p-6 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-slate-600">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-semibold text-slate-900">What&#39;s next</h2>
          </div>
          <p className="text-sm text-slate-600">
            We are building collaborative labs, AI-first course authoring, and peer review loops that mirror modern product teams.
          </p>
          <Button
            variant="secondary"
            className="bg-gradient-to-r from-slate-900 to-slate-700 text-white hover:from-slate-800 hover:to-slate-600"
            onClick={() => setLocation(COURSE_PLAYER_PATH)}
          >
            Return to home
          </Button>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Community impact</p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span>Career labs with 120+ volunteer mentors</span>
            </li>
            <li className="flex items-start gap-2">
              <Users2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span>Global chapter meetups hosted quarterly</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 text-slate-600">
          <h2 className="text-xl font-semibold text-slate-900">Frequently asked questions</h2>
        </div>
        {isLoading && faqs.length === 0 ? (
          <Skeleton className="h-32 w-full rounded-2xl bg-slate-100" />
        ) : faqs.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`faq-${index}`}
                className="rounded-2xl border border-slate-100 bg-white px-4 shadow-sm"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-slate-900">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm text-slate-600">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-sm text-slate-500">More answers are coming soon.</p>
        )}
      </section>
    </SiteLayout>
  );
}
