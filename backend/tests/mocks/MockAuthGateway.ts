import { IAuthGateway, GoogleUserInfo } from "../../src/gateways/interfaces/IAuthGateway";

export class MockAuthGateway implements IAuthGateway {
    async verifyGoogleToken(token: string): Promise<GoogleUserInfo> {
        if (token === "valid_token") {
            return {
                email: "test@example.com",
                name: "Test User",
                sub: "google_123",
                email_verified: true, // Gateway interface has sub/email/name/picture
                picture: "http://example.com/pic.jpg"
            } as any;
        }
        throw new Error("Invalid token");
    }
}
