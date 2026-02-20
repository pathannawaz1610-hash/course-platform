import express from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../services/prisma"; // Still used for user/course lookup in helpers if strictly needed, or simpler to keep standard.
// Actually standardizing to use repositories where possible.
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { COHORT_ACCESS_DENIED_MESSAGE } from "../services/cohortAccess";
import { ColdCallRepository } from "../repositories/implementations/ColdCallRepository";
import { CohortRepository } from "../repositories/implementations/CohortRepository";

const coldCallRouter = express.Router();
const coldCallRepo = new ColdCallRepository();
const cohortRepo = new CohortRepository();

const ACTIVE_MEMBER_STATUS = "active";

type MembershipDecision =
  | { allowed: true; cohortId: string; cohortName: string; batchNo: number }
  | { allowed: false; status: number; message: string };

const normalizeEmail = (value: string) => value.trim().toLowerCase();

async function resolveCohortMembership(courseId: string, userId: string): Promise<MembershipDecision> {
  const cohorts = await cohortRepo.findCohortsForCourse(courseId);

  if (cohorts.length === 0) {
    return { allowed: false, status: 409, message: "Cohort access is not configured for this course." };
  }

  // User lookup still via prisma or I should add getUser to a repo.
  // Using prisma for User lookup is fine as established in cohortProjects.ts
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true },
  });

  if (!user?.email) {
    return { allowed: false, status: 401, message: "Unauthorized" };
  }

  const normalizedEmail = normalizeEmail(user.email);
  const cohortIds = cohorts.map((cohort) => cohort.cohortId);

  const member = await cohortRepo.findCohortMember(userId, normalizedEmail, cohortIds);

  if (!member) {
    return { allowed: false, status: 403, message: COHORT_ACCESS_DENIED_MESSAGE };
  }

  if (!member.userId || member.email !== normalizedEmail) {
    await cohortRepo.updateCohortMember(member.memberId, { userId, email: normalizedEmail });
  }

  const batchNo = typeof member.batchNo === "number" && member.batchNo > 0 ? member.batchNo : 1;

  return {
    allowed: true,
    cohortId: member.cohort.cohortId,
    cohortName: member.cohort.name,
    batchNo,
  };
}

coldCallRouter.get(
  "/prompts/:topicId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { topicId } = req.params;

    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const prompt = await coldCallRepo.findPromptByTopic(topicId);

    if (!prompt) {
      // 204 No Content if no prompt active for this topic
      res.status(204).end();
      return;
    }

    const membership = await resolveCohortMembership(prompt.courseId, auth.userId);
    if (!membership.allowed) {
      // If code expects 403, return it.
      res.status(membership.status).json({ message: membership.message });
      return;
    }

    const messages = await coldCallRepo.findMessagesForPrompt(prompt.promptId, membership.cohortId, auth.userId);

    const formattedMessages = messages.map((msg) => ({
      messageId: msg.messageId,
      body: msg.body,
      parentId: msg.parentId,
      rootId: msg.rootId,
      userId: msg.userId,
      authorName: msg.user.fullName,
      createdAt: msg.createdAt,
      stars: msg._count.stars,
      isStarredByMe: msg.stars.length > 0,
    }));

    res.status(200).json({
      prompt: {
        id: prompt.promptId,
        text: prompt.promptText,
        helperText: prompt.helperText,
      },
      messages: formattedMessages,
    });
  }),
);

coldCallRouter.post(
  "/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const body = req.body;

    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const promptId = typeof body.promptId === "string" ? body.promptId : null;
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!promptId || !text) {
      res.status(400).json({ message: "Missing promptId or text" });
      return;
    }

    const prompt = await coldCallRepo.findPromptById(promptId);
    if (!prompt) {
      res.status(404).json({ message: "Prompt not found" });
      return;
    }

    const membership = await resolveCohortMembership(prompt.courseId, auth.userId);
    if (!membership.allowed) {
      res.status(membership.status).json({ message: membership.message });
      return;
    }

    // Check if user already posted a top-level message
    const existing = await coldCallRepo.findTopLevelMessage(promptId, membership.cohortId, auth.userId);
    if (existing) {
      res.status(409).json({ message: "You have already answered this prompt." });
      return;
    }

    const newMessage = await coldCallRepo.createMessage({
      promptId,
      cohortId: membership.cohortId,
      userId: auth.userId,
      body: text,
      // parentId undefined
      // rootId undefined initially
    });

    // Validating rootId logic: if parentId is null, rootId should be messageId.
    // Since we can't do it in one create unless we use UUID generation in app, we update.
    await coldCallRepo.updateMessageRoot(newMessage.messageId, newMessage.messageId);

    res.status(201).json({ messageId: newMessage.messageId });
  }),
);

coldCallRouter.post(
  "/replies",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const body = req.body;

    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parentId = typeof body.parentId === "string" ? body.parentId : null;
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!parentId || !text) {
      res.status(400).json({ message: "Missing parentId or text" });
      return;
    }

    const parentMessage = await coldCallRepo.findMessageById(parentId);
    if (!parentMessage) {
      res.status(404).json({ message: "Parent message not found" });
      return;
    }

    const prompt = await coldCallRepo.findPromptById(parentMessage.promptId);
    if (!prompt) {
      res.status(404).json({ message: "Prompt not found" });
      return;
    }

    const membership = await resolveCohortMembership(prompt.courseId, auth.userId);
    if (!membership.allowed) {
      res.status(membership.status).json({ message: membership.message });
      return;
    }

    const rootId = parentMessage.rootId ?? parentMessage.messageId;

    const newMessage = await coldCallRepo.createMessage({
      promptId: prompt.promptId,
      cohortId: membership.cohortId,
      userId: auth.userId,
      body: text,
      parentId,
      rootId,
    });

    res.status(201).json({ messageId: newMessage.messageId });
  }),
);

coldCallRouter.post(
  "/stars",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const messageId = typeof req.body.messageId === "string" ? req.body.messageId : null;

    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!messageId) {
      res.status(400).json({ message: "messageId required" });
      return;
    }

    const message = await coldCallRepo.findMessageById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const prompt = await coldCallRepo.findPromptById(message.promptId);
    if (!prompt) {
      res.status(404).json({ message: "Prompt not found" });
      return;
    }

    const membership = await resolveCohortMembership(prompt.courseId, auth.userId);
    if (!membership.allowed) {
      res.status(membership.status).json({ message: membership.message });
      return;
    }

    await coldCallRepo.starMessage(messageId, auth.userId);
    res.status(200).json({ success: true });
  }),
);

coldCallRouter.delete(
  "/stars/:messageId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const { messageId } = req.params;

    if (!auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const message = await coldCallRepo.findMessageById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const prompt = await coldCallRepo.findPromptById(message.promptId);
    if (!prompt) {
      res.status(404).json({ message: "Prompt not found" });
      return;
    }

    const membership = await resolveCohortMembership(prompt.courseId, auth.userId);
    if (!membership.allowed) {
      res.status(membership.status).json({ message: membership.message });
      return;
    }

    await coldCallRepo.unstarMessage(messageId, auth.userId);
    res.status(200).json({ success: true });
  }),
);

export { coldCallRouter };
