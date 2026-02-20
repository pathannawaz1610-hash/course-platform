import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../services/prisma";
import {
    IQuizRepository,
    StoredQuestion,
    ModuleProgressRow,
    QuizSectionMetaRow,
    QuizSectionAttemptRow,
    AttemptRow,
    StoredOption
} from "../interfaces/IQuizRepository";
import { createHash, randomUUID } from "node:crypto";

const MODULE_WINDOW_DURATION = "7d";
const MODULE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // Hardcoded consistency with service

export class QuizRepository implements IQuizRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async ensureUserExists(userId: string): Promise<void> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) return;

        const existing = await this.db.user.findUnique({ where: { userId } });
        if (existing) return;

        const placeholderEmail = `${userId}@quiz.local`;
        const placeholderHash = createHash("sha256").update(userId).digest("hex");

        await this.db.user.create({
            data: {
                userId,
                email: placeholderEmail,
                fullName: "Quiz Learner",
                passwordHash: placeholderHash,
            },
        });
    }

    async getCourseModuleNumbers(courseId: string): Promise<number[]> {
        const records = await this.db.topic.findMany({
            where: { courseId, moduleNo: { gt: 0 } },
            select: { moduleNo: true },
            distinct: ["moduleNo"],
            orderBy: { moduleNo: "asc" },
        });
        return Array.from(new Set(records.map((entry) => entry.moduleNo))).sort((a, b) => a - b);
    }

    async ensureModuleUnlockRow(params: {
        userId: string;
        courseId: string;
        moduleNo: number;
    }): Promise<ModuleProgressRow | null> {
        await this.ensureUserExists(params.userId);
        const [row] = await this.db.$queryRaw<ModuleProgressRow[]>(Prisma.sql`
            WITH inserted AS (
              INSERT INTO module_progress (
                user_id, course_id, module_no, videos_completed, quiz_passed, 
                unlocked_at, cooldown_until, completed_at, updated_at, passed_at
              )
              VALUES (
                ${params.userId}::uuid, ${params.courseId}::uuid, ${params.moduleNo}, '[]'::jsonb, FALSE, 
                NOW(), NOW() + ${MODULE_WINDOW_MS} * INTERVAL '1 millisecond', NULL, NOW(), NULL
              )
              ON CONFLICT (user_id, course_id, module_no) DO NOTHING
              RETURNING module_no, quiz_passed, unlocked_at, cooldown_until, completed_at, passed_at, updated_at
            )
            SELECT module_no, quiz_passed, unlocked_at, cooldown_until, completed_at, passed_at, updated_at FROM inserted
            UNION ALL
            SELECT module_no, quiz_passed, unlocked_at, cooldown_until, completed_at, passed_at, updated_at FROM module_progress
            WHERE user_id = ${params.userId}::uuid AND course_id = ${params.courseId}::uuid AND module_no = ${params.moduleNo}
            LIMIT 1
        `);
        return row ?? null;
    }

    async getModuleProgress(params: {
        userId: string;
        courseId: string;
        moduleNumbers: number[];
    }): Promise<ModuleProgressRow[]> {
        if (params.moduleNumbers.length === 0) return [];
        return this.db.$queryRaw<ModuleProgressRow[]>(Prisma.sql`
            SELECT module_no, quiz_passed, unlocked_at, cooldown_until, completed_at, passed_at, updated_at
            FROM module_progress
            WHERE user_id = ${params.userId}::uuid
              AND course_id = ${params.courseId}::uuid
              AND module_no IN (${Prisma.join(params.moduleNumbers)})
        `);
    }

    async loadQuestionSet(params: {
        courseId: string;
        moduleNo: number;
        topicPairIndex: number;
        limit: number;
    }): Promise<StoredQuestion[]> {
        const questions = await this.db.$queryRaw<{
            question_id: string;
            course_id: string;
            module_no: number;
            topic_pair_index: number;
            prompt: string;
            order_index: number | null;
        }[]>(Prisma.sql`
          SELECT question_id, course_id, module_no, topic_pair_index, prompt, order_index
          FROM quiz_questions
          WHERE course_id = ${params.courseId}::uuid
            AND module_no = ${params.moduleNo}
            AND topic_pair_index = ${params.topicPairIndex}
          ORDER BY RANDOM()
          LIMIT ${params.limit}
        `);

        if (questions.length === 0) return [];

        const questionIds = questions.map((row) => row.question_id);
        const rawOptions = await this.db.$queryRaw<{
            option_id: string;
            question_id: string;
            option_text: string;
            is_correct: boolean;
        }[]>(Prisma.sql`
            SELECT option_id, question_id, option_text, is_correct
            FROM quiz_options
            WHERE question_id IN (${Prisma.join(questionIds.map((id) => Prisma.sql`${id}::uuid`))})
        `);

        const optionsByQuestion = new Map<string, typeof rawOptions>();
        rawOptions.forEach((opt) => {
            const list = optionsByQuestion.get(opt.question_id) || [];
            list.push(opt);
            optionsByQuestion.set(opt.question_id, list);
        });

        return questions.map((row) => ({
            questionId: row.question_id,
            prompt: row.prompt,
            moduleNo: row.module_no,
            topicPairIndex: row.topic_pair_index,
            options: (optionsByQuestion.get(row.question_id) ?? []).map((o) => ({
                optionId: o.option_id,
                text: o.option_text,
                isCorrect: Boolean(o.is_correct),
            })),
        }));
    }

    async getMaxTopicPairIndex(courseId: string, moduleNo: number): Promise<number> {
        const rows = await this.db.$queryRaw<{ max_pair: number | null }[]>(Prisma.sql`
            SELECT MAX(topic_pair_index) AS max_pair
            FROM quiz_questions
            WHERE course_id = ${courseId}::uuid AND module_no = ${moduleNo}
        `);
        return rows[0]?.max_pair ?? 0;
    }

    async upsertModuleProgress(params: {
        userId: string;
        courseId: string;
        moduleNo: number;
        quizPassed: boolean;
    }): Promise<void> {
        await this.db.$executeRaw(Prisma.sql`
            UPDATE module_progress
            SET
              quiz_passed = module_progress.quiz_passed OR ${params.quizPassed},
              passed_at = CASE WHEN ${params.quizPassed} THEN COALESCE(module_progress.passed_at, NOW()) ELSE module_progress.passed_at END,
              completed_at = CASE WHEN ${params.quizPassed} THEN COALESCE(module_progress.completed_at, NOW()) ELSE module_progress.completed_at END,
              updated_at = NOW()
            WHERE user_id = ${params.userId}::uuid
              AND course_id = ${params.courseId}::uuid
              AND module_no = ${params.moduleNo};
        `);
    }

    async loadQuizSectionsMetadata(courseId: string): Promise<QuizSectionMetaRow[]> {
        return this.db.$queryRaw<QuizSectionMetaRow[]>(Prisma.sql`
            SELECT module_no, topic_pair_index, MIN(order_index) AS order_index, COUNT(*)::bigint AS question_count
            FROM quiz_questions
            WHERE course_id = ${courseId}::uuid
            GROUP BY module_no, topic_pair_index
            ORDER BY module_no ASC, topic_pair_index ASC
        `);
    }

    async getQuizAttempts(params: { userId: string; courseId: string; }): Promise<QuizSectionAttemptRow[]> {
        return this.db.$queryRaw<QuizSectionAttemptRow[]>(Prisma.sql`
            SELECT module_no, topic_pair_index, status, score, completed_at, updated_at
            FROM quiz_attempts
            WHERE course_id = ${params.courseId}::uuid
              AND user_id = ${params.userId}::uuid
            ORDER BY completed_at DESC NULLS LAST, updated_at DESC NULLS LAST
        `);
    }

    async createAttempt(params: {
        userId: string;
        courseId: string;
        moduleNo: number;
        topicPairIndex: number;
        questionSet: StoredQuestion[];
    }): Promise<{ attemptId: string }> {
        const [inserted] = await this.db.$queryRaw<{ attempt_id: string }[]>(Prisma.sql`
            INSERT INTO quiz_attempts (user_id, course_id, module_no, topic_pair_index, question_set)
            VALUES (${params.userId}::uuid, ${params.courseId}::uuid, ${params.moduleNo}, ${params.topicPairIndex}, ${JSON.stringify(params.questionSet)}::jsonb)
            RETURNING attempt_id
        `);
        return { attemptId: inserted?.attempt_id ?? randomUUID() };
    }

    async getAttemptById(attemptId: string): Promise<AttemptRow | null> {
        const rows = await this.db.$queryRaw<AttemptRow[]>(Prisma.sql`
            SELECT attempt_id, user_id, course_id, module_no, topic_pair_index, question_set
            FROM quiz_attempts
            WHERE attempt_id = ${attemptId}::uuid
            LIMIT 1
        `);
        return rows[0] ?? null;
    }

    async updateAttempt(params: {
        attemptId: string;
        answers: any;
        score: number;
        passed: boolean;
    }): Promise<void> {
        await this.db.$executeRaw(Prisma.sql`
            UPDATE quiz_attempts
            SET
              answers = ${JSON.stringify(params.answers)}::jsonb,
              score = ${params.score},
              status = ${params.passed ? "passed" : "failed"},
              completed_at = NOW(),
              updated_at = NOW()
            WHERE attempt_id = ${params.attemptId}::uuid
        `);
    }
}
