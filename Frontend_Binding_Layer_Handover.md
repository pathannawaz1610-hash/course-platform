# Frontend–Backend Binding Layer: Technical Handover Document

**Audience:** Frontend Team  
**Project:** Ottolearn Course Platform  
**Date:** February 2026  
**Purpose:** Explain the architectural refactoring of how the frontend communicates with the backend

---

## What Changed and Why You Need to Read This

We refactored how the frontend talks to the backend. Before this change, every component or page that needed data from the backend was writing its own `fetch()` call — with its own URL, its own headers, its own error handling, and its own type definitions. This worked, but it created a mess over time.

We introduced a **Binding Layer** — a dedicated folder (`frontend/src/lib/binding/`) that owns all frontend-to-backend communication. Every API call now goes through this layer. No component talks to the backend directly anymore.

This document explains what it was before, what it is now, why we made this change, and what it means for how you write code going forward.

---

## Section 1 — Before the Binding Layer

### How the Frontend Was Communicating With the Backend

Before the binding layer existed, API calls were written **directly inside components, hooks, and pages**. Each developer who needed to call an endpoint would write a `fetch()` call wherever they needed it.

A typical pattern looked like this:

```typescript
// Inside a React component or hook — BEFORE
const response = await fetch(`http://localhost:4000/courses/${courseId}`, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    },
});

if (!response.ok) {
    throw new Error("Failed to fetch course");
}

const data = await response.json();
```

### Where These Calls Were Placed

- Directly inside `useEffect()` hooks in page components
- Inside custom hooks like `useCourse()`, `useCart()`, `useProgress()`
- Inside event handlers (e.g., button click → fetch → update state)
- Sometimes inside utility files, but with no consistent structure

### How Types Were Handled

Types were defined **locally** — wherever the fetch call lived. If `CoursePlayerPage` needed a `Course` type, it defined it in that file. If `CourseListPage` also needed a `Course` type, it defined it again — possibly differently.

```typescript
// CoursePlayerPage.tsx — defined its own Course type
interface Course {
    id: string;
    title: string;
    slug: string;
}

// CourseListPage.tsx — defined its own Course type, slightly different
interface Course {
    courseId: string;    // ← different field name
    name: string;        // ← different field name
    slug: string;
}
```

### Problems This Created

**1. Tight Coupling**  
Every component that called the backend was directly coupled to the URL, the HTTP method, the headers, and the response shape. If the backend changed a URL from `/courses` to `/api/courses`, you had to find and update every component that called it.

**2. Scattered API Calls**  
There was no single place to look at "what endpoints does the frontend use?" The calls were spread across 20+ files. New developers had no map of the API surface.

**3. Duplicate Error Handling**  
Every fetch call had its own error handling logic. Some checked `response.ok`, some didn't. Some parsed the error body, some just threw a generic error. The behavior was inconsistent.

**4. Duplicate Auth Headers**  
Every fetch call that needed authentication had to manually add `Authorization: Bearer ${token}` to the headers. If the auth mechanism changed (e.g., from Bearer token to a cookie), every single fetch call would need updating.

**5. Inconsistent Types**  
The same data shape was defined multiple times across the codebase with different field names, optional/required mismatches, and `any` types used to paper over the gaps.

**6. No Centralized Contract**  
There was no single source of truth for what the backend returns. The frontend had to guess, or look at the backend code directly, or trial-and-error at runtime.

### Old Communication Flow

```
Component
    │
    ├── writes fetch() directly
    ├── builds URL manually
    ├── adds auth headers manually
    ├── handles errors locally
    └── defines types locally
    │
    ▼
Backend API (Express)
```

---

## Section 2 — After the Binding Layer

### What the Binding Layer Is

The binding layer is a folder at `frontend/src/lib/binding/` that contains:

```
frontend/src/lib/binding/
├── client.ts              ← The HTTP client (one place for fetch, auth, errors)
├── index.ts               ← Single export point for everything
└── actions/
    ├── authActions.ts     ← All auth-related API calls
    ├── courseActions.ts   ← All course-related API calls
    ├── lessonActions.ts   ← All lesson progress API calls
    ├── cartActions.ts     ← All cart API calls
    ├── quizActions.ts     ← All quiz API calls
    ├── dashboardActions.ts← All dashboard API calls
    ├── assistantActions.ts← All AI assistant API calls
    ├── coldCallActions.ts ← All cold call API calls
    └── registrationActions.ts ← All registration API calls
