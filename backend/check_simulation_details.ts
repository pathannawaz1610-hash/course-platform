
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const topics = await prisma.topic.findMany({
        where: {
            simulation: { isNot: null }
        },
        select: {
            topicId: true,
            topicName: true,
            simulation: {
                select: {
                    title: true,
                    body: true
                }
            }
        }
    });

    console.log("Topics with simulation:", topics.length);
    topics.forEach(t => {
        if (t.simulation) {
            console.log("------------------------------------------------");
            console.log(`Topic: ${t.topicName}`);
            console.log(`Simulation Title: ${t.simulation.title}`);
            console.log(`Body Keys:`, Object.keys(t.simulation.body as object));
            console.log(`Body Sample (scenario/context_story/goal):`);
            const body = t.simulation.body as any;
            console.log(`  - scenario: ${body.scenario}`);
            console.log(`  - context_story: ${body.context_story}`);
            console.log(`  - goal: ${body.goal}`);
        }
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
