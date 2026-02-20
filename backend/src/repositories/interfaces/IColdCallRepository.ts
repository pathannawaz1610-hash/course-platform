export interface ColdCallPrompt {
    promptId: string;
    courseId: string;
    topicId: string;
    promptText: string;
    helperText: string | null;
}

export interface ColdCallMessageWithUser {
    messageId: string;
    body: string;
    parentId: string | null;
    rootId: string | null;
    createdAt: Date;
    userId: string;
    user: {
        userId: string;
        fullName: string;
    };
    _count: { stars: number };
    stars: { starId: string }[]; // Used to check if starred by current user
}

export interface IColdCallRepository {
    findPromptByTopic(topicId: string): Promise<ColdCallPrompt | null>;
    findPromptById(promptId: string): Promise<ColdCallPrompt | null>;

    findTopLevelMessage(promptId: string, cohortId: string, userId: string): Promise<{ messageId: string } | null>;

    findMessagesForPrompt(promptId: string, cohortId: string, currentUserId: string): Promise<ColdCallMessageWithUser[]>;

    findMessageById(messageId: string): Promise<{ messageId: string; promptId: string; cohortId: string; userId: string; rootId: string | null; status: string } | null>;

    createMessage(data: { promptId: string; cohortId: string; userId: string; body: string; parentId?: string; rootId?: string }): Promise<{ messageId: string }>;

    updateMessageRoot(messageId: string, rootId: string): Promise<void>;

    starMessage(messageId: string, userId: string): Promise<void>;
    unstarMessage(messageId: string, userId: string): Promise<void>;
}
