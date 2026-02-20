
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const courseId = 'f26180b2-5dda-495a-a014-ae02e63f172f';
    const count = await prisma.topic.count({ where: { courseId } });
    console.log(`Topics for course ${courseId}: ${count}`);

    if (count > 0) {
        const first = await prisma.topic.findFirst({ where: { courseId }, select: { topicName: true, moduleNo: true } });
        console.log(`Sample topic: ${first?.topicName} in Module ${first?.moduleNo}`);
    }
}

main().finally(() => prisma.$disconnect());
