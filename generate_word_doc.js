const fs = require("fs");
const path = require("path");

const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    AlignmentType, ShadingType, convertInchesToTwip,
    PageOrientation, Header, Footer, PageNumber, NumberFormat,
    UnderlineType, TableLayoutType
} = require(path.join(__dirname, "backend", "node_modules", "docx"));


// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
    primary: "1E3A5F",   // deep navy
    accent: "2E86AB",   // steel blue
    accentLight: "D6EAF8",   // pale blue (table header bg)
    codeBlock: "F4F6F8",   // light grey (code bg)
    codeBorder: "CBD5E0",   // grey border
    textDark: "1A202C",   // near-black body text
    textMid: "4A5568",   // mid-grey for captions
    white: "FFFFFF",
    proGreen: "1A6B3C",   // dark green for ✅ rows
    conRed: "8B1A1A",   // dark red for ❌ rows
    tableAlt: "F7FAFC",   // alternating row tint
    tableBorder: "BEE3F8",   // table border blue
    sectionLine: "2E86AB",   // horizontal rule colour
};

// ─── Font ─────────────────────────────────────────────────────────────────────
const FONT = "Calibri";
const MONO = "Courier New";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function noBorder() {
    return {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    };
}

function thinBorder(color = COLORS.tableBorder) {
    const b = { style: BorderStyle.SINGLE, size: 4, color };
    return { top: b, bottom: b, left: b, right: b };
}

function spacer(pts = 6) {
    return new Paragraph({ spacing: { before: 0, after: pts * 20 } });
}

function hrParagraph() {
    return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.sectionLine } },
        spacing: { before: 160, after: 160 },
    });
}

function bodyText(text, opts = {}) {
    return new Paragraph({
        children: [new TextRun({
            text,
            font: FONT,
            size: 22,
            color: COLORS.textDark,
            bold: opts.bold || false,
            italics: opts.italic || false,
        })],
        spacing: { before: 40, after: 80 },
        alignment: AlignmentType.LEFT,
    });
}

function bulletPoint(text, level = 0) {
    // Split on **bold** markers
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    const runs = parts.map(p => {
        if (p.startsWith("**") && p.endsWith("**")) {
            return new TextRun({ text: p.slice(2, -2), font: FONT, size: 22, bold: true, color: COLORS.textDark });
        }
        return new TextRun({ text: p, font: FONT, size: 22, color: COLORS.textDark });
    });
    return new Paragraph({
        children: runs,
        bullet: { level },
        spacing: { before: 20, after: 40 },
    });
}

function numberedItem(text, num) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    const runs = parts.map(p => {
        if (p.startsWith("**") && p.endsWith("**")) {
            return new TextRun({ text: p.slice(2, -2), font: FONT, size: 22, bold: true, color: COLORS.textDark });
        }
        return new TextRun({ text: p, font: FONT, size: 22, color: COLORS.textDark });
    });
    return new Paragraph({
        children: [
            new TextRun({ text: `${num}.  `, font: FONT, size: 22, bold: true, color: COLORS.accent }),
            ...runs,
        ],
        indent: { left: convertInchesToTwip(0.3) },
        spacing: { before: 20, after: 60 },
    });
}

function heading1(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 44, bold: true, color: COLORS.primary })],
        spacing: { before: 480, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent } },
    });
}

function heading2(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: COLORS.accent })],
        spacing: { before: 360, after: 100 },
    });
}

function heading3(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: COLORS.primary })],
        spacing: { before: 240, after: 80 },
    });
}

function inlineCode(text) {
    return new TextRun({
        text: ` ${text} `,
        font: MONO,
        size: 19,
        color: COLORS.primary,
        shading: { type: ShadingType.SOLID, color: COLORS.codeBlock, fill: COLORS.codeBlock },
    });
}

function codeBlock(lines) {
    const children = [];
    lines.forEach((line, i) => {
        children.push(new Paragraph({
            children: [new TextRun({
                text: line || " ",
                font: MONO,
                size: 18,
                color: COLORS.primary,
            })],
            spacing: { before: 0, after: 0 },
            shading: { type: ShadingType.SOLID, color: COLORS.codeBlock, fill: COLORS.codeBlock },
            indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
            border: i === 0 ? {
                top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
                left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
                right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
            } : i === lines.length - 1 ? {
                bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
                left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
                right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
            } : {
                left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
                right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder },
            },
        }));
    });
    return children;
}

