import { EnrollmentRepository } from "../repositories/implementations/EnrollmentRepository";

const enrollmentRepo = new EnrollmentRepository();

export async function ensureEnrollment(userId: string, courseId: string): Promise<void> {
  await enrollmentRepo.ensureEnrollment(userId, courseId);
}
