import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleOAuthGateway } from "../../src/gateways/implementations/GoogleOAuthGateway";

// Mock google-auth-library
vi.mock("google-auth-library", () => {
    const OAuth2Client = vi.fn();
    OAuth2Client.prototype.verifyIdToken = vi.fn();
    return { OAuth2Client };
});

import { OAuth2Client } from "google-auth-library";

describe("GoogleOAuthGateway", () => {
    let gateway: GoogleOAuthGateway;
    let mockClient: any;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GOOGLE_CLIENT_ID = "test-client-id";
        gateway = new GoogleOAuthGateway();
        mockClient = (OAuth2Client as any).mock.instances[0];
    });

    describe("verifyGoogleToken", () => {
        it("should return user info on valid token", async () => {
            const mockPayload = {
                sub: "123",
                email: "test@example.com",
                name: "Test User",
                picture: "pic.jpg"
            };

            mockClient.verifyIdToken.mockResolvedValue({
                getPayload: () => mockPayload
            });

            const result = await gateway.verifyGoogleToken("valid-token");
            expect(result).toEqual(mockPayload);
        });

        it("should throw error on invalid token", async () => {
            mockClient.verifyIdToken.mockRejectedValue(new Error("Invalid token"));
            await expect(gateway.verifyGoogleToken("invalid-token")).rejects.toThrow("Invalid token");
        });
    });
});
