import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { McpSchema } from "effect/ai";
import { ComputerUseError } from "@t4tools/contracts";

import * as ServerSettings from "../../../serverSettings.ts";
import { authorizeComputerUseAction, authorizeComputerUseScreenshot } from "./handlers.ts";
import { ComputerUseScreenshotSuccess } from "./tools.ts";

const decodeComputerUseScreenshotSuccess = Schema.decodeSync(ComputerUseScreenshotSuccess);
const isComputerUseError = Schema.is(ComputerUseError);

describe("computer use screenshot tool", () => {
  it("accepts a dimensions-only result when image capture is disabled", () => {
    expect(
      decodeComputerUseScreenshotSuccess({
        screenWidth: 1920,
        screenHeight: 1080,
      }),
    ).toEqual({ screenWidth: 1920, screenHeight: 1080 });
  });
});

describe("computer use approval modes", () => {
  const clientFor = (action: "accept" | "decline", onElicit: () => void = () => {}) =>
    McpSchema.McpServerClient.of({
      clientId: 1,
      clientCapabilities: { elicitation: { form: {} } },
      clientInfo: { name: "test", version: "1" },
      protocolVersion: "2025-06-18",
      initializePayload: {
        protocolVersion: "2025-06-18",
        capabilities: { elicitation: { form: {} } },
        clientInfo: { name: "test", version: "1" },
      },
      getClient: Effect.succeed({
        listRoots: () => Effect.die("unused"),
        createMessage: () => Effect.die("unused"),
        elicit: () =>
          Effect.sync(() => {
            onElicit();
            return action === "accept" ? { action, content: {} } : { action };
          }),
      }),
    });

  const runWithMode = <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    mode: "always-allow" | "always-ask" | "allow-move-and-screenshot",
    decision: "accept" | "decline" = "accept",
    onElicit?: () => void,
  ) =>
    effect.pipe(
      Effect.provide(ServerSettings.layerTest({ computerUseApprovalMode: mode })),
      Effect.provideService(McpSchema.McpServerClient, clientFor(decision, onElicit)),
    );

  it.effect("skips prompts in Always allow mode", () =>
    Effect.gen(function* () {
      let prompts = 0;
      yield* runWithMode(
        authorizeComputerUseAction({ action: "click", x: 2, y: 3 }),
        "always-allow",
        "accept",
        () => prompts++,
      );
      expect(prompts).toBe(0);
    }),
  );

  it.effect("asks before actions outside the move and screenshot exception", () =>
    Effect.gen(function* () {
      let prompts = 0;
      yield* runWithMode(
        authorizeComputerUseAction({ action: "move", x: 2, y: 3 }),
        "allow-move-and-screenshot",
        "decline",
        () => prompts++,
      );
      const denied = yield* runWithMode(
        authorizeComputerUseAction({ action: "click", x: 2, y: 3 }),
        "allow-move-and-screenshot",
        "decline",
        () => prompts++,
      ).pipe(Effect.flip);
      expect(prompts).toBe(1);
      expect(isComputerUseError(denied)).toBe(true);
      if (isComputerUseError(denied)) {
        expect(denied.reason).toBe("Computer Use action was not approved.");
      }
    }),
  );

  it.effect("asks before screenshots in Always ask mode", () =>
    Effect.gen(function* () {
      let prompts = 0;
      yield* runWithMode(authorizeComputerUseScreenshot(), "always-ask", "accept", () => prompts++);
      expect(prompts).toBe(1);
    }),
  );
});
