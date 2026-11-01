import {
  T4_PROJECT_FILE_NAME,
  type EnvironmentId,
  type T4ProjectFile,
  type T4ProjectFileScript,
} from "@t4tools/contracts";
import { parseT4ProjectFile } from "@t4tools/shared/t4ProjectFile";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const NO_SCRIPTS: ReadonlyArray<T4ProjectFileScript> = [];

export interface T4ProjectFileState {
  status: "loading" | "missing" | "invalid" | "valid";
  file: T4ProjectFile | null;
  scripts: ReadonlyArray<T4ProjectFileScript>;
}

export function useT4ProjectFileState(
  environmentId: EnvironmentId,
  cwd: string | null,
): T4ProjectFileState {
  const query = useProjectFileQuery(environmentId, cwd ?? "", T4_PROJECT_FILE_NAME, cwd !== null);
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const isPending = query.isPending;
  if (contents === null) {
    return {
      status: isPending ? "loading" : "missing",
      file: null,
      scripts: NO_SCRIPTS,
    } as const;
  }
  const file = parseT4ProjectFile(contents);
  if (file === null) {
    return { status: "invalid", file: null, scripts: NO_SCRIPTS } as const;
  }
  return { status: "valid", file, scripts: file.scripts ?? NO_SCRIPTS } as const;
}

export function useT4ProjectFileScripts(
  environmentId: EnvironmentId,
  cwd: string | null,
): ReadonlyArray<T4ProjectFileScript> {
  return useT4ProjectFileState(environmentId, cwd).scripts;
}
