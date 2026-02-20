export type DashboardUserSummary = {
    fullName: string;
    email: string;
};

export type DashboardStats = {
    sessionsThisWeek: number;
    lastActiveAt: Date | null;
};

export type DashboardResumeCourse = {
    id: string;
    courseSlug: string | null;
    title: string;
    progress: number;
    lastAccessedModule: string;
    lastLessonSlug: string | null;
} | null;

export type DashboardCohort = {
    id: string;
    title: string;
    courseSlug: string | null;
    status: "Upcoming" | "Ongoing" | "Completed";
    progress: number;
    nextSessionDate: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
};

export type DashboardOnDemand = {
    id: string;
    title: string;
    courseSlug: string | null;
    progress: number;
    lastAccessedModule: string;
    lastLessonSlug: string | null;
};

export type DashboardWorkshop = {
    id: string;
    title: string;
    date: string | null;
    time: string | null;
    isJoined: boolean;
};

export type DashboardSummary = {
    user: { fullName: string; email: string };
    stats: { sessionsThisWeek: number; lastActiveAt: string | null };
    resumeCourse: DashboardResumeCourse;
    cohorts: (DashboardCohort & { nextSessionDate: string | null })[]; // Use intersection to ensure stringified date match view model
    onDemand: DashboardOnDemand[];
    workshops: DashboardWorkshop[];
    completed: any[];
    upcoming: any[];
};

export interface IDashboardRepository {
    getUserProfile(userId: string): Promise<DashboardUserSummary | null>;
    getEnrollments(userId: string): Promise<any[]>; // keeping as any for now to match prisma output structure, or strict type later
    getCohortMemberships(userId: string): Promise<any[]>;
    getTopicProgress(userId: string, courseIds: string[]): Promise<any[]>;
    getQuizSectionTotals(courseIds: string[]): Promise<{ course_id: string; section_count: bigint }[]>;
    getQuizSectionPassed(userId: string, courseIds: string[]): Promise<{ course_id: string; passed_count: bigint }[]>;
    getWorkshopRegistrations(userId: string): Promise<any[]>;
}
