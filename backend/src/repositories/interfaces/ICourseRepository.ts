export type CourseSummary = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    price: number;
    priceCents: number;
    createdAt: string;
};

export type CourseDetails = {
    courseId: string;
    courseName: string;
    slug: string;
    description: string | null;
    priceCents: number;
    createdAt: Date;
    // Add other fields as needed
};

export type TopicSummary = {
    topicId: string;
    courseId: string;
    moduleNo: number;
    moduleName: string;
    topicNumber: number;
    topicName: string;
    pptUrl: string | null;
    videoUrl: string | null;
    textContent: string | null;
    isPreview: boolean;
    contentType: string;
    simulation?: {
        title: string;
        body: unknown;
    } | null;
};

export type TopicProgressRow = {
    topicId: string;
    isCompleted: boolean;
    lastPosition: number;
    updatedAt: Date;
    completedAt: Date | null;
    userId?: string;
};

export type ContentAssetRow = {
    topicId: string;
    contentKey: string;
    contentType: string;
    personaKey: string | null;
    payload: unknown;
};

export type PromptSuggestionRow = {
    suggestionId: string;
    promptText: string;
    answer: string | null;
};

export interface ICourseRepository {
    getAllCourses(): Promise<CourseSummary[]>;

    getCourseById(courseId: string): Promise<CourseDetails | null>;

    findCourseIdBySlug(slug: string): Promise<string | null>;

    findCourseIdByName(name: string): Promise<string | null>;

    findCourseIdByPossibleNames(names: string[]): Promise<string | null>;

    /**
     * Standardized resolver for course keys (UUIDs, legacy slugs, or normalized names)
     */
    resolveCourseIdByFuzzyKey(key: string): Promise<string | null>;

    getCourseTopics(courseId: string): Promise<TopicSummary[]>;

    getModuleTopics(moduleNo: number): Promise<TopicSummary[]>; // For strict module fetching

    getTopicById(topicId: string): Promise<{ topicId: string; courseId: string; } | null>;

    getTopicContentAssets(params: {
        topicIds: string[];
        contentKeys: string[];
        personaKey?: string | null;
    }): Promise<ContentAssetRow[]>;

    getTopicPrompts(params: {
        courseId?: string;
        topicId?: string;
        parentSuggestionId?: string;
    }): Promise<PromptSuggestionRow[]>;

    getTopicProgress(userId: string, topicIds: string[]): Promise<TopicProgressRow[]>;

    getSingleTopicProgress(userId: string, topicId: string): Promise<TopicProgressRow | null>;

    upsertTopicProgress(params: {
        userId: string;
        topicId: string;
        isCompleted: boolean;
        lastPosition: number;
        completedAt: Date | null;
    }): Promise<TopicProgressRow>;
}
