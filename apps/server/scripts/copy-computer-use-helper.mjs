import * as NodeFSP from "node:fs/promises";

await NodeFSP.copyFile(
  new URL("../src/computerUse/computerUsePortal.py", import.meta.url),
  new URL("../dist/computerUsePortal.py", import.meta.url),
);
