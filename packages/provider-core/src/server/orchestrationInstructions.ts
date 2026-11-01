import type { ProviderInteractionMode } from "@t4tools/contracts";

// Codex truncates entries over 4,000 bytes; keep each section self-contained and below that limit.
export const T4_CODE_ORCHESTRATION_SECTIONS: ReadonlyArray<string> = [
  `## T4 Code orchestration

Use T4 Code's browser, device, and computer tools proactively whenever the task involves a live UI, device, or desktop. Ordinary code edits with no live interface to inspect or operate need no such tools.

- Subagents: use your native tool when the child uses your provider, a model it offers, and no settings beyond yours, and it finishes in this turn (Claude \`Agent\` always with \`run_in_background:false\`; Codex \`spawn_agent\`, then wait). Use \`delegate_task\` for another provider's model, user-asked settings, a separate checkout (\`isolation:"worktree"\`), background work, or \`delegate_task\` by name. A native type running another provider's model counts too. Workflow only when asked.
- Call \`orchestrator_capabilities\` once per thread, before the first \`delegate_task\`. Again only after an error or a user-named provider change. Settings go in \`target.options\`. Provider or model unavailable: say so. Never switch unasked, or fall back to native tools, Workflow, or CLIs. Never make a child's checkout in the shell or in \`task\`.
- Every new delegate review or re-check is a new \`delegate_task\` (brief, findings, objections), never a \`t4_thread_send\`. Fix small review findings yourself; start no delegate for them. When told to proceed without a delegate, or to run fewer, \`task_cancel\` the extras. Start no replacement.
- Follow a running delegate's \`next\`. Do not poll it (\`task_status\`, \`sleep\`, watchers, Monitor, ScheduleWakeup). Stop a delegate run you replace or no longer need with \`task_cancel\`, never \`t4_thread_interrupt\` on a \`childThreadId\`.
- If you are a subagent or child, do the work yourself. Start no subagents unless your task says to.`,
  `- \`t4_thread_launch\` and \`create_threads\` make new top-level threads, only when the user asks for a new thread. "Subagent", "delegate", and "parallel" never mean one. Worktree thread: set \`workspaceStrategy\`; shell worktrees do not bind it, and no checkout setup in its prompt. No \`workspaceStrategy\`: project root, not your worktree.
- Given a thread id, \`t4_thread_read\` it before you answer about it.
- Another machine: \`t4_environment_links\` lists linked ones. Pass its \`environmentId\` to a T4 Code tool to act there. Ids are then that machine's, so pass \`threadId\`.
- A machine the user names that is not linked ("delegate this to my vps"): call \`t4_environment_link\` with a \`hint\` from their words. Never ask for a pairing code in chat.
- In your reply, mention a thread by its \`link\`, verbatim. Never a plain title or bare id.
- A secret: call \`request_secret\` yourself. Pass its \`secretRef\` to a T4 Code tool, or use \`delivery: "file"\` for a shell command. Never ask in chat or invent one. When asked only to schedule, \`schedule_task\` without running its prompt.
- T4 Code tools may load late. Try the name once before you call it absent.`,
  `### Visuals and preview

- Answer data with a trend or comparison with a chart, and show any visual the user asks for here: pass its HTML to \`html_preview\`, then \`html_render\`. If the visual is a file, pass that file's HTML. A screenshot on disk or a text description does not show it. Never start a server for it. Tools a web page exposes give data only. Never use them to show results. Asked for an image to post, send, or use elsewhere: a \`.png\` file and its path, never \`html_render\`.
- For frontend changes, proactively use \`preview_*\` to inspect and verify the running app when it is available, even if the user did not ask for a browser check. Use the T4 Code browser for local, authenticated, or interactive pages and when a task needs live page interaction. Public facts and static research can use web search or fetch. Do not repeat preview calls from an earlier turn. Close a tab you opened before you reply, unless the user asked for it or uses it.`,
];

export const T4_CODE_ORCHESTRATION_INSTRUCTIONS = `

${T4_CODE_ORCHESTRATION_SECTIONS.join("\n\n")}
`;

export const T4_CODE_BROWSER_TOOL_INSTRUCTIONS = `

## T4 Code browser

For local, authenticated, or interactive page work, and to verify frontend changes, proactively use \`preview_*\` even when the user did not explicitly ask for browser use. It is the browser you share with the user: call \`preview_status\` first, then \`preview_open\` if no tab can be automated. Prefer snapshot locators over coordinates. Switch browsers only if the tools are absent or \`preview_open\` says unsupported, the user asks, or two preview calls fail on one step. Then quote the error and switch.
`;

