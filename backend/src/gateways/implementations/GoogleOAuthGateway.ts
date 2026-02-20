import { OAuth2Client } from "google-auth-library";
import { IAuthGateway, GoogleUserInfo } from "../interfaces/IAuthGateway";

export class GoogleOAuthGateway implements IAuthGateway {
    private client: OAuth2Client;
    private clientId: string;

    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID || "";
        if (!this.clientId) {
            console.warn("GoogleOAuthGateway: GOOGLE_CLIENT_ID not found. OAuth will fail.");
        }
        this.client = new OAuth2Client(this.clientId);
    }

    async verifyGoogleToken(token: string): Promise<GoogleUserInfo> {
        if (!this.clientId) {
            throw new Error("Google Client ID not configured");
        }

        try {
            const ticket = await this.client.verifyIdToken({
                idToken: token,
                audience: this.clientId,
            });

            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error("Invalid token payload");
            }

            return {
                email: payload.email!,
                name: payload.name!,
                picture: payload.picture,
                sub: payload.sub,
            };
        } catch (error) {
            console.error("GoogleOAuthGateway: Token verification failed", error);
            throw error;
        }
    }
}
