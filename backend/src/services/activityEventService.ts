import { Prisma } from "@prisma/client";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import type { LearnerStatusRow, ActivityEventRow } from "../repositories/interfaces/IActivityRepository";

const activityRepo = new ActivityRepository();

export type { LearnerStatusRow };

export type TelemetryEventInput = {
  courseId: string;
  moduleNo?: number | null;
  topicId?: string | null;
  eventType: string;
  payload?: Prisma.JsonValue;
  occurredAt?: Date | null;
};

const VIDEO_EVENT_PREFIXES = ["video.play", "video.resume", "video.buffer.end", "progress.snapshot", "persona.", "notes.", "lesson.", "cold_call.", "tutor.response"];
const FRICTION_EVENT_PREFIXES = ["quiz.fail", "quiz.retry", "tutor.prompt", "cold_call.star", "cold_call.submit", "tutor.response_received", "content.friction"];
const ATTENTION_EVENT_PREFIXES = ["idle.", "video.pause", "video.buffer.start", "lesson.locked_click"];

export function classifyEvent(eventType: string, payload?: Prisma.JsonValue): { derivedStatus?: string; statusReason?: string } {
  const normalized = eventType.toLowerCase();

  if (ATTENTION_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return {
      derivedStatus: "attention_drift",
      statusReason: buildReason(eventType, payload, "Idle or pause pattern detected"),
    };
  }

  if (FRICTION_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return {
      derivedStatus: "content_friction",
      statusReason: buildReason(eventType, payload, "Learner signaled friction"),
    };
  }

  if (VIDEO_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return {
      derivedStatus: "engaged",
      statusReason: buildReason(eventType, payload, "Learner interacting with content"),
    };
  }

  return {};
}

function buildReason(eventType: string, payload: Prisma.JsonValue | undefined, fallback: string): string {
  if (typeof payload === "object" && payload && "reason" in (payload as Record<string, unknown>)) {
    const possible = (payload as Record<string, unknown>).reason;
    if (typeof possible === "string" && possible.trim()) {
      return possible;
    }
  }
  return `${fallback} (${eventType})`;
}

export async function recordActivityEvents(userId: string, events: TelemetryEventInput[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const rows: ActivityEventRow[] = events.map((event) => {
    const { derivedStatus, statusReason } = classifyEvent(event.eventType, event.payload);
    return {
      userId,
      courseId: event.courseId,
      moduleNo: event.moduleNo ?? null,
      topicId: event.topicId ?? null,
      eventType: event.eventType,
      payload: event.payload,
      derivedStatus: derivedStatus ?? null,
      statusReason: statusReason ?? null,
      createdAt: event.occurredAt ?? new Date(),
    };
  });

  await activityRepo.recordEvents(rows);
}

export async function getLatestStatusesForCourse(courseId: string): Promise<LearnerStatusRow[]> {
  const windowedEvents = await activityRepo.getLatestStatusesForCourse(courseId);

  const grouped = new Map<string, LearnerStatusRow[]>();
  windowedEvents.forEach((row) => {
    const list = grouped.get(row.userId) ?? [];
    list.push(row);
    grouped.set(row.userId, list);
  });

  const summaries: LearnerStatusRow[] = [];
  grouped.forEach((events) => {
    const summary = deriveStatusFromEvents(events);
    if (summary) {
      summaries.push(summary);
    }
  });

  return summaries;
}

export async function getLearnerHistory(params: {
  userId: string;
  courseId: string;
  limit: number;
  before?: Date | null;
}): Promise<LearnerStatusRow[]> {
  const { userId, courseId, limit, before } = params;
  return activityRepo.getLearnerHistory(userId, courseId, limit, before);
}

export async function ensureTutorOrAdminAccess(userId: string, courseId: string, role?: string | null): Promise<void> {
  if (role === "admin") {
    return;
  }

  const hasAccess = await activityRepo.checkTutorAccess(userId, courseId);

  if (!hasAccess) {
    throw Object.assign(new Error("Tutor is not assigned to this course"), { status: 403 });
  }
}

function deriveStatusFromEvents(events: LearnerStatusRow[]): LearnerStatusRow | null {
  if (events.length === 0) {
    return null;
  }
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const frictionEvent = sorted.find((event) => event.derivedStatus === "content_friction");
  const attentionEvent = sorted.find((event) => event.derivedStatus === "attention_drift");
  const engagedEvent = sorted.find((event) => event.derivedStatus === "engaged");
  const fallback = sorted[0];

  if (frictionEvent) {
    return { ...frictionEvent, derivedStatus: "content_friction" };
  }
  if (attentionEvent) {
    return { ...attentionEvent, derivedStatus: "attention_drift" };
  }
  if (engagedEvent) {
    return { ...engagedEvent, derivedStatus: "engaged" };
  }
  return fallback;
}