```

### The Core: `client.ts`

The `APIClient` class in `client.ts` is the single HTTP client for the entire frontend. It handles:

- Building the full URL from a path (`/courses` → `http://localhost:4000/courses`)
- Adding `Content-Type: application/json` to every request
- Adding `Authorization: Bearer <token>` when a session is provided
- Parsing the response as JSON
- Handling non-JSON responses (204 No Content, etc.)
- Parsing error responses into proper `Error` objects with status codes

```typescript
// client.ts — the single HTTP client
export class APIClient {
    async request<T>(
        path: string,
        options: RequestOptions = {},
        session?: Session | null
    ): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (session?.accessToken) {
            headers.Authorization = `Bearer ${session.accessToken}`;
        }

        const response = await fetch(buildApiUrl(path), {
            method: options.method || "GET",
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: options.signal,
            credentials: "include",
        });

        if (!response.ok) {
            throw await this.handleError(response);
        }

        return response.json();
    }
}

export const apiClient = new APIClient(); // singleton
```

### The Actions: One File Per Domain

Each action file contains all the API calls for one domain area. Each function:
- Accepts typed parameters
- Calls `apiClient.request<T>()` with the correct path, method, and body
- Returns a typed response

```typescript
// courseActions.ts — example of an action function
export async function fetchCourses(session: Session): Promise<Course[]> {
    const data = await apiClient.request<{ courses: Course[] }>(
        "/courses",
        {},
        session
    );
    return data.courses || [];
}

export async function fetchCourse(
    courseKey: string,
    session: Session
): Promise<Course> {
    const data = await apiClient.request<{ course: Course }>(
        `/courses/${courseKey}`,
        {},
        session
    );
    return data.course;
}
```

### How Components Use It Now

Components no longer write fetch calls. They import from the binding layer:

```typescript
// CoursePlayerPage.tsx — AFTER
import { fetchCourse, fetchCourseSections } from "@/lib/binding";

// Inside the component:
const course = await fetchCourse(courseKey, session);
const sections = await fetchCourseSections(courseKey, session);
```

### New Communication Flow

```
Component
    │
    └── imports from @/lib/binding
            │
            ▼
    Action Function (e.g., fetchCourse)
            │
            └── calls apiClient.request<T>()
                        │
                        ├── builds URL via buildApiUrl()
                        ├── adds auth headers
                        ├── serializes body
                        └── handles errors
                        │
                        ▼
            Backend API (Express)
```

### Before vs After Comparison

| Concern | Before | After |
|---|---|---|
| Where API calls live | Scattered across 20+ files | Centralized in `binding/actions/` |
| Auth headers | Added manually in every fetch | Handled once in `APIClient` |
| Error handling | Each component handles its own | Handled once in `APIClient.handleError()` |
| URL construction | Hardcoded strings everywhere | `buildApiUrl()` called once |
| TypeScript types | Defined locally, often duplicated | Defined once per domain in action files |
| Adding a new endpoint | Write fetch + types in the component | Add one function to the relevant action file |
| Changing a URL | Find and update every component | Update one line in one action file |
| Changing auth mechanism | Update every fetch call | Update one place in `client.ts` |

---

## Section 3 — What Was Refactored and Why

### What Was Extracted Into the Binding Layer

The following were moved out of components and into the binding layer:

1. **All `fetch()` calls** — extracted into action functions
2. **URL construction** — centralized in `buildApiUrl()` + `APIClient`
3. **Auth header logic** — centralized in `APIClient.request()`
4. **Error parsing logic** — centralized in `APIClient.handleError()`
5. **Request/response TypeScript interfaces** — defined once per domain in action files
6. **Response unwrapping** — e.g., `data.courses || []` done in the action, not the component

### What Was NOT Moved

**Business logic was NOT moved into the binding layer.** The binding layer is only responsible for communication. Examples of what stayed in components and hooks:

- Deciding *when* to fetch (on mount, on user action, on dependency change)
- Combining data from multiple API calls
- Transforming data for display (formatting dates, calculating totals)
- Managing loading/error state in UI
- Deciding what to show based on the response

**Backend logic was NOT touched.** The binding layer is a frontend concern only. The backend's Express routes, services, repositories, and database queries are completely unchanged by this refactoring.

### Why Each Separation Was Made

**Why extract API calls?**  
So that if the backend changes a URL, method, or response shape, there is exactly one place to update in the frontend — not 10.

**Why keep business logic in components?**  
Business logic belongs close to where it's used. A component that decides "show a lock icon if the quiz is not unlocked" is making a UI decision, not an API decision. That logic should stay in the component.

**Why not move Prisma/database logic?**  
Prisma is a backend tool. The frontend has no knowledge of the database. The binding layer communicates over HTTP — it has no direct database connection and never will.

---

