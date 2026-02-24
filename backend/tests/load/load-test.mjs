/**
 * Load Test — Ottolearn Course Platform Backend
 * Tests: /health, /api/courses, /api/cart (auth-gated), /api/topics
 *
 * Uses only Node.js built-in `http` — no external dependencies.
 * Run: node tests/load/load-test.mjs
 */

import http from "http";

const BASE_HOST = "localhost";
const BASE_PORT = 4000;
const CONCURRENCY = 20;    // concurrent virtual users
const DURATION_MS = 8000;  // 8 second test window per endpoint

// ──────────────────────────────────────────────────
// Core HTTP request wrapper
// ──────────────────────────────────────────────────
function request(path, method = "GET", headers = {}) {
    return new Promise((resolve) => {
        const start = Date.now();
        const options = {
            hostname: BASE_HOST,
            port: BASE_PORT,
            path,
            method,
            headers: { "Content-Type": "application/json", ...headers },
        };

        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () =>
                resolve({ status: res.statusCode, latency: Date.now() - start, ok: res.statusCode < 400 })
            );
        });

        req.on("error", () =>
            resolve({ status: 0, latency: Date.now() - start, ok: false, error: true })
        );
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ status: 0, latency: 5000, ok: false, timedOut: true });
        });

        req.end();
    });
}

// ──────────────────────────────────────────────────
// Worker: continuous requests for DURATION_MS
// ──────────────────────────────────────────────────
async function worker(path, method, headers, endAt, results) {
    while (Date.now() < endAt) {
        const result = await request(path, method, headers);
        results.push(result);
    }
}

// ──────────────────────────────────────────────────
// Statistics calculator
// ──────────────────────────────────────────────────
function stats(results, durationMs) {
    const total = results.length;
    const successes = results.filter((r) => r.ok).length;
    const failures = total - successes;
    const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
    const avg = latencies.reduce((s, v) => s + v, 0) / (latencies.length || 1);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
    const rps = ((successes / durationMs) * 1000).toFixed(2);

    return { total, successes, failures, avg: avg.toFixed(1), p50, p95, p99, rps };
}

// ──────────────────────────────────────────────────
// Run one endpoint scenario
// ──────────────────────────────────────────────────
async function runScenario(name, path, method = "GET", headers = {}) {
    console.log(`\n▶  Running: ${name} [${method} ${path}] — ${CONCURRENCY} VUs / ${DURATION_MS / 1000}s`);
    const results = [];
    const endAt = Date.now() + DURATION_MS;
    const workers = Array.from({ length: CONCURRENCY }, () =>
        worker(path, method, headers, endAt, results)
    );
    await Promise.all(workers);
    const s = stats(results, DURATION_MS);

    console.log(`   Total Requests : ${s.total}`);
    console.log(`   Successes      : ${s.successes}`);
    console.log(`   Failures       : ${s.failures}`);
    console.log(`   Req/sec (RPS)  : ${s.rps}`);
    console.log(`   Avg Latency    : ${s.avg} ms`);
    console.log(`   p50 Latency    : ${s.p50} ms`);
    console.log(`   p95 Latency    : ${s.p95} ms`);
    console.log(`   p99 Latency    : ${s.p99} ms`);
    console.log(`   Error Rate     : ${((s.failures / s.total) * 100).toFixed(1)}%`);

    return { name, path, method, ...s };
}

// ──────────────────────────────────────────────────
// Connectivity check
// ──────────────────────────────────────────────────
async function checkHealth() {
    const result = await request("/health");
    if (!result.ok) {
        console.error(`\n✗ Backend not reachable on ${BASE_HOST}:${BASE_PORT}/health`);
        console.error("  → Start the backend with: tsx src/server.ts");
        console.error("  → Then re-run this script.\n");
        return false;
    }
    console.log(`✓ Backend reachable — /health responded in ${result.latency}ms`);
    return true;
}

// ──────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Ottolearn Course Platform — Load & Performance Test  ");
    console.log(`  Started: ${new Date().toISOString()}                 `);
    console.log("═══════════════════════════════════════════════════════");

    const healthy = await checkHealth();
    if (!healthy) process.exit(1);

    const scenarios = [
        { name: "Health Check Endpoint", path: "/health", method: "GET" },
        { name: "Public Courses List", path: "/api/courses", method: "GET" },
        { name: "Course Detail by Slug (simulated)", path: "/api/courses/intro-to-python", method: "GET" },
        { name: "Auth-Gated Cart (no token)", path: "/api/cart", method: "GET" },
        { name: "Non-existent Route (404)", path: "/api/does-not-exist", method: "GET" },
    ];

    const allResults = [];
    for (const s of scenarios) {
        const result = await runScenario(s.name, s.path, s.method, s.headers || {});
        allResults.push(result);
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  SUMMARY TABLE");
    console.log("═══════════════════════════════════════════════════════");
    console.log(
        `${"Endpoint".padEnd(40)} ${"RPS".padStart(8)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"p99".padStart(8)} ${"Errors".padStart(8)}`
    );
    console.log("─".repeat(82));
    for (const r of allResults) {
        const errPct = ((r.failures / r.total) * 100).toFixed(1) + "%";
        console.log(
            `${r.name.padEnd(40)} ${r.rps.padStart(8)} ${String(r.p50 + "ms").padStart(8)} ${String(r.p95 + "ms").padStart(8)} ${String(r.p99 + "ms").padStart(8)} ${errPct.padStart(8)}`
        );
    }
    console.log("─".repeat(82));
    console.log(`\n  Completed: ${new Date().toISOString()}`);
    console.log("═══════════════════════════════════════════════════════\n");

    // Write JSON results for documentation
    process.stdout.write(
        "\n__RESULTS_JSON__" + JSON.stringify(allResults) + "__END_RESULTS__\n"
    );
}

main().catch((e) => { console.error(e); process.exit(1); });
