import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivityRepository } from "../../src/repositories/implementations/ActivityRepository";
import { prisma } from "../../src/services/prisma";

vi.mock("../../src/services/prisma", () => ({
    prisma: {
        $executeRaw: vi.fn(),
        $queryRaw: vi.fn(),
        learnerActivityEvent: {
            createMany: vi.fn(),
        }
    },
}));

describe("ActivityRepository", () => {
    let activityRepo: ActivityRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        activityRepo = new ActivityRepository();
    });

    describe("recordEvents", () => {
        it("should bulk insert events", async () => {
            const events = [{
                userId: "u1",
                courseId: "c1",
                eventType: "login",
                createdAt: new Date()
            }];

            await activityRepo.recordEvents(events);

            expect(prisma.learnerActivityEvent.createMany).toHaveBeenCalledWith({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        userId: "u1",
                        courseId: "c1",
                        eventType: "login"
                    })
                ])
            });
        });

        it("should do nothing if empty array", async () => {
            await activityRepo.recordEvents([]);
            expect(prisma.learnerActivityEvent.createMany).not.toHaveBeenCalled();
        });
    });

    describe("getLatestStatusesForCourse", () => {
        it("should return statuses via raw sql", async () => {
            const mockRows = [{ user_id: "u1", current_status: "active", course_id: "c1" }];
            vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

            const result = await activityRepo.getLatestStatusesForCourse("c1");

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(result).toEqual(mockRows);
        });
    });
});
