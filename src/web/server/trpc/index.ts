import { router } from "./trpc.js";
import { entryRouter } from "./routers/entry.js";
import { draftRouter } from "./routers/draft.js";
import { systemRouter } from "./routers/system.js";
import { settingsRouter } from "./routers/settings.js";
import { diagnosticsRouter } from "./routers/diagnostics.js";
import { generatorRouter } from "./routers/generator.js";

export const appRouter = router({
  entry: entryRouter,
  draft: draftRouter,
  system: systemRouter,
  settings: settingsRouter,
  diagnostics: diagnosticsRouter,
  generator: generatorRouter,
});

export type AppRouter = typeof appRouter;
