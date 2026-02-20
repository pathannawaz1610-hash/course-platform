
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/services/prisma";

async function generateSnapshots() {
    console.log("Starting snapshot generation...");

    // Connect to DB (needed for createApp to work if it relies on side-effects, 
    // though strictly createApp just returns express app)
    // We assume the app uses the singleton prisma instance.
    try {
        await prisma.$connect();
    } catch (e) {
        console.warn("Could not connect to DB, some tests might fail if they need strictly live DB", e);
    }

    const app = createApp();
    const snapshots: Record<string, any> = {};

    // 1. GET /api/courses (Public)
    console.log("Snapshotting GET /api/courses...");
    const coursesRes = await request(app).get("/api/courses");
    snapshots["GET /api/courses"] = {
        status: coursesRes.status,
        type: coursesRes.type,
        body: typeof coursesRes.body === 'object' ? {
            ...coursesRes.body,
            // Mask dynamic dates or variable fields if necessary, 
            // but for "current state" we want to see what it returns.
            // We might truncate lists to avoid huge files.
            courses: coursesRes.body.courses ? coursesRes.body.courses.slice(0, 1) : []
        } : coursesRes.body
    };

    // 2. GET /api/health (Public)
    console.log("Snapshotting GET /api/health...");
    const healthRes = await request(app).get("/api/health");
    snapshots["GET /api/health"] = {
        status: healthRes.status,
        body: healthRes.body
    };

    // 3. GET /api/cold-call/prompts/fake-id (Auth Required -> Expect 401)
    console.log("Snapshotting GET /api/cold-call/prompts/fake-id (Expect 401)...");
    const coldCallRes = await request(app).get("/api/cold-call/prompts/fake-id");
    snapshots["GET /api/cold-call/prompts/fake-id"] = {
        status: coldCallRes.status,
        body: coldCallRes.body
    };

    // 4. POST /api/tutors/login (Validation Error)
    console.log("Snapshotting POST /api/tutors/login (Validation Error)...");
    const loginRes = await request(app).post("/api/tutors/login").send({});
    snapshots["POST /api/tutors/login"] = {
        status: loginRes.status,
        body: loginRes.body
    };

    // Save to file
    const snapshotPath = path.join(process.cwd(), "tests/snapshots/baseline.json");
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(snapshots, null, 2));

    console.log(`Snapshots saved to ${snapshotPath}`);

    await prisma.$disconnect();
}

generateSnapshots().catch(err => {
    console.error("Snapshot generation failed:", err);
    process.exit(1);
});
