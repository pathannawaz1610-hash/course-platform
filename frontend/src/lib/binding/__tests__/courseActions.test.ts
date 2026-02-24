import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCourses, fetchCourse, enrollInCourse } from "../actions/courseActions";
import { apiClient } from "../client";

// Mock the apiClient instance
vi.mock("../client", () => ({
    apiClient: {
        request: vi.fn(),
    },
}));

describe("courseActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should fetch all courses", async () => {
        const mockCourses = [{ id: "1", title: "Course 1" }];
        vi.mocked(apiClient.request).mockResolvedValueOnce({ courses: mockCourses });

        const result = await fetchCourses();

        expect(apiClient.request).toHaveBeenCalledWith("/api/courses", expect.any(Object));
        expect(result).toEqual(mockCourses);
    });

    it("should fetch a single course", async () => {
        const mockCourse = { id: "1", title: "Course 1" };
        vi.mocked(apiClient.request).mockResolvedValueOnce({ course: mockCourse });

        const result = await fetchCourse("course-1");

        expect(apiClient.request).toHaveBeenCalledWith("/api/courses/course-1");
        expect(result).toEqual(mockCourse);
    });

    it("should enroll in a course", async () => {
        const session = { accessToken: "token" };
        vi.mocked(apiClient.request).mockResolvedValueOnce({});

        await enrollInCourse("course-1", session);

        expect(apiClient.request).toHaveBeenCalledWith(
            "/api/courses/course-1/enroll",
            { method: "POST" },
            session
        );
    });
});
