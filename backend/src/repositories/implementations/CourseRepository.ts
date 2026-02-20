import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../services/prisma";
import {
    ICourseRepository,
    CourseSummary,
    CourseDetails,
    TopicSummary,
    TopicProgressRow,
    ContentAssetRow,
    PromptSuggestionRow
} from "../interfaces/ICourseRepository";

export class CourseRepository implements ICourseRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async getAllCourses(): Promise<CourseSummary[]> {
        const courses = await this.db.course.findMany({
            select: {
                courseId: true,
                courseName: true,
                description: true,
                priceCents: true,
                slug: true,
                createdAt: true,
            },
            orderBy: [{ createdAt: "asc" }],
        });

        return courses.map(course => {
            const priceCents = course.priceCents ?? 0;
            const createdAt = course.createdAt instanceof Date ? course.createdAt.toISOString() : new Date(course.createdAt ?? Date.now()).toISOString();
            return {
                id: course.courseId,
                slug: course.slug,
                title: course.courseName,
                description: course.description,
                price: Math.round(priceCents / 100),
                priceCents: priceCents,
                createdAt: createdAt
            };
        });
    }

    async getCourseById(courseId: string): Promise<CourseDetails | null> {
        const course = await this.db.course.findUnique({
            where: { courseId },
            select: {
                courseId: true,
                courseName: true,
                slug: true,
                description: true,
                priceCents: true,
                createdAt: true,
            },
        });

        if (!course) return null;

        return {
            ...course,
            priceCents: course.priceCents ?? 0,
            createdAt: course.createdAt instanceof Date ? course.createdAt : new Date(course.createdAt ?? Date.now())
        };
    }

    async findCourseIdBySlug(slug: string): Promise<string | null> {
        const course = await this.db.course.findUnique({
            where: { slug },
            select: { courseId: true }
        });
        return course?.courseId ?? null;
    }

    async findCourseIdByName(name: string): Promise<string | null> {
        const course = await this.db.course.findFirst({
            where: {
                courseName: { equals: name, mode: "insensitive" }
            },
            select: { courseId: true }
        });
        return course?.courseId ?? null;
    }

    async findCourseIdByPossibleNames(names: string[]): Promise<string | null> {
        if (names.length === 0) return null;
        const course = await this.db.course.findFirst({
            where: {
                OR: [
                    { slug: { in: names, mode: "insensitive" } },
                    { courseName: { in: names, mode: "insensitive" } }
                ]
            },
            select: { courseId: true },
        });
        return course?.courseId ?? null;
    }

    async getCourseTopics(courseId: string): Promise<TopicSummary[]> {
        const rows = await this.db.topic.findMany({
            where: { courseId },
            orderBy: [{ moduleNo: "asc" }, { topicNumber: "asc" }],
            select: {
                topicId: true,
                courseId: true,
                moduleNo: true,
                moduleName: true,
                topicNumber: true,
                topicName: true,
                pptUrl: true,
                videoUrl: true,
                textContent: true,
                isPreview: true,
                contentType: true,
                simulation: {
                    select: {
                        title: true,
                        body: true,
                    }
                }
            }
        });

        return rows.map(row => ({
            ...row,
            simulation: row.simulation ? {
                title: row.simulation.title,
                body: row.simulation.body
            } : null
        }));
    }

    async getModuleTopics(moduleNo: number): Promise<TopicSummary[]> {
        const rows = await this.db.topic.findMany({
            where: { moduleNo },
            orderBy: { topicNumber: "asc" },
            select: {
                topicId: true,
                courseId: true,
                moduleNo: true,
                moduleName: true,
                topicNumber: true,
                topicName: true,
                pptUrl: true,
                videoUrl: true,
                textContent: true,
                isPreview: true,
                contentType: true,
                simulation: {
                    select: {
                        title: true,
                        body: true,
                    }
                }
            }
        });

        return rows.map(row => ({
            ...row,
            simulation: row.simulation ? {
                title: row.simulation.title,
                body: row.simulation.body
            } : null
        }));
    }

    async getTopicById(topicId: string): Promise<{ topicId: string; courseId: string; } | null> {
        return this.db.topic.findUnique({
            where: { topicId },
            select: { topicId: true, courseId: true }
        });
    }

    async getTopicContentAssets(params: {
        topicIds: string[];
        contentKeys: string[];
        personaKey?: string | null;
    }): Promise<ContentAssetRow[]> {
        if (params.topicIds.length === 0 || params.contentKeys.length === 0) return [];

        const filters: Prisma.TopicContentAssetWhereInput = {
            topicId: { in: params.topicIds },
            contentKey: { in: params.contentKeys },
        };

        if (params.personaKey !== undefined) {
            filters.OR = params.personaKey
                ? [{ personaKey: params.personaKey as any }, { personaKey: null }]
                : [{ personaKey: null }];
        }

        return this.db.topicContentAsset.findMany({
            where: filters,
            select: {
                topicId: true,
                contentKey: true,
                contentType: true,
                personaKey: true,
                payload: true,
            }
        });
    }

    async getTopicPrompts(params: {
        courseId?: string;
        topicId?: string;
        parentSuggestionId?: string;
    }): Promise<PromptSuggestionRow[]> {
        const where: Prisma.TopicPromptSuggestionWhereInput = { isActive: true };

        if (params.parentSuggestionId) {
            where.parentSuggestionId = params.parentSuggestionId;
        } else {
            where.parentSuggestionId = null;
            const orList: Prisma.TopicPromptSuggestionWhereInput[] = [];

            if (params.courseId) {
                orList.push({ AND: [{ courseId: params.courseId }, { topicId: null }] });
            }
            if (params.topicId) {
                orList.push({ topicId: params.topicId });
            }

            if (orList.length > 0) {
                where.OR = orList;
            }
        }

        return this.db.topicPromptSuggestion.findMany({
            where,
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            select: {
                suggestionId: true,
                promptText: true,
                answer: true,
            }
        });
    }

    async getTopicProgress(userId: string, topicIds: string[]): Promise<TopicProgressRow[]> {
        if (topicIds.length === 0) return [];
        return this.db.topicProgress.findMany({
            where: { userId, topicId: { in: topicIds } },
            select: {
                topicId: true,
                isCompleted: true,
                lastPosition: true,
                updatedAt: true,
                completedAt: true,
            }
        });
    }

    async getSingleTopicProgress(userId: string, topicId: string): Promise<TopicProgressRow | null> {
        return this.db.topicProgress.findUnique({
            where: { userId_topicId: { userId, topicId } },
            select: {
                topicId: true,
                isCompleted: true,
                lastPosition: true,
                updatedAt: true,
                completedAt: true,
                userId: true
            }
        });
    }

    async upsertTopicProgress(params: {
        userId: string;
        topicId: string;
        isCompleted: boolean;
        lastPosition: number;
        completedAt: Date | null;
    }): Promise<TopicProgressRow> {
        const now = new Date();
        return this.db.topicProgress.upsert({
            where: { userId_topicId: { userId: params.userId, topicId: params.topicId } },
            create: {
                topicId: params.topicId,
                userId: params.userId,
                isCompleted: params.isCompleted,
                lastPosition: params.lastPosition,
                completedAt: params.completedAt,
            },
            update: {
                isCompleted: params.isCompleted,
                lastPosition: params.lastPosition,
                completedAt: params.completedAt,
                updatedAt: now,
            },
            select: {
                topicId: true,
                isCompleted: true,
                lastPosition: true,
                updatedAt: true,
                completedAt: true,
                userId: true
            }
        });
    }
}
