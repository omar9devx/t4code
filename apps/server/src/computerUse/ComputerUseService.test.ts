import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerSettings from "../serverSettings.ts";
import * as ComputerUseService from "./ComputerUseService.ts";

it.effect(
  "denies screen access before opening a desktop portal when Computer Use is disabled",
  () =>
    Effect.gen(function* () {
      const computer = yield* ComputerUseService.ComputerUseService;
      const failure = yield* computer.screenshot({}).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "ComputerUseError",
        operation: "permission",
      });
    }).pipe(
      Effect.provide(
        ComputerUseService.layer.pipe(
          Layer.provide(ServerSettings.ServerSettingsService.layerTest()),
        ),
      ),
      Effect.scoped,
    ),
);

it.effect("requires pointer permission before a drag can open the desktop session", () =>
  Effect.gen(function* () {
    const computer = yield* ComputerUseService.ComputerUseService;
    const failure = yield* computer
      .drag({ startX: 2, startY: 3, endX: 10, endY: 20 })
      .pipe(Effect.flip);
    expect(failure).toMatchObject({
      _tag: "ComputerUseError",
      operation: "permission",
      reason: "The agent does not have the pointer permission.",
    });
  }).pipe(
    Effect.provide(
      ComputerUseService.layer.pipe(
        Layer.provide(
          ServerSettings.ServerSettingsService.layerTest({
            enableComputerUseSupport: true,
            enableAgentComputerUseAccess: true,
            computerUsePermissions: { screen: true, pointer: false, click: true, keyboard: false },
          }),
        ),
      ),
    ),
    Effect.scoped,
  ),
);
