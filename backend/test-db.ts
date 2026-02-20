import { prisma } from "./src/services/prisma";
import { env } from "./src/config/env";

async function testConnection() {
    const dbUrl = new URL(env.databaseUrl);
    console.log(`Connecting to database at ${dbUrl.host}...`);
    try {
        await prisma.$connect();
        console.log("Connection successful!");
    } catch (error) {
        console.error("Connection failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
