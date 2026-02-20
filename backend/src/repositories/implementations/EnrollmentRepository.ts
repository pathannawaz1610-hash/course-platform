import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";
import {
    IEnrollmentRepository,
    OfferingRow,
    AssessmentQuestionRow,
    RegistrationPayload
} from "../interfaces/IEnrollmentRepository";

export class EnrollmentRepository implements IEnrollmentRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async ensureEnrollment(userId: string, courseId: string): Promise<void> {
        if (!userId || !courseId) return;

        await this.db.enrollment.upsert({
            where: {
                userId_courseId: { userId, courseId },
            },
            update: { status: "active" },
            create: {
                userId,
                courseId,
                status: "active",
            },
        });
    }

    async findCourseForRegistration(slug?: string, courseId?: string): Promise<{ courseId: string; slug: string; } | null> {
        if (courseId) {
            return this.db.course.findUnique({
                where: { courseId },
                select: { courseId: true, slug: true }
            });
        }
        if (slug) {
            return this.db.course.findUnique({
                where: { slug },
                select: { courseId: true, slug: true }
            });
        }
        return null;
    }

    async getOfferings(courseId: string, programType?: string): Promise<OfferingRow[]> {
        const where: any = {
            courseId,
            isActive: true,
        };
        if (programType) {
            where.programType = programType;
        }

        const offerings = await this.db.courseOffering.findMany({
            where,
            orderBy: { createdAt: "asc" },
        });

        // Map if necessary, but Prisma types should match OfferingRow close enough
        // OfferingRow has meta: any, Prisma has meta: JsonValue. 
        return offerings as unknown as OfferingRow[];
    }

    async getAssessmentQuestions(offeringId: string, programType: string = "all"): Promise<AssessmentQuestionRow[]> {
        const questions = await this.db.assessmentQuestion.findMany({
            where: {
                isActive: true,
                AND: [
                    {
                        OR: [{ offeringId: null }, { offeringId }],
                    },
                    {
                        OR: [{ programType: "all" }, { programType: programType as any }],
                    },
                ],
            },
            orderBy: { questionNumber: "asc" },
        });
        return questions as unknown as AssessmentQuestionRow[];
    }

    async getRegistration(email: string, offeringId: string): Promise<any | null> {
        return this.db.registration.findFirst({
            where: { email, offeringId },
        });
    }

    async createRegistration(data: RegistrationPayload): Promise<any> {
        return this.db.registration.create({
            data: {
                offeringId: data.offeringId,
                userId: data.userId || null,
                fullName: data.fullName,
                email: data.email,
                phoneNumber: data.phoneNumber,
                collegeName: data.collegeName,
                yearOfPassing: data.yearOfPassing,
                branch: data.branch,
                referredBy: data.referredBy || null,
                selectedSlot: data.selectedSlot || null,
                sessionTime: data.sessionTime || null,
                mode: data.mode || null,
                status: data.status || "new",
                answersJson: data.answersJson || Prisma.JsonNull,
                questionsSnapshot: data.questionsSnapshot || Prisma.JsonNull,
                assessmentSubmittedAt: data.assessmentSubmittedAt || null,
            }
        });
    }

    async updateRegistration(registrationId: string, data: RegistrationPayload): Promise<any> {
        return this.db.registration.update({
            where: { registrationId },
            data: {
                // We update everything provided in payload
                userId: data.userId || null,
                fullName: data.fullName,
                email: data.email,
                phoneNumber: data.phoneNumber,
                collegeName: data.collegeName,
                yearOfPassing: data.yearOfPassing,
                branch: data.branch,
                referredBy: data.referredBy || null,
                selectedSlot: data.selectedSlot || null,
                sessionTime: data.sessionTime || null,
                mode: data.mode || null,
                status: data.status || "new",
                answersJson: data.answersJson || Prisma.JsonNull,
                questionsSnapshot: data.questionsSnapshot || Prisma.JsonNull,
                assessmentSubmittedAt: data.assessmentSubmittedAt || null,
            }
        });
    }
}
