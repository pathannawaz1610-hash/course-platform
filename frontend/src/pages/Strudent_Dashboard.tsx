
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Play,
  ArrowRight,
  Users,
  GraduationCap,
  CalendarClock,
  Ticket,
  PlayCircle,
  Clock,
  Layers,
  LogOut,
  Search,
  Bell,
  Zap,
} from 'lucide-react';
import { readStoredSession, ensureSessionFresh, logoutAndRedirect } from '@/utils/session';
import { fetchDashboardSummary, type DashboardSummary } from '@/lib/binding/actions/dashboardActions';

// --- TYPES ---
export enum EnrollmentType {
  COHORT = 'COHORT',
  ON_DEMAND = 'ON_DEMAND',
  WORKSHOP = 'WORKSHOP'
}

export enum CohortStatus {
  UPCOMING = 'Upcoming',
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed'
}

export interface CohortProgram {
  id: string;
  title: string;
  status: CohortStatus;
  progress: number;
  nextSessionDate?: string;
  courseSlug?: string | null;
}

export interface OnDemandCourse {
  id: string;
  title: string;
  progress: number;
  lastAccessedModule: string;
  courseSlug?: string | null;
  lastLessonSlug?: string | null;
}

export interface Workshop {
  id: string;
  title: string;
  date: string;
  time: string;
  isJoined: boolean;
}

export interface UpcomingCourse {
  id: string;
  title: string;
  releaseDate: string;
  category: string;
}

export interface UserEnrollments {
  cohorts: CohortProgram[];
  onDemand: OnDemandCourse[];
  workshops: Workshop[];
  completed: { title: string; date: string }[];
  upcoming: UpcomingCourse[];
}

type NotificationItem = {
  id: string;
  label: string;
  detail?: string;
  route?: string;
};

// --- COMPONENTS ---
const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
};

