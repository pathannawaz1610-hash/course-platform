import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  fetchTutorCourses,
  fetchTutorEnrollments,
  fetchTutorProgress,
  fetchActivityLearners,
  fetchLearnerHistory,
  queryAssistant,
  type TutorCourse,
  type EnrollmentRow,
  type ProgressRow,
  type ActivityLearner,
  type ActivitySummary
} from '@/lib/binding/actions/tutorActions';
import { fetchCourseTopics, type Topic as CourseTopic } from '@/lib/binding/actions/courseActions';
import { readStoredSession, clearStoredSession, resetSessionHeartbeat } from '@/utils/session';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';



type TutorAssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export default function TutorDashboardPage() {
  const session = readStoredSession();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<TutorAssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }
    resetSessionHeartbeat();
  }, [session]);

  const headers = useMemo(() => {
    if (!session?.accessToken) return undefined;
    const h = new Headers();
    h.set('Authorization', `Bearer ${session.accessToken}`);
    return h;
  }, [session?.accessToken]);

  const {
    data: coursesResponse,
    isLoading: coursesLoading
  } = useQuery<{ courses: TutorCourse[] }>({
    queryKey: ['tutor-courses'],
    enabled: session?.role === 'tutor' || session?.role === 'admin',
    queryFn: async () => {
      const response = await fetchTutorCourses();
      return response;
    }
  });

  const courses = coursesResponse?.courses ?? [];

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].courseId);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    setAssistantMessages([]);
    setSelectedLearnerId(null);
  }, [selectedCourseId]);

  const {
    data: enrollmentsResponse,
    isLoading: enrollmentsLoading
  } = useQuery<{ enrollments: EnrollmentRow[] }>({
    queryKey: ['tutor-enrollments', selectedCourseId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      return fetchTutorEnrollments(selectedCourseId!);
    }
  });

  const { data: progressResponse, isLoading: progressLoading } = useQuery<{ learners: ProgressRow[]; totalModules: number }>({
    queryKey: ['tutor-progress', selectedCourseId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      return fetchTutorProgress(selectedCourseId!);
    }
  });

  const {
    data: topicsResponse,
    isLoading: topicsLoading
  } = useQuery<{ topics: CourseTopic[] }>({
    queryKey: ['tutor-topics', selectedCourseId],
    enabled: Boolean(selectedCourseId),
    queryFn: async () => {
      const topics = await fetchCourseTopics(selectedCourseId!);
      return { topics };
    }
  });

  const {
    data: activityResponse,
    isLoading: activityLoading,
    isFetching: activityFetching,
    error: activityError
  } = useQuery<{ learners: ActivityLearner[]; summary: ActivitySummary }>({
    queryKey: ['activity-summary', selectedCourseId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    refetchInterval: 30_000,
    queryFn: async () => {
      return fetchActivityLearners(selectedCourseId!);
    }
  });

  const {
    data: historyResponse,
    isLoading: historyLoading,
    isFetching: historyFetching
  } = useQuery<{ events: ActivityLearner[] }>({
    queryKey: ['activity-history', selectedLearnerId, selectedCourseId],
    enabled: Boolean(selectedLearnerId) && Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      return fetchLearnerHistory(selectedLearnerId!, selectedCourseId!);
    }
  });

  useEffect(() => {
    const learners = activityResponse?.learners ?? [];
    if (learners.length === 0) {
      setSelectedLearnerId(null);
      return;
    }
    if (!selectedLearnerId || !learners.some((learner) => learner.userId === selectedLearnerId)) {
      setSelectedLearnerId(learners[0].userId);
    }
  }, [activityResponse?.learners, selectedLearnerId]);

  const learnerDirectory = useMemo(() => {
    const map = new Map<string, { fullName?: string; email?: string }>();
    (enrollmentsResponse?.enrollments ?? []).forEach((row) => {
      map.set(row.userId, { fullName: row.fullName, email: row.email });
    });
    (progressResponse?.learners ?? []).forEach((row) => {
      if (!map.has(row.userId)) {
        map.set(row.userId, { fullName: row.fullName, email: row.email });
      }
    });
    return map;
  }, [enrollmentsResponse?.enrollments, progressResponse?.learners]);

  const topicTitleLookup = useMemo(() => {
    const map = new Map<string, { title: string; moduleNo: number; moduleName?: string }>();
    (topicsResponse?.topics ?? []).forEach((topic) => {
      map.set(topic.topicId, { title: topic.topicName, moduleNo: topic.moduleNo, moduleName: topic.moduleName });
    });
    return map;
  }, [topicsResponse?.topics]);

  const activitySummary = activityResponse?.summary ?? { engaged: 0, attention_drift: 0, content_friction: 0, unknown: 0 };
  const statusMeta: Record<
    NonNullable<ActivityLearner['derivedStatus']> | 'unknown',
    { label: string; badgeClass: string; description: string; dotClass: string }
  > = {
    engaged: {
      label: 'Engaged',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      dotClass: 'bg-emerald-500',
      description: 'Actively interacting with course content.'
    },
    attention_drift: {
      label: 'Attention drift',
      badgeClass: 'bg-amber-100 text-amber-700',
      dotClass: 'bg-amber-500',
      description: 'Idle or pause cues observed.'
    },
    content_friction: {
      label: 'Content friction',
      badgeClass: 'bg-rose-100 text-rose-700',
      dotClass: 'bg-rose-500',
      description: 'Learner signaling friction.'
    },
    unknown: {
      label: 'Unknown',
      badgeClass: 'bg-slate-200 text-slate-700',
      dotClass: 'bg-slate-400',
      description: 'Awaiting telemetry events.'
    }
  };

  const selectedLearner = activityResponse?.learners.find((learner) => learner.userId === selectedLearnerId) ?? null;
  const selectedIdentity = selectedLearnerId ? learnerDirectory.get(selectedLearnerId) : null;
  const historyEvents = historyResponse?.events ?? [];
  const sortedHistoryEvents = useMemo(() => {
    return [...historyEvents].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (diff !== 0) {
        return diff;
      }
      if (a.eventId && b.eventId && a.eventId !== b.eventId) {
        return a.eventId < b.eventId ? 1 : -1;
      }
      return 0;
    });
  }, [historyEvents]);
  const statusOrder: Array<keyof typeof statusMeta> = ['engaged', 'attention_drift', 'content_friction', 'unknown'];

  const formatTimestamp = (timestamp: string) =>
    new Date(timestamp).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', year: 'numeric', month: 'short', day: 'numeric' });

  const EVENT_LABELS: Record<string, string> = {
    'idle.start': 'Idle detected',
    'idle.end': 'Attention resumed',
    'video.play': 'Video started',
    'video.pause': 'Video paused',
    'video.buffer.start': 'Video buffering',
    'video.buffer.end': 'Video resumed',
    'lesson.view': 'Lesson viewed',
    'lesson.locked_click': 'Locked lesson clicked',
    'quiz.fail': 'Quiz attempt failed',
    'quiz.pass': 'Quiz passed',
    'quiz.retry': 'Quiz retried',
    'quiz.progress': 'Quiz progress updated',
    'progress.snapshot': 'Progress snapshot',
    'persona.change': 'Persona updated',
    'notes.saved': 'Notes saved',
    'cold_call.loaded': 'Cold-call prompt opened',
    'cold_call.submit': 'Cold-call response submitted',
    'cold_call.star': 'Cold-call star awarded',
    'cold_call.response_received': 'Tutor responded to cold-call',
    'tutor.prompt': 'Tutor prompt sent',
    'tutor.response_received': 'Tutor response received',
  };

  const STATUS_REASON_LABELS: Record<string, string> = {
    no_interaction: 'No interaction detected',
    tab_hidden: 'Browser tab hidden',
    tab_visible: 'Browser tab visible',
    video_play: 'Video playing',
    video_pause: 'Video paused',
  };

  function friendlyLabel(source: string, dictionary: Record<string, string>): string {
    const normalized = source.toLowerCase();
    if (dictionary[normalized]) {
      return dictionary[normalized];
    }
    if (/\s/.test(source) || /[()]/.test(source)) {
      return source;
    }
    return source
      .replace(/[._]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function formatEventLabel(eventType: string): string {
    return friendlyLabel(eventType, EVENT_LABELS);
  }

  function formatStatusReason(reason?: string | null): string | null {
    if (!reason) return null;
    return friendlyLabel(reason, STATUS_REASON_LABELS);
  }

  const handleLogout = () => {
    clearStoredSession();
    toast({ title: 'Signed out' });
    setLocation('/become-a-tutor');
  };

  const handleAssistantSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId || !assistantInput.trim()) {
      return;
    }

    if (!headers) {
      toast({ variant: 'destructive', title: 'Session missing', description: 'Please sign in again.' });
      return;
    }

    const question = assistantInput.trim();
    const userMessage: TutorAssistantMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };

    setAssistantMessages((prev) => [...prev, userMessage]);
    setAssistantInput('');
    setAssistantLoading(true);

    try {
      const payload = await queryAssistant(selectedCourseId, question);
      const assistantMessage: TutorAssistantMessage = {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: payload?.answer ?? 'No response available.',
        timestamp: new Date().toISOString()
      };
      setAssistantMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Assistant unavailable',
        description: error?.message ?? 'Unable to fetch response'
      });
    } finally {
      setAssistantLoading(false);
    }
  };

  const totalEnrollments = enrollmentsResponse?.enrollments?.length ?? 0;
  const averageProgressPercent = useMemo(() => {
    const learners = progressResponse?.learners ?? [];
    if (learners.length === 0) {
      return 0;
    }
    const total = learners.reduce((acc, learner) => acc + learner.percent, 0);
    return Math.round(total / learners.length);
  }, [progressResponse?.learners]);

  const navItems = [
    { id: 'overview', label: 'Command Center' },
    { id: 'classroom', label: 'Classroom' },
    { id: 'monitoring', label: 'Live Monitor' },
    { id: 'copilot', label: 'AI Copilot' }
  ];

  const overviewStats = [
    { label: 'Active learners', value: totalEnrollments, helper: `${activitySummary.engaged} currently engaged` },
    {
      label: 'Avg. progress',
      value: `${averageProgressPercent}%`,
      helper: progressResponse?.totalModules ? `${progressResponse.totalModules} modules tracked` : 'Across current cohort'
    },
    {
      label: 'Critical alerts',
      value: activitySummary.content_friction,
      helper: 'Content friction signals'
    }
  ];

  const handleSectionNav = (sectionId: string) => {
    if (typeof document === 'undefined') {
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!session) {
    return (
      <SiteLayout>
        <div className="max-w-3xl mx-auto py-10 px-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">Use your tutor credentials to access the dashboard.</p>
              <Button onClick={() => setLocation('/become-a-tutor')}>Go to tutor login</Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  if (session.role !== 'tutor' && session.role !== 'admin') {
    return (
      <SiteLayout>
        <div className="max-w-3xl mx-auto py-10 px-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access restricted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">This area is only for tutors or admins.</p>
              <Button className="mt-3" onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 text-slate-900">
          <section id="overview" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Tutor Command Center</p>
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">Welcome back, {session.fullName ?? 'Tutor'}</h1>
                  <p className="text-sm text-slate-600">
                    Monitor every learner signal, respond to alerts, and guide your class from a single surface.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Select value={selectedCourseId ?? undefined} onValueChange={(value) => setSelectedCourseId(value)}>
                    <SelectTrigger className="w-full border-slate-300 bg-white text-left text-slate-900 sm:w-[280px]">
                      <SelectValue placeholder={coursesLoading ? 'Loading...' : 'Select course'} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.courseId} value={course.courseId}>
                          {course.title} {course.role ? `(${course.role})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={handleLogout}
                  >
                    Logout
                  </Button>
                </div>
                {courses.length > 0 && selectedCourseId && (
                  <p className="text-sm text-slate-600">
                    Showing data for{' '}
                    <span className="font-semibold">
                      {courses.find((c) => c.courseId === selectedCourseId)?.title ?? 'your course'}
                    </span>
                    .
                  </p>
                )}
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {overviewStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{stat.value}</p>
                    <p className="text-sm text-slate-600">{stat.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <nav className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600" aria-label="Tutor sections">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSectionNav(item.id)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <section id="classroom" className="mt-12 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Classroom</p>
              <h2 className="text-2xl font-semibold text-slate-900">Roster & Throughput</h2>
              <p className="text-sm text-slate-600">Stay on top of enrollments and module completion at a glance.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-200 bg-white text-slate-900 shadow-md">
                <CardHeader>
                  <CardTitle className="text-slate-900">Enrollments</CardTitle>
                  <p className="text-sm text-slate-600">{totalEnrollments} learners in the cohort</p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {enrollmentsLoading ? (
                    <p className="text-sm text-slate-600">Loading enrollments...</p>
                  ) : (enrollmentsResponse?.enrollments ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">No enrollments yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-slate-500">Learner</TableHead>
                          <TableHead className="text-slate-500">Email</TableHead>
                          <TableHead className="text-slate-500">Status</TableHead>
                          <TableHead className="text-slate-500">Enrolled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(enrollmentsResponse?.enrollments ?? []).map((enrollment) => (
                          <TableRow key={enrollment.enrollmentId} className="border-slate-100">
                            <TableCell className="text-slate-900">{enrollment.fullName}</TableCell>
                            <TableCell className="text-slate-600">{enrollment.email}</TableCell>
                            <TableCell>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs capitalize text-emerald-700">
                                {enrollment.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-600">{new Date(enrollment.enrolledAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white text-slate-900 shadow-md">
                <CardHeader>
                  <CardTitle className="text-slate-900">Learner progress</CardTitle>
                  <p className="text-sm text-slate-600">
                    Average completion {averageProgressPercent}% across {progressResponse?.totalModules ?? 0} modules
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {progressLoading ? (
                    <p className="text-sm text-slate-600">Loading progress...</p>
                  ) : (progressResponse?.learners ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">No progress yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-slate-500">Learner</TableHead>
                          <TableHead className="text-slate-500">Modules</TableHead>
                          <TableHead className="text-slate-500">Percent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(progressResponse?.learners ?? []).map((learner) => (
                          <TableRow key={learner.userId} className="border-slate-100">
                            <TableCell>
                              <div className="font-semibold text-slate-900">{learner.fullName}</div>
                              <div className="text-xs text-slate-500">{learner.email}</div>
                            </TableCell>
                            <TableCell className="text-slate-700">
                              {learner.completedModules}/{learner.totalModules}
                            </TableCell>
                            <TableCell className="text-slate-900">
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
                                    style={{ width: `${learner.percent}%` }}
                                  />
                                </div>
                                <span>{learner.percent}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="monitoring" className="mt-12 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Live monitor</p>
              <h2 className="text-2xl font-semibold text-slate-900">Engagement & Alerts</h2>
              <p className="text-sm text-slate-600">
                Engagement states synthesized from system logs, idle heuristics, cold calls, personas, and quiz telemetry.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex flex-wrap gap-2">
                {statusOrder.map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                  >
                    <span className={`h-2 w-2 rounded-full ${statusMeta[key].dotClass}`} />
                    <div>
                      <p className="font-semibold leading-none text-slate-900">{statusMeta[key].label}</p>
                      <p className="text-[10px] text-slate-500">{activitySummary[key]} learners</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    {activityFetching ? 'Refreshing telemetry...' : 'Snapshots refresh automatically every 30 seconds.'}
                  </p>
                  {activityError && (
                    <p className="text-sm text-rose-500">
                      Unable to load learner telemetry right now. Please retry shortly.
                    </p>
                  )}
                  {activityLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((index) => (
                        <Skeleton key={index} className="h-24 w-full rounded-2xl bg-slate-100" />
                      ))}
                    </div>
                  ) : (activityResponse?.learners ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No telemetry yet. As learners watch, read, attempt quizzes, or interact with widgets, they will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(activityResponse?.learners ?? []).map((learner) => {
                        const identity = learnerDirectory.get(learner.userId);
                        const key = (learner.derivedStatus ?? 'unknown') as keyof typeof statusMeta;
                        const meta = statusMeta[key];
                        const isActive = selectedLearnerId === learner.userId;
                        const reasonLabel = formatStatusReason(learner.statusReason);
                        return (
                          <button
                            type="button"
                            key={learner.userId}
                            onClick={() => setSelectedLearnerId(learner.userId)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${isActive ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {identity?.fullName ?? 'Learner'}{' '}
                                  {!identity?.fullName && (
                                    <span className="text-xs text-slate-500">({learner.userId.slice(0, 6)})</span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">{identity?.email ?? 'Email unavailable'}</p>
                              </div>
                              <Badge variant="secondary" className={`${meta.badgeClass} border-0`}>
                                {meta.label}
                              </Badge>
                            </div>
                            {reasonLabel && <p className="mt-2 text-sm text-slate-600">{reasonLabel}</p>}
                            <p className="mt-1 text-[11px] text-slate-500">Updated {formatTimestamp(learner.createdAt)}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Learner detail</p>
                      <p className="text-xs text-slate-600">
                        {selectedIdentity?.fullName
                          ? `${selectedIdentity.fullName} ? ${selectedIdentity.email ?? 'Email unavailable'}`
                          : 'Select a learner to drill into their last actions.'}
                      </p>
                    </div>
                    {selectedLearner && (
                      <Badge
                        variant="secondary"
                        className={`${statusMeta[(selectedLearner.derivedStatus ?? 'unknown') as keyof typeof statusMeta].badgeClass} border-0`}
                      >
                        {statusMeta[(selectedLearner.derivedStatus ?? 'unknown') as keyof typeof statusMeta].label}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {!selectedLearnerId ? (
                      <p className="text-sm text-slate-600">Select any learner from the list to review their telemetry timeline.</p>
                    ) : historyLoading || historyFetching ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((index) => (
                          <Skeleton key={index} className="h-20 w-full rounded-xl bg-slate-100" />
                        ))}
                      </div>
                    ) : sortedHistoryEvents.length === 0 ? (
                      <p className="text-sm text-slate-600">No events recorded for this learner yet.</p>
                    ) : (
                      sortedHistoryEvents.map((event, index) => {
                        const meta = statusMeta[(event.derivedStatus ?? 'unknown') as keyof typeof statusMeta];
                        const eventLabel = formatEventLabel(event.eventType);
                        const reasonLabel = formatStatusReason(event.statusReason);
                        return (
                          <div
                            key={event.eventId ?? `${event.eventType}-${event.createdAt}-${event.moduleNo ?? 'm'}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <Badge variant="secondary" className={`${meta.badgeClass} border-0`}>
                                {meta.label}
                              </Badge>
                              <span className="text-[11px] text-slate-500">{formatTimestamp(event.createdAt)}</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{eventLabel}</p>
                            {reasonLabel && <p className="text-xs text-slate-600">{reasonLabel}</p>}
                            <p className="mt-1 text-[11px] text-slate-500">
                              {(() => {
                                const topicMeta = event.topicId ? topicTitleLookup.get(event.topicId) : null;
                                const moduleLabel = topicMeta
                                  ? topicMeta.moduleName ?? `Module ${topicMeta.moduleNo}`
                                  : `Module ${event.moduleNo ?? 'n/a'}`;
                                const topicLabel = topicMeta?.title ?? (event.topicId ? `Topic ${event.topicId.slice(0, 8)}` : 'Topic n/a');
                                return `${moduleLabel} | ${topicLabel}`;
                              })()}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="copilot" className="mt-12 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">AI copilot</p>
              <h2 className="text-2xl font-semibold text-slate-900">Ask the classroom analyst</h2>
              <p className="text-sm text-slate-600">Use natural language to query enrollments, engagement trends, or struggling learners.</p>
            </div>
            <Card className="border-slate-200 bg-white text-slate-900 shadow-md">
              <CardContent className="space-y-5 pt-6">
                <div className="h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  {assistantMessages.length === 0 ? (
                    <div className="text-slate-600">
                      Example prompts: ?Which learners have been inactive for 7 days?? or ?Summarize completion by module.?
                    </div>
                  ) : (
                    assistantMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`mb-3 inline-block max-w-full rounded-2xl px-4 py-2 ${message.role === 'assistant'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'bg-emerald-50 text-emerald-800'
                          }`}
                      >
                        <p className="text-[10px] uppercase tracking-wide opacity-70">
                          {message.role === 'assistant' ? 'Copilot' : 'You'}
                        </p>
                        <p>{message.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <form className="space-y-3" onSubmit={handleAssistantSubmit}>
                  <Textarea
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    placeholder="Ask about enrollments, stuck learners, quiz performance..."
                    disabled={!selectedCourseId}
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      disabled={!selectedCourseId || assistantLoading}
                      className="bg-blue-600 text-white hover:bg-blue-500"
                    >
                      {assistantLoading ? 'Thinking...' : 'Ask Copilot'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-slate-600"
                      onClick={() => setAssistantInput('List learners below 50% completion and note their last activity.')}
                    >
                      Suggestion
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}
