import { apiClient, type Session } from "../client";

/**
 * Lesson progress data
 */
export interface LessonProgress {
    progressId: string;
    topicId: string;
    isCompleted: boolean;
    lastPosition: number;
    updatedAt: string;
    completedAt?: string | null;
}

/**
 * Personalization data
 */
export interface Personalization {
    personaKey?: string;
    [key: string]: any;
}

/**
 * Fetch lesson progress for a course
 */
export async function fetchLessonProgress(
    courseKey: string,
    session: Session
): Promise<LessonProgress[]> {
    const data = await apiClient.request<{ progress: LessonProgress[] }>(
        `/api/lessons/courses/${courseKey}/progress`,
        {},
        session
    );
    return data.progress || [];
}

/**
 * Update lesson progress
 */
export async function updateLessonProgress(
    topicId: string,
    progress: number,
    session: Session
): Promise<void> {
    await apiClient.request<void>(
        `/api/lessons/topics/${topicId}/progress`,
        {
            method: "POST",
            body: { lastPosition: progress },
        },
        session
    );
}

/**
 * Fetch personalization settings for a course
 */
export async function fetchPersonalization(
    courseId: string,
    session: Session
): Promise<Personalization> {
    return apiClient.request<Personalization>(
        `/api/lessons/courses/${courseId}/personalization`,
        {},
        session
    );
}

/**
 * Update personalization settings
 */
export async function updatePersonalization(
    courseId: string,
    data: Personalization,
    session: Session
): Promise<void> {
    await apiClient.request<void>(
        `/api/lessons/courses/${courseId}/personalization`,
        {
            method: "POST",
            body: data,
        },
        session
    );
}

/**
 * Fetch prompt suggestions for a course/topic
 */
export async function fetchPromptSuggestions(
    courseKey: string,
    topicId?: string,
    session?: Session | null
): Promise<any[]> {
    const query = new URLSearchParams();
    if (topicId) {
        query.set("topicId", topicId);
    }
    const queryString = query.toString();

    const data = await apiClient.request<{ suggestions: any[] }>(
        `/api/lessons/courses/${courseKey}/prompts${queryString ? `?${queryString}` : ""}`,
        {},
        session
    );
    return data.suggestions || [];
}
