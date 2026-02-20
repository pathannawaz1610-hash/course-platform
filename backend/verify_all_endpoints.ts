
const API_BASE = 'http://localhost:4000/api';
const COURSE_KEY = 'ai-native-fullstack-developer';

async function check(name: string, url: string, method: string = 'GET', body: any = null) {
    process.stdout.write(`Checking ${name}... `);
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : null
        });
        if (res.ok) {
            const data = await res.json();
            console.log(`✅ OK (${res.status})`);
            return data;
        } else {
            console.log(`❌ FAIL (${res.status})`);
            const text = await res.text();
            console.log(`   Response: ${text.slice(0, 100)}`);
            return null;
        }
    } catch (e: any) {
        console.log(`❌ ERROR: ${e.message}`);
        return null;
    }
}

async function runVerification() {
    console.log("=== STARTING FINAL SYSTEM-WIDE VERIFICATION ===");

    await check("Health Check", `${API_BASE}/health`);
    await check("Courses List", `${API_BASE}/courses`);

    const topicsData = await check("Topics for Course", `${API_BASE}/lessons/courses/${COURSE_KEY}/topics`);
    if (topicsData && topicsData.topics) {
        const sim = topicsData.topics.find((t: any) => t.simulation);
        if (sim) console.log(`   ✅ Verified Simulation Data exists for: ${sim.topicName}`);
    }

    await check("About Page Content", `${API_BASE}/pages/about`);
    await check("Cart (Requires Auth)", `${API_BASE}/cart`);
    await check("Assistant Session (Requires Auth)", `${API_BASE}/assistant/session?courseId=${COURSE_KEY}&topicId=mock-id`);
    await check("Quiz (Requires Auth)", `${API_BASE}/quiz/some-quiz-id`);
    await check("Dashboard (Requires Auth)", `${API_BASE}/dashboard/stats`);

    console.log("=== FINAL VERIFICATION COMPLETE ===");
}

runVerification();
