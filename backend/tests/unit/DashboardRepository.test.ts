import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardRepository } from "../../src/repositories/implementations/DashboardRepository";
import { prisma } from "../../src/services/prisma";

// Mock the prisma client
vi.mock("../../src/services/prisma", () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
        enrollment: {
            findMany: vi.fn(),
        },
        cohortMember: {
            findMany: vi.fn(),
        },
        topicProgress: {
            findMany: vi.fn(),
        },
        registration: {
            findMany: vi.fn(),
        },
        $queryRaw: vi.fn(),
    },
}));

describe("DashboardRepository", () => {
    let dashboardRepo: DashboardRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        dashboardRepo = new DashboardRepository();
    });

    describe("getUserProfile", () => {
        it("should return null if user not found", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
            const result = await dashboardRepo.getUserProfile("u1");
            expect(result).toBeNull();
        });

        it("should return user profile if found", async () => {
            const mockUser = {
                fullName: "Test User",
                email: "test@example.com",
            };
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

            const result = await dashboardRepo.getUserProfile("u1");

            expect(result).toEqual(mockUser);
        });
    });

    describe("getEnrollments", () => {
        it("should return enrollments with course details", async () => {
            const mockEnrollments = [
                {
                    course: {
                        courseId: "c1",
                        title: "Course 1",
                        slug: "course-1",
                        category: "tech",
                    },
                    enrolledAt: new Date(),
                }
            ];

            vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);

            const result = await dashboardRepo.getEnrollments("u1");

            expect(prisma.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId: "u1" }
            }));
            expect(result).toEqual(mockEnrollments);
        });
    });

    describe("getQuizSectionTotals", () => {
        it("should return section counts", async () => {
            const mockTotals = [{ course_id: "c1", section_count: BigInt(5) }];
            vi.mocked(prisma.$queryRaw).mockResolvedValue(mockTotals);

            const result = await dashboardRepo.getQuizSectionTotals(["c1"]);

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(result).toEqual(mockTotals);
        });

        it("should return empty array if no courseIds", async () => {
            const result = await dashboardRepo.getQuizSectionTotals([]);
            expect(result).toEqual([]);
            expect(prisma.$queryRaw).not.toHaveBeenCalled();
        });
    });

});
