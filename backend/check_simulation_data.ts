
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const topics = await prisma.topic.findMany({
        where: {
            moduleNo: 1
        },
        select: {
            topicId: true,
            topicName: true,
            moduleNo: true,
            contentType: true,
            simulation: true
        }
    });

    console.log("Found topics in Module 1:", topics.length);
    topics.forEach(t => {
        console.log("------------------------------------------------");
        console.log(`Topic: ${t.topicName} (ID: ${t.topicId})`);
        console.log(`Module: ${t.moduleNo}`);
        console.log(`Type: ${t.contentType}`);
        console.log("Simulation Data:", t.simulation ? "PRESENT (length: " + JSON.stringify(t.simulation).length + ")" : "NULL");
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
