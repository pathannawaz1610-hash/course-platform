import express from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { ensureEnrollment } from "../services/enrollmentService";
import { checkCohortAccessForUser } from "../services/cohortAccess";
import { CourseRepository } from "../repositories/implementations/CourseRepository";

const coursesRouter = express.Router();
const courseRepo = new CourseRepository();

coursesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const courses = await courseRepo.getAllCourses();
    res.status(200).json({ courses });
  }),
);

coursesRouter.get(
  "/:courseKey",
  asyncHandler(async (req, res) => {
    const courseId = await courseRepo.resolveCourseIdByFuzzyKey(req.params.courseKey);

    if (!courseId) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const course = await courseRepo.getCourseById(courseId);

    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    // Map to view model if strictly needed, or just return. 
    // The repo returns CourseDetails which is close enough or exact.
    // The repo returns :
    // { courseId, courseName, slug, description, priceCents, createdAt }
    // The old route returned:
    // { id, slug, title, description, price, priceCents, createdAt }
    // We need to map it to match the old API response exactly.

    const response = {
      id: course.courseId,
      slug: course.slug,
      title: course.courseName,
      description: course.description,
      price: Math.round(course.priceCents / 100),
      priceCents: course.priceCents,
      createdAt: course.createdAt.toISOString()
    };

    res.status(200).json({ course: response });
  }),
);

coursesRouter.post(
  "/:courseKey/enroll",
  requireAuth,
  asyncHandler(async (req, res) => {
    const courseId = await courseRepo.resolveCourseIdByFuzzyKey(req.params.courseKey);

    if (!courseId) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const cohortAccess = await checkCohortAccessForUser(auth.userId, courseId);
    if (!cohortAccess.allowed) {
      res.status(cohortAccess.status).json({ message: cohortAccess.message });
      return;
    }

    const checkOnly =
      (typeof req.query?.checkOnly === "string" && req.query.checkOnly === "true") ||
      req.body?.checkOnly === true;
    if (checkOnly) {
      res.status(204).end();
      return;
    }

    await ensureEnrollment(auth.userId, courseId);
    res.status(200).json({ status: "enrolled", courseId });
  }),
);

export { coursesRouter };
