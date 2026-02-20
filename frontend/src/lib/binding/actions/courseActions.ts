import { apiClient, type Session } from "../client";
import type { Course, AssessmentQuestion } from "@/types/content";

/**
 * Topic/Lesson data
 */
export interface Topic {
    topicId: string;
    courseId: string;
    moduleNo: number;
    moduleName: string;
    topicNumber: number;
    topicName: string;
    videoUrl: string | null;
    textContent: string | null;
    contentType: string;
    pptUrl?: string | null;
    simulation?: any;
    [key: string]: any;
}

/**
 * Course section data
 */
export interface CourseSection {
    [key: string]: any;
}

/**
 * Fetch a single course by ID or slug
 */
export async function fetchCourse(courseId: string): Promise<Course> {
    const data = await apiClient.request<{ course: Course }>(`/api/courses/${courseId}`);
    return data.course;
}

/**
 * Fetch all topics for a course
 */
export async function fetchCourseTopics(
    courseKey: string,
    session?: Session | null
): Promise<Topic[]> {
    const data = await apiClient.request<{ topics: Topic[] }>(
        `/api/lessons/courses/${courseKey}/topics`,
        {},
        session
    );
    return data.topics || [];
}

/**
 * Fetch all available courses
 */
export async function fetchCourses(signal?: AbortSignal): Promise<Course[]> {
    const data = await apiClient.request<{ courses: Course[] }>("/api/courses", { signal });
    return data.courses;
}

/**
 * Enroll in a course
 */
export async function enrollInCourse(
    courseId: string,
    session: Session
): Promise<void> {
    await apiClient.request<void>(
        `/api/courses/${courseId}/enroll`,
        {
            method: "POST",
        },
        session
    );
}

/**
 * Check enrollment status (check only, no enrollment)
 */
export async function checkEnrollment(
    courseId: string,
    session: Session
): Promise<{ enrolled: boolean;[key: string]: any }> {
    return apiClient.request<{ enrolled: boolean }>(
        `/api/courses/${courseId}/enroll?checkOnly=true`,
        { method: "POST" },
        session
    );
}

/**
 * Fetch course sections
 */
export async function fetchCourseSections(
    courseId: string,
    session: Session
): Promise<CourseSection[]> {
    const data = await apiClient.request<{ sections: CourseSection[] }>(
        `/api/courses/${courseId}/sections`,
        {},
        session
    );
    return data.sections || [];
}

export interface CohortProject {
    id: string;
    title: string;
    description: string;
    submissionType: "link" | "file";
    dueDate?: string;
    instructions?: string;
    [key: string]: any;
}

/**
 * Fetch cohort project for a course
 */
export async function fetchCohortProject(
    courseKey: string,
    session: Session
): Promise<{ project: CohortProject | null; batchNo: number | null }> {
    return apiClient.request<{ project: CohortProject | null; batchNo: number | null }>(
        `/api/cohort-projects/${courseKey}`,
        {},
        session
    );
}

/**
 * Fetch assessment questions for a course
 */
export async function fetchAssessmentQuestions(courseId: string): Promise<AssessmentQuestion[]> {
    const data = await apiClient.request<{ questions: AssessmentQuestion[] }>(`/api/courses/${courseId}/assessment`);
    return data.questions;
}

/**
 * Submit course assessment
 */
export async function submitAssessment(courseId: string, data: any): Promise<{ result: any }> {
    return apiClient.request<{ result: any }>(`/api/courses/${courseId}/assessment`, {
        method: "POST",
        body: data
    });
}
