import { lahzaRouter } from "./lahza";
import { router } from "./_core/trpc";

export const appRouter = router({
  lahza: lahzaRouter,
});

export type AppRouter = typeof appRouter;
