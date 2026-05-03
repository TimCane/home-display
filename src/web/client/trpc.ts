import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../server/trpc/index.js";
import { redirectToLogin } from "./auth";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if ((error as any)?.data?.code === "UNAUTHORIZED") return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

// Global error handler: redirect to login on 401
const originalOnError =
  queryClient.getDefaultOptions().mutations?.onError;
queryClient.setDefaultOptions({
  ...queryClient.getDefaultOptions(),
  queries: {
    ...queryClient.getDefaultOptions().queries,
    throwOnError: (error) => {
      if ((error as any)?.data?.code === "UNAUTHORIZED") {
        redirectToLogin();
        return false;
      }
      return false;
    },
  },
});
