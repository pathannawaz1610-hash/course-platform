export type CartCourseMetadata = {
    description?: string;
    instructor?: string;
    duration?: string;
    rating?: number;
    students?: number;
    level?: string;
    thumbnail?: string;
};

export type CartItemAddPayload = {
    id: string;
    title: string;
    price: number;
} & CartCourseMetadata;

export type CartItemRow = {
    courseId: string;
    title: string;
    price: number;
    addedAt: Date;
} & CartCourseMetadata;

export interface ICartRepository {
    getCartItems(userId: string): Promise<CartItemRow[]>;
    addItem(userId: string, item: CartItemAddPayload): Promise<void>;
    removeItem(userId: string, courseSlug: string): Promise<void>;
    clearCart(userId: string): Promise<void>;
}
