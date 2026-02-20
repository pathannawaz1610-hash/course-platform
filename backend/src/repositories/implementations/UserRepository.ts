import { PrismaClient } from "@prisma/client";
import { IUserRepository, UserRecord } from "../interfaces/IUserRepository";
import { prisma } from "../../services/prisma";

export class UserRepository implements IUserRepository {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async findById(userId: string): Promise<UserRecord | null> {
        return this.db.user.findUnique({
            where: { userId },
            select: {
                userId: true,
                email: true,
                fullName: true,
                role: true,
            },
        });
    }

    async findByEmail(email: string): Promise<UserRecord | null> {
        return this.db.user.findUnique({
            where: { email },
            select: {
                userId: true,
                email: true,
                fullName: true,
                role: true,
            },
        });
    }
}