const Sidebar: React.FC<{
  onHomeClick: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  notifications: NotificationItem[];
  onNavigate: (route: string) => void;
  userName: string;
  onLogout: () => void;
}> = ({ onHomeClick, searchQuery, onSearchChange, notifications, onNavigate, userName, onLogout }) => {
  const [open, setOpen] = useState(false);
  const initials = getInitials(userName);
  const notificationCount = notifications.length;

  return (
    <nav className="fixed top-0 left-0 w-full h-16 bg-retro-teal text-retro-bg flex items-center justify-between px-6 lg:px-10 z-50 border-b border-retro-sage/30 shadow-lg backdrop-blur-md bg-opacity-95">
      <button
        type="button"
        onClick={onHomeClick}
        className="flex items-center gap-3 min-w-max group cursor-pointer"
      >
        <div className="w-9 h-9 bg-retro-salmon rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white shadow-lg group-hover:scale-110 transition-all">
          <Zap size={18} fill="white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-lg tracking-tighter leading-none">OTTOLEARN</span>
          <span className="text-[8px] font-black tracking-[0.3em] text-retro-salmon uppercase">Command</span>
        </div>
      </button>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="relative hidden lg:block">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-retro-teal/50" />
          <input
            type="text"
            placeholder="Search my courses..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="bg-white/10 border border-white/10 rounded-xl py-1.5 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-retro-salmon/50 transition-all placeholder:text-retro-teal/50 w-48 xl:w-72 text-white"
          />
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            className="relative p-2 hover:bg-white/10 rounded-xl text-canvas transition-all group"
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-retro-salmon rounded-full border border-retro-teal"></span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-72 bg-white text-retro-teal rounded-2xl shadow-xl border border-retro-sage/20 overflow-hidden z-50">
              <div className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-retro-teal/60 border-b border-retro-sage/10">
                Notifications
              </div>
              <div className="max-h-72 overflow-auto">
                {notificationCount === 0 ? (
                  <div className="px-4 py-4 text-sm text-retro-teal/60">All caught up.</div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-retro-bg/60 transition-colors"
                      onClick={() => {
                        setOpen(false);
                        if (item.route) {
                          onNavigate(item.route);
                        }
                      }}
                    >
                      <div className="text-xs font-bold text-retro-teal">{item.label}</div>
                      {item.detail && (
                        <div className="text-[11px] text-retro-teal/60 mt-1">{item.detail}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="h-8 w-[1px] bg-white/10 hidden sm:block mx-1"></div>
          <div className="flex items-center gap-3 pl-2">
            <div className="w-9 h-9 rounded-xl bg-retro-salmon/20 flex items-center justify-center text-retro-salmon border border-retro-salmon/20 cursor-pointer hover:bg-retro-salmon/30 transition-colors">
              <span className="text-xs font-black">{initials}</span>
            </div>
          </div>
          <button
            className="p-2 ml-1 text-white/30 hover:text-retro-salmon transition-all group"
            title="Logout"
            type="button"
            onClick={onLogout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
};

const ResumeHero: React.FC<{
  course: OnDemandCourse | null;
  onContinue: () => void;
  onBrowse: () => void;
  lastActiveLabel: string;
}> = ({ course, onContinue, onBrowse, lastActiveLabel }) => (
  <section>
    <div className="bg-retro-teal rounded-2xl p-6 lg:p-10 text-retro-bg flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl border border-white/5">
      <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-retro-salmon/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-5 max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 bg-retro-salmon text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-1.5">
            <Play size={10} fill="currentColor" /> {course ? "Resume" : "Get Started"}
          </span>
          <span className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 flex items-center gap-1.5">
            <GraduationCap size={12} /> {course ? "On-Demand Course" : "Course Library"}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/40 flex items-center gap-1.5 ml-auto md:ml-0">
            <Clock size={12} /> {lastActiveLabel}
          </span>
        </div>

        <div>
          <h2 className="text-3xl md:text-4xl font-black leading-tight tracking-tight mb-2">
            {course ? course.title : "No active course to resume yet"}
          </h2>
          <p className="text-base opacity-75 font-medium italic flex items-center gap-2">
            <Layers size={16} className="text-retro-salmon" />
            {course?.lastAccessedModule
              ? `Currently on: "${course.lastAccessedModule}"`
              : "Browse the catalog to start learning."}
          </p>
        </div>

        <div className="pt-2">
          {course ? (
            <button
              className="flex items-center gap-3 bg-white text-retro-teal px-8 py-3 rounded-2xl font-black transition-all hover:scale-105 hover:shadow-xl active:scale-95 text-base group shadow-lg"
              onClick={onContinue}
              type="button"
            >
              <PlayCircle size={22} className="group-hover:text-retro-salmon transition-colors" />
              Continue
            </button>
          ) : (
            <button
              className="flex items-center gap-3 bg-white text-retro-teal px-8 py-3 rounded-2xl font-black transition-all hover:scale-105 hover:shadow-xl active:scale-95 text-base group shadow-lg"
              onClick={onBrowse}
              type="button"
            >
              <PlayCircle size={22} className="group-hover:text-retro-salmon transition-colors" />
              Browse courses
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 bg-white/5 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 w-full md:w-64 flex flex-col items-center justify-center text-center shadow-inner">
        {course ? (
          <>
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle className="text-white/5" strokeWidth="10" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                <circle
                  className="text-retro-salmon transition-all duration-1000 ease-out"
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - course.progress / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black tracking-tighter">{course.progress}%</span>
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-retro-salmon">Syllabus Completion</p>
          </>
        ) : (
          <div className="text-sm text-white/70 font-semibold">Start your first module to see progress.</div>
        )}
      </div>
    </div>
  </section>
);

const QuickStats: React.FC<{
  sessionsThisWeek: number;
  lastActiveLabel: string;
  cohortCount: number;
  onDemandCount: number;
  workshopCount: number;
}> = ({ sessionsThisWeek, lastActiveLabel, cohortCount, onDemandCount, workshopCount }) => (
  <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="bg-white rounded-2xl p-4 border border-retro-sage/10 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-retro-teal/50 mb-2">This Week</p>
      <p className="text-lg font-black text-retro-teal">{sessionsThisWeek} session{sessionsThisWeek === 1 ? "" : "s"}</p>
      <p className="text-xs text-retro-teal/60 mt-1">{lastActiveLabel}</p>
    </div>
    <div className="bg-white rounded-2xl p-4 border border-retro-sage/10 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-retro-teal/50 mb-2">Enrollments</p>
      <p className="text-lg font-black text-retro-teal">{cohortCount + onDemandCount} active</p>
      <p className="text-xs text-retro-teal/60 mt-1">{cohortCount} cohort - {onDemandCount} on-demand</p>
    </div>
    <div className="bg-white rounded-2xl p-4 border border-retro-sage/10 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-retro-teal/50 mb-2">Workshops</p>
      <p className="text-lg font-black text-retro-teal">{workshopCount} upcoming</p>
      <p className="text-xs text-retro-teal/60 mt-1">Registration from your dashboard</p>
    </div>
  </section>
);

const NextActionCard: React.FC<{
  title: string;
  description: string;
  cta: string;
  onAction: () => void;
}> = ({ title, description, cta, onAction }) => (
  <section className="bg-white rounded-2xl p-6 border border-retro-sage/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-retro-teal/50 mb-2">Next Action</p>
      <h3 className="text-xl font-black text-retro-teal mb-1">{title}</h3>
      <p className="text-sm text-retro-teal/70">{description}</p>
    </div>
    <button
      type="button"
      onClick={onAction}
      className="bg-retro-teal text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-md hover:bg-retro-salmon transition-colors"
    >
      {cta}
    </button>
  </section>
);

const DashboardContent: React.FC<{
  data: UserEnrollments;
  onNavigateCourse: (courseSlug?: string | null, lessonSlug?: string | null) => void;
  onNavigateCourseDetails: (courseSlug?: string | null) => void;
  onNavigateCohortCatalog: () => void;
  onNavigateOnDemandCatalog: () => void;
  onNavigateRegistration: () => void;
}> = ({
  data,
  onNavigateCourse,
  onNavigateCourseDetails,
  onNavigateCohortCatalog,
  onNavigateOnDemandCatalog,
  onNavigateRegistration,
}) => {
    const hasCohorts = data.cohorts.length > 0;
    const hasOnDemand = data.onDemand.length > 0;
    const hasWorkshops = data.workshops.length > 0;

    return (
      <div className="space-y-16 mt-10">
        {/* Section 1: Cohort Programs */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-retro-sage/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-retro-teal/10 rounded-xl text-retro-teal"><Users size={20} /></div>
              <h3 className="text-xl font-black text-retro-teal tracking-tight uppercase tracking-widest">My Active Cohorts</h3>
            </div>
            <button
              className="text-xs font-bold text-retro-teal/70 hover:text-retro-salmon transition-colors uppercase tracking-widest"
              type="button"
              onClick={() => {
                if (data.cohorts[0]?.courseSlug) {
                  onNavigateCourseDetails(data.cohorts[0]?.courseSlug);
                } else {
                  onNavigateCohortCatalog();
                }
              }}
            >
              {hasCohorts ? "View History" : "Explore Cohorts"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hasCohorts ? (
              data.cohorts.map(cohort => (
                <div key={cohort.id} className="bg-white rounded-3xl p-7 border border-retro-sage/5 hover:border-retro-salmon/20 transition-all shadow-sm hover:shadow-xl group">
                  <div className="flex justify-between items-center mb-6">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${cohort.status === CohortStatus.ONGOING ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                      {cohort.status}
                    </span>
                    <div className="text-[9px] font-black text-retro-teal/60 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={12} /> {cohort.nextSessionDate?.split(' - ')[0] ?? "TBD"}
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-retro-teal mb-10 line-clamp-2 group-hover:text-retro-salmon transition-colors leading-snug min-h-[3.5rem]">
                    {cohort.title}
                  </h4>

                  <div className="space-y-4 pt-4 border-t border-retro-sage/5">
                    <div className="flex justify-between items-end">
                      <p className="text-2xl font-black text-retro-teal tracking-tighter">{cohort.progress}<span className="text-xs text-retro-teal/40 ml-0.5">%</span></p>
                      <button
                        className="bg-retro-teal text-white p-2.5 rounded-xl hover:bg-retro-salmon transition-all shadow-md group-hover:scale-110 active:scale-95"
                        type="button"
                        onClick={() =>
                          cohort.courseSlug ? onNavigateCourseDetails(cohort.courseSlug) : onNavigateCohortCatalog()
                        }
                      >
                        <ArrowRight size={18} />
                      </button>
                    </div>
                    <div className="h-2.5 bg-retro-bg rounded-full overflow-hidden">
                      <div className="h-full bg-retro-teal transition-all duration-700 ease-out" style={{ width: `${cohort.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl p-7 border border-dashed border-retro-sage/30 text-retro-teal/70">
                <div className="text-sm font-bold mb-2">No active cohorts yet.</div>
                <button
                  type="button"
                  onClick={onNavigateCohortCatalog}
                  className="text-xs font-black uppercase tracking-[0.2em] text-retro-salmon"
                >
                  Explore cohort programs
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: On Demand Courses */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-retro-sage/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-retro-teal/10 rounded-xl text-retro-teal"><GraduationCap size={20} /></div>
              <h3 className="text-xl font-black text-retro-teal tracking-tight uppercase tracking-widest">On Demand Courses</h3>
            </div>
            <button
              className="text-xs font-bold text-retro-teal/70 hover:text-retro-salmon transition-colors uppercase tracking-widest"
              type="button"
              onClick={() => {
                if (data.onDemand[0]?.courseSlug) {
                  onNavigateCourseDetails(data.onDemand[0]?.courseSlug);
                } else {
                  onNavigateOnDemandCatalog();
                }
              }}
            >
              {hasOnDemand ? "Browse Library" : "Explore On-Demand"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hasOnDemand ? (
              data.onDemand.map(course => (
                <div key={course.id} className="bg-white rounded-3xl p-7 border border-retro-sage/5 hover:border-retro-salmon/10 transition-all shadow-sm hover:shadow-lg group flex flex-col justify-between">
                  <div className="mb-8">
                    <h4 className="text-base font-bold text-retro-teal mb-3 line-clamp-2 leading-snug group-hover:text-retro-salmon transition-colors min-h-[3rem]">
                      {course.title}
                    </h4>
                    <div className="bg-retro-bg/40 p-2.5 rounded-xl border border-retro-sage/5">
                      <p className="text-[9px] text-retro-teal/50 font-black uppercase tracking-widest mb-1">Last Viewed</p>
                      <p className="text-[10px] font-bold text-retro-teal/80 line-clamp-1 italic">
                        {course.lastAccessedModule ? `"${course.lastAccessedModule}"` : "Not started yet"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-1.5 bg-retro-bg rounded-full overflow-hidden">
                      <div className="h-full bg-retro-sage/60 group-hover:bg-retro-salmon transition-all duration-500" style={{ width: `${course.progress}%` }} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-retro-teal/40 uppercase tracking-widest">{course.progress}% Complete</span>
                      <button
                        className="text-retro-salmon text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:translate-x-1 transition-transform"
                        type="button"
                        onClick={() => onNavigateCourse(course.courseSlug ?? course.id, course.lastLessonSlug)}
                      >
                        <PlayCircle size={14} /> Resume
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl p-7 border border-dashed border-retro-sage/30 text-retro-teal/70">
                <div className="text-sm font-bold mb-2">No on-demand courses yet.</div>
                <button
                  type="button"
                  onClick={onNavigateOnDemandCatalog}
                  className="text-xs font-black uppercase tracking-[0.2em] text-retro-salmon"
                >
                  Explore on-demand catalog
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Workshops */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-retro-sage/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-retro-salmon/10 rounded-xl text-retro-salmon"><CalendarClock size={20} /></div>
              <h3 className="text-xl font-black text-retro-teal tracking-tight uppercase tracking-widest">Upcoming Workshops</h3>
            </div>
            <p className="text-[10px] font-black text-retro-teal/40 uppercase tracking-[0.2em] hidden sm:block">Live Interactive Sessions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hasWorkshops ? (
              data.workshops.map(workshop => (
                <div key={workshop.id} className="bg-white p-7 rounded-3xl border border-retro-sage/5 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                  {workshop.isJoined && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-retro-teal text-[8px] font-black text-white uppercase tracking-widest rounded-bl-xl">Registered</div>
                  )}
                  <div className="mb-6">
                    <p className="text-lg font-bold text-retro-teal mb-2 line-clamp-1">{workshop.title}</p>
                    <div className="flex items-center gap-4">
                      <p className="text-[10px] font-black text-retro-teal/60 uppercase tracking-widest flex items-center gap-2 bg-retro-bg/50 px-2 py-1 rounded-lg">
                        <CalendarClock size={12} className="text-retro-salmon" /> {workshop.date}
                      </p>
                      <p className="text-[10px] font-black text-retro-teal/60 uppercase tracking-widest flex items-center gap-2 bg-retro-bg/50 px-2 py-1 rounded-lg">
                        <Clock size={12} className="text-retro-salmon" /> {workshop.time}
                      </p>
                    </div>
                  </div>
                  <button
                    className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-sm ${workshop.isJoined
                      ? 'bg-retro-teal text-white hover:bg-retro-teal/90'
                      : 'bg-white border-2 border-retro-sage/10 text-retro-teal hover:bg-retro-teal hover:text-white'
                      }`}
                    type="button"
                    onClick={() => {
                      if (!workshop.isJoined) {
                        onNavigateRegistration();
                      }
                    }}
                  >
                    <Ticket size={16} /> {workshop.isJoined ? 'Joined Session' : 'Register Now'}
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl p-7 border border-dashed border-retro-sage/30 text-retro-teal/70">
                <div className="text-sm font-bold mb-2">No workshops scheduled yet.</div>
                <button
                  type="button"
                  onClick={onNavigateRegistration}
                  className="text-xs font-black uppercase tracking-[0.2em] text-retro-salmon"
                >
                  View available workshops
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-center pt-4">
            <div className="flex items-center gap-3 bg-white/40 px-6 py-2 rounded-full border border-retro-sage/5">
              <span className="w-2 h-2 bg-retro-salmon rounded-full animate-pulse shadow-[0_0_8px_rgba(230,72,51,0.5)]"></span>
              <p className="text-[10px] font-bold text-retro-teal/60 italic tracking-wide">
                Join instructions and calendar invites are sent automatically upon registration.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  };

// --- MAIN APP ---
const App: React.FC = () => {
  const [, setLocation] = useLocation();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [data, setData] = useState<UserEnrollments>({
    cohorts: [],
    onDemand: [],
    workshops: [],
    completed: [],
    upcoming: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      const stored = readStoredSession();
      if (!stored) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      const freshSession = await ensureSessionFresh(stored, { notifyOnFailure: false });
      if (!freshSession) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const summary = await fetchDashboardSummary(freshSession);
        if (!isMounted) {
          return;
        }
        setDashboard(summary);
        setData({
          cohorts: summary.cohorts.map((cohort) => ({
            id: cohort.id,
            title: cohort.title,
            status: cohort.status as CohortStatus,
            progress: cohort.progress,
            nextSessionDate: cohort.nextSessionDate ?? undefined,
            courseSlug: cohort.courseSlug ?? null,
          })),
          onDemand: summary.onDemand.map((course) => ({
            id: course.id,
            title: course.title,
            progress: course.progress,
            lastAccessedModule: course.lastAccessedModule,
            courseSlug: course.courseSlug ?? null,
            lastLessonSlug: course.lastLessonSlug ?? null,
          })),
          workshops: summary.workshops.map((workshop) => ({
            id: workshop.id,
            title: workshop.title,
            date: workshop.date,
            time: workshop.time,
            isJoined: workshop.isJoined,
          })),
          completed: summary.completed,
          upcoming: summary.upcoming,
        });
      } catch (error) {
        console.error('Failed to load dashboard summary', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const heroCourse = useMemo<OnDemandCourse | null>(() => {
    if (dashboard?.resumeCourse) {
      return {
        id: dashboard.resumeCourse.id,
        title: dashboard.resumeCourse.title,
        progress: dashboard.resumeCourse.progress,
        lastAccessedModule: dashboard.resumeCourse.lastAccessedModule,
        courseSlug: dashboard.resumeCourse.courseSlug ?? null,
        lastLessonSlug: dashboard.resumeCourse.lastLessonSlug ?? null,
      };
    }
    return data.onDemand[0] ?? null;
  }, [dashboard, data.onDemand]);

  const displayName = dashboard?.user.fullName ?? readStoredSession()?.fullName ?? 'Learner';
  const sessionsThisWeek = dashboard?.stats.sessionsThisWeek ?? 0;
  const lastActiveLabel = dashboard?.stats.lastActiveAt
    ? `Last active: ${new Date(dashboard.stats.lastActiveAt).toLocaleString()}`
    : isLoading ? 'Last active: loading...' : 'Last active: not yet';

  const filteredData = useMemo<UserEnrollments>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return data;
    }

    const matches = (value: string | undefined | null) =>
      Boolean(value && value.toLowerCase().includes(query));

    return {
      ...data,
      cohorts: data.cohorts.filter((cohort) => matches(cohort.title)),
      onDemand: data.onDemand.filter((course) => matches(course.title) || matches(course.lastAccessedModule)),
      workshops: data.workshops.filter((workshop) => matches(workshop.title)),
    };
  }, [data, searchQuery]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    data.cohorts
      .filter((cohort) => cohort.status === CohortStatus.UPCOMING)
      .forEach((cohort) => {
        items.push({
          id: `cohort-${cohort.id}`,
          label: "Upcoming cohort session",
          detail: `${cohort.title}${cohort.nextSessionDate ? ` - ${cohort.nextSessionDate}` : ""}`,
          route: cohort.courseSlug ? `/course/${cohort.courseSlug}` : "/our-courses/cohort",
        });
      });

    data.workshops
      .filter((workshop) => !workshop.isJoined)
      .forEach((workshop) => {
        items.push({
          id: `workshop-${workshop.id}`,
          label: "Workshop registration open",
          detail: `${workshop.title} - ${workshop.date}`,
          route: "/registration",
        });
      });

    return items;
  }, [data]);

  const navigateToCourse = (courseSlug?: string | null, lessonSlug?: string | null) => {
    const courseKey = courseSlug || heroCourse?.courseSlug || heroCourse?.id;
    if (!courseKey) {
      setLocation('/our-courses/on-demand');
      return;
    }
    if (lessonSlug) {
      setLocation(`/course/${courseKey}/learn/${lessonSlug}`);
      return;
    }
    setLocation(`/course/${courseKey}`);
  };

  const navigateToCourseDetails = (courseSlug?: string | null) => {
    const courseKey = courseSlug || heroCourse?.courseSlug || heroCourse?.id;
    if (!courseKey) {
      setLocation('/our-courses/on-demand');
      return;
    }
    setLocation(`/course/${courseKey}`);
  };

  const navigateToCohortCatalog = () => {
    setLocation('/our-courses/cohort');
  };

  const navigateToOnDemandCatalog = () => {
    setLocation('/our-courses/on-demand');
  };

  const navigateToRegistration = () => {
    setLocation('/registration');
  };
  const nextAction = useMemo(() => {
    if (heroCourse) {
      return {
        title: `Continue ${heroCourse.title}`,
        description: heroCourse.lastAccessedModule
          ? `Pick up at ${heroCourse.lastAccessedModule}.`
          : "Jump back into your course.",
        cta: "Resume",
        action: () => navigateToCourse(heroCourse.courseSlug, heroCourse.lastLessonSlug),
      };
    }

    if (data.cohorts.length > 0) {
      const upcoming = data.cohorts.find((cohort) => cohort.status === CohortStatus.UPCOMING) ?? data.cohorts[0];
      return {
        title: "Review your cohort plan",
        description: upcoming
          ? `${upcoming.title}${upcoming.nextSessionDate ? ` - ${upcoming.nextSessionDate}` : ""}`
          : "Check your cohort schedule.",
        cta: "View cohort",
        action: () =>
          upcoming?.courseSlug ? navigateToCourseDetails(upcoming.courseSlug) : navigateToCohortCatalog(),
      };
    }

    if (data.workshops.length > 0) {
      return {
        title: "Register for a workshop",
        description: "Reserve your seat for the next live session.",
        cta: "Register",
        action: navigateToRegistration,
      };
    }

    return {
      title: "Browse the course catalog",
      description: "Start with an on-demand course or join a cohort.",
      cta: "Explore",
      action: navigateToOnDemandCatalog,
    };
  }, [
    heroCourse,
    data.cohorts,
    data.workshops,
    navigateToCourse,
    navigateToCourseDetails,
    navigateToCohortCatalog,
    navigateToRegistration,
    navigateToOnDemandCatalog,
  ]);

  return (
    <div className="min-h-screen bg-retro-bg selection:bg-retro-salmon/30 selection:text-retro-teal pb-20">
      <Sidebar
        onHomeClick={() => setLocation('/')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        notifications={notifications}
        onNavigate={(route) => setLocation(route)}
        userName={displayName}
        onLogout={() => logoutAndRedirect('/')}
      />
      <div className="flex flex-col pt-16">
        <main className="flex-grow p-4 md:p-6 xl:p-10 w-full max-w-[1400px] mx-auto">

          <div className="mb-10">
            <h1 className="text-3xl lg:text-4xl font-black text-retro-teal mb-1 tracking-tight">
              Welcome back, {displayName}!
            </h1>
            <p className="text-retro-teal/70 font-bold text-sm opacity-70">
              {isLoading
                ? 'Loading your learning dashboard...'
                : `You have ${sessionsThisWeek} session${sessionsThisWeek === 1 ? '' : 's'} scheduled for this week. Pick up where you left off below.`}
            </p>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-6 mb-10">
              <NextActionCard
                title={nextAction.title}
                description={nextAction.description}
                cta={nextAction.cta}
                onAction={nextAction.action}
              />
              <QuickStats
                sessionsThisWeek={sessionsThisWeek}
                lastActiveLabel={lastActiveLabel}
                cohortCount={data.cohorts.length}
                onDemandCount={data.onDemand.length}
                workshopCount={data.workshops.length}
              />
            </div>
            {heroCourse && (
              <ResumeHero
                course={heroCourse}
                onContinue={() => navigateToCourse(heroCourse?.courseSlug, heroCourse?.lastLessonSlug)}
                onBrowse={navigateToOnDemandCatalog}
                lastActiveLabel={lastActiveLabel}
              />
            )}
            <DashboardContent
              data={filteredData}
              onNavigateCourse={navigateToCourse}
              onNavigateCourseDetails={navigateToCourseDetails}
              onNavigateCohortCatalog={navigateToCohortCatalog}
              onNavigateOnDemandCatalog={navigateToOnDemandCatalog}
              onNavigateRegistration={navigateToRegistration}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;

