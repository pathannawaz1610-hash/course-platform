import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../client";

// Mock the native fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the buildApiUrl utility
vi.mock("@/lib/api", () => ({
    buildApiUrl: (path: string) => `http://localhost:4000${path}`,
}));

describe("APIClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should include Authorization header when session is provided", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ success: true }),
        });

        const session = { accessToken: "test-token" };
        await apiClient.request("/test", {}, session);

        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:4000/test",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer test-token",
                }),
            })
        );
    });

    it("should include Content-Type: application/json when body is provided", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ success: true }),
        });

        await apiClient.request("/test", {
            method: "POST",
            body: { foo: "bar" },
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:4000/test",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({ foo: "bar" }),
            })
        );
    });

    it("should throw a formatted error when response is not ok", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            text: async () => JSON.stringify({ message: "Invalid token" }),
        });

        await expect(apiClient.request("/protected")).rejects.toThrow("Invalid token");
    });

    it("should return parsed JSON when response is ok", async () => {
        const mockData = { id: 1, name: "Test" };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => mockData,
        });

        const result = await apiClient.request("/data");
        expect(result).toEqual(mockData);
    });

    it("should return empty object for non-json responses", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ "content-type": "text/plain" }),
            text: async () => "OK",
        });

        const result = await apiClient.request("/ping");
        expect(result).toEqual({});
    });
});
