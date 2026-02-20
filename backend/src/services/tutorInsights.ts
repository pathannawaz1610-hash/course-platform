import { differenceInDays } from "date-fns";
import { AnalyticsRepository } from "../repositories/implementations/AnalyticsRepository";

const analyticsRepo = new AnalyticsRepository();

export type TutorLearnerSnapshot = {
  userId: string;
  fullName: string;
  email: string;
  enrolledAt: Date;
  completedModules: number;
  totalModules: number;
  percent: number;
  lastActivity?: Date | null;
};

export type TutorCourseSnapshot = {
  course: {
    courseId: string;
    title: string;
    slug: string;
    description?: string | null;
  };
  stats: {
    totalEnrollments: number;
    newThisWeek: number;
    averageCompletion: number;
    activeThisWeek: number;
    atRiskLearners: number;
  };
  learners: TutorLearnerSnapshot[];
};

export async function buildTutorCourseSnapshot(courseId: string): Promise<TutorCourseSnapshot> {
  const course = await analyticsRepo.getCourseMetadata(courseId);

  if (!course) {
    throw new Error("Course not found");
  }

  const totalModules = await analyticsRepo.getDistinctModuleCount(courseId);

  const enrollments = await analyticsRepo.getEnrollmentsWithUser(courseId);

  const progressRows = await analyticsRepo.getModuleProgressStats(courseId);

  const progressByUser = new Map<string, { passedModules: Set<number>; lastActivity?: Date | null }>();
  progressRows.forEach((row) => {
    const entry = progressByUser.get(row.user_id) ?? { passedModules: new Set<number>(), lastActivity: null };
    if (row.quiz_passed) {
      entry.passedModules.add(row.module_no);
    }
    if (!entry.lastActivity || (row.updated_at && row.updated_at > entry.lastActivity)) {
      entry.lastActivity = row.updated_at;
    }
    progressByUser.set(row.user_id, entry);
  });

  const learners: TutorLearnerSnapshot[] = enrollments.map((enrollment) => {
    const progress = progressByUser.get(enrollment.userId);
    const completedModules = progress ? progress.passedModules.size : 0;
    const percent =
      totalModules === 0 ? 0 : Math.min(100, Math.round((completedModules / totalModules) * 100));
    return {
      userId: enrollment.userId,
      fullName: enrollment.user.fullName,
      email: enrollment.user.email,
      enrolledAt: enrollment.enrolledAt,
      completedModules,
      totalModules,
      percent,
      lastActivity: progress?.lastActivity ?? enrollment.enrolledAt,
    };
  });

  const now = new Date();
  const newThisWeek = learners.filter(
    (learner) => differenceInDays(now, learner.enrolledAt) <= 7,
  ).length;

  const activeThisWeek = learners.filter((learner) => {
    if (!learner.lastActivity) {
      return false;
    }
    return differenceInDays(now, learner.lastActivity) <= 7;
  }).length;

  const atRiskLearners = learners.filter((learner) => learner.percent < 50).length;

  const averageCompletion =
    learners.length === 0
      ? 0
      : Math.round(learners.reduce((sum, learner) => sum + learner.percent, 0) / learners.length);

  return {
    course: {
      courseId: course.courseId,
      title: course.courseName,
      slug: course.slug,
      description: course.description,
    },
    stats: {
      totalEnrollments: learners.length,
      newThisWeek,
      averageCompletion,
      activeThisWeek,
      atRiskLearners,
    },
    learners,
  };
}

export function formatTutorSnapshot(snapshot: TutorCourseSnapshot): string {
  const { course, stats, learners } = snapshot;
  const rosterLines = (learners ?? [])
    .slice(0, 40)
    .map((learner, index) => {
      const enrolled = formatDate(learner.enrolledAt);
      const lastActivity = learner.lastActivity ? formatDate(learner.lastActivity) : "unknown";
      return `${index + 1}. ${learner.fullName} (${learner.email}) – ${learner.percent}% complete (${learner.completedModules}/${learner.totalModules} modules). Enrolled ${enrolled}. Last activity ${lastActivity}.`;
    })
    .join("\n");

  return [
    `Course: ${course.title} (slug: ${course.slug})`,
    course.description ? `Description: ${course.description}` : undefined,
    `Stats: total learners ${stats.totalEnrollments}, new this week ${stats.newThisWeek}, average completion ${stats.averageCompletion}%, active in last 7 days ${stats.activeThisWeek}, at risk ${stats.atRiskLearners}.`,
    "Learner roster (top 40):",
    rosterLines || "No learners yet.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
