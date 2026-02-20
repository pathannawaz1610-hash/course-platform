import { apiClient, type Session } from "../client";
import { streamJobResult } from "@/lib/streamJob";
import { buildApiUrl } from "@/lib/api";

/**
 * Query the AI assistant for a course
 */
export async function queryAssistant(
    question: string,
    context: {
        courseId?: string;
        topicId?: string;
        moduleNo?: number;
        sessionId?: string | null;
    },
    session: Session
): Promise<{ answer: string; sessionId?: string }> {
    // 1. Initiate the query (returns 202 + jobId)
    const initialResponse = await apiClient.request<{
        jobId: string;
        sessionId: string;
        status: string;
    }>(
        "/assistant/query",
        {
            method: "POST",
            body: {
                question,
                ...context,
            },
        },
        session
    );

    // 2. If we got a job ID, stream the result
    if (initialResponse.jobId) {
        // Use buildApiUrl to ensure we hit the backend directly (avoiding proxy buffer issues)
        // We use the /assistant route directly (not /api prefix) to match standard client behavior logic
        // logic if buildApiUrl does not include /api by default.
        // Actually buildApiUrl prepends http://localhost:4000.
        // The router is mounted at /assistant.
        const streamUrl = buildApiUrl(`/assistant/stream/${initialResponse.jobId}`);

        const headers: Record<string, string> = {};
        if (session.accessToken) {
            headers.Authorization = `Bearer ${session.accessToken}`;
        }

        const result = await streamJobResult(
            streamUrl,
            headers
        );

        return {
            answer: typeof result.answer === "string" ? result.answer : "",
            sessionId: initialResponse.sessionId,
        };
    }

    // Fallback if immediate response (e.g. suggestions)
    return {
        answer: (initialResponse as any).answer || "",
        sessionId: initialResponse.sessionId,
    };
}

/**
 * Query the landing page assistant (public, no auth)
 */
export async function queryLandingAssistant(
    question: string,
    turnCount: number
): Promise<{ answer?: string; jobId?: string; message?: string }> {
    return apiClient.request<{ answer?: string; jobId?: string; message?: string }>(
        "/api/landing-assistant/query",
        {
            method: "POST",
            body: { question, turnCount },
        }
    );
}

/**
 * Fetch assistant session history
 */
export async function fetchAssistantSession(
    courseId: string,
    topicId: string,
    session: Session
): Promise<{
    sessionId: string;
    messages: Array<{
        messageId: string;
        role: string;
        content: string;
    }>;
}> {
    return apiClient.request<{
        sessionId: string;
        messages: Array<{
            messageId: string;
            role: string;
            content: string;
        }>;
    }>(
        `/assistant/session?courseId=${encodeURIComponent(courseId)}&topicId=${topicId}`,
        {},
        session
    );
}
