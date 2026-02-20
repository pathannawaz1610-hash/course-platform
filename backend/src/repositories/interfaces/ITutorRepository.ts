export interface AssignedCourse {
    courseId: string;
    courseName: string;
    slug: string;
    description: string;
    role: string | null;
}

export interface EnrollmentRow {
    enrollmentId: string;
    enrolledAt: Date;
    status: string;
    userId: string;
    fullName: string;
    email: string;
}

export interface LearnerProgressRaw {
    user_id: string;
    module_no: number;
    quiz_passed: boolean;
}

export interface TutorUser {
    userId: string;
    email: string;
    fullName: string;
    role: string;
    passwordHash: string;
    tutorProfile?: {
        tutorId: string;
        displayName: string;
    } | null;
}

export interface ITutorRepository {
    findTutorByEmail(email: string): Promise<TutorUser | null>;
    verifyTutorAssignment(userId: string, courseId: string): Promise<boolean>;
    getAssignedCourses(userId: string): Promise<AssignedCourse[]>;
    getCourseEnrollments(courseId: string): Promise<EnrollmentRow[]>;
    getCourseModuleNumbers(courseId: string): Promise<number[]>;
    getCourseLearners(courseId: string): Promise<any[]>; // Returns simplified user objects
    getModuleProgress(courseId: string): Promise<LearnerProgressRaw[]>;
}
