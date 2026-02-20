import { PrismaClient } from "@prisma/client";
import { IColdCallRepository, ColdCallPrompt, ColdCallMessageWithUser } from "../interfaces/IColdCallRepository";
import { prisma } from "../../services/prisma";

export class ColdCallRepository implements IColdCallRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async findPromptByTopic(topicId: string): Promise<ColdCallPrompt | null> {
        const prompt = await this.db.coldCallPrompt.findFirst({
            where: { topicId, isActive: true },
            orderBy: [{ displayOrder: "asc" }],
            select: { promptId: true, courseId: true, topicId: true, promptText: true, helperText: true },
        });
        return prompt;
    }

    async findPromptById(promptId: string): Promise<ColdCallPrompt | null> {
        return this.db.coldCallPrompt.findUnique({
            where: { promptId },
            select: { promptId: true, courseId: true, topicId: true, promptText: true, helperText: true },
        });
    }

    async findTopLevelMessage(promptId: string, cohortId: string, userId: string): Promise<{ messageId: string } | null> {
        return this.db.coldCallMessage.findFirst({
            where: {
                promptId,
                cohortId,
                userId,
                parentId: null,
                status: "active",
            },
            select: { messageId: true },
        });
    }

    async findMessagesForPrompt(promptId: string, cohortId: string, currentUserId: string): Promise<ColdCallMessageWithUser[]> {
        // The query includes a check for stars by currentUserId to determine "starredByMe"
        const messages = await this.db.coldCallMessage.findMany({
            where: {
                promptId,
                cohortId,
                status: "active",
            },
            orderBy: [{ createdAt: "asc" }],
            select: {
                messageId: true,
                body: true,
                parentId: true,
                rootId: true,
                createdAt: true,
                userId: true, // Need this for ownership check logic if needed
                user: { select: { userId: true, fullName: true } },
                _count: { select: { stars: true } },
                stars: { where: { userId: currentUserId }, select: { starId: true } },
            },
        });
        return messages;
    }

    async findMessageById(messageId: string): Promise<{ messageId: string; promptId: string; cohortId: string; userId: string; rootId: string | null; status: string } | null> {
        return this.db.coldCallMessage.findUnique({
            where: { messageId },
            select: { messageId: true, promptId: true, cohortId: true, userId: true, rootId: true, status: true },
        });
    }

    async createMessage(data: { promptId: string; cohortId: string; userId: string; body: string; parentId?: string; rootId?: string }): Promise<{ messageId: string }> {
        return this.db.coldCallMessage.create({
            data: {
                promptId: data.promptId,
                cohortId: data.cohortId,
                userId: data.userId,
                body: data.body,
                parentId: data.parentId ?? null,
                rootId: data.rootId ?? null,
            },
            select: { messageId: true },
        });
    }

    async updateMessageRoot(messageId: string, rootId: string): Promise<void> {
        await this.db.coldCallMessage.update({
            where: { messageId },
            data: { rootId },
        });
    }

    async starMessage(messageId: string, userId: string): Promise<void> {
        await this.db.coldCallStar.upsert({
            where: {
                messageId_userId: {
                    messageId,
                    userId,
                },
            },
            update: {},
            create: { messageId, userId },
        });
    }

    async unstarMessage(messageId: string, userId: string): Promise<void> {
        await this.db.coldCallStar.deleteMany({
            where: { messageId, userId },
        });
    }
}
