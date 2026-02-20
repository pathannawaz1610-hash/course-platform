import { describe, it, expect, vi, beforeEach } from "vitest";
import { CourseRepository } from "../../src/repositories/implementations/CourseRepository";
import { prisma } from "../../src/services/prisma";

// Mock the prisma client
vi.mock("../../src/services/prisma", () => ({
    prisma: {
        course: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
        topic: {
            findMany: vi.fn(),
        },
        topicProgress: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        contentAsset: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        }
    },
}));

describe("CourseRepository", () => {
    let courseRepo: CourseRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        courseRepo = new CourseRepository();
    });

    describe("getAllCourses", () => {
        it("should return all courses with formatted fields", async () => {
            const now = new Date("2023-01-01T00:00:00.000Z");
            const mockDbCourses = [{
                courseId: "c1",
                courseName: "Course 1",
                description: "Desc",
                priceCents: 1000,
                slug: "slug-1",
                createdAt: now
            }];
            vi.mocked(prisma.course.findMany).mockResolvedValue(mockDbCourses as any);

            const result = await courseRepo.getAllCourses();

            expect(prisma.course.findMany).toHaveBeenCalled();
            expect(result).toEqual([{
                id: "c1",
                title: "Course 1",
                description: "Desc",
                price: 10,
                priceCents: 1000,
                slug: "slug-1",
                createdAt: now.toISOString()
            }]);
        });
    });

    describe("getCourseById", () => {
        it("should return course details with formatted fields", async () => {
            const now = new Date("2023-01-01");
            const mockDbCourse = {
                courseId: "c1",
                courseName: "Course 1",
                description: "Desc",
                slug: "slug-1",
                priceCents: 2000,
                createdAt: now
            };
            vi.mocked(prisma.course.findUnique).mockResolvedValue(mockDbCourse as any);

            const result = await courseRepo.getCourseById("c1");

            expect(prisma.course.findUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: { courseId: "c1" }
            }));
            expect(result).toEqual({
                ...mockDbCourse,
                priceCents: 2000,
                createdAt: now
            });
        });
    });

    describe("getCourseTopics", () => {
        it("should return topics for a course", async () => {
            const mockDbTopics = [{
                topicId: "t1",
                title: "Topic 1",
                simulation: null // Repository expects this field structure from DB
            }];
            vi.mocked(prisma.topic.findMany).mockResolvedValue(mockDbTopics as any);

            const result = await courseRepo.getCourseTopics("c1");

            expect(prisma.topic.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { courseId: "c1" }
            }));
            // Repository maps the result, but structurally it should be similar enough here if simulation is null
            expect(result).toEqual(mockDbTopics);
        });
    });
});
