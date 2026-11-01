import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { T4_PROJECT_FILE_NAME, type T4ProjectFile } from "@t4tools/contracts";
import { T4ProjectFileFromJson } from "@t4tools/shared/t4ProjectFile";

const decodeT4ProjectFileJson = Schema.decodeEffect(T4ProjectFileFromJson);

export class T4ProjectFileLoadError extends Schema.TaggedError<T4ProjectFileLoadError>()(
  "T4ProjectFileLoadError",
  {
    operation: Schema.Literals(["read", "decode"]),
    workspaceRoot: Schema.String,
    filePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation} ${T4_PROJECT_FILE_NAME} at ${this.filePath}.`;
  }
}

export class T4ProjectFileLoader extends Context.Service<
  T4ProjectFileLoader,
  {
    /** Never fails; missing/unreadable/invalid files return none, with warnings for invalid files. */
    readonly load: (workspaceRoot: string) => Effect.Effect<Option.Option<T4ProjectFile>>;
  }
>()("t4/project/T4ProjectFileLoader") {}

const logT4ProjectFileLoadError = (error: T4ProjectFileLoadError) =>
  Effect.logWarning(error).pipe(
    Effect.annotateLogs({
      operation: error.operation,
      workspaceRoot: error.workspaceRoot,
      filePath: error.filePath,
      errorTag: error._tag,
    }),
  );

/** @public */
export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const load: T4ProjectFileLoader["Service"]["load"] = Effect.fn("T4ProjectFileLoader.load")(
    function* (workspaceRoot) {
      const filePath = path.join(workspaceRoot, T4_PROJECT_FILE_NAME);
      const raw = yield* fileSystem.readFileString(filePath).pipe(
        Effect.asSome,
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "NotFound"
              ? Effect.succeed(Option.none<string>())
              : logT4ProjectFileLoadError(
                  new T4ProjectFileLoadError({
                    operation: "read",
                    workspaceRoot,
                    filePath,
                    cause: error,
                  }),
                ).pipe(Effect.as(Option.none<string>())),
        }),
      );
      if (Option.isNone(raw)) {
        return Option.none<T4ProjectFile>();
      }
      return yield* decodeT4ProjectFileJson(raw.value).pipe(
        Effect.asSome,
        Effect.catchTags({
          SchemaError: (error) =>
            logT4ProjectFileLoadError(
              new T4ProjectFileLoadError({
                operation: "decode",
                workspaceRoot,
                filePath,
                cause: error,
              }),
            ).pipe(Effect.as(Option.none<T4ProjectFile>())),
        }),
      );
    },
  );

  return T4ProjectFileLoader.of({ load });
});

export const layer = Layer.effect(T4ProjectFileLoader, make);
