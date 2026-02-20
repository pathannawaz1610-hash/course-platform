import { apiClient, type Session } from "../client";

/**
 * Quiz section metadata
 */
export interface QuizSection {
    moduleNo: number;
    topicPairIndex: number;
    title: string;
    questionCount: number;
    unlocked: boolean;
    passed: boolean;
    lockedDueToCooldown?: boolean;
    lockedDueToQuiz?: boolean;
    cooldownUnlockAt?: string | null;
    moduleUnlockedAt?: string | null;
    moduleWindowEndsAt?: string | null;
}

/**
 * Quiz question with options
 */
export interface QuizQuestion {
    questionId: string;
    prompt: string;
    options: Array<{
        optionId: string;
        text: string;
    }>;
}

/**
 * Quiz attempt response
 */
export interface QuizAttempt {
    attemptId: string;
    courseId: string;
    moduleNo: number;
    topicPairIndex: number;
    questions: QuizQuestion[];
}

/**
 * Quiz submission result
 */
export interface QuizResult {
    attemptId: string;
    result: {
        correctCount: number;
        totalQuestions: number;
        scorePercent: number;
        passed: boolean;
        thresholdPercent: number;
        answers: Array<{
            questionId: string;
            chosenOptionId: string | null;
            correctOptionId: string | null;
            isCorrect: boolean;
        }>;
    };
    progress: any[];
}

/**
 * Fetch all quiz sections for a course
 */
export async function fetchQuizSections(
    courseKey: string,
    session: Session
): Promise<QuizSection[]> {
    const data = await apiClient.request<{ sections: QuizSection[] }>(
        `/api/quiz/sections/${courseKey}`,
        {},
        session
    );
    return data.sections || [];
}

/**
 * Start a new quiz attempt
 */
export async function startQuizAttempt(
    params: {
        courseId: string;
        moduleNo: number;
        topicPairIndex: number;
    },
    session: Session
): Promise<QuizAttempt> {
    return apiClient.request<QuizAttempt>(
        `/api/quiz/attempts`,
        {
            method: "POST",
            body: params,
        },
        session
    );
}

/**
 * Submit quiz answers
 */
export async function submitQuizAttempt(
    attemptId: string,
    answers: Array<{ questionId: string; optionId: string }>,
    session: Session
): Promise<QuizResult> {
    return apiClient.request<QuizResult>(
        `/api/quiz/attempts/${attemptId}/submit`,
        {
            method: "POST",
            body: { answers },
        },
        session
    );
}
