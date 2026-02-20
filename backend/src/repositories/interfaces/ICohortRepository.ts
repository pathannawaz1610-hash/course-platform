export interface CohortSimple {
    cohortId: string;
    name: string;
}

export interface CohortMemberWithCohort {
    memberId: string;
    userId: string | null;
    email: string;
    status: string;
    batchNo?: number | null;
    cohort: CohortSimple;
}

export interface CohortProjectPayload {
    projectId: string;
    batchNo: number;
    payload: any;
    updatedAt: Date;
}

export interface ICohortRepository {
    findCohortsForCourse(courseId: string): Promise<CohortSimple[]>;
    findCohortMember(userId: string, normalizedEmail: string, cohortIds: string[]): Promise<CohortMemberWithCohort | null>;
    updateCohortMember(memberId: string, data: { userId: string; email: string }): Promise<void>;
    findCohortBatchProject(cohortId: string, batchNo: number): Promise<CohortProjectPayload | null>;
}
