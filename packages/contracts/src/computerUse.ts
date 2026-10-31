import * as Schema from "effect/Schema";

export class ComputerUseError extends Schema.TaggedError<ComputerUseError>()("ComputerUseError", {
  operation: Schema.Literals([
    "availability",
    "permission",
    "portal",
    "capture",
    "pointer",
    "click",
    "keyboard",
    "close",
  ]),
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    return this.reason;
  }
}
