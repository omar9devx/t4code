import { createEnvironmentRpcCommand } from "@t4tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t4tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";

export const computerUseEnvironment = {
  selectScreen: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:computer-use:select-screen",
    tag: WS_METHODS.computerUseSelectScreen,
  }),
};
