import type { V2TurnStartParams__AdditionalContextEntry } from "effect-codex-app-server/schema";
import { buildRuntimeInstructions } from "@t4tools/provider-core/server/runtimeInstructions";

import {
  T4_CODE_BROWSER_TOOL_INSTRUCTIONS,
  T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS,
  T4_CODE_DEVICE_TOOL_INSTRUCTIONS,
  T4_CODE_ORCHESTRATION_SECTIONS,
} from "@t4tools/provider-core/server/orchestrationInstructions";

/** Codex silently truncates additionalContext values over 1,000 tokens, counted as UTF-8 bytes / 4. */
export const CODEX_ADDITIONAL_CONTEXT_VALUE_MAX_BYTES = 4_000;

export interface T4CODEToolAvailability {
  readonly browser: boolean;
  readonly device: boolean;
  readonly computerUse: boolean;
}

const normalizeAvailability = (
  availability: boolean | T4CODEToolAvailability,
): T4CODEToolAvailability =>
  typeof availability === "boolean"
    ? { browser: availability, device: false, computerUse: false }
    : availability;

/** Instructions for unavailable tools would steer the model away from its remaining automation. */
const toolInstructions = (availability: boolean | T4CODEToolAvailability): string => {
  const tools = normalizeAvailability(availability);
  return [
    tools.browser ? T4_CODE_BROWSER_TOOL_INSTRUCTIONS : "",
    tools.device ? T4_CODE_DEVICE_TOOL_INSTRUCTIONS : "",
    tools.computerUse ? T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export interface CodexRuntimeInfo {
  readonly model: string;
  readonly modelName?: string | undefined;
  readonly reasoningEffort?: string | undefined;
}

/** Keep this outside collaboration mode; model-catalog mode text overrides client developer_instructions. */
export function buildCodexAdditionalContext(
  runtime: CodexRuntimeInfo,
  toolsAvailable: boolean | T4CODEToolAvailability = true,
): Record<string, V2TurnStartParams__AdditionalContextEntry> {
  const tools = toolInstructions(toolsAvailable);
  // Split values to fit per-entry caps; number keys because Codex emits them in key order.
  return {
    ...Object.fromEntries(
      T4_CODE_ORCHESTRATION_SECTIONS.map((section, index) => [
        `t4_code_orchestration_${String(index + 1).padStart(2, "0")}`,
        { kind: "application" as const, value: section },
      ]),
    ),
    t4_code_runtime: {
      kind: "application",
      value: buildRuntimeInstructions({ harness: "Codex", ...runtime }),
    },
    ...(tools ? { t4_code_tools: { kind: "application", value: tools } } : {}),
  };
}
