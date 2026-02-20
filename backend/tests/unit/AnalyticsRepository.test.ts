import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsRepository } from "../../src/repositories/implementations/AnalyticsRepository";
import { prisma } from "../../src/services/prisma";

vi.mock("../../src/services/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        course: {
            findUnique: vi.fn(),
        },
        topic: {
            findMany: vi.fn(),
        },
        enrollment: {
            findMany: vi.fn(),
        }
    },
}));

describe("AnalyticsRepository", () => {
    let analyticsRepo: AnalyticsRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        analyticsRepo = new AnalyticsRepository();
    });

    describe("getCourseMetadata", () => {
        it("should return course metadata", async () => {
            const mockCourse = { courseId: "c1", courseName: "C1", slug: "s1", description: "d" };
            vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

            const result = await analyticsRepo.getCourseMetadata("c1");

            expect(prisma.course.findUnique).toHaveBeenCalled();
            expect(result).toEqual(mockCourse);
        });
    });

    describe("getDistinctModuleCount", () => {
        it("should return count of modules", async () => {
            vi.mocked(prisma.topic.findMany).mockResolvedValue([{ moduleNo: 1 }, { moduleNo: 2 }] as any);

            const result = await analyticsRepo.getDistinctModuleCount("c1");

            expect(prisma.topic.findMany).toHaveBeenCalled();
            expect(result).toBe(2);
        });
    });

    describe("getModuleProgressStats", () => {
        it("should return progress stats via raw sql", async () => {
            const mockRows = [{ user_id: "u1", module_no: 1, quiz_passed: true }];
            vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

            const result = await analyticsRepo.getModuleProgressStats("c1");

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(result).toEqual(mockRows);
        });
    });
});
