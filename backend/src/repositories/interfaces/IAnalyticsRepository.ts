export type AnalyticsCourseRow = {
    courseId: string;
    courseName: string;
    slug: string;
    description: string | null;
};

export type AnalyticsEnrollmentRow = {
    enrollmentId: string;
    userId: string;
    enrolledAt: Date;
    status: string;
    user: {
        fullName: string;
        email: string;
    };
};

export type AnalyticsProgressRow = {
    user_id: string;
    module_no: number;
    quiz_passed: boolean;
    updated_at: Date | null;
};

export interface IAnalyticsRepository {
    getCourseMetadata(courseId: string): Promise<AnalyticsCourseRow | null>;
    getDistinctModuleCount(courseId: string): Promise<number>;
    getEnrollmentsWithUser(courseId: string): Promise<AnalyticsEnrollmentRow[]>;
    getModuleProgressStats(courseId: string): Promise<AnalyticsProgressRow[]>;
}
