
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const simulations = await prisma.simulationExercise.findMany({
        where: {
            title: { contains: "Module 1 Simulation", mode: "insensitive" }
        },
        include: {
            topic: true
        }
    });

    console.log("Found simulations:", simulations.length);
    simulations.forEach(s => {
        console.log("------------------------------------------------");
        console.log(`Simulation Title: ${s.title}`);
        console.log(`Topic ID: ${s.topicId}`);
        console.log(`Topic Name: ${s.topic.topicName}`);
        console.log(`Body Keys:`, Object.keys(s.body as object));
        console.log(`Body:`, JSON.stringify(s.body, null, 2));
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
