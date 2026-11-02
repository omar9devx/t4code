import { assert, describe, it } from "@effect/vitest";

import {
  T4_CODE_DEVICE_TOOL_INSTRUCTIONS,
  T4_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH,
  T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS,
  T4_CODE_ORCHESTRATION_INSTRUCTIONS,
  t4AcpPromptWithInstructions,
  t4OrchestrationPrompt,
  t4OrchestrationSystemPrompt,
} from "./orchestrationInstructions.ts";

describe("T4 Code tool instructions", () => {
  it("route device work through device_open and give Claude the line that loads the tools", () => {
    for (const intent of ["`device_list`", "`device_open`", "`agent-device`", "ssh", "`hostId`"]) {
      assert.include(T4_CODE_DEVICE_TOOL_INSTRUCTIONS, intent);
    }
    assert.notInclude(T4_CODE_DEVICE_TOOL_INSTRUCTIONS, "ToolSearch");
    const loadLine =
      " Load them with ToolSearch `select:mcp__t4-code__device_list,mcp__t4-code__device_open,mcp__t4-code__device_screenshot,mcp__t4-code__device_close`.";
    assert.include(T4_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH, loadLine);
    assert.equal(
      T4_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH.replace(loadLine, ""),
      T4_CODE_DEVICE_TOOL_INSTRUCTIONS,
    );
  });

  it("open the app before the returned command's snapshots, screenshots and input", () => {
    assert.include(
      T4_CODE_DEVICE_TOOL_INSTRUCTIONS,
      "its snapshots, screenshots and input need `open <app>` first,",
    );
  });

  it("keep the failure rule from taking over or closing a session another thread holds", () => {
    // agent-device's DEVICE_IN_USE advice is to rerun with the owner's --session or close it first.
    assert.include(
      T4_CODE_DEVICE_TOOL_INSTRUCTIONS,
      "follow its advice once, but never reuse or close another session; if it still fails,",
    );
  });

  it("reach OpenCode and Cursor only when the session holds device access", () => {
    assert.include(t4OrchestrationSystemPrompt(true, true), T4_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(t4OrchestrationSystemPrompt(true, false), "## T4 Code devices");
    assert.isUndefined(t4OrchestrationSystemPrompt(false, true));

    const firstRun = (hasDeviceTools: boolean) =>
      t4OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasT4Mcp: true,
        hasDeviceTools,
        hasComputerUseTools: false,
        orchestrationDelivered: false,
        deviceInstructionsDelivered: false,
        computerUseInstructionsDelivered: false,
      });
    assert.include(firstRun(true), T4_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(firstRun(false), "## T4 Code devices");

    const laterRun = (deviceInstructionsDelivered: boolean) =>
      t4OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasT4Mcp: true,
        hasDeviceTools: true,
        hasComputerUseTools: false,
        orchestrationDelivered: true,
        deviceInstructionsDelivered,
        computerUseInstructionsDelivered: false,
      });
    assert.include(laterRun(false), T4_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(laterRun(false), T4_CODE_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(laterRun(true), "Check the login screen.");
  });

  it("reach ACP agents again when device access changes mid-thread", () => {
    const state = {
      interactionMode: "default",
      hasT4Mcp: true,
      hasDeviceTools: false,
      hasComputerUseTools: false,
    } as const;
    const withDevices = t4AcpPromptWithInstructions({
      prompt: "Check the login screen.",
      state: { ...state, hasDeviceTools: true },
      previousState: state,
    });
    assert.include(withDevices, T4_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.equal(
      t4AcpPromptWithInstructions({ prompt: "Again.", state, previousState: state }),
      "Again.",
    );
    assert.notInclude(t4AcpPromptWithInstructions({ prompt: "Hi.", state }), "## T4 Code devices");
  });

  it("uses T4 Code prompt boundaries while preserving the legacy MCP tool namespace", () => {
    const acp = t4AcpPromptWithInstructions({
      prompt: "Check the login screen.",
      state: {
        interactionMode: "default",
        hasT4Mcp: true,
        hasDeviceTools: false,
        hasComputerUseTools: false,
      },
    });
    const cursor = t4OrchestrationPrompt({
      prompt: "Check the login screen.",
      hasT4Mcp: true,
      hasDeviceTools: false,
      hasComputerUseTools: false,
      orchestrationDelivered: false,
      deviceInstructionsDelivered: false,
      computerUseInstructionsDelivered: false,
    });

    assert.include(acp, "<t4_code_instructions>");
    assert.notInclude(acp, "<t4_code_instructions>");
    assert.include(cursor, "<t4_code_orchestration_instructions>");
    assert.notInclude(cursor, "<t4_code_orchestration_instructions>");
    assert.include(T4_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH, "mcp__t4-code__");
  });

  it("routes Computer Use through T4 tools for ACP, Cursor, and OpenCode only when granted", () => {
    assert.include(
      t4OrchestrationSystemPrompt(true, false, true),
      T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS,
    );
    assert.notInclude(
      t4OrchestrationSystemPrompt(true, false),
      T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS,
    );
    assert.isUndefined(t4OrchestrationSystemPrompt(false, false, true));

    const state = {
      interactionMode: "default",
      hasT4Mcp: true,
      hasDeviceTools: false,
      hasComputerUseTools: true,
    } as const;
    const acp = t4AcpPromptWithInstructions({ prompt: "Move the mouse.", state });
    assert.include(acp, T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS);
    const cursor = t4OrchestrationPrompt({
      prompt: "Move the mouse.",
      hasT4Mcp: true,
      hasDeviceTools: false,
      hasComputerUseTools: true,
      orchestrationDelivered: false,
      deviceInstructionsDelivered: false,
      computerUseInstructionsDelivered: false,
    });
    assert.include(cursor, T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS.trim());

    const addedLater = t4OrchestrationPrompt({
      prompt: "Move the mouse.",
      hasT4Mcp: true,
      hasDeviceTools: false,
      hasComputerUseTools: true,
      orchestrationDelivered: true,
      deviceInstructionsDelivered: false,
      computerUseInstructionsDelivered: false,
    });
    assert.include(addedLater, T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS.trim());
  });
});
