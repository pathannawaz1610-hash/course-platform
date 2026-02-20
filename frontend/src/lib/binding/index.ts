/**
 * Frontend Binding Layer - Actions
 * 
 * Centralized API client for all backend communication.
 * Replaces direct fetch() calls throughout the application.
 */

// Core client
export { apiClient, APIClient } from "./client";
export type { RequestOptions, Session } from "./client";

// Actions
export * from "./actions/quizActions";
export * from "./actions/courseActions";
export * from "./actions/cartActions";
export * from "./actions/dashboardActions";
export * from "./actions/lessonActions";
export * from "./actions/authActions";
export * from "./actions/assistantActions";
export * from "./actions/coldCallActions";
export * from "./actions/registrationActions";
