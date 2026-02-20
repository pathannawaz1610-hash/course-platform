/**
 * Frontend Binding Layer — Centralized Entry Point
 *
 * This barrel file provides a single import source for all binding actions.
 * Uses explicit named exports where function names conflict across modules
 * (avoids TypeScript TS2308 duplicate export errors from wildcard re-exports).
 */

// ─── Core Client ─────────────────────────────────────────────────────────────
export { apiClient, APIClient } from "./client";
export type { RequestOptions, Session } from "./client";

// ─── Quiz ─────────────────────────────────────────────────────────────────────
export * from "./actions/quizActions";

// ─── Courses (exports fetchAssessmentQuestions for course-level assessments) ──
export * from "./actions/courseActions";

// ─── Cart ─────────────────────────────────────────────────────────────────────
export * from "./actions/cartActions";

// ─── Dashboard ────────────────────────────────────────────────────────────────
export * from "./actions/dashboardActions";

// ─── Lessons ─────────────────────────────────────────────────────────────────
export * from "./actions/lessonActions";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export * from "./actions/authActions";

// ─── Assistant ────────────────────────────────────────────────────────────────
export * from "./actions/assistantActions";

// ─── Cold Call ────────────────────────────────────────────────────────────────
export * from "./actions/coldCallActions";

// ─── Registration (uses fetchRegistrationAssessmentQuestions — renamed to avoid conflict) ──
export {
    fetchOfferings,
    fetchRegistrationAssessmentQuestions,
    submitRegistration,
} from "./actions/registrationActions";

// ─── Tutor ───────────────────────────────────────────────────────────────────
export {
    submitTutorApplication,
    loginTutor,
    fetchTutorCourses,
    fetchTutorEnrollments,
    fetchTutorProgress,
    fetchActivityLearners,
    fetchLearnerHistory,
    // Aliased to avoid conflict with assistantActions.queryAssistant in this barrel
    queryAssistant as queryTutorAssistant,
} from "./actions/tutorActions";
export type {
    TutorApplicationPayload,
    TutorLoginPayload,
    TutorSessionResponse,
    TutorCourse,
    EnrollmentRow,
    ProgressRow,
    ActivityLearner,
    ActivitySummary,
} from "./actions/tutorActions";

// ─── Page Content ─────────────────────────────────────────────────────────────
export * from "./actions/pageActions";

// ─── Telemetry ────────────────────────────────────────────────────────────────
export * from "./actions/telemetryActions";
