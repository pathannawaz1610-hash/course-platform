
const API_BASE = 'http://localhost:4000/api';
const COURSE_KEY = 'ai-native-fullstack-developer';

async function verifyLearningFlow() {
    console.log("=== Verifying Learning Flow ===");

    try {
        // 1. Fetch Topics
        console.log(`Searching for topics for course: ${COURSE_KEY}...`);
        const topicsRes = await fetch(`${API_BASE}/lessons/courses/${COURSE_KEY}/topics`);
        if (!topicsRes.ok) {
            throw new Error(`Failed to fetch topics: ${topicsRes.status} ${topicsRes.statusText}`);
        }
        const topics = await topicsRes.json() as any[];

        if (!Array.isArray(topics) || topics.length === 0) {
            throw new Error("No topics found or invalid response format");
        }
        console.log(`✅ Fetched ${topics.length} topics.`);

        // 2. Check Simulation Data
        const simulationTopic = topics.find(t => t.simulation !== null);
        if (simulationTopic) {
            console.log(`✅ Found simulation topic: ${simulationTopic.topicName}`);
            const body = simulationTopic.simulation.body;
            if (!body || typeof body !== 'object') {
                throw new Error(`Simulation body for ${simulationTopic.topicName} is not an object! Received: ${typeof body}`);
            }
            console.log(`✅ Simulation body is a valid object with keys: ${Object.keys(body).join(', ')}`);

            // Check for Module 1 Simulation specifically
            if (simulationTopic.simulation.title.includes("Module 1 Simulation")) {
                console.log(`✅ Confirmed Module 1 Simulation is present with title: ${simulationTopic.simulation.title}`);
            }
        } else {
            console.log("⚠️ No simulation topics found in this course.");
        }

        // 3. Verify Lesson Content types
        const contentTypes = new Set(topics.map(t => t.contentType));
        console.log(`✅ Topics contain content types: ${Array.from(contentTypes).join(', ')}`);

        console.log("=== Learning Flow Verification Complete ===");
    } catch (error: any) {
        console.error("❌ Learning Flow Verification FAILED:", error.message);
        process.exit(1);
    }
}

verifyLearningFlow();
