export interface GoogleUserInfo {
    email: string;
    name: string;
    picture?: string;
    sub: string; // Google ID
}

export interface IAuthGateway {
    /**
     * Verifies a Google ID token and returns user info.
     */
    verifyGoogleToken(token: string): Promise<GoogleUserInfo>;
}