function tableHeaderCell(text) {
    return new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: COLORS.white })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 60 },
        })],
        shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
        borders: thinBorder(COLORS.primary),
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });
}

function tableDataCell(text, shade = COLORS.white, bold = false, color = COLORS.textDark) {
    // Parse inline code backticks
    const parts = text.split(/(`[^`]+`)/g);
    const runs = parts.map(p => {
        if (p.startsWith("`") && p.endsWith("`")) {
            return new TextRun({
                text: p.slice(1, -1), font: MONO, size: 18, color: COLORS.primary,
                shading: { type: ShadingType.SOLID, color: COLORS.codeBlock, fill: COLORS.codeBlock }
            });
        }
        return new TextRun({ text: p, font: FONT, size: 20, bold, color });
    });
    return new TableCell({
        children: [new Paragraph({
            children: runs,
            spacing: { before: 60, after: 60 },
        })],
        shading: { type: ShadingType.SOLID, color: shade, fill: shade },
        borders: thinBorder(COLORS.tableBorder),
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });
}

// ─── Cover Page ───────────────────────────────────────────────────────────────
function coverPage() {
    return [
        spacer(80),
        new Paragraph({
            children: [new TextRun({ text: "OTTOLEARN COURSE PLATFORM", font: FONT, size: 24, color: COLORS.accent, bold: true, allCaps: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
        }),
        new Paragraph({
            children: [new TextRun({ text: "Frontend–Backend Binding Layer", font: FONT, size: 64, bold: true, color: COLORS.primary })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 120 },
        }),
        new Paragraph({
            children: [new TextRun({ text: "Technical Handover Document", font: FONT, size: 36, color: COLORS.accent, italics: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
        }),
        hrParagraph(),
        spacer(20),
        new Paragraph({
            children: [new TextRun({ text: "Audience: ", font: FONT, size: 22, bold: true, color: COLORS.textDark }), new TextRun({ text: "Frontend Engineering Team", font: FONT, size: 22, color: COLORS.textDark })],
            alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
        }),
        new Paragraph({
            children: [new TextRun({ text: "Project: ", font: FONT, size: 22, bold: true, color: COLORS.textDark }), new TextRun({ text: "Ottolearn Course Platform", font: FONT, size: 22, color: COLORS.textDark })],
            alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
        }),
        new Paragraph({
            children: [new TextRun({ text: "Date: ", font: FONT, size: 22, bold: true, color: COLORS.textDark }), new TextRun({ text: "February 2026", font: FONT, size: 22, color: COLORS.textDark })],
            alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
        }),
        spacer(40),
        new Paragraph({
            children: [new TextRun({ text: "Purpose: Explain the architectural refactoring of how the frontend communicates with the backend", font: FONT, size: 20, italics: true, color: COLORS.textMid })],
            alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
        }),
        // Page break
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 1: Before ────────────────────────────────────────────────────────
function section1() {
    return [
        heading1("Section 1 — Before the Binding Layer"),
        heading2("How the Frontend Was Communicating With the Backend"),
        bodyText("Before the binding layer existed, API calls were written directly inside components, hooks, and pages. Each developer who needed to call an endpoint would write a fetch() call wherever they needed it."),
        bodyText("A typical pattern looked like this:"),
        spacer(4),
        ...codeBlock([
            "// Inside a React component or hook — BEFORE",
            "const response = await fetch(`http://localhost:4000/courses/${courseId}`, {",
            "    method: \"GET\",",
            "    headers: {",
            "        \"Content-Type\": \"application/json\",",
            "        \"Authorization\": `Bearer ${token}`,",
            "    },",
            "});",
            "",
            "if (!response.ok) {",
            "    throw new Error(\"Failed to fetch course\");",
            "}",
            "",
            "const data = await response.json();",
        ]),
        spacer(8),
        heading2("Where These Calls Were Placed"),
        bulletPoint("Directly inside useEffect() hooks in page components"),
        bulletPoint("Inside custom hooks like useCourse(), useCart(), useProgress()"),
        bulletPoint("Inside event handlers (e.g., button click → fetch → update state)"),
        bulletPoint("Sometimes inside utility files, but with no consistent structure"),
        spacer(4),
        heading2("How Types Were Handled"),
        bodyText("Types were defined locally — wherever the fetch call lived. If CoursePlayerPage needed a Course type, it defined it in that file. If CourseListPage also needed a Course type, it defined it again — possibly differently."),
        spacer(4),
        ...codeBlock([
            "// CoursePlayerPage.tsx — defined its own Course type",
            "interface Course {",
            "    id: string;",
            "    title: string;",
            "    slug: string;",
            "}",
            "",
            "// CourseListPage.tsx — defined its own Course type, slightly different",
            "interface Course {",
            "    courseId: string;    // ← different field name",
            "    name: string;        // ← different field name",
            "    slug: string;",
            "}",
        ]),
        spacer(8),
        heading2("Problems This Created"),
        // Problems table
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("#"), tableHeaderCell("Problem"), tableHeaderCell("Impact")] }),
                new TableRow({ children: [tableDataCell("1", COLORS.tableAlt, true, COLORS.accent), tableDataCell("Tight Coupling", COLORS.tableAlt, true), tableDataCell("URL/method changes required updates in every component", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("2", COLORS.white, true, COLORS.accent), tableDataCell("Scattered API Calls", COLORS.white, true), tableDataCell("No single map of the API surface — calls spread across 20+ files", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("3", COLORS.tableAlt, true, COLORS.accent), tableDataCell("Duplicate Error Handling", COLORS.tableAlt, true), tableDataCell("Inconsistent behavior — some checked response.ok, some didn't", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("4", COLORS.white, true, COLORS.accent), tableDataCell("Duplicate Auth Headers", COLORS.white, true), tableDataCell("Authorization: Bearer added manually in every fetch call", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("5", COLORS.tableAlt, true, COLORS.accent), tableDataCell("Inconsistent Types", COLORS.tableAlt, true), tableDataCell("Same data shape defined multiple times with different field names", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("6", COLORS.white, true, COLORS.accent), tableDataCell("No Centralized Contract", COLORS.white, true), tableDataCell("No single source of truth for what the backend returns", COLORS.white)] }),
            ],
        }),
        spacer(8),
        heading2("Old Communication Flow"),
        ...codeBlock([
            "Component",
            "    │",
            "    ├── writes fetch() directly",
            "    ├── builds URL manually",
            "    ├── adds auth headers manually",
            "    ├── handles errors locally",
            "    └── defines types locally",
            "    │",
            "    ▼",
            "Backend API (Express)",
        ]),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 2: After ─────────────────────────────────────────────────────────
function section2() {
    return [
        heading1("Section 2 — After the Binding Layer"),
        heading2("What the Binding Layer Is"),
        bodyText("The binding layer is a dedicated folder at frontend/src/lib/binding/ that centralizes all frontend-to-backend communication. No component talks to the backend directly anymore."),
        spacer(4),
        ...codeBlock([
            "frontend/src/lib/binding/",
            "├── client.ts              ← The HTTP client (fetch, auth, errors)",
            "├── index.ts               ← Single export point for everything",
            "└── actions/",
            "    ├── authActions.ts     ← All auth-related API calls",
            "    ├── courseActions.ts   ← All course-related API calls",
            "    ├── lessonActions.ts   ← All lesson progress API calls",
            "    ├── cartActions.ts     ← All cart API calls",
            "    ├── quizActions.ts     ← All quiz API calls",
            "    ├── dashboardActions.ts← All dashboard API calls",
            "    ├── assistantActions.ts← All AI assistant API calls",
            "    ├── coldCallActions.ts ← All cold call API calls",
            "    └── registrationActions.ts ← All registration API calls",
        ]),
        spacer(8),
        heading2("The Core: client.ts"),
        bodyText("The APIClient class in client.ts is the single HTTP client for the entire frontend. It handles:"),
        bulletPoint("Building the full URL from a path (/courses → http://localhost:4000/courses)"),
        bulletPoint("Adding Content-Type: application/json to every request"),
        bulletPoint("Adding Authorization: Bearer <token> when a session is provided"),
        bulletPoint("Parsing the response as JSON"),
        bulletPoint("Handling non-JSON responses (204 No Content, etc.)"),
        bulletPoint("Parsing error responses into proper Error objects with status codes"),
        spacer(4),
        ...codeBlock([
            "// client.ts — the single HTTP client",
            "export class APIClient {",
            "    async request<T>(",
            "        path: string,",
            "        options: RequestOptions = {},",
            "        session?: Session | null",
            "    ): Promise<T> {",
            "        const headers: Record<string, string> = {",
            "            \"Content-Type\": \"application/json\",",
            "            ...options.headers,",
            "        };",
            "",
            "        if (session?.accessToken) {",
            "            headers.Authorization = `Bearer ${session.accessToken}`;",
            "        }",
            "",
            "        const response = await fetch(buildApiUrl(path), {",
            "            method: options.method || \"GET\",",
            "            headers,",
            "            body: options.body ? JSON.stringify(options.body) : undefined,",
            "            signal: options.signal,",
            "            credentials: \"include\",",
            "        });",
            "",
            "        if (!response.ok) {",
            "            throw await this.handleError(response);",
            "        }",
            "",
            "        return response.json();",
            "    }",
            "}",
            "",
            "export const apiClient = new APIClient(); // singleton",
        ]),
        spacer(8),
        heading2("The Actions: One File Per Domain"),
        bodyText("Each action file contains all the API calls for one domain area. Each function accepts typed parameters, calls apiClient.request<T>() with the correct path, method, and body, and returns a typed response."),
        spacer(4),
        ...codeBlock([
            "// courseActions.ts — example of an action function",
            "export async function fetchCourses(session: Session): Promise<Course[]> {",
            "    const data = await apiClient.request<{ courses: Course[] }>(",
            "        \"/courses\",",
            "        {},",
            "        session",
            "    );",
            "    return data.courses || [];",
            "}",
        ]),
        spacer(8),
        heading2("How Components Use It Now"),
        ...codeBlock([
            "// CoursePlayerPage.tsx — AFTER",
            "import { fetchCourse, fetchCourseSections } from \"@/lib/binding\";",
            "",
            "// Inside the component:",
            "const course = await fetchCourse(courseKey, session);",
            "const sections = await fetchCourseSections(courseKey, session);",
        ]),
        spacer(8),
        heading2("New Communication Flow"),
        ...codeBlock([
            "Component",
            "    │",
            "    └── imports from @/lib/binding",
            "            │",
            "            ▼",
            "    Action Function (e.g., fetchCourse)",
            "            │",
            "            └── calls apiClient.request<T>()",
            "                        │",
            "                        ├── builds URL via buildApiUrl()",
            "                        ├── adds auth headers",
            "                        ├── serializes body",
            "                        └── handles errors",
            "                        │",
            "                        ▼",
            "            Backend API (Express)",
        ]),
        spacer(8),
        heading2("Before vs After Comparison"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("Concern"), tableHeaderCell("Before"), tableHeaderCell("After")] }),
                new TableRow({ children: [tableDataCell("Where API calls live", COLORS.tableAlt, true), tableDataCell("Scattered across 20+ files", COLORS.tableAlt), tableDataCell("Centralized in binding/actions/", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Auth headers", COLORS.white, true), tableDataCell("Added manually in every fetch", COLORS.white), tableDataCell("Handled once in APIClient", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Error handling", COLORS.tableAlt, true), tableDataCell("Each component handles its own", COLORS.tableAlt), tableDataCell("Handled once in APIClient.handleError()", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("URL construction", COLORS.white, true), tableDataCell("Hardcoded strings everywhere", COLORS.white), tableDataCell("buildApiUrl() called once", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("TypeScript types", COLORS.tableAlt, true), tableDataCell("Defined locally, often duplicated", COLORS.tableAlt), tableDataCell("Defined once per domain in action files", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Changing a URL", COLORS.white, true), tableDataCell("Find and update every component", COLORS.white), tableDataCell("Update one line in one action file", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Changing auth mechanism", COLORS.tableAlt, true), tableDataCell("Update every fetch call", COLORS.tableAlt), tableDataCell("Update one place in client.ts", COLORS.tableAlt)] }),
            ],
        }),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 3: Refactoring Details ──────────────────────────────────────────
function section3() {
    return [
        heading1("Section 3 — What Was Refactored and Why"),
        heading2("What Was Extracted Into the Binding Layer"),
        numberedItem("**All fetch() calls** — extracted into action functions", 1),
        numberedItem("**URL construction** — centralized in buildApiUrl() + APIClient", 2),
        numberedItem("**Auth header logic** — centralized in APIClient.request()", 3),
        numberedItem("**Error parsing logic** — centralized in APIClient.handleError()", 4),
        numberedItem("**Request/response TypeScript interfaces** — defined once per domain in action files", 5),
        numberedItem("**Response unwrapping** — e.g., data.courses || [] done in the action, not the component", 6),
        spacer(8),
        heading2("What Was NOT Moved"),
        bodyText("Business logic was NOT moved into the binding layer. The binding layer is only responsible for communication. The following stayed in components and hooks:"),
        bulletPoint("Deciding when to fetch (on mount, on user action, on dependency change)"),
        bulletPoint("Combining data from multiple API calls"),
        bulletPoint("Transforming data for display (formatting dates, calculating totals)"),
        bulletPoint("Managing loading/error state in UI"),
        bulletPoint("Deciding what to show based on the response"),
        spacer(4),
        bodyText("Backend logic was NOT touched. The binding layer is a frontend concern only. The backend's Express routes, services, repositories, and database queries are completely unchanged by this refactoring."),
        spacer(8),
        heading2("Why Each Separation Was Made"),
        heading3("Why extract API calls?"),
        bodyText("So that if the backend changes a URL, method, or response shape, there is exactly one place to update in the frontend — not 10."),
        heading3("Why keep business logic in components?"),
        bodyText("Business logic belongs close to where it's used. A component that decides \"show a lock icon if the quiz is not unlocked\" is making a UI decision, not an API decision. That logic should stay in the component."),
        heading3("Why not move Prisma/database logic?"),
        bodyText("Prisma is a backend tool. The frontend has no knowledge of the database. The binding layer communicates over HTTP — it has no direct database connection and never will."),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 4: Eligibility Rules ────────────────────────────────────────────
function section4() {
    return [
        heading1("Section 4 — What Belongs in the Binding Layer"),
        heading2("✅ Belongs in the Binding Layer"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("Item"), tableHeaderCell("Example")] }),
                new TableRow({ children: [tableDataCell("API request functions", COLORS.tableAlt, true), tableDataCell("fetchCourses(), addToCart(), submitQuizAttempt()", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Request/response TypeScript types", COLORS.white, true), tableDataCell("Course, QuizSection, LessonProgress", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("HTTP method, URL, body definition", COLORS.tableAlt, true), tableDataCell("method: \"POST\", \"/cart\", body: { course: courseData }", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Auth token injection", COLORS.white, true), tableDataCell("headers.Authorization = Bearer ${token}", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Error response parsing", COLORS.tableAlt, true), tableDataCell("APIClient.handleError()", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Response unwrapping", COLORS.white, true), tableDataCell("return data.courses || []", COLORS.white)] }),
            ],
        }),
        spacer(12),
        heading2("❌ Does NOT Belong in the Binding Layer"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("Item"), tableHeaderCell("Why Not"), tableHeaderCell("Where It Belongs")] }),
                new TableRow({ children: [tableDataCell("Business rules", COLORS.tableAlt, true), tableDataCell("Not an API concern", COLORS.tableAlt), tableDataCell("Services / components", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Prisma queries", COLORS.white, true), tableDataCell("Backend only", COLORS.white), tableDataCell("Backend repositories", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Database models", COLORS.tableAlt, true), tableDataCell("Backend only", COLORS.tableAlt), tableDataCell("Backend schema", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("UI state management", COLORS.white, true), tableDataCell("Not an API concern", COLORS.white), tableDataCell("Components / hooks", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Data transformation for display", COLORS.tableAlt, true), tableDataCell("Not an API concern", COLORS.tableAlt), tableDataCell("Components / utils", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("External SDK logic (e.g., Stripe)", COLORS.white, true), tableDataCell("Not a backend HTTP call", COLORS.white), tableDataCell("Dedicated gateway/service", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Caching logic", COLORS.tableAlt, true), tableDataCell("Not an API concern", COLORS.tableAlt), tableDataCell("React Query / hooks", COLORS.tableAlt)] }),
            ],
        }),
        spacer(8),
        heading2("Architecture Diagram"),
        ...codeBlock([
            "┌─────────────────────────────────────────────────────────┐",
            "│  FRONTEND                                               │",
            "│                                                         │",
            "│  ┌──────────────┐    ┌──────────────┐                  │",
            "│  │  Components  │    │    Hooks     │  ← UI logic       │",
            "│  │  & Pages     │    │  & Context   │    state mgmt     │",
            "│  └──────┬───────┘    └──────┬───────┘                  │",
            "│         └─────────┬─────────┘                           │",
            "│                   │ imports from                        │",
            "│                   ▼                                     │",
            "│  ┌────────────────────────────────┐                     │",
            "│  │      Binding Layer             │  ← HTTP calls,      │",
            "│  │  frontend/src/lib/binding/     │    types, auth      │",
            "│  └────────────────┬───────────────┘                     │",
            "│                   │ HTTP                                │",
            "└───────────────────┼─────────────────────────────────────┘",
            "                    │",
            "                    ▼",
            "┌─────────────────────────────────────────────────────────┐",
            "│  BACKEND (Express)                                      │",
            "│  Routes → Services → Repositories → Database            │",
            "└─────────────────────────────────────────────────────────┘",
        ]),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 5: Pros and Cons ─────────────────────────────────────────────────
