import * as Option from "effect/Option";

export type JoinPath = (first: string, ...segments: string[]) => string;

function normalizeConfiguredBaseDir(t4Home: Option.Option<string>): Option.Option<string> {
  if (Option.isNone(t4Home)) {
    return Option.none();
  }
  const trimmed = t4Home.value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
}

export function resolveDesktopBaseDir(input: {
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly t4Home: Option.Option<string>;
  readonly legacyT3HomeExists?: boolean;
}): string {
  return Option.getOrElse(normalizeConfiguredBaseDir(input.t4Home), () =>
    input.joinPath(input.homeDirectory, input.legacyT3HomeExists ? ".t3" : ".t4"),
  );
}

export function resolveDesktopStateDir(input: {
  readonly baseDir: string;
  readonly isDevelopment: boolean;
  readonly joinPath: JoinPath;
  readonly t4Home: Option.Option<string>;
}): string {
  const useDevSubdir =
    input.isDevelopment && Option.isNone(normalizeConfiguredBaseDir(input.t4Home));
  return input.joinPath(input.baseDir, useDevSubdir ? "dev" : "userdata");
}
