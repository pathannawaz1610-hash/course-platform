import express from "express";
import { EnrollmentRepository } from "../repositories/implementations/EnrollmentRepository";

export const registrationsRouter = express.Router();
const enrollmentRepo = new EnrollmentRepository();

const PROGRAM_TYPES = new Set(["cohort", "ondemand", "workshop"]);

registrationsRouter.get("/offerings", async (req, res, next) => {
  try {
    const courseSlug = typeof req.query.courseSlug === "string" ? req.query.courseSlug : undefined;
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const programType = typeof req.query.programType === "string" ? req.query.programType : undefined;

    if (!courseSlug && !courseId) {
      return res.status(400).json({ error: "courseSlug or courseId is required" });
    }

    const course = await enrollmentRepo.findCourseForRegistration(courseSlug, courseId);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (programType && !PROGRAM_TYPES.has(programType)) {
      return res.status(400).json({ error: "Invalid programType" });
    }

    const offerings = await enrollmentRepo.getOfferings(course.courseId, programType);

    return res.json({ course, offerings });
  } catch (error) {
    return next(error);
  }
});

registrationsRouter.get("/assessment-questions", async (req, res, next) => {
  try {
    const offeringId = typeof req.query.offeringId === "string" ? req.query.offeringId : undefined;
    const programType = typeof req.query.programType === "string" ? req.query.programType : "all";

    if (!offeringId) {
      return res.status(400).json({ error: "offeringId is required" });
    }

    if (programType !== "all" && !PROGRAM_TYPES.has(programType)) {
      return res.status(400).json({ error: "Invalid programType" });
    }

    const questions = await enrollmentRepo.getAssessmentQuestions(offeringId, programType);

    return res.json({ questions });
  } catch (error) {
    return next(error);
  }
});

registrationsRouter.post("/", async (req, res, next) => {
  try {
    const {
      offeringId,
      userId,
      fullName,
      email,
      phoneNumber,
      collegeName,
      yearOfPassing,
      branch,
      referredBy,
      selectedSlot,
      sessionTime,
      mode,
      status,
      answersJson,
      questionsSnapshot,
      assessmentSubmittedAt,
    } = req.body ?? {};

    const missingFields: string[] = [];
    if (!offeringId) missingFields.push("offeringId");
    if (!fullName) missingFields.push("fullName");
    if (!email) missingFields.push("email");
    if (!phoneNumber) missingFields.push("phoneNumber");
    if (!collegeName) missingFields.push("collegeName");
    if (!yearOfPassing) missingFields.push("yearOfPassing");
    if (!branch) missingFields.push("branch");

    if (missingFields.length > 0) {
      return res.status(400).json({ error: "Missing required fields", fields: missingFields });
    }

    // Since we don't have getOfferingById in repo (only getOfferings by course), 
    // we might skip offering check or add it to repo if strictly needed.
    // However, FK constraint will fail if offeringId is invalid during create.
    // Or we can query DB. But for now, let's assume valid ID or catch error.
    // Wait, the original code did:
    // const offering = await prisma.courseOffering.findUnique({ where: { offeringId } });

    // I should add getOfferingById to Repo if I want to maintain this 404 check, 
    // or just rely on getRegistration check which uses email+offeringId.
    // But getRegistration doesn't check if offering exists.
    // I'll skip the explicit offering existence check for now as it's partial redundancy 
    // (create will fail with FK error if offering missing).
    // optimizing: just find existing registration.

    const existing = await enrollmentRepo.getRegistration(email, offeringId);

    const payload = {
      offeringId,
      userId: userId || null,
      fullName,
      email,
      phoneNumber,
      collegeName,
      yearOfPassing,
      branch,
      referredBy: referredBy || null,
      selectedSlot: selectedSlot || null,
      sessionTime: sessionTime || null,
      mode: mode || null,
      status: status || "new",
      answersJson: answersJson || null,
      questionsSnapshot: questionsSnapshot || null,
      assessmentSubmittedAt: assessmentSubmittedAt ? new Date(assessmentSubmittedAt) : null,
    };

    let registration;
    if (existing) {
      registration = await enrollmentRepo.updateRegistration(existing.registrationId, payload);
    } else {
      registration = await enrollmentRepo.createRegistration(payload);
    }

    return res.status(existing ? 200 : 201).json({ registration });
  } catch (error: any) {
    // If we want to catch "foreign key constraint failed" for offeringId:
    if (error.code === 'P2003') {
      return res.status(404).json({ error: "Offering not found" });
    }
    return next(error);
  }
});
