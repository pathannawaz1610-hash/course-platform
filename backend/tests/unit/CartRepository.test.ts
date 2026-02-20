import { describe, it, expect, vi, beforeEach } from "vitest";
import { CartRepository } from "../../src/repositories/implementations/CartRepository";
import { prisma } from "../../src/services/prisma";

// Mock the prisma client
vi.mock("../../src/services/prisma", () => ({
    prisma: {
        $executeRawUnsafe: vi.fn(),
        cartItem: {
            findMany: vi.fn(),
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

describe("CartRepository", () => {
    let cartRepo: CartRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        cartRepo = new CartRepository();
    });

    describe("getCartItems", () => {
        it("should return mapped cart items", async () => {
            const now = new Date();
            const mockDbItems = [{
                cartItemId: "ci1",
                userId: "u1",
                courseSlug: "slug-1",
                courseTitle: "Course 1",
                coursePrice: 100,
                addedAt: now,
                courseData: { description: "Desc" }
            }];

            vi.mocked(prisma.cartItem.findMany).mockResolvedValue(mockDbItems as any);
            vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(0);

            const result = await cartRepo.getCartItems("u1");

            expect(prisma.cartItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId: "u1" }
            }));

            expect(result).toEqual([{
                courseId: "slug-1",
                title: "Course 1",
                price: 100,
                addedAt: now,
                description: "Desc"
            }]);
        });
    });

    describe("addItem", () => {
        it("should upsert item", async () => {
            const mockPayload = { id: "c1", title: "Course 1", price: 100, slug: "course-1" };

            vi.mocked(prisma.cartItem.upsert).mockResolvedValue({} as any);
            vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(0);

            await cartRepo.addItem("u1", mockPayload);

            expect(prisma.cartItem.upsert).toHaveBeenCalled();
        });
    });

    describe("removeItem", () => {
        it("should delete item", async () => {
            vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 1 });
            vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(0);

            await cartRepo.removeItem("u1", "course-1");

            expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId: "u1", courseSlug: "course-1" }
            }));
        });
    });
});
