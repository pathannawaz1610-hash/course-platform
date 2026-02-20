
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
            console.log(`Body Type: ${typeof t.simulation.body}`);
            console.log(`Is Array: ${Array.isArray(t.simulation.body)}`);
            console.log(`Raw Body (first 500 chars):`, JSON.stringify(t.simulation.body).slice(0, 500));

            if (typeof t.simulation.body === 'string') {
                try {
                    const parsed = JSON.parse(t.simulation.body);
                    console.log(`Parsed Body Type: ${typeof parsed}`);
                    console.log(`Parsed Body Keys:`, Object.keys(parsed));
                } catch (e) {
                    console.log("Could not parse body as JSON");
                }
            } else if (t.simulation.body && typeof t.simulation.body === 'object') {
                console.log(`Body Keys:`, Object.keys(t.simulation.body as object));
            }
        }
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
