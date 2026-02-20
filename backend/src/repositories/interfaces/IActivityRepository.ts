export type ActivityEventRow = {
    eventId?: string;
    userId: string;
    courseId: string;
    moduleNo?: number | null;
    topicId?: string | null;
    eventType: string;
    payload?: any;
    derivedStatus?: string | null;
    statusReason?: string | null;
    createdAt?: Date;
};

export type LearnerStatusRow = {
    eventId: string;
    userId: string;
    courseId: string;
    moduleNo: number | null;
    topicId: string | null;
    eventType: string;
    derivedStatus: string | null;
    statusReason: string | null;
    createdAt: Date;
};

export interface IActivityRepository {
    recordEvents(events: ActivityEventRow[]): Promise<void>;
    getLatestStatusesForCourse(courseId: string): Promise<LearnerStatusRow[]>;
    getLearnerHistory(userId: string, courseId: string, limit: number, before?: Date | null): Promise<LearnerStatusRow[]>;
    checkTutorAccess(userId: string, courseId: string): Promise<boolean>;
}
