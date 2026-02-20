import { apiClient, type Session } from "../client";

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshToken: string): Promise<{
    session: {
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
        refreshTokenExpiresAt: string;
        sessionId: string;
    };
}> {
    return apiClient.request<{
        session: {
            accessToken: string;
            accessTokenExpiresAt: string;
            refreshToken: string;
            refreshTokenExpiresAt: string;
            sessionId: string;
        };
    }>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
    });
}

/**
 * Login user
 */
export async function login(
    email: string,
    password: string
): Promise<{
    session: {
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
        refreshTokenExpiresAt: string;
        sessionId: string;
    };
    user: any;
}> {
    return apiClient.request<{
        session: {
            accessToken: string;
            accessTokenExpiresAt: string;
            refreshToken: string;
            refreshTokenExpiresAt: string;
            sessionId: string;
        };
        user: any;
    }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
    });
}

/**
 * Signup user
 */
export async function signup(data: {
    email: string;
    password: string;
    fullName: string;
    username: string;
    phone: string;
}): Promise<{
    session: {
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
        refreshTokenExpiresAt: string;
        sessionId: string;
    };
    user: any;
}> {
    return apiClient.request<{
        session: {
            accessToken: string;
            accessTokenExpiresAt: string;
            refreshToken: string;
            refreshTokenExpiresAt: string;
            sessionId: string;
        };
        user: any;
    }>("/api/auth/signup", {
        method: "POST",
        body: data,
    });
}

/**
 * Logout user
 */
export async function logout(session: Session): Promise<void> {
    await apiClient.request<void>(
        "/auth/logout",
        {
            method: "POST",
            body: { refreshToken: session.refreshToken },
        },
        session
    );
}

/**
 * Tutor login
 */
export async function tutorLogin(
    email: string,
    password: string
): Promise<{
    accessToken: string;
    refreshToken?: string;
    user: any;
}> {
    return apiClient.request<{
        accessToken: string;
        refreshToken?: string;
        user: any;
    }>("/api/tutors/login", {
        method: "POST",
        body: { email, password },
    });
}

/**
 * Submit tutor application
 */
export async function submitTutorApplication(data: {
    fullName: string;
    email: string;
    expertise: string;
    experience: string;
    motivation: string;
}): Promise<void> {
    await apiClient.request<void>("/api/tutor-applications", {
        method: "POST",
        body: data,
    });
}
