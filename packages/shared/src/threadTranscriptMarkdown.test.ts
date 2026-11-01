import { describe, expect, it } from "vite-plus/test";

import type { OrchestrationV2ThreadTranscript } from "@t4tools/contracts";
import { threadTranscriptMarkdown } from "./threadTranscriptMarkdown.ts";

describe("threadTranscriptMarkdown", () => {
  it("exports user and assistant messages while skipping internal activity", () => {
    const transcript = {
      title: "Fix chat rendering",
      updatedAt: "2026-10-31T12:00:00.000Z",
      items: [
        { item: { type: "user_message", text: "Find the bug", textOmitted: false } },
        { item: { type: "reasoning", text: "private reasoning" } },
        { item: { type: "assistant_message", text: "Fixed it", textOmitted: false } },
      ],
    } as unknown as OrchestrationV2ThreadTranscript;

    expect(threadTranscriptMarkdown(transcript)).toBe(
      "# Fix chat rendering\n\nUpdated: 2026-10-31T12:00:00.000Z\n\n" +
        "## User\n\nFind the bug\n\n## Assistant\n\nFixed it\n",
    );
  });

  it("marks omitted message bodies and escapes the title heading", () => {
    const transcript = {
      title: "# Summary\nDetails",
      updatedAt: "2026-10-31T12:00:00.000Z",
      items: [{ item: { type: "user_message", text: "", textOmitted: true } }],
    } as unknown as OrchestrationV2ThreadTranscript;

    expect(threadTranscriptMarkdown(transcript)).toContain(
      "# \\# Summary Details\n\nUpdated: 2026-10-31T12:00:00.000Z",
    );
    expect(threadTranscriptMarkdown(transcript)).toContain(
      "[Message body omitted from transcript]",
    );
  });
});
