import { QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/binding/client";
import { readStoredSession } from "@/utils/session";

/**
 * Centralized query function used by React Query's defaultOptions.
 *
 * ALL queries that don't supply an explicit queryFn flow through here,
 * routing through the apiClient instead of raw fetch. This ensures:
 *  - Uniform auth (Authorization header from stored session)
 *  - Uniform error handling (HTTP errors are thrown as typed Errors)
 *  - Uniform behavior across the entire app
 *
 * Usage with explicit binding action (preferred):
 *   useQuery({ queryKey: ['course', id], queryFn: () => fetchCourse(id) })
 *
 * Usage with string-path fallback (acceptable for simple GETs):
 *   useQuery({ queryKey: ['/api/courses'] })  // routes through apiClient.request
 */
export const getQueryFn =
  (opts: { on401: "throw" | "returnNull" }) =>
    async ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const path = queryKey[0];
      if (typeof path !== "string") {
        throw new Error("Query key must start with a string path when no explicit queryFn is provided");
      }

      const session = readStoredSession();

      try {
        return await apiClient.request<unknown>(path, { method: "GET" }, session);
      } catch (error: any) {
        if (opts.on401 === "returnNull" && error?.status === 401) {
          return null;
        }
        throw error;
      }
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // All implicit string-key queries now go through apiClient (not raw fetch)
      queryFn: getQueryFn({ on401: "throw" }) as any,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
