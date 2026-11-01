import type { ProviderDriverKind, ProviderInstanceId, ServerProvider } from "@t4tools/contracts";
import type * as Stream from "effect/Stream";
import type { ManagedServerProvider } from "@t4tools/provider-core/server/snapshot";

export type ProviderSnapshotSource = {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: ProviderDriverKind;
  readonly getSnapshot: ManagedServerProvider["getSnapshot"];
  readonly refresh: ManagedServerProvider["refresh"];
  readonly streamChanges: Stream.Stream<ServerProvider>;
};
