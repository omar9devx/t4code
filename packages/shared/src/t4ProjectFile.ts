import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { T4ProjectFile, T4_PROJECT_FILE_SCHEMA_URL } from "@t4tools/contracts";

import { fromLenientJson } from "./schemaJson.ts";

export const T4ProjectFileFromJson = fromLenientJson(T4ProjectFile);

const decodeT4ProjectFile = Schema.decodeExit(T4ProjectFileFromJson);

export function parseT4ProjectFile(contents: string): T4ProjectFile | null {
  const decoded = decodeT4ProjectFile(contents);
  return Exit.isSuccess(decoded) ? decoded.value : null;
}

export function buildT4ProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(T4ProjectFile, { onExcessProperty: "error" });
  const jsonSchema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: T4_PROJECT_FILE_SCHEMA_URL,
    ...document.schema,
  };
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions;
  }
  return jsonSchema;
}
