import * as Effect from "effect/Effect";
import { McpSchema } from "effect/ai";
import { ComputerUseError } from "@t3tools/contracts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import * as ComputerUseService from "../../../computerUse/ComputerUseService.ts";
import * as ServerSettings from "../../../serverSettings.ts";
import { ComputerUseInput, ComputerUseToolkit, ComputerUseScreenshotToolkit } from "./tools.ts";

const service = Effect.service(ComputerUseService.ComputerUseService);
const settingsService = Effect.service(ServerSettings.ServerSettingsService);
const requireAccess = McpInvocationContext.requireThreadMcpCapability("computer-use").pipe(
  Effect.mapError(
    () =>
      new ComputerUseError({
        operation: "permission",
        reason: "Enable Computer Use and agent access in Settings before using these tools.",
      }),
  ),
);

const requestApproval = Effect.fn("ComputerUse.requestApproval")(function* (
  message: string,
  reason: string,
) {
  const result = yield* Effect.scoped(
    McpSchema.McpServerClient.pipe(
      Effect.flatMap((context) => context.getClient),
      Effect.flatMap((client) =>
        client.elicit(
          new McpSchema.ElicitRequestFormParams({
            mode: "form",
            message,
            requestedSchema: { type: "object", properties: {} },
          }),
        ),
      ),
      Effect.mapError(
        () =>
          new ComputerUseError({
            operation: "permission",
            reason: `${reason} The provider may not support approval prompts.`,
          }),
      ),
    ),
  );
  if (result.action !== "accept") {
    return yield* new ComputerUseError({ operation: "permission", reason });
  }
});

export const authorizeComputerUseAction = Effect.fn("authorizeComputerUseAction")(function* (
  input: typeof ComputerUseInput.Type,
) {
  const action = input.action;
  const settings = yield* settingsService;
  const mode = yield* settings.getSettings.pipe(
    Effect.map((current) => current.computerUseApprovalMode),
    Effect.mapError(
      () =>
        new ComputerUseError({
          operation: "permission",
          reason: "Could not read Computer Use approval settings.",
        }),
    ),
  );
  if (mode === "always-allow") return;
  if (mode === "allow-move-and-screenshot" && action === "move") return;
  const description = (() => {
    switch (action) {
      case "move":
        return `move the pointer to (${input.x}, ${input.y})`;
      case "click":
        return `click ${input.button ?? "left"} at (${input.x}, ${input.y})`;
      case "double_click":
        return `double-click ${input.button ?? "left"} at (${input.x}, ${input.y})`;
      case "drag":
        return `drag ${input.button ?? "left"} from (${input.startX}, ${input.startY}) to (${input.endX}, ${input.endY})`;
      case "scroll":
        return `scroll at (${input.x}, ${input.y}) by (${input.deltaX ?? 0}, ${input.deltaY ?? 0})`;
      case "type":
        return `type ${JSON.stringify(input.text ?? "")}`;
      case "press_key":
        return `press ${[...(input.modifiers ?? []), input.key ?? ""].join("+")}`;
    }
  })();
  yield* requestApproval(
    `Allow the agent to ${description}?`,
    "Computer Use action was not approved.",
  );
});

export const authorizeComputerUseScreenshot = Effect.fn("authorizeComputerUseScreenshot")(
  function* () {
    const settings = yield* settingsService;
    const mode = yield* settings.getSettings.pipe(
      Effect.map((current) => current.computerUseApprovalMode),
      Effect.mapError(
        () =>
          new ComputerUseError({
            operation: "permission",
            reason: "Could not read Computer Use approval settings.",
          }),
      ),
    );
    if (mode !== "always-allow") {
      yield* requestApproval(
        "Allow the agent to capture and read the selected screen?",
        "Screen capture was not approved.",
      );
    }
  },
);

const screenshot = McpToolAccess.readsAsCaller(
  (input: { readonly includeImage?: boolean | undefined }) =>
    Effect.gen(function* () {
      yield* requireAccess;
      yield* authorizeComputerUseScreenshot();
      const computer = yield* service;
      const { imageData, screenWidth, screenHeight, imageWidth, imageHeight } =
        yield* computer.screenshot({ includeImage: input.includeImage !== false });
      return {
        screenWidth,
        screenHeight,
        ...(imageData === null
          ? {}
          : {
              screenshot: {
                mimeType: "image/png" as const,
                data: imageData,
                width: imageWidth,
                height: imageHeight,
              },
            }),
      };
    }),
);

const computerUse = McpToolAccess.actsAsCaller((input: typeof ComputerUseInput.Type) =>
  Effect.gen(function* () {
    yield* requireAccess;
    yield* authorizeComputerUseAction(input);
    const computer = yield* service;
    switch (input.action) {
      case "move":
        if (input.x === undefined || input.y === undefined) {
          return yield* new ComputerUseError({
            operation: "pointer",
            reason: "Move requires x and y screen coordinates.",
          });
        }
        yield* computer.movePointer({ x: input.x, y: input.y });
        break;
      case "click":
        if (input.x === undefined || input.y === undefined) {
          return yield* new ComputerUseError({
            operation: "click",
            reason: "Click requires x and y screen coordinates.",
          });
        }
        yield* computer.click({
          x: input.x,
          y: input.y,
          ...(input.button === undefined ? {} : { button: input.button }),
        });
        break;
      case "double_click":
        if (input.x === undefined || input.y === undefined) {
          return yield* new ComputerUseError({
            operation: "click",
            reason: "Double-click requires x and y screen coordinates.",
          });
        }
        yield* computer.click({
          x: input.x,
          y: input.y,
          clickCount: 2,
          ...(input.button === undefined ? {} : { button: input.button }),
        });
        break;
      case "drag":
        if (
          input.startX === undefined ||
          input.startY === undefined ||
          input.endX === undefined ||
          input.endY === undefined
        ) {
          return yield* new ComputerUseError({
            operation: "pointer",
            reason: "Drag requires startX, startY, endX, and endY coordinates.",
          });
        }
        yield* computer.drag({
          startX: input.startX,
          startY: input.startY,
          endX: input.endX,
          endY: input.endY,
          ...(input.button === undefined ? {} : { button: input.button }),
        });
        break;
      case "scroll":
        if (input.x === undefined || input.y === undefined) {
          return yield* new ComputerUseError({
            operation: "pointer",
            reason: "Scroll requires x and y screen coordinates.",
          });
        }
        yield* computer.scroll({
          x: input.x,
          y: input.y,
          ...(input.deltaX === undefined ? {} : { deltaX: input.deltaX }),
          ...(input.deltaY === undefined ? {} : { deltaY: input.deltaY }),
        });
        break;
      case "type":
        if (input.text === undefined) {
          return yield* new ComputerUseError({
            operation: "keyboard",
            reason: "Type requires text.",
          });
        }
        yield* computer.typeText({ text: input.text });
        break;
      case "press_key":
        if (input.key === undefined) {
          return yield* new ComputerUseError({
            operation: "keyboard",
            reason: "Press key requires a key name.",
          });
        }
        yield* computer.pressKey({
          key: input.key,
          ...(input.modifiers === undefined ? {} : { modifiers: input.modifiers }),
        });
        break;
    }
    return { completed: true as const };
  }),
);

export const layerAction = McpToolAccess.toLayer(ComputerUseToolkit, {
  computer_use: computerUse,
});

export const layerScreenshot = McpToolAccess.toLayer(ComputerUseScreenshotToolkit, {
  computer_use_screenshot: screenshot,
});
