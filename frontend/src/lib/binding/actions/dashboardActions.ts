import { apiClient, type Session } from "../client";

/**
 * Dashboard summary data
 */
export interface DashboardSummary {
    user: {
        fullName: string;
        email: string;
    };
    stats: {
        sessionsThisWeek: number;
        lastActiveAt: string | null;
    };
    resumeCourse: {
        id: string;
        courseSlug: string | null;
        title: string;
        progress: number;
        lastAccessedModule: string;
        lastLessonSlug: string | null;
    } | null;
    cohorts: Array<{
        id: string;
        title: string;
        courseSlug: string | null;
        status: "Upcoming" | "Ongoing" | "Completed";
        progress: number;
        nextSessionDate: string | null;
    }>;
    onDemand: Array<{
        id: string;
        title: string;
        courseSlug: string | null;
        progress: number;
        lastAccessedModule: string;
        lastLessonSlug: string | null;
    }>;
    workshops: Array<{
        id: string;
        title: string;
        date: string;
        time: string;
        isJoined: boolean;
    }>;
    completed: Array<{ title: string; date: string }>;
    upcoming: Array<{ id: string; title: string; releaseDate: string; category: string }>;
}

/**
 * Fetch dashboard summary for authenticated user
 */
export async function fetchDashboardSummary(
    session: Session
): Promise<DashboardSummary> {
    return apiClient.request<DashboardSummary>(
        "/api/dashboard/summary",
        {},
        session
    );
}
