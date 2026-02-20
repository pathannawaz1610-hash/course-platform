export interface UserRecord {
    userId: string;
    email: string;
    fullName: string;
    role: string;
}

export interface IUserRepository {
    findById(userId: string): Promise<UserRecord | null>;
    findByEmail(email: string): Promise<UserRecord | null>;
}
