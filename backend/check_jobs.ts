
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const jobs = await prisma.backgroundJob.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    console.log("Recent Background Jobs:");
    jobs.forEach((job) => {
        console.log({
            id: job.jobId,
            type: job.jobType,
            status: job.status,
            attempts: job.attempts,
            error: job.errorMessage,
            result: job.result,
            created: job.createdAt,
            updated: job.updatedAt,
        });
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
