import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnrollmentRepository } from "../../src/repositories/implementations/EnrollmentRepository";
import { prisma } from "../../src/services/prisma";

vi.mock("../../src/services/prisma", () => ({
    prisma: {
        enrollment: {
            upsert: vi.fn(),
        },
        course: {
            findUnique: vi.fn(),
        },
        courseOffering: {
            findMany: vi.fn(),
        },
        assessmentQuestion: {
            findMany: vi.fn(),
        },
        registration: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        }
    },
}));

describe("EnrollmentRepository", () => {
    let enrollmentRepo: EnrollmentRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        enrollmentRepo = new EnrollmentRepository();
    });

    describe("ensureEnrollment", () => {
        it("should upsert enrollment", async () => {
            await enrollmentRepo.ensureEnrollment("u1", "c1");
            expect(prisma.enrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId_courseId: { userId: "u1", courseId: "c1" } }
            }));
        });
    });

    describe("getOfferings", () => {
        it("should return offerings for course", async () => {
            const mockOfferings = [{ offeringId: "o1" }];
            vi.mocked(prisma.courseOffering.findMany).mockResolvedValue(mockOfferings as any);

            const result = await enrollmentRepo.getOfferings("c1");

            expect(prisma.courseOffering.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { courseId: "c1", isActive: true }
            }));
            expect(result).toEqual(mockOfferings);
        });
    });

    describe("createRegistration", () => {
        it("should create registration", async () => {
            const mockReg = { registrationId: "r1" };
            vi.mocked(prisma.registration.create).mockResolvedValue(mockReg as any);

            const result = await enrollmentRepo.createRegistration({
                offeringId: "o1",
                email: "test@example.com",
                fullName: "Test",
                phoneNumber: "123",
                collegeName: "College",
                yearOfPassing: "2024",
                branch: "CS"
            });

            expect(prisma.registration.create).toHaveBeenCalled();
            expect(result).toEqual(mockReg);
        });
    });
});
