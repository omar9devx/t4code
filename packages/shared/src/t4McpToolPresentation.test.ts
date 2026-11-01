import { describe, expect, it } from "vite-plus/test";

import {
  T4_MCP_TOOL_NAMES,
  resolveT4McpSummaryAction,
  resolveT4McpToolDefinition,
  resolveT4McpToolPresentation,
} from "./t4McpToolPresentation.ts";

describe("resolveT4McpToolPresentation", () => {
  it("recognizes every T4 Code tool across provider prefixes and completion suffixes", () => {
    for (const tool of T4_MCP_TOOL_NAMES) {
      const presentation = resolveT4McpToolPresentation(tool);
      for (const prefix of [
        "mcp__t4-code__",
        "mcp__t4_code__",
        "mcp__T4CODE__",
        "T4 Code-code.",
        "T4_code/",
        "T4CODE:",
        "mcp_t4-code_",
        "T4 Code ",
        "t4-code · ",
      ]) {
        expect(resolveT4McpToolPresentation(`${prefix}${tool} completed`), tool).toEqual(
          presentation,
        );
      }
      expect(resolveT4McpToolPresentation(`mcp__another-server__${tool}`), tool).toBeNull();
    }
  });

  it("matches OpenCode 2's per-thread server names, whose thread ids hold underscores", () => {
    expect(
      resolveT4McpToolPresentation("t4-code-thread_opencode2-adapter_delegate_task")?.displayName,
    ).toBe("Delegate a child task");
    expect(resolveT4McpToolPresentation("t4-code-thread_opencode2-adapter_not_a_tool")).toBeNull();
  });
});

describe("resolveT4McpToolDefinition", () => {
  it("labels an action tool call as the action it ran", () => {
    expect(
      resolveT4McpToolDefinition("mcp__t4-code__preview_act", { action: "type" })?.labels,
    ).toEqual(resolveT4McpToolDefinition("preview_type")?.labels);
    expect(resolveT4McpToolDefinition("T4_thread_transfer", { action: "fork" })?.displayName).toBe(
      resolveT4McpToolDefinition("T4_thread_fork")?.displayName,
    );
    expect(resolveT4McpToolDefinition("preview_act", { action: "unknown" })?.labels[2]).toBe(
      "Used",
    );
  });
});

describe("resolveT4McpSummaryAction", () => {
  it("summarizes an action tool by the action each call ran", () => {
    expect(resolveT4McpSummaryAction("mcp__t4-code__t4_queue", { action: "list" })).toBe(
      "queue-list",
    );
    expect(resolveT4McpSummaryAction("T4_queue", { action: "edit" })).toBe("queue-edit");
    expect(resolveT4McpSummaryAction("T4_thread_transfer", { action: "status" })).toBe(
      "thread-transfers",
    );
    expect(resolveT4McpSummaryAction("T4_thread_configure", {})).toBe("thread-configuration");
    expect(resolveT4McpSummaryAction("schedule_task", { scheduledTaskId: "task-1" })).toBe(
      "schedule-update",
    );
    expect(resolveT4McpSummaryAction("delegate_task", { task: "x" })).toBe("delegate");
  });
});
