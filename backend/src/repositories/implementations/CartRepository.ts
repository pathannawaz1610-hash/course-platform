import crypto from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";
import {
    ICartRepository,
    CartItemRow,
    CartItemAddPayload,
    CartCourseMetadata
} from "../interfaces/ICartRepository";

export class CartRepository implements ICartRepository {
    private db: PrismaClient;
    private tableReadyPromise: Promise<void> | null = null;

    constructor() {
        this.db = prisma;
    }

    private async ensureCartTable(): Promise<void> {
        if (!this.tableReadyPromise) {
            this.tableReadyPromise = (async () => {
                await this.db.$executeRawUnsafe(`
                    CREATE TABLE IF NOT EXISTS "cart_items" (
                        "cart_item_id" UUID PRIMARY KEY,
                        "user_id" UUID NOT NULL,
                        "course_slug" TEXT NOT NULL,
                        "course_title" TEXT NOT NULL,
                        "course_price" INTEGER NOT NULL DEFAULT 0,
                        "course_data" JSONB,
                        "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT "cart_items_user_id_fkey"
                            FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE
                    )
                `);

                await this.db.$executeRawUnsafe(`
                    CREATE UNIQUE INDEX IF NOT EXISTS "uq_cart_item_user_slug"
                        ON "cart_items" ("user_id", "course_slug")
                `);
            })().catch((error) => {
                this.tableReadyPromise = null;
                throw error;
            });
        }
        await this.tableReadyPromise;
    }

    private mapToRow(item: any): CartItemRow {
        const metadata = (item.courseData ?? {}) as CartCourseMetadata;
        return {
            courseId: item.courseSlug,
            title: item.courseTitle,
            price: item.coursePrice,
            addedAt: item.addedAt instanceof Date ? item.addedAt : new Date(item.addedAt),
            ...metadata
        };
    }

    private extractMetadata(payload: CartItemAddPayload): CartCourseMetadata {
        const METADATA_KEYS: Array<keyof CartCourseMetadata> = [
            "description",
            "instructor",
            "duration",
            "rating",
            "students",
            "level",
            "thumbnail",
        ];

        const metadata: CartCourseMetadata = {};
        for (const key of METADATA_KEYS) {
            const value = payload[key];
            if (value === undefined || value === null) {
                continue;
            }
            if (typeof value === "string" || typeof value === "number") {
                (metadata as any)[key] = value;
            }
        }
        return metadata;
    }

    async getCartItems(userId: string): Promise<CartItemRow[]> {
        await this.ensureCartTable();
        const items = await this.db.cartItem.findMany({
            where: { userId },
            orderBy: { addedAt: "desc" },
        });
        return items.map(item => this.mapToRow(item));
    }

    async addItem(userId: string, item: CartItemAddPayload): Promise<void> {
        await this.ensureCartTable();
        const metadata = this.extractMetadata(item);

        await this.db.cartItem.upsert({
            where: {
                userId_courseSlug: {
                    userId,
                    courseSlug: item.id,
                },
            },
            create: {
                cartItemId: crypto.randomUUID(),
                userId,
                courseSlug: item.id,
                courseTitle: item.title,
                coursePrice: item.price,
                courseData: metadata,
            },
            update: {
                courseTitle: item.title,
                coursePrice: item.price,
                courseData: metadata,
                addedAt: new Date(),
            },
        });
    }

    async removeItem(userId: string, courseSlug: string): Promise<void> {
        await this.ensureCartTable();
        await this.db.cartItem.deleteMany({
            where: {
                userId,
                courseSlug,
            },
        });
    }

    async clearCart(userId: string): Promise<void> {
        await this.ensureCartTable();
        await this.db.cartItem.deleteMany({
            where: { userId },
        });
    }
}