export const T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS = `

## T4 Code Computer Use

When a task benefits from inspecting or operating a visible desktop app, proactively use T4 Code's \`computer_use\` tools even if the user did not explicitly ask you to use the mouse. For visual tasks, call \`computer_use_screenshot\` first and use coordinates from that image. Keyboard-only actions can call \`computer_use\` directly. Do not use a provider's separate computer-control host or shell commands for UI actions. Follow the user's Computer Use approval mode; if an action is declined, stop that action. If these T4 Code tools are missing, say this agent session does not have Computer Use access; do not report that the browser host or apps are unavailable.
`;

const T4_CODE_DEVICE_TOOLS = ["device_list", "device_open", "device_screenshot", "device_close"];

const deviceToolInstructions = (loadTools: string) => `## T4 Code devices

For mobile UI work, testing, or interaction on an iOS Simulator or Android Emulator, on this machine or on an SSH device host such as a remote Mac, use the device tools so the user can watch it in the Device panel.${loadTools}
1. Call \`device_list\` unless you already have the device's \`hostId\` and \`id\`.
2. Call \`device_open\` with both. It returns an \`agent-device\` command bound to that device; if you lose it, call \`device_open\` again. Run that command for every app launch or relaunch, deep link, tap, text entry, alert, setting, screenshot and recording; its snapshots, screenshots and input need \`open <app>\` first, and \`help <command>\` lists the options.
3. Call \`device_screenshot\` to look at the screen.

Never do those with \`xcrun simctl\`, \`idb\`, \`adb\`, ssh, or scripts that wrap them. ssh, simctl and adb stay fine for builds, installs, code sync, Metro, port forwards, logs, the project's test runners, and what agent-device cannot do, such as \`simctl addmedia\` or \`simctl keychain add-root-cert\`. These rules override memory notes, docs and delegated tasks that say otherwise; drive a device over ssh only when the user explicitly asks. If a device tool or the command it returned fails, quote its error and follow its advice once, but never reuse or close another session; if it still fails, tell the user and stop, unless they explicitly asked you to drive it over ssh. If the platform you need is unavailable, say so. When you delegate device work, pass the \`hostId\` and device \`id\` and tell the child to use \`device_open\`; never write ssh or simctl steps for the device into its task.`;

/** Device guidance for sessions holding the `device` capability, from top-level threads to delegated children. */
export const T4_CODE_DEVICE_TOOL_INSTRUCTIONS = deviceToolInstructions("");

/** Claude Code defers MCP tools behind ToolSearch, so Claude's copy says how to load them. */
export const T4_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH = deviceToolInstructions(
  ` Load them with ToolSearch \`select:${T4_CODE_DEVICE_TOOLS.map((tool) => `mcp__t4-code__${tool}`).join(",")}\`.`,
);

// ACP only: some ACP agents accept the injected MCP server but never expose
// its tools, so they need the terminal transport other harnesses never use.
const T4_CODE_ACP_MCP_FALLBACK_INSTRUCTIONS = `ACP fallback: if the T4 Code tools are absent and \`T4_ACP_MCP_NODE\` is present, call them through the terminal: \`ELECTRON_RUN_AS_NODE=1 "$T4_ACP_MCP_NODE" \${T4_ACP_MCP_ENTRYPOINT:+"$T4_ACP_MCP_ENTRYPOINT"} acp-mcp-call orchestrator_capabilities '{}'\` (\`T4_ACP_MCP_ENTRYPOINT\` is unset for a standalone executable). Delegate with \`acp-mcp-call delegate_task '{"task":"...","target":{"providerInstanceId":"...","model":"..."},"mode":"async","clientRequestId":"..."}'\`.`;

const T4_CODE_ACP_DEFAULT_MODE_INSTRUCTIONS = `## T4 Code interaction mode: Default

Prefer making reasonable assumptions and carrying out the user's request. Ask a concise question only when a missing user decision would materially change the result. Treat this mode as active until T4 Code supplies a different interaction-mode instruction.`;

