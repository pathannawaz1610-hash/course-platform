import { apiClient } from "../client";

export interface PageContent {
    id: string;
    slug: string;
    title: string;
    content: string;
    heroImage?: string;
    metaDescription?: string;
    [key: string]: any;
}

/**
 * Fetch static page content by slug
 */
export async function fetchPageContent(
    pageSlug: string,
    signal?: AbortSignal
): Promise<PageContent> {
    return apiClient.request<PageContent>(`/pages/${pageSlug}`, { signal });
}