function section5() {
    return [
        heading1("Section 5 — Pros and Cons"),
        heading2("✅ Pros"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("Benefit"), tableHeaderCell("Explanation")] }),
                new TableRow({ children: [tableDataCell("Single source of truth for API calls", COLORS.tableAlt, true), tableDataCell("New developers can open binding/actions/ and immediately see the full API surface the frontend depends on.", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Auth is handled automatically", COLORS.white, true), tableDataCell("Pass a session object to any action function and the Authorization header is added automatically. Never write Bearer token manually again.", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Consistent error handling", COLORS.tableAlt, true), tableDataCell("All API errors are parsed the same way. The error object always has a .status and a .message.", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Type safety at the boundary", COLORS.white, true), tableDataCell("Every action function has typed parameters and a typed return value. TypeScript catches wrong arguments at compile time.", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Easy to change backend contracts", COLORS.tableAlt, true), tableDataCell("If the backend changes /courses to /api/v2/courses, update one line in courseActions.ts. All components pick up the change automatically.", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Testable in isolation", COLORS.white, true), tableDataCell("Mock the binding layer in component tests instead of mocking fetch() globally. Control exactly what each action returns.", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Scales to multiple clients", COLORS.tableAlt, true), tableDataCell("If a mobile app is added later, it can import the same action functions instead of rewriting all API calls.", COLORS.tableAlt)] }),
            ],
        }),
        spacer(12),
        heading2("❌ Cons"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("Limitation"), tableHeaderCell("Explanation")] }),
                new TableRow({ children: [tableDataCell("Extra layer of indirection", COLORS.tableAlt, true), tableDataCell("To understand what happens when a component fetches data, you now look in two places: the component (when) and the action file (how).", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Requires team discipline", COLORS.white, true), tableDataCell("If one developer writes a direct fetch() call in a component, the contract is broken. The team must enforce: all API calls go through the binding layer.", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Types are manually maintained", COLORS.tableAlt, true), tableDataCell("TypeScript interfaces in action files are written by hand. If the backend changes a field name and no one updates the action file, the mismatch only shows at runtime.", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("More boilerplate for simple calls", COLORS.white, true), tableDataCell("For a one-off API call, writing an action function feels like more work than writing fetch() inline. The benefit only becomes clear when the call is reused or the backend changes.", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("Learning curve for new developers", COLORS.tableAlt, true), tableDataCell("Developers must learn the pattern: find the right action file, add a function, export from index.ts, import in the component.", COLORS.tableAlt)] }),
            ],
        }),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 6: Exact Changes ─────────────────────────────────────────────────
