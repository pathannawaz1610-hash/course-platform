import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../services/prisma";
import { IDashboardRepository, DashboardUserSummary } from "../interfaces/IDashboardRepository";

export class DashboardRepository implements IDashboardRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async getUserProfile(userId: string): Promise<DashboardUserSummary | null> {
        const user = await this.db.user.findUnique({
            where: { userId },
            select: { fullName: true, email: true },
        });
        return user;
    }

    async getEnrollments(userId: string) {
        return this.db.enrollment.findMany({
            where: { userId },
            include: {
                course: {
                    select: {
                        courseId: true,
                        courseName: true,
                        slug: true,
                        category: true,
                    },
                },
            },
        });
    }

    async getCohortMemberships(userId: string) {
        return this.db.cohortMember.findMany({
            where: { userId },
            include: {
                cohort: {
                    include: {
                        course: {
                            select: {
                                courseId: true,
                                courseName: true,
                                slug: true,
                                category: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async getTopicProgress(userId: string, courseIds: string[]) {
        if (courseIds.length === 0) return [];
        return this.db.topicProgress.findMany({
            where: {
                userId: userId,
                topic: { courseId: { in: courseIds } },
            },
            select: {
                isCompleted: true,
                updatedAt: true,
                topic: {
                    select: {
                        courseId: true,
                        moduleNo: true,
                        topicName: true,
                    },
                },
            },
        });
    }

    async getQuizSectionTotals(courseIds: string[]) {
        if (courseIds.length === 0) return [];

        // Using $queryRaw for complex aggregation not easily doable with Prisma types
        return this.db.$queryRaw<{ course_id: string; section_count: bigint }[]>(
            Prisma.sql`
          SELECT course_id, COUNT(*)::bigint AS section_count
          FROM (
            SELECT DISTINCT course_id, module_no, topic_pair_index
            FROM quiz_questions
            WHERE course_id IN (${Prisma.join(courseIds.map((id) => Prisma.sql`${id}::uuid`))})
          ) AS sections
          GROUP BY course_id
        `
        );
    }

    async getQuizSectionPassed(userId: string, courseIds: string[]) {
        if (courseIds.length === 0) return [];

        return this.db.$queryRaw<{ course_id: string; passed_count: bigint }[]>(
            Prisma.sql`
          WITH latest AS (
            SELECT DISTINCT ON (course_id, module_no, topic_pair_index)
              course_id,
              module_no,
              topic_pair_index,
              status
            FROM quiz_attempts
            WHERE user_id = ${userId}::uuid
              AND course_id IN (${Prisma.join(courseIds.map((id) => Prisma.sql`${id}::uuid`))})
            ORDER BY course_id,
                     module_no,
                     topic_pair_index,
                     completed_at DESC NULLS LAST,
                     updated_at DESC NULLS LAST
          )
          SELECT course_id, COUNT(*)::bigint AS passed_count
          FROM latest
          WHERE status = 'passed'
          GROUP BY course_id
        `
        );
    }

    async getWorkshopRegistrations(userId: string) {
        return this.db.registration.findMany({
            where: {
                userId: userId,
                offering: { programType: "workshop" },
            },
            include: {
                offering: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }
}
