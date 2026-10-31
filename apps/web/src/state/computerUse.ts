import { createEnvironmentRpcCommand } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";

export const computerUseEnvironment = {
  selectScreen: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:computer-use:select-screen",
    tag: WS_METHODS.computerUseSelectScreen,
  }),
};
