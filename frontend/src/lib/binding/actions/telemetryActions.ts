import { apiClient, type Session } from "../client";

export async function logActivityEvent(
    eventType: string,
    metadata: any,
    url: string
): Promise<void> {
    // We don't await the response for telemetry to avoid blocking
    void apiClient.request<void>("/api/activity/events", {
        method: "POST",
        body: {
            type: eventType,
            url,
            metadata,
            timestamp: new Date().toISOString(),
        },
    }).catch(err => console.error("Telemetry error:", err));
}

export async function postActivityEvents(
    events: any[],
    token: string
): Promise<void> {
    await apiClient.request<void>(
        "/api/activity/events",
        {
            method: "POST",
            body: { events },
        },
        // We manually construct session-like object or pass token if apiClient supports it.
        // The original code passed 'Authorization: Bearer token'.
        // apiClient expects a Session object.
        { accessToken: token } as any
    );
}
