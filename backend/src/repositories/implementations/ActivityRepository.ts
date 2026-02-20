import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";
import {
    IActivityRepository,
    ActivityEventRow,
    LearnerStatusRow
} from "../interfaces/IActivityRepository";

export class ActivityRepository implements IActivityRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async recordEvents(events: ActivityEventRow[]): Promise<void> {
        if (events.length === 0) return;

        // Map interface to Prisma payload
        const rows = events.map(event => ({
            userId: event.userId,
            courseId: event.courseId,
            moduleNo: event.moduleNo ?? null,
            topicId: event.topicId ?? null,
            eventType: event.eventType,
            payload: event.payload ?? Prisma.JsonNull,
            derivedStatus: event.derivedStatus ?? null,
            statusReason: event.statusReason ?? null,
            createdAt: event.createdAt ?? new Date(),
        }));

        await this.db.learnerActivityEvent.createMany({
            data: rows,
        });
    }

    async getLatestStatusesForCourse(courseId: string): Promise<LearnerStatusRow[]> {
        return this.db.$queryRaw<LearnerStatusRow[]>(Prisma.sql`
            SELECT
              ranked.event_id AS "eventId",
              ranked.user_id AS "userId",
              ranked.course_id AS "courseId",
              ranked.module_no AS "moduleNo",
              ranked.topic_id AS "topicId",
              ranked.event_type AS "eventType",
              ranked.derived_status AS "derivedStatus",
              ranked.status_reason AS "statusReason",
              ranked.created_at AS "createdAt"
            FROM (
              SELECT
                event_id,
                user_id,
                course_id,
                module_no,
                topic_id,
                event_type,
                derived_status,
                status_reason,
                created_at,
                ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
              FROM learner_activity_events
              WHERE course_id = ${courseId}::uuid
            ) ranked
            WHERE ranked.rn <= 20
        `);
    }

    async getLearnerHistory(userId: string, courseId: string, limit: number, before?: Date | null): Promise<LearnerStatusRow[]> {
        const beforeFilter = before ? Prisma.sql`AND created_at < ${before}` : Prisma.sql``;

        return this.db.$queryRaw<LearnerStatusRow[]>(Prisma.sql`
            SELECT
              event_id AS "eventId",
              user_id AS "userId",
              course_id AS "courseId",
              module_no AS "moduleNo",
              topic_id AS "topicId",
              event_type AS "eventType",
              derived_status AS "derivedStatus",
              status_reason AS "statusReason",
              created_at AS "createdAt"
            FROM learner_activity_events
            WHERE user_id = ${userId}::uuid
              AND course_id = ${courseId}::uuid
              ${beforeFilter}
            ORDER BY created_at DESC
            LIMIT ${limit}
        `);
    }

    async checkTutorAccess(userId: string, courseId: string): Promise<boolean> {
        const assignment = await this.db.courseTutor.findFirst({
            where: {
                courseId,
                isActive: true,
                tutor: { userId },
            },
            select: { courseTutorId: true },
        });

        return !!assignment;
    }
}
