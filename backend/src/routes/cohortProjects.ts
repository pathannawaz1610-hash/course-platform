import express from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { resolveCohortMembership } from "../services/cohortAccess";
import { CohortRepository } from "../repositories/implementations/CohortRepository";
import { CourseRepository } from "../repositories/implementations/CourseRepository";

const cohortProjectsRouter = express.Router();
const cohortRepo = new CohortRepository();
const courseRepo = new CourseRepository();

cohortProjectsRouter.get(
  "/:courseKey",
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

    const membership = await resolveCohortMembership(courseId, auth.userId);
    if (!membership.allowed) {
      res.status(membership.status).json({ message: membership.message });
      return;
    }

    const project = await cohortRepo.findCohortBatchProject(membership.cohortId, membership.batchNo);

    if (!project) {
      res.status(404).json({ message: "Cohort project not assigned yet." });
      return;
    }

    res.status(200).json({
      cohortId: membership.cohortId,
      cohortName: membership.cohortName,
      batchNo: project.batchNo,
      project: project.payload,
      updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
    });
  }),
);

export { cohortProjectsRouter };
