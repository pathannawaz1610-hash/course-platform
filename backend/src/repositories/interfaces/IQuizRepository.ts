import { Prisma } from "@prisma/client";

// Types extracted from quizService (to be moved to a shared types file later if needed)
export type StoredOption = { optionId: string; text: string; isCorrect?: boolean };

export type StoredQuestion = {
    questionId: string;
    prompt: string;
    moduleNo: number;
    topicPairIndex: number;
    options: StoredOption[];
};

export type ModuleProgressRow = {
    module_no: number;
    quiz_passed: boolean;
    unlocked_at: Date;
    cooldown_until: Date | null;
    completed_at: Date | null;
    passed_at: Date | null;
    updated_at: Date;
};

export type QuizSectionMetaRow = {
    module_no: number;
    topic_pair_index: number;
    order_index?: number | null;
    question_count?: number | bigint | null;
};

export type QuizSectionAttemptRow = {
    module_no: number;
    topic_pair_index: number;
    status: string | null;
    score: number | null;
    completed_at: Date | null;
    updated_at: Date | null;
};

export type AttemptRow = {
    attempt_id: string;
    user_id: string;
    course_id: string;
    module_no: number;
    topic_pair_index: number;
    question_set: Prisma.JsonValue;
    answers?: Prisma.JsonValue;
    score?: number | null;
    status?: string | null;
    completed_at?: Date | null;
    updated_at?: Date | null;
};

export interface IQuizRepository {
    ensureUserExists(userId: string): Promise<void>;

    getCourseModuleNumbers(courseId: string): Promise<number[]>;

    ensureModuleUnlockRow(params: {
        userId: string;
        courseId: string;
        moduleNo: number;
    }): Promise<ModuleProgressRow | null>;

    getModuleProgress(params: {
        userId: string;
        courseId: string;
        moduleNumbers: number[];
    }): Promise<ModuleProgressRow[]>;

    loadQuestionSet(params: {
        courseId: string;
        moduleNo: number;
        topicPairIndex: number;
        limit: number;
    }): Promise<StoredQuestion[]>;

    getMaxTopicPairIndex(courseId: string, moduleNo: number): Promise<number>;

    upsertModuleProgress(params: {
        userId: string;
        courseId: string;
        moduleNo: number;
        quizPassed: boolean;
    }): Promise<void>;

    loadQuizSectionsMetadata(courseId: string): Promise<QuizSectionMetaRow[]>;

    getQuizAttempts(params: {
        userId: string;
        courseId: string
    }): Promise<QuizSectionAttemptRow[]>;

    createAttempt(params: {
        userId: string;
        courseId: string;
        moduleNo: number;
        topicPairIndex: number;
        questionSet: StoredQuestion[];
    }): Promise<{ attemptId: string }>;

    getAttemptById(attemptId: string): Promise<AttemptRow | null>;

    updateAttempt(params: {
        attemptId: string;
        answers: any;
        score: number;
        passed: boolean;
    }): Promise<void>;
}

export type QuizResult = {
    attemptId: string;
    result: {
        correctCount: number;
        totalQuestions: number;
        scorePercent: number;
        passed: boolean;
        thresholdPercent: number;
        answers: {
            questionId: string;
            chosenOptionId: string | null;
            correctOptionId: string | null;
            isCorrect: boolean;
        }[];
    };
    progress: ModuleProgressRow[];
};
