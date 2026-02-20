export type OfferingRow = {
    offeringId: string;
    courseId: string;
    programType: string;
    label: string;
    startDate: Date | null;
    endDate: Date | null;
    isActive: boolean;
    meta: any;
    createdAt: Date;
    updatedAt: Date;
};

export type AssessmentQuestionRow = {
    questionId: string;
    questionText: string;
    options: any; // Json
    type: string;
    isActive: boolean;
    displayOrder: number;
    offeringId: string | null;
    programType: string | null;
    questionNumber: number | null;
};

export type RegistrationPayload = {
    offeringId: string;
    userId?: string | null;
    fullName: string;
    email: string;
    phoneNumber: string;
    collegeName: string;
    yearOfPassing: string;
    branch: string;
    referredBy?: string | null;
    selectedSlot?: string | null;
    sessionTime?: string | null;
    mode?: string | null;
    status?: string;
    answersJson?: any;
    questionsSnapshot?: any;
    assessmentSubmittedAt?: Date | null;
};

export interface IEnrollmentRepository {
    // Basic Course Enrollment
    ensureEnrollment(userId: string, courseId: string): Promise<void>;

    // Course Offerings & Registrations
    findCourseForRegistration(slug?: string, courseId?: string): Promise<{ courseId: string; slug: string } | null>;
    getOfferings(courseId: string, programType?: string): Promise<OfferingRow[]>;
    getAssessmentQuestions(offeringId: string, programType?: string): Promise<AssessmentQuestionRow[]>;
    getRegistration(email: string, offeringId: string): Promise<any | null>;
    createRegistration(data: RegistrationPayload): Promise<any>;
    updateRegistration(registrationId: string, data: RegistrationPayload): Promise<any>;
}
