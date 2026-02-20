import { PrismaClient } from "@prisma/client";
import { ICohortRepository, CohortSimple, CohortMemberWithCohort, CohortProjectPayload } from "../interfaces/ICohortRepository";
import { prisma } from "../../services/prisma";

export class CohortRepository implements ICohortRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async findCohortsForCourse(courseId: string): Promise<CohortSimple[]> {
        return this.db.cohort.findMany({
            where: { courseId, isActive: true },
            select: { cohortId: true, name: true },
        });
    }

    async findCohortMember(userId: string, normalizedEmail: string, cohortIds: string[]): Promise<CohortMemberWithCohort | null> {
        const member = await this.db.cohortMember.findFirst({
            where: {
                cohortId: { in: cohortIds },
                status: "active",
                OR: [{ userId }, { email: { equals: normalizedEmail, mode: "insensitive" } }],
            },
            include: {
                cohort: { select: { cohortId: true, name: true } },
            },
        });

        if (!member) return null;

        return {
            memberId: member.memberId,
            userId: member.userId,
            email: member.email,
            status: member.status,
            batchNo: member.batchNo,
            cohort: member.cohort,
        };
    }

    async updateCohortMember(memberId: string, data: { userId: string; email: string }): Promise<void> {
        await this.db.cohortMember.update({
            where: { memberId },
            data,
        });
    }

    async findCohortBatchProject(cohortId: string, batchNo: number): Promise<CohortProjectPayload | null> {
        const project = await this.db.cohortBatchProject.findFirst({
            where: { cohortId, batchNo },
            select: { projectId: true, batchNo: true, payload: true, updatedAt: true },
        });

        // Check if payload is Json, cast if needed, but Prisma types usually handle it.
        // Assuming simple return is fine.
        return project as CohortProjectPayload | null;
    }
}
