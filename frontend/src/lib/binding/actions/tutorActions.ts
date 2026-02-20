import { apiClient, type Session } from "../client";

export interface TutorApplicationPayload {
    fullName: string;
    email: string;
    phone?: string;
    headline: string;
    courseTitle: string;
    courseDescription: string;
    targetAudience: string;
    expertiseArea: string;
    experienceYears: number;
    availability: string;
}

export interface TutorLoginPayload {
    email: string;
    password: string;
}

export interface TutorSessionResponse {
    session: {
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
        refreshTokenExpiresAt: string;
        sessionId: string;
    };
    user: {
        id: string;
        email: string;
        fullName: string;
        role: "learner" | "tutor" | "admin";
        tutorId?: string;
        displayName?: string;
    };
}

/**
 * Submit a new tutor application
 */
export async function submitTutorApplication(
    application: TutorApplicationPayload
): Promise<void> {
    await apiClient.request<void>("/api/tutor-applications", {
        method: "POST",
        body: application,
    });
}

/**
 * Login as a tutor
 */
export async function loginTutor(
    credentials: TutorLoginPayload
): Promise<TutorSessionResponse> {
    return apiClient.request<TutorSessionResponse>("/api/tutors/login", {
        method: "POST",
        body: credentials,
    });
}

export interface TutorCourse {
    courseId: string;
    slug: string;
    title: string;
    description?: string;
    role?: string;
}

export interface EnrollmentRow {
    enrollmentId: string;
    enrolledAt: string;
    status: string;
    userId: string;
    fullName: string;
    email: string;
}

export interface ProgressRow {
    userId: string;
    fullName: string;
    email: string;
    enrolledAt: string;
    completedModules: number;
    totalModules: number;
    percent: number;
}

export interface ActivityLearner {
    eventId?: string;
    userId: string;
    courseId: string;
    moduleNo: number | null;
    topicId: string | null;
    topicTitle?: string | null;
    eventType: string;
    derivedStatus: string | null;
    statusReason: string | null;
    createdAt: string;
}

export interface ActivitySummary {
    engaged: number;
    attention_drift: number;
    content_friction: number;
    unknown: number;
    [key: string]: number;
}

/**
 * Fetch courses for the current tutor
 */
export async function fetchTutorCourses(): Promise<{ courses: TutorCourse[] }> {
    return apiClient.request<{ courses: TutorCourse[] }>("/api/tutors/me/courses");
}

/**
 * Fetch enrollments for a specific course
 */
export async function fetchTutorEnrollments(courseId: string): Promise<{ enrollments: EnrollmentRow[] }> {
    return apiClient.request<{ enrollments: EnrollmentRow[] }>(`/api/tutors/${courseId}/enrollments`);
}

/**
 * Fetch learner progress for a specific course
 */
export async function fetchTutorProgress(courseId: string): Promise<{ learners: ProgressRow[]; totalModules: number }> {
    return apiClient.request<{ learners: ProgressRow[]; totalModules: number }>(`/api/tutors/${courseId}/progress`);
}

/**
 * Fetch activity summary and learners for a course
 */
export async function fetchActivityLearners(courseId: string): Promise<{ learners: ActivityLearner[]; summary: ActivitySummary }> {
    return apiClient.request<{ learners: ActivityLearner[]; summary: ActivitySummary }>(`/api/activity/courses/${courseId}/learners`);
}

/**
 * Fetch detailed history for a learner in a course
 */
export async function fetchLearnerHistory(learnerId: string, courseId: string, limit = 40): Promise<{ events: ActivityLearner[] }> {
    const query = new URLSearchParams({ courseId, limit: limit.toString() });
    return apiClient.request<{ events: ActivityLearner[] }>(`/api/activity/learners/${learnerId}/history?${query.toString()}`);
}

/**
 * Query the AI assistant for tutor insights
 */
export async function queryAssistant(courseId: string, question: string): Promise<{ answer: string }> {
    return apiClient.request<{ answer: string }>("/api/tutors/assistant/query", {
        method: "POST",
        body: { courseId, question }
    });
}
