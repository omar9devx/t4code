import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { parseT4ProjectFile, T4ProjectFileFromJson } from "./t4ProjectFile.ts";

const decodeJson = Schema.decodeUnknownSync(T4ProjectFileFromJson);

describe("T4ProjectFileFromJson", () => {
  it("decodes lenient JSONC with comments and trailing commas", () => {
    const decoded = decodeJson(`{
      // team scripts
      "iconPath": "assets/logo.svg",
      "scripts": [
        { "name": "Dev", "command": "pnpm dev", },
      ],
    }`);

    expect(decoded.iconPath).toBe("assets/logo.svg");
    expect(decoded.scripts?.[0]).toEqual({ name: "Dev", command: "pnpm dev" });
  });
});

describe("parseT4ProjectFile", () => {
  it("reads project defaults from JSONC with a URL in a block comment", () => {
    expect(
      parseT4ProjectFile(`{
        /* See https://t3.codes/schema/t4.json */
        "defaultThreadEnvMode": "worktree"
      }`),
    ).toEqual({ defaultThreadEnvMode: "worktree" });
  });
});
