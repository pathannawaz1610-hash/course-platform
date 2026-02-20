import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiClient } from "@/lib/binding/client";
import { readStoredSession } from "@/utils/session";

export const getQueryFn: <T>(options: {
  on401: "throw" | "returnNull";
}) => QueryFunction<T> =
  ({ on401 }) =>
    async ({ queryKey }) => {
      const path = queryKey[0];
      if (typeof path !== "string") {
        throw new Error("Query key must start with a string path");
      }

      // Extract query params from the second element if it exists and is an object
      // This supports passing options like { headers: ... } if needed, though rare with GET
      const options = (queryKey[1] as Record<string, any>) || {};

      const session = readStoredSession();

      try {
        return await apiClient.request(path, {
          method: "GET",
          // We can spread options here if we want to support overriding headers via queryKey
          // checking if options has valid RequestOptions properties
          ...options
        }, session);
      } catch (error: any) {
        if (on401 === "returnNull" && error?.status === 401) {
          return null;
        }
        throw error;
      }
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
