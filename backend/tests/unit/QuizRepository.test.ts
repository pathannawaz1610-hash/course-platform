import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuizRepository } from "../../src/repositories/implementations/QuizRepository";
import { prisma } from "../../src/services/prisma";

// Mock the prisma client
vi.mock("../../src/services/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
        $executeRaw: vi.fn(),
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        // Mock other potential calls if needed
    },
}));

describe("QuizRepository", () => {
    let quizRepo: QuizRepository;
    const mockUUID = "12345678-1234-1234-1234-1234567890ab";

    beforeEach(() => {
        vi.clearAllMocks();
        quizRepo = new QuizRepository();
    });

    describe("ensureUserExists", () => {
        it("should do nothing if user exists", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue({ userId: mockUUID } as any);

            await quizRepo.ensureUserExists(mockUUID);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: mockUUID } });
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it("should create user if not exists", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            await quizRepo.ensureUserExists(mockUUID);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: mockUUID } });
            expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    userId: mockUUID,
                    email: `${mockUUID}@quiz.local`
                })
            }));
        });

        it("should return early if userId is not a valid UUID", async () => {
            await quizRepo.ensureUserExists("invalid-uuid");
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
        });
    });

    describe("loadQuestionSet", () => {
        it("should return questions from DB", async () => {
            const mockQuestions = [
                {
                    question_id: "q1",
                    course_id: "c1",
                    module_no: 1,
                    topic_pair_index: 0,
                    prompt: "test?",
                    order_index: 1
                }
            ];
            const mockOptions = [
                {
                    option_id: "o1",
                    question_id: "q1",
                    option_text: "Yes",
                    is_correct: true
                }
            ];

            // First call is for questions, second for options
            vi.mocked(prisma.$queryRaw)
                .mockResolvedValueOnce(mockQuestions)
                .mockResolvedValueOnce(mockOptions);

            const result = await quizRepo.loadQuestionSet({
                courseId: "c1",
                moduleNo: 1,
                topicPairIndex: 0,
                limit: 10
            });

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(1);
            expect(result[0].questionId).toBe("q1");
            expect(result[0].options).toHaveLength(1);
            expect(result[0].options[0].text).toBe("Yes");
        });
    });

    describe("createAttempt", () => {
        it("should create a new attempt", async () => {
            const mockAttemptRow = { attempt_id: "a1" };
            vi.mocked(prisma.$queryRaw).mockResolvedValue([mockAttemptRow]);

            const result = await quizRepo.createAttempt({
                userId: mockUUID,
                courseId: "c1",
                moduleNo: 1,
                topicPairIndex: 0,
                questionSet: []
            });

            // createAttempt calls ensuredUserExists? No, service does.
            // Repo createAttempt uses raw SQL
            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(result).toEqual({ attemptId: "a1" });
        });
    });

});