## Section 4 — What Belongs in the Binding Layer and What Does Not

### ✅ Belongs in the Binding Layer

| Item | Example |
|---|---|
| API request functions | `fetchCourses()`, `addToCart()`, `submitQuizAttempt()` |
| Request/response TypeScript types | `Course`, `QuizSection`, `LessonProgress` |
| HTTP method, URL, body definition | `method: "POST"`, `"/cart"`, `body: { course: courseData }` |
| Auth token injection | `headers.Authorization = Bearer ${token}` |
| Error response parsing | `APIClient.handleError()` |
| Response unwrapping | `return data.courses || []` |

### ❌ Does NOT Belong in the Binding Layer

| Item | Why Not | Where It Belongs |
|---|---|---|
| Business rules | Not an API concern | Services / components |
| Prisma queries | Backend only | Backend repositories |
| Database models | Backend only | Backend schema |
| UI state management | Not an API concern | Components / hooks |
| Data transformation for display | Not an API concern | Components / utils |
| External SDK logic (e.g., Stripe) | Not a backend HTTP call | Dedicated gateway/service |
| Caching logic | Not an API concern | React Query / hooks |

### The Principle: Separation of Concerns

The binding layer has **one job**: translate a function call into an HTTP request and return the typed result. It does not know what the component will do with the data. It does not know about the database. It does not make UI decisions.

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND                                               │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │  Components  │    │    Hooks     │  ← UI logic,      │
│  │  & Pages     │    │  & Context   │    state mgmt     │
│  └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                           │
│         └─────────┬─────────┘                           │
│                   │ imports from                        │
│                   ▼                                     │
│  ┌────────────────────────────────┐                     │
│  │      Binding Layer             │  ← HTTP calls,      │
│  │  frontend/src/lib/binding/     │    types, auth      │
│  └────────────────┬───────────────┘                     │
│                   │ HTTP                                │
└───────────────────┼─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND (Express)                                      │
│  Routes → Services → Repositories → Database            │
└─────────────────────────────────────────────────────────┘
```

---

## Section 5 — Pros and Cons

### ✅ Pros

**1. Single source of truth for API calls**  
Every endpoint the frontend uses is defined in one place. New developers can open `binding/actions/` and immediately see the full API surface the frontend depends on.

**2. Auth is handled automatically**  
Pass a `session` object to any action function and the `Authorization` header is added automatically. You never manually write `"Authorization": "Bearer " + token` again.

**3. Consistent error handling**  
All API errors are parsed the same way. The error object always has a `.status` (HTTP status code) and a `.message` (from the backend's error response). No more inconsistent error handling across components.

**4. Type safety at the boundary**  
Every action function has typed parameters and a typed return value. TypeScript will catch it if you pass the wrong argument or try to access a field that doesn't exist on the response.

**5. Easy to change backend contracts**  
If the backend changes `/courses` to `/api/v2/courses`, you update one line in `courseActions.ts`. Every component that calls `fetchCourses()` automatically picks up the change.

**6. Testable in isolation**  
You can mock the binding layer in component tests. Instead of mocking `fetch()` globally, you mock `fetchCourses` and control exactly what it returns.

**7. Scales to multiple clients**  
If a mobile app is added later, it can import the same action functions (or a shared package derived from them) instead of rewriting all the API calls.

---

### ❌ Cons

**1. Extra layer of indirection**  
To understand what happens when a component fetches data, you now have to look in two places: the component (to see *when* it fetches) and the action file (to see *how* it fetches). Before, everything was in one place.

**2. Requires discipline to maintain boundaries**  
The binding layer only works if everyone agrees to use it. If one developer writes a direct `fetch()` call in a component, the contract is broken. The team must enforce the rule: *all API calls go through the binding layer*.

**3. Type definitions are still manually maintained**  
The TypeScript interfaces in the action files (e.g., `Course`, `QuizSection`) are written by hand and must match what the backend actually returns. If the backend changes a field name and no one updates the action file, TypeScript won't catch it — the mismatch only shows up at runtime. *(This is a known limitation that would require OpenAPI code generation to fully solve.)*

**4. Slightly more boilerplate for simple calls**  
For a one-off API call, writing an action function feels like more work than just writing a `fetch()` inline. The benefit only becomes clear when that call is used in multiple places or when the backend changes.

**5. Learning curve for new developers**  
Developers familiar with writing fetch calls directly will need to learn the pattern: find the right action file, add a function, export it from `index.ts`, import it in the component. It's a small overhead but it exists.

---

## Section 6 — Exact Changes Made to the Frontend Code

### What Was Added

| File | What It Does |
|---|---|
| `frontend/src/lib/binding/client.ts` | `APIClient` class — the single HTTP client |
| `frontend/src/lib/binding/index.ts` | Re-exports everything from the binding layer |
| `frontend/src/lib/binding/actions/authActions.ts` | `login`, `signup`, `logout`, `refreshToken`, `tutorLogin`, `submitTutorApplication` |
| `frontend/src/lib/binding/actions/courseActions.ts` | `fetchCourses`, `fetchCourse`, `fetchCourseSections`, `enrollInCourse`, `checkEnrollment` |
| `frontend/src/lib/binding/actions/lessonActions.ts` | `fetchLessonProgress`, `updateLessonProgress`, `fetchPersonalization`, `updatePersonalization` |
| `frontend/src/lib/binding/actions/cartActions.ts` | `fetchCart`, `addToCart`, `removeFromCart`, `clearCart` |
| `frontend/src/lib/binding/actions/quizActions.ts` | `fetchQuizSections`, `startQuizAttempt`, `submitQuizAttempt` |
| `frontend/src/lib/binding/actions/dashboardActions.ts` | Dashboard data fetching functions |
| `frontend/src/lib/binding/actions/assistantActions.ts` | `queryAssistant`, `queryLandingAssistant`, `fetchAssistantSession` |
| `frontend/src/lib/binding/actions/coldCallActions.ts` | Cold call message functions |
| `frontend/src/lib/binding/actions/registrationActions.ts` | Course registration functions |

### What Changed in Existing Files

- **Components and pages** that previously wrote `fetch()` directly now import from `@/lib/binding`
- **Import statements** changed from local type definitions to imports from the binding layer
- **Inline type definitions** that duplicated backend response shapes were removed from components

### What Was Removed

- Direct `fetch()` calls inside components
- Locally defined TypeScript interfaces that duplicated API response shapes
- Manual `Authorization` header construction in individual components
- Per-component error handling for HTTP errors

### What Was NOT Changed

- Component rendering logic
- State management (useState, useContext, React Query)
- UI event handlers (the *when* to call, not the *how*)
- All backend code (routes, services, repositories, database)
- The `frontend/src/lib/api.ts` file (`buildApiUrl` utility — still used by `client.ts`)

---

## Section 7 — How to Use the Binding Layer Going Forward

### Rule 1: Never Write a Direct `fetch()` to the Backend in a Component

```typescript
// ❌ WRONG — do not do this
const response = await fetch("http://localhost:4000/courses", {
    headers: { Authorization: `Bearer ${token}` }
});

