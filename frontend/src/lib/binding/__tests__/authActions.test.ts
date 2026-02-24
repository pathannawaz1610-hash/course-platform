import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, logout, signup, refreshToken } from "../actions/authActions";
import { apiClient } from "../client";

// Mock the apiClient instance
vi.mock("../client", () => ({
    apiClient: {
        request: vi.fn(),
    },
}));

describe("authActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should login a user", async () => {
        const mockResponse = { session: { accessToken: "token" }, user: { id: "1" } };
        vi.mocked(apiClient.request).mockResolvedValueOnce(mockResponse);

        const result = await login("test@example.com", "password");

        expect(apiClient.request).toHaveBeenCalledWith(
            "/api/auth/login",
            {
                method: "POST",
                body: { email: "test@example.com", password: "password" },
            }
        );
        expect(result).toEqual(mockResponse);
    });

    it("should logout a user", async () => {
        const session = { accessToken: "access", refreshToken: "refresh" };
        vi.mocked(apiClient.request).mockResolvedValueOnce({});

        await logout(session);

        expect(apiClient.request).toHaveBeenCalledWith(
            "/auth/logout",
            {
                method: "POST",
                body: { refreshToken: "refresh" },
            },
            session
        );
    });

    it("should signup a user", async () => {
        const data = { email: "a@b.com", password: "p", fullName: "N", username: "u", phone: "1" };
        const mockResponse = { session: { accessToken: "t" }, user: { id: "1" } };
        vi.mocked(apiClient.request).mockResolvedValueOnce(mockResponse);

        const result = await signup(data);

        expect(apiClient.request).toHaveBeenCalledWith(
            "/api/auth/signup",
            {
                method: "POST",
                body: data,
            }
        );
        expect(result).toEqual(mockResponse);
    });

    it("should refresh the token", async () => {
        const mockResponse = { session: { accessToken: "new-t" } };
        vi.mocked(apiClient.request).mockResolvedValueOnce(mockResponse);

        const result = await refreshToken("old-refresh");

        expect(apiClient.request).toHaveBeenCalledWith(
            "/auth/refresh",
            {
                method: "POST",
                body: { refreshToken: "old-refresh" },
            }
        );
        expect(result).toEqual(mockResponse);
    });
});
