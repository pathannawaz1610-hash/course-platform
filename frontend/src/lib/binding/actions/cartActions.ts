import { apiClient, type Session } from "../client";

// Use existing CartItem type from the project
export type { CartItem } from "@/types/cart";

/**
 * Fetch user's cart items
 */
export async function fetchCart(session: Session): Promise<import("@/types/cart").CartItem[]> {
    const data = await apiClient.request<{ items: import("@/types/cart").CartItem[] }>(
        "/cart",
        {},
        session
    );
    return data.items || [];
}

/**
 * Remove an item from cart
 */
export async function removeFromCart(
    courseId: string,
    session: Session
): Promise<import("@/types/cart").CartItem[]> {
    const data = await apiClient.request<{ items: import("@/types/cart").CartItem[] }>(
        `/api/cart/items/${encodeURIComponent(courseId)}`,
        {
            method: "DELETE",
        },
        session
    );
    return data.items || [];
}

/**
 * Add a course to cart
 */
export async function addToCart(
    courseData: {
        id: string;
        title: string;
        price: number;
        description: string;
        instructor: string;
        duration: string;
        rating: number;
        students: number;
        level: string;
        thumbnail: string;
    },
    session: Session
): Promise<import("@/types/cart").CartItem[]> {
    const data = await apiClient.request<{ items: import("@/types/cart").CartItem[] }>(
        "/cart",
        {
            method: "POST",
            body: { course: courseData },
        },
        session
    );
    return data.items || [];
}

/**
 * Clear entire cart
 */
export async function clearCart(session: Session): Promise<void> {
    await apiClient.request<void>(
        "/cart",
        {
            method: "DELETE",
        },
        session
    );
}
