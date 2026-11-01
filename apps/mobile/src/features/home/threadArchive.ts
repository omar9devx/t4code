import {
  threadRuntimeCanArchive,
  type ThreadRuntimeSummary,
} from "@t4tools/client-runtime/state/models";

export function threadCanArchive(runtime: ThreadRuntimeSummary | null | undefined): boolean {
  return threadRuntimeCanArchive(runtime);
}
