import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";
import {
    IAnalyticsRepository,
    AnalyticsCourseRow,
    AnalyticsEnrollmentRow,
    AnalyticsProgressRow
} from "../interfaces/IAnalyticsRepository";

export class AnalyticsRepository implements IAnalyticsRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async getCourseMetadata(courseId: string): Promise<AnalyticsCourseRow | null> {
        return this.db.course.findUnique({
            where: { courseId },
            select: {
                courseId: true,
                courseName: true,
                slug: true,
                description: true,
            },
        });
    }

    async getDistinctModuleCount(courseId: string): Promise<number> {
        const moduleNumbers = await this.db.topic.findMany({
            where: { courseId, moduleNo: { gt: 0 } },
            select: { moduleNo: true },
            distinct: ["moduleNo"],
            orderBy: { moduleNo: "asc" },
        });
        return moduleNumbers.length;
    }

    async getEnrollmentsWithUser(courseId: string): Promise<AnalyticsEnrollmentRow[]> {
        return this.db.enrollment.findMany({
            where: { courseId },
            select: {
                enrollmentId: true,
                userId: true,
                enrolledAt: true,
                status: true,
                user: {
                    select: {
                        fullName: true,
                        email: true,
                    },
                },
            },
            orderBy: { enrolledAt: "asc" },
        }) as unknown as AnalyticsEnrollmentRow[];
    }

    async getModuleProgressStats(courseId: string): Promise<AnalyticsProgressRow[]> {
        return this.db.$queryRaw<AnalyticsProgressRow[]>(Prisma.sql`
            SELECT user_id, module_no, quiz_passed, updated_at
            FROM module_progress
            WHERE course_id = ${courseId}::uuid
        `);
    }
}
