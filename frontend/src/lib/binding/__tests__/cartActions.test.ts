import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCart, addToCart, removeFromCart, clearCart } from "../actions/cartActions";
import { apiClient } from "../client";

// Mock the apiClient instance
vi.mock("../client", () => ({
    apiClient: {
        request: vi.fn(),
    },
}));

describe("cartActions", () => {
    const session = { accessToken: "token", refreshToken: "ref" };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should fetch cart items", async () => {
        const mockItems = [{ id: "1", title: "Course 1", price: 10 }];
        vi.mocked(apiClient.request).mockResolvedValueOnce({ items: mockItems });

        const result = await fetchCart(session);

        expect(apiClient.request).toHaveBeenCalledWith("/cart", {}, session);
        expect(result).toEqual(mockItems);
    });

    it("should add to cart", async () => {
        const item = {
            id: "1", title: "C1", price: 10, description: "D",
            instructor: "I", duration: "1h", rating: 5, students: 100,
            level: "B", thumbnail: "t.jpg"
        } as any;

        vi.mocked(apiClient.request).mockResolvedValueOnce({ items: [item] });

        const result = await addToCart(item, session);

        expect(apiClient.request).toHaveBeenCalledWith(
            "/cart",
            {
                method: "POST",
                body: { course: item },
            },
            session
        );
        expect(result).toEqual([item]);
    });

    it("should remove from cart", async () => {
        vi.mocked(apiClient.request).mockResolvedValueOnce({ items: [] });

        const result = await removeFromCart("course-1", session);

        expect(apiClient.request).toHaveBeenCalledWith(
            `/api/cart/items/${encodeURIComponent("course-1")}`,
            { method: "DELETE" },
            session
        );
        expect(result).toEqual([]);
    });

    it("should clear the cart", async () => {
        vi.mocked(apiClient.request).mockResolvedValueOnce({});

        await clearCart(session);

        expect(apiClient.request).toHaveBeenCalledWith(
            "/cart",
            { method: "DELETE" },
            session
        );
    });
});
