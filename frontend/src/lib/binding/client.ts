import { buildApiUrl } from "@/lib/api";

export interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: any;
    signal?: AbortSignal;
}

export interface Session {
    accessToken: string;
}

/**
 * Base HTTP client for making API requests.
 * Handles authentication, headers, and error responses.
 */
export class APIClient {
    /**
     * Make an HTTP request to the backend API
     */
    async request<T>(
        path: string,
        options: RequestOptions = {},
        session?: Session | null
    ): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (session?.accessToken) {
            headers.Authorization = `Bearer ${session.accessToken}`;
        }

        const response = await fetch(buildApiUrl(path), {
            method: options.method || "GET",
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: options.signal,
            credentials: "include",
        });

        if (!response.ok) {
            throw await this.handleError(response);
        }

        // Handle empty responses (204 No Content, etc.)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            return {} as T;
        }

        return response.json();
    }

    /**
     * Handle HTTP error responses
     */
    private async handleError(response: Response): Promise<Error> {
        const text = await response.text();
        let message = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const json = JSON.parse(text);
            message = json.message || json.error || message;
        } catch {
            // Not JSON, use status text
            if (text) {
                message = text;
            }
        }

        const error = new Error(message);
        (error as any).status = response.status;
        (error as any).response = response;
        return error;
    }
}

/**
 * Singleton API client instance
 */
export const apiClient = new APIClient();
