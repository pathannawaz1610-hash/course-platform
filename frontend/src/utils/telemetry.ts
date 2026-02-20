import { buildApiUrl } from "@/lib/api";
import { postActivityEvents } from '@/lib/binding/actions/telemetryActions';

type TelemetryEvent = {
  courseId: string;
  moduleNo?: number | null;
  topicId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
};

const BUFFER_FLUSH_INTERVAL_MS = 4000;
const MAX_BUFFER_SIZE = 20;

let currentToken: string | null = null;
let buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const isBrowser = typeof window !== "undefined";

async function flushBuffer(): Promise<void> {
  if (!currentToken || buffer.length === 0) {
    return;
  }
  const events = buffer.slice();
  buffer = [];
  try {
    // ✅ UPDATED: Use telemetryActions
    await postActivityEvents(events, currentToken);
  } catch (error) {
    console.warn("Failed to send telemetry events", error);
  }
}


function scheduleFlush(): void {
  if (flushTimer || !isBrowser) {
    return;
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushBuffer();
  }, BUFFER_FLUSH_INTERVAL_MS) as any;
}

export function updateTelemetryAccessToken(token: string | null): void {
  currentToken = token ?? null;
  if (!currentToken) {
    buffer = [];
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
}

export function recordTelemetryEvent(event: TelemetryEvent): void {
  if (!currentToken || !isBrowser) {
    return;
  }
  buffer.push(event);
  if (buffer.length >= MAX_BUFFER_SIZE) {
    void flushBuffer();
    return;
  }
  scheduleFlush();
}
