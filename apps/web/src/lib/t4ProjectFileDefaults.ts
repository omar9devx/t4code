import { T4_PROJECT_FILE_NAME, type EnvironmentId, type T4ProjectFile } from "@t4tools/contracts";
import { parseT4ProjectFile } from "@t4tools/shared/t4ProjectFile";
import { executeAtomQuery } from "@t4tools/client-runtime/state/runtime";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "~/components/files/projectFilesQueryState";
import { appAtomRegistry } from "~/rpc/atomRegistry";

export async function readT4ProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
): Promise<T4ProjectFile | null> {
  const result = await executeAtomQuery(
    appAtomRegistry,
    getProjectFileQueryAtom(environmentId, workspaceRoot, T4_PROJECT_FILE_NAME),
    { reportDefect: false, reportFailure: false },
  );
  const data = resolveProjectFileQueryData(
    environmentId,
    workspaceRoot,
    T4_PROJECT_FILE_NAME,
    result._tag === "Success" ? result.value : null,
  );
  if (data === null || data.exists === false || data.truncated) return null;
  return parseT4ProjectFile(data.contents);
}