// ✅ CORRECT — use the binding layer
import { fetchCourses } from "@/lib/binding";
const courses = await fetchCourses(session);
```

### Rule 2: Adding a New Endpoint

1. Find the relevant action file in `frontend/src/lib/binding/actions/`
2. Add a new exported function
3. Define the request parameters and return type
4. Call `apiClient.request<ReturnType>(path, options, session)`
5. It is automatically available via `@/lib/binding` (already re-exported in `index.ts`)

```typescript
// Example: adding a new endpoint to courseActions.ts
export async function fetchCourseReviews(
    courseId: string,
    session: Session
): Promise<Review[]> {
    const data = await apiClient.request<{ reviews: Review[] }>(
        `/courses/${courseId}/reviews`,
        {},
        session
    );
    return data.reviews || [];
}
```

### Rule 3: Authenticated vs Public Endpoints

- **Authenticated endpoint**: pass `session` as the third argument to `apiClient.request()`
- **Public endpoint**: omit `session` or pass `null`

```typescript
// Authenticated
apiClient.request<Course[]>("/courses", {}, session);

// Public (no auth needed)
apiClient.request<{ answer: string }>("/api/landing-assistant/query", {
    method: "POST",
    body: { question }
});
```

### Rule 4: Importing

Always import from the barrel export, not from individual files:

```typescript
// ✅ CORRECT
import { fetchCourses, fetchCart, login } from "@/lib/binding";

// ❌ AVOID — importing from internal files directly
import { fetchCourses } from "@/lib/binding/actions/courseActions";
```

---

## Summary

| Topic | Answer |
|---|---|
| What changed | All frontend API calls are now centralized in `frontend/src/lib/binding/` |
| Why | Eliminate scattered fetch calls, duplicate types, and inconsistent error handling |
| What you need to do | Import from `@/lib/binding` instead of writing fetch calls in components |
| What you must NOT do | Write direct `fetch()` calls to the backend in components or hooks |
| What stayed the same | All backend code, all component rendering logic, all state management |
| Biggest limitation | Types are still manually maintained — backend changes must be manually reflected in action files |
