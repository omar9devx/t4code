import { showBootError } from "./lib/bootError";
import { isDynamicImportLoadError, reloadOnceForChunkLoadError } from "./lib/chunkReloadGuard";

// Shared dev chunks need the React refresh preamble first. Catch failures before React mounts.
void import("./main")
  .then(({ startup }) => startup)
  .catch((error: unknown) => {
    if (isDynamicImportLoadError(error) && reloadOnceForChunkLoadError()) return;
    showBootError(error);
  });
