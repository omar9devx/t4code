import type { OrchestrationV2ThreadTranscript } from "@t4tools/contracts";

function headingText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("#", "\\#").replaceAll("\n", " ").trim();
}

export function threadTranscriptMarkdown(transcript: OrchestrationV2ThreadTranscript): string {
  const sections = [`# ${headingText(transcript.title)}`, `Updated: ${transcript.updatedAt}`];

  for (const { item } of transcript.items) {
    if (item.type !== "user_message" && item.type !== "assistant_message") continue;
    const text = item.text.trim();
    if (!text && !item.textOmitted) continue;

    const role = item.type === "user_message" ? "User" : "Assistant";
    sections.push(`## ${role}`, text || "[Message body omitted from transcript]");
  }

  if (sections.length === 2) sections.push("_No messages in this thread._");
  return `${sections.join("\n\n")}\n`;
}