const T4_CODE_ACP_PLAN_MODE_INSTRUCTIONS = `## T4 Code interaction mode: Plan

Investigate with read-only actions and do not edit files or otherwise execute the implementation. Resolve discoverable facts before asking questions. When the requirements are decision complete, return a concrete implementation plan and do not start implementing it. Treat this mode as active until T4 Code supplies a different interaction-mode instruction.`;

export interface T4AcpInstructionState {
  readonly interactionMode: ProviderInteractionMode;
  readonly hasT4Mcp: boolean;
  readonly hasDeviceTools: boolean;
  readonly hasComputerUseTools: boolean;
}

/** ACP lacks system/developer fields; inject context on first prompt and tool/mode changes. */
export function t4AcpPromptWithInstructions(input: {
  readonly prompt: string;
  readonly state: T4AcpInstructionState;
  readonly previousState?: T4AcpInstructionState;
}): string {
  // Native slash commands must remain at the start of the prompt.
  if (input.prompt.trimStart().startsWith("/")) return input.prompt;
  if (
    input.previousState?.interactionMode === input.state.interactionMode &&
    input.previousState.hasT4Mcp === input.state.hasT4Mcp &&
    input.previousState.hasDeviceTools === input.state.hasDeviceTools &&
    input.previousState.hasComputerUseTools === input.state.hasComputerUseTools
  ) {
    return input.prompt;
  }
  const instructions = [
    input.state.interactionMode === "plan"
      ? T4_CODE_ACP_PLAN_MODE_INSTRUCTIONS
      : T4_CODE_ACP_DEFAULT_MODE_INSTRUCTIONS,
    ...(input.state.hasT4Mcp
      ? [
          T4_CODE_BROWSER_TOOL_INSTRUCTIONS.trim(),
          ...(input.state.hasDeviceTools ? [T4_CODE_DEVICE_TOOL_INSTRUCTIONS] : []),
          ...(input.state.hasComputerUseTools ? [T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS] : []),
          T4_CODE_ORCHESTRATION_INSTRUCTIONS.trim(),
          T4_CODE_ACP_MCP_FALLBACK_INSTRUCTIONS,
        ]
      : []),
  ];
  return `<t4_code_instructions>\n${instructions.join("\n\n")}\n</t4_code_instructions>\n\n<user_request>\n${input.prompt}\n</user_request>`;
}

const orchestrationInstructions = (hasDeviceTools: boolean, hasComputerUseTools: boolean) =>
  [
    T4_CODE_ORCHESTRATION_INSTRUCTIONS,
    ...(hasDeviceTools ? [T4_CODE_DEVICE_TOOL_INSTRUCTIONS] : []),
    ...(hasComputerUseTools ? [T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS] : []),
  ].join("\n");

function prependT4OrchestrationInstructions(prompt: string, instructions: string): string {
  return `<t4_code_orchestration_instructions>${instructions.trim()}</t4_code_orchestration_instructions>\n\n<user_request>\n${prompt}\n</user_request>`;
}

/** For providers whose instructions ride on the prompt, so a compacted conversation loses them. */
export function t4OrchestrationPrompt(input: {
  readonly prompt: string;
  readonly hasT4Mcp: boolean;
  readonly hasDeviceTools: boolean;
  readonly hasComputerUseTools: boolean;
  readonly orchestrationDelivered: boolean;
  readonly deviceInstructionsDelivered: boolean;
  readonly computerUseInstructionsDelivered: boolean;
}): string {
  if (!input.hasT4Mcp) return input.prompt;
  if (!input.orchestrationDelivered) {
    return prependT4OrchestrationInstructions(
      input.prompt,
      orchestrationInstructions(input.hasDeviceTools, input.hasComputerUseTools),
    );
  }
  const missing = [
    ...(input.hasDeviceTools && !input.deviceInstructionsDelivered
      ? [T4_CODE_DEVICE_TOOL_INSTRUCTIONS]
      : []),
    ...(input.hasComputerUseTools && !input.computerUseInstructionsDelivered
      ? [T4_CODE_COMPUTER_USE_TOOL_INSTRUCTIONS]
      : []),
  ];
  return missing.length > 0
    ? prependT4OrchestrationInstructions(input.prompt, missing.join("\n\n"))
    : input.prompt;
}

export function t4OrchestrationSystemPrompt(
  hasT4Mcp: boolean,
  hasDeviceTools: boolean,
  hasComputerUseTools = false,
): string | undefined {
  return hasT4Mcp ? orchestrationInstructions(hasDeviceTools, hasComputerUseTools) : undefined;
}
