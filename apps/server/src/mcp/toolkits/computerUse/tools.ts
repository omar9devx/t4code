import { ComputerUseError, OrchestratorMcpFailure } from "@t4tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";

import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as ComputerUseService from "../../../computerUse/ComputerUseService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ServerSettings from "../../../serverSettings.ts";
import { McpSchema } from "effect/ai";

const dependencies = [
  McpInvocationContext.McpInvocationContext,
  ThreadManagementService.ThreadManagementService,
  ComputerUseService.ComputerUseService,
  ServerSettings.ServerSettingsService,
  McpSchema.McpServerClient,
];
const failure = Schema.Union([ComputerUseError, OrchestratorMcpFailure]);
export const ComputerUseScreenshotSuccess = Schema.Struct({
  screenWidth: Schema.Number,
  screenHeight: Schema.Number,
  screenshot: Schema.optionalKey(
    Schema.Struct({
      mimeType: Schema.Literal("image/png"),
      data: Schema.String,
      width: Schema.Number,
      height: Schema.Number,
    }),
  ),
});

export const ComputerUseScreenshotTool = Tool.make("computer_use_screenshot", {
  description:
    "Capture the screen selected in the operating system permission dialog. Requires Computer Use and screen reading to be enabled in Settings. The image is scaled to at most 1600×1000 pixels for faster agent vision; screenWidth and screenHeight report the display's logical size. Set includeImage=false to return dimensions without attaching the PNG.",
  parameters: Schema.Struct({ includeImage: Schema.optional(Schema.Boolean) }),
  success: ComputerUseScreenshotSuccess,
  failure,
  dependencies,
})
  .annotate(Tool.Title, "Capture computer screen")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

export const ComputerUseInput = Schema.Struct({
  action: Schema.Literals(["move", "click", "double_click", "drag", "scroll", "type", "press_key"]),
  x: Schema.optional(Schema.Number),
  y: Schema.optional(Schema.Number),
  startX: Schema.optional(Schema.Number),
  startY: Schema.optional(Schema.Number),
  endX: Schema.optional(Schema.Number),
  endY: Schema.optional(Schema.Number),
  button: Schema.optional(Schema.Literals(["left", "right", "middle"])),
  deltaX: Schema.optional(Schema.Number),
  deltaY: Schema.optional(Schema.Number),
  text: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
  key: Schema.optional(Schema.String.check(Schema.isMaxLength(20))),
  modifiers: Schema.optional(
    Schema.Array(Schema.Literals(["Shift", "Control", "Alt", "Meta"])).check(Schema.isMaxLength(3)),
  ),
});

const ComputerUseActionTool = Tool.make("computer_use", {
  description:
    "Control the screen the user approved. Call computer_use_screenshot first and use image pixel coordinates from its PNG; the server maps them to the selected screen. Actions: move (x,y), click or double_click (x,y, optional button), drag (startX,startY to endX,endY, optional button), scroll (x,y and deltaX/deltaY in wheel steps), type (text up to 256 characters), or press_key (key plus optional Shift, Control, Alt, or Meta modifiers). Each action is checked against the user's current Settings permissions and the desktop's portal grant; the selected approval mode may ask the user before it runs.",
  parameters: ComputerUseInput,
  success: Schema.Struct({ completed: Schema.Literal(true) }),
  failure,
  dependencies,
})
  .annotate(Tool.Title, "Control computer")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

export const ComputerUseToolkit = Toolkit.make(ComputerUseActionTool);
export const ComputerUseScreenshotToolkit = Toolkit.make(ComputerUseScreenshotTool);