function section6() {
    return [
        heading1("Section 6 — Exact Changes Made to the Frontend Code"),
        heading2("Files Added"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("File"), tableHeaderCell("What It Does")] }),
                new TableRow({ children: [tableDataCell("binding/client.ts", COLORS.tableAlt, true), tableDataCell("APIClient class — the single HTTP client for the entire frontend", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("binding/index.ts", COLORS.white, true), tableDataCell("Re-exports everything from the binding layer (barrel export)", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("actions/authActions.ts", COLORS.tableAlt, true), tableDataCell("login, signup, logout, refreshToken, tutorLogin, submitTutorApplication", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("actions/courseActions.ts", COLORS.white, true), tableDataCell("fetchCourses, fetchCourse, fetchCourseSections, enrollInCourse, checkEnrollment", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("actions/lessonActions.ts", COLORS.tableAlt, true), tableDataCell("fetchLessonProgress, updateLessonProgress, fetchPersonalization, updatePersonalization", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("actions/cartActions.ts", COLORS.white, true), tableDataCell("fetchCart, addToCart, removeFromCart, clearCart", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("actions/quizActions.ts", COLORS.tableAlt, true), tableDataCell("fetchQuizSections, startQuizAttempt, submitQuizAttempt", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("actions/dashboardActions.ts", COLORS.white, true), tableDataCell("Dashboard data fetching functions", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("actions/assistantActions.ts", COLORS.tableAlt, true), tableDataCell("queryAssistant, queryLandingAssistant, fetchAssistantSession", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("actions/coldCallActions.ts", COLORS.white, true), tableDataCell("Cold call message functions", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("actions/registrationActions.ts", COLORS.tableAlt, true), tableDataCell("Course registration functions", COLORS.tableAlt)] }),
            ],
        }),
        spacer(12),
        heading2("What Changed in Existing Files"),
        bulletPoint("Components and pages that previously wrote fetch() directly now import from @/lib/binding"),
        bulletPoint("Import statements changed from local type definitions to imports from the binding layer"),
        bulletPoint("Inline type definitions that duplicated backend response shapes were removed from components"),
        spacer(8),
        heading2("What Was Removed"),
        bulletPoint("Direct fetch() calls inside components"),
        bulletPoint("Locally defined TypeScript interfaces that duplicated API response shapes"),
        bulletPoint("Manual Authorization header construction in individual components"),
        bulletPoint("Per-component error handling for HTTP errors"),
        spacer(8),
        heading2("What Was NOT Changed"),
        bulletPoint("Component rendering logic"),
        bulletPoint("State management (useState, useContext, React Query)"),
        bulletPoint("UI event handlers (the when to call, not the how)"),
        bulletPoint("All backend code (routes, services, repositories, database)"),
        bulletPoint("The frontend/src/lib/api.ts file (buildApiUrl utility — still used by client.ts)"),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Section 7: How to Use Going Forward ─────────────────────────────────────
function section7() {
    return [
        heading1("Section 7 — How to Use the Binding Layer Going Forward"),
        heading2("Rule 1: Never Write a Direct fetch() to the Backend in a Component"),
        ...codeBlock([
            "// ❌ WRONG — do not do this",
            "const response = await fetch(\"http://localhost:4000/courses\", {",
            "    headers: { Authorization: `Bearer ${token}` }",
            "});",
            "",
            "// ✅ CORRECT — use the binding layer",
            "import { fetchCourses } from \"@/lib/binding\";",
            "const courses = await fetchCourses(session);",
        ]),
        spacer(8),
        heading2("Rule 2: Adding a New Endpoint"),
        numberedItem("Find the relevant action file in frontend/src/lib/binding/actions/", 1),
        numberedItem("Add a new exported function", 2),
        numberedItem("Define the request parameters and return type", 3),
        numberedItem("Call apiClient.request<ReturnType>(path, options, session)", 4),
        numberedItem("It is automatically available via @/lib/binding (already re-exported in index.ts)", 5),
        spacer(4),
        ...codeBlock([
            "// Example: adding a new endpoint to courseActions.ts",
            "export async function fetchCourseReviews(",
            "    courseId: string,",
            "    session: Session",
            "): Promise<Review[]> {",
            "    const data = await apiClient.request<{ reviews: Review[] }>(",
            "        `/courses/${courseId}/reviews`,",
            "        {},",
            "        session",
            "    );",
            "    return data.reviews || [];",
            "}",
        ]),
        spacer(8),
        heading2("Rule 3: Authenticated vs Public Endpoints"),
        bulletPoint("**Authenticated endpoint**: pass session as the third argument to apiClient.request()"),
        bulletPoint("**Public endpoint**: omit session or pass null"),
        spacer(4),
        ...codeBlock([
            "// Authenticated",
            "apiClient.request<Course[]>(\"/courses\", {}, session);",
            "",
            "// Public (no auth needed)",
            "apiClient.request<{ answer: string }>(\"/api/landing-assistant/query\", {",
            "    method: \"POST\",",
            "    body: { question }",
            "});",
        ]),
        spacer(8),
        heading2("Rule 4: Always Import from the Barrel Export"),
        ...codeBlock([
            "// ✅ CORRECT",
            "import { fetchCourses, fetchCart, login } from \"@/lib/binding\";",
            "",
            "// ❌ AVOID — importing from internal files directly",
            "import { fetchCourses } from \"@/lib/binding/actions/courseActions\";",
        ]),
        spacer(8),
        new Paragraph({ pageBreakBefore: true }),
    ];
}

// ─── Summary Table ─────────────────────────────────────────────────────────────
function summarySection() {
    return [
        heading1("Summary"),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
                new TableRow({ children: [tableHeaderCell("Topic"), tableHeaderCell("Answer")] }),
                new TableRow({ children: [tableDataCell("What changed", COLORS.tableAlt, true), tableDataCell("All frontend API calls are now centralized in frontend/src/lib/binding/", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Why", COLORS.white, true), tableDataCell("Eliminate scattered fetch calls, duplicate types, and inconsistent error handling", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("What you need to do", COLORS.tableAlt, true), tableDataCell("Import from @/lib/binding instead of writing fetch calls in components", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("What you must NOT do", COLORS.white, true), tableDataCell("Write direct fetch() calls to the backend in components or hooks", COLORS.white)] }),
                new TableRow({ children: [tableDataCell("What stayed the same", COLORS.tableAlt, true), tableDataCell("All backend code, all component rendering logic, all state management", COLORS.tableAlt)] }),
                new TableRow({ children: [tableDataCell("Biggest limitation", COLORS.white, true), tableDataCell("Types are still manually maintained — backend changes must be manually reflected in action files", COLORS.white)] }),
            ],
        }),
        spacer(8),
    ];
}

// ─── Build Document ───────────────────────────────────────────────────────────
async function buildDocument() {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: FONT, size: 22, color: COLORS.textDark },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1.0),
                        bottom: convertInchesToTwip(1.0),
                        left: convertInchesToTwip(1.2),
                        right: convertInchesToTwip(1.2),
                    },
                },
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Ottolearn Course Platform  |  Frontend Binding Layer — Technical Handover", font: FONT, size: 18, color: COLORS.textMid }),
                            ],
                            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder } },
                            spacing: { after: 80 },
                        }),
                    ],
                }),
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Confidential — Frontend Team Internal Document  |  Page ", font: FONT, size: 18, color: COLORS.textMid }),
                                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: COLORS.textMid }),
                                new TextRun({ text: " of ", font: FONT, size: 18, color: COLORS.textMid }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: COLORS.textMid }),
                            ],
                            alignment: AlignmentType.CENTER,
                            border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.codeBorder } },
                            spacing: { before: 80 },
                        }),
                    ],
                }),
            },
            children: [
                ...coverPage(),
                ...section1(),
                ...section2(),
                ...section3(),
                ...section4(),
                ...section5(),
                ...section6(),
                ...section7(),
                ...summarySection(),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    const outPath = path.join(__dirname, "Frontend_Binding_Layer_Handover.docx");
    fs.writeFileSync(outPath, buffer);
    console.log("SUCCESS: " + outPath);
}

buildDocument().catch(err => {
    console.error("❌ Error generating document:", err);
    process.exit(1);
});
