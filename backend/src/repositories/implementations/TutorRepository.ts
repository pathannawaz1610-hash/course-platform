import { Prisma, PrismaClient } from "@prisma/client";
import { ITutorRepository, AssignedCourse, EnrollmentRow, LearnerProgressRaw, TutorUser } from "../interfaces/ITutorRepository";
import { prisma } from "../../services/prisma";

export class TutorRepository implements ITutorRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async findTutorByEmail(email: string): Promise<TutorUser | null> {
        const user = await this.db.user.findUnique({
            where: { email },
            select: {
                userId: true,
                email: true,
                fullName: true,
                role: true, // Should verify this matches enum
                passwordHash: true,
                tutorProfile: {
                    select: {
                        tutorId: true,
                        displayName: true,
                    },
                },
            },
        });

        if (!user) return null;
        return user as TutorUser;
    }

    async verifyTutorAssignment(userId: string, courseId: string): Promise<boolean> {
        const assignment = await this.db.courseTutor.findFirst({
            where: {
                courseId,
                isActive: true,
                tutor: { userId },
            },
            select: { courseTutorId: true },
        });
        return Boolean(assignment);
    }

    async getAssignedCourses(userId: string): Promise<AssignedCourse[]> {
        const courses = await this.db.courseTutor.findMany({
            where: {
                isActive: true,
                tutor: { userId },
            },
            include: {
                course: {
                    select: {
                        courseId: true,
                        courseName: true,
                        slug: true,
                        description: true,
                    },
                },
            },
        });

        return courses.map((entry) => ({
            courseId: entry.course.courseId,
            courseName: entry.course.courseName,
            slug: entry.course.slug,
            description: entry.course.description,
            role: entry.role,
        }));
    }

    async getCourseEnrollments(courseId: string): Promise<EnrollmentRow[]> {
        const enrollments = await this.db.enrollment.findMany({
            where: { courseId },
            select: {
                enrollmentId: true,
                enrolledAt: true,
                status: true,
                user: {
                    select: {
                        userId: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
            orderBy: { enrolledAt: "desc" },
        });

        return enrollments.map((enrollment) => ({
            enrollmentId: enrollment.enrollmentId,
            enrolledAt: enrollment.enrolledAt,
            status: enrollment.status,
            userId: enrollment.user.userId,
            fullName: enrollment.user.fullName,
            email: enrollment.user.email,
        }));
    }

    async getCourseModuleNumbers(courseId: string): Promise<number[]> {
        const moduleNumbers = await this.db.topic.findMany({
            where: { courseId, moduleNo: { gt: 0 } },
            select: { moduleNo: true },
            distinct: ["moduleNo"],
            orderBy: { moduleNo: "asc" },
        });
        return moduleNumbers.map(m => m.moduleNo);
    }

    async getCourseLearners(courseId: string): Promise<any[]> {
        const enrolledUsers = await this.db.enrollment.findMany({
            where: { courseId },
            select: {
                userId: true,
                enrolledAt: true,
                user: { select: { fullName: true, email: true } },
            },
        });
        return enrolledUsers; // Return raw structure as controller expects it for now
    }

    async getModuleProgress(courseId: string): Promise<LearnerProgressRaw[]> {
        const progressRows = await this.db.$queryRaw<LearnerProgressRaw[]>(Prisma.sql`
      SELECT user_id, module_no, quiz_passed
      FROM module_progress
      WHERE course_id = ${courseId}::uuid
    `);

        // Ensure the return type matches strictly, sometimes raw query returns weird shapes
        return progressRows;
    }
}
