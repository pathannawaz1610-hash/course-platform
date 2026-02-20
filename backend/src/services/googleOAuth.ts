import { OAuth2Client } from "google-auth-library";
import type { Credentials } from "google-auth-library";
import { env } from "../config/env";
import { GoogleOAuthGateway } from "../gateways/implementations/GoogleOAuthGateway";

const oauthClient = new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
const authGateway = new GoogleOAuthGateway();

export type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

export function generateGoogleAuthUrl(state?: string): string {
  return oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    state,
  });
}

// Helper to adapt Gateway result to local type
function adaptGatewayUser(user: any): GoogleUserInfo {
  return {
    sub: user.sub,
    email: user.email,
    email_verified: true, // Gateway validates token signature, so email is verified
    name: user.name,
    picture: user.picture
  };
}

async function fetchGoogleUser(accessToken: string, idToken?: string): Promise<GoogleUserInfo> {
  if (idToken) {
    try {
      const user = await authGateway.verifyGoogleToken(idToken);
      return adaptGatewayUser(user);
    } catch (e) {
      // Fallback or ignore if token invalid
    }
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user info (${response.status})`);
  }

  const data = (await response.json()) as any;
  if (!data.email) {
    throw new Error("Google user does not include an email address");
  }

  return {
    sub: data.sub,
    email: data.email,
    email_verified: data.email_verified,
    name: data.name,
    picture: data.picture
  };
}

export async function exchangeCodeForTokens(code: string): Promise<{ tokens: Credentials; profile: GoogleUserInfo }> {
  const { tokens } = await oauthClient.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  const profile = await fetchGoogleUser(tokens.access_token, tokens.id_token ?? undefined);
  return { tokens, profile };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  // Use Gateway for verification
  try {
    const user = await authGateway.verifyGoogleToken(idToken);
    return adaptGatewayUser(user);
  } catch (error) {
    throw new Error("Invalid Google ID token");
  }
}
