import { LRUCache } from "lru-cache";
import { prisma } from "./prisma";
import { CourseRepository } from "../repositories/implementations/CourseRepository";

const courseRepo = new CourseRepository();

// --- Cache Configuration ---
// Options:
// - max: 500 items (Enough for all active courses + aliases)
// - ttl: 10 minutes (600,000 ms) - Balance between freshness and DB load
const courseIdCache = new LRUCache<string, string>({
    max: 500,
    ttl: 1000 * 60 * 10,
});

const LEGACY_COURSE_SLUGS: Record<string, string> = {
    "ai-in-web-development": "f26180b2-5dda-495a-a014-ae02e63f172f",
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a course identifier (UUID, slug, name, or legacy alias) to a valid Course UUID.
 * Returns null if the course cannot be found.
 * 
 * Uses an in-memory LRU cache to prevent redundant DB lookups for the same slug.
 */
export async function resolveCourseId(courseKey: string | null | undefined): Promise<string | null> {
    const trimmedKey = courseKey?.trim();
    if (!trimmedKey) {
        return null;
    }

    // 0. Check Cache (Fast Path)
    // We cache based on the *exact input string* to cover all variations (slug, name, etc.)
    // efficiently without re-normalizing every time.
    if (courseIdCache.has(trimmedKey)) {
        return courseIdCache.get(trimmedKey)!;
    }

    // 1. Direct UUID check (No DB/Cache needed if it's already an ID)
    if (uuidRegex.test(trimmedKey)) {
        return trimmedKey;
    }

    // 2. Decode URL component
    let decodedKey: string;
    try {
        decodedKey = decodeURIComponent(trimmedKey).trim();
    } catch {
        decodedKey = trimmedKey;
    }

    const normalizedSlug = decodedKey.toLowerCase();

    // 3. Legacy Alias Check
    const aliasMatch = LEGACY_COURSE_SLUGS[normalizedSlug];
    if (aliasMatch) {
        // Cache the alias -> ID mapping too
        courseIdCache.set(trimmedKey, aliasMatch);
        return aliasMatch;
    }

    // 4. Database Lookup (Slug or Name)
    const normalizedName = decodedKey.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

    // Prepare search candidates
    const searchValues = Array.from(new Set([
        normalizedSlug, // as slug
        decodedKey,     // as name (exact)
        normalizedName  // as name (normalized)
    ])).filter(v => v.length > 0);

    if (searchValues.length === 0) return null;

    const resultId = await courseRepo.findCourseIdByPossibleNames(searchValues);

    // 5. Update Cache
    if (resultId) {
        courseIdCache.set(trimmedKey, resultId);
    }

    return resultId;
}
