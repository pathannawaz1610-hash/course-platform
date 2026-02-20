import { apiClient, type Session } from "../client";

/**
 * Cold call prompt data
 */
export interface ColdCallPrompt {
    promptId: string;
    courseId: string;
    topicId: string;
    promptText: string;
    helperText?: string | null;
}

export interface ColdCallMessage {
    messageId: string;
    body: string;
    parentId: string | null;
    rootId: string | null;
    createdAt: string;
    user: {
        userId: string;
        fullName: string;
    };
    starCount: number;
    starredByMe: boolean;
}

export interface ColdCallPayload {
    prompt: ColdCallPrompt;
    cohort: {
        cohortId: string;
        name: string;
    };
    hasSubmitted: boolean;
    messages?: ColdCallMessage[];
}

/**
 * Fetch cold call prompt and messages for a topic
 */
export async function fetchColdCallPrompts(
    topicId: string,
    session: Session
): Promise<ColdCallPayload> {
    return apiClient.request<ColdCallPayload>(
        `/api/cold-call/prompts/${topicId}`,
        {},
        session
    );
}

/**
 * Post a cold call message
 */
export async function postColdCallMessage(
    params: {
        promptId: string;
        body: string;
    },
    session: Session
): Promise<{ messageId: string }> {
    return apiClient.request<{ messageId: string }>(
        "/api/cold-call/messages",
        {
            method: "POST",
            body: params,
        },
        session
    );
}

/**
 * Post a cold call reply
 */
export async function postColdCallReply(
    params: {
        parentId: string;
        body: string;
    },
    session: Session
): Promise<{ replyId: string }> {
    return apiClient.request<{ replyId: string }>(
        "/api/cold-call/replies",
        {
            method: "POST",
            body: params,
        },
        session
    );
}

/**
 * Remove star from a cold call message
 */
export async function removeColdCallStar(
    messageId: string,
    session: Session
): Promise<void> {
    await apiClient.request<void>(
        `/api/cold-call/stars/${messageId}`,
        {
            method: "DELETE",
        },
        session
    );
}

/**
 * Star a cold call message
 */
export async function starColdCallMessage(
    params: {
        messageId: string;
    },
    session: Session
): Promise<void> {
    await apiClient.request<void>("/api/cold-call/stars", {
        method: "POST",
        body: params,
    }, session);
}
