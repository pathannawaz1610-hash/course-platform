import { apiClient } from "../client";

/**
 * Fetch registration offerings
 */
/**
 * Fetch registration offerings
 */
export async function fetchOfferings(params: {
    courseSlug?: string;
    courseId?: string;
    programType?: "cohort" | "ondemand" | "workshop";
}): Promise<{ course: any; offerings: any[] }> {
    const query = new URLSearchParams();
    if (params.courseSlug) query.set("courseSlug", params.courseSlug);
    if (params.courseId) query.set("courseId", params.courseId);
    if (params.programType) query.set("programType", params.programType);

    return apiClient.request<{ course: any; offerings: any[] }>(
        `/api/registrations/offerings?${query.toString()}`
    );
}

/**
 * Fetch assessment questions for registration
 */
export async function fetchAssessmentQuestions(params: {
    offeringId: string;
    programType: "cohort" | "ondemand" | "workshop";
}): Promise<{ questions: any[] }> {
    const query = new URLSearchParams({
        offeringId: params.offeringId,
        programType: params.programType,
    });

    return apiClient.request<{ questions: any[] }>(
        `/api/registrations/assessment-questions?${query.toString()}`
    );
}

/**
 * Submit a registration
 */
export async function submitRegistration(payload: Record<string, unknown>) {
    return apiClient.request(
        "/api/registrations",
        {
            method: "POST",
            body: payload,
        }
    );
}
