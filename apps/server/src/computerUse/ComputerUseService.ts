// @effect-diagnostics nodeBuiltinImport:off preferSchemaOverJson:off -- The portal helper is a local native-runtime process boundary using NDJSON.
import * as NodeChildProcess from "node:child_process";
import * as NodeReadline from "node:readline";
import * as NodeURL from "node:url";
import { ComputerUseError, type ServerSettings as ServerSettingsValue } from "@t4tools/contracts";
import * as HostProcess from "@t4tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as ServerSettings from "../serverSettings.ts";

const MAX_TEXT_LENGTH = 256;
const PORTAL_HELPER = NodeURL.fileURLToPath(
  new URL("./computerUsePortal.py", import.meta.url),
).replace(/\.asar([/\\])/, ".asar.unpacked$1");

type PortalReply = {
  readonly ok: boolean;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
};

type PortalClient = {
  readonly child: NodeChildProcess.ChildProcessWithoutNullStreams;
  closed: boolean;
  readonly pending: Array<{
    readonly resolve: (reply: PortalReply) => void;
    readonly reject: (cause: Error) => void;
  }>;
  queue: Promise<void>;
};

type ActiveSession = {
  readonly client: PortalClient;
  readonly streamId: number | null;
  readonly width: number;
  readonly height: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly permissionsKey: string;
};

const permissionKey = (permissions: ServerSettingsValue["computerUsePermissions"]) =>
  `${Number(permissions.screen)}${Number(permissions.pointer)}${Number(permissions.click)}${Number(permissions.keyboard)}`;

export class ComputerUseService extends Context.Service<
  ComputerUseService,
  {
    readonly selectScreen: Effect.Effect<void, ComputerUseError>;
    readonly screenshot: (options: { readonly includeImage?: boolean }) => Effect.Effect<
      {
        readonly imageData: string | null;
        readonly screenWidth: number;
        readonly screenHeight: number;
        readonly imageWidth: number;
        readonly imageHeight: number;
      },
      ComputerUseError
    >;
    readonly movePointer: (input: {
      readonly x: number;
      readonly y: number;
    }) => Effect.Effect<void, ComputerUseError>;
    readonly click: (input: {
      readonly x: number;
      readonly y: number;
      readonly button?: "left" | "right" | "middle";
      readonly clickCount?: 1 | 2;
    }) => Effect.Effect<void, ComputerUseError>;
    readonly drag: (input: {
      readonly startX: number;
      readonly startY: number;
      readonly endX: number;
      readonly endY: number;
      readonly button?: "left" | "right" | "middle";
    }) => Effect.Effect<void, ComputerUseError>;
    readonly scroll: (input: {
      readonly x: number;
      readonly y: number;
      readonly deltaX?: number;
      readonly deltaY?: number;
    }) => Effect.Effect<void, ComputerUseError>;
    readonly typeText: (input: { readonly text: string }) => Effect.Effect<void, ComputerUseError>;
    readonly pressKey: (input: {
      readonly key: string;
      readonly modifiers?: ReadonlyArray<"Shift" | "Control" | "Alt" | "Meta">;
    }) => Effect.Effect<void, ComputerUseError>;
    readonly close: Effect.Effect<void, ComputerUseError>;
  }
>()("t4/computerUse/ComputerUseService") {}

const error = (operation: ComputerUseError["operation"], reason: string, cause?: unknown) =>
  new ComputerUseError({ operation, reason, ...(cause === undefined ? {} : { cause }) });

function createPortalClient(): PortalClient {
  const child = NodeChildProcess.spawn("python3", [PORTAL_HELPER], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const pending: PortalClient["pending"] = [];
  const lines = NodeReadline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    const current = pending.shift();
    if (!current) return;
    try {
      current.resolve(JSON.parse(line) as PortalReply);
    } catch (cause) {
      current.reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
  const client: PortalClient = { child, pending, queue: Promise.resolve(), closed: false };
  child.on("error", (cause) => {
    client.closed = true;
    while (pending.length > 0) pending.shift()?.reject(cause);
  });
  child.on("close", (code, signal) => {
    client.closed = true;
    const cause = new Error(`Desktop portal helper exited (${signal ?? code ?? "unknown"}).`);
    while (pending.length > 0) pending.shift()?.reject(cause);
  });
  return client;
}

function portalRequest(client: PortalClient, command: Record<string, unknown>) {
  const current = client.queue.then(
    () =>
      new Promise<PortalReply>((resolve, reject) => {
        client.pending.push({ resolve, reject });
        client.child.stdin.write(`${JSON.stringify(command)}\n`, (cause) => {
          if (cause) {
            const pending = client.pending.pop();
            pending?.reject(cause);
          }
        });
      }),
  );
  client.queue = current.then(
    () => undefined,
    () => undefined,
  );
  return current.then((reply) => {
    if (!reply.ok) throw new Error(reply.error ?? "The desktop portal request failed.");
    return reply.result ?? {};
  });
}

const make = Effect.gen(function* () {
  const settings = yield* ServerSettings.ServerSettingsService;
  let active: ActiveSession | undefined;
  const getSettings = settings.getSettings.pipe(
    Effect.mapError((cause) => error("permission", "Could not read Computer Use settings.", cause)),
  );

  const enabledFor = Effect.fn("ComputerUseService.enabledFor")(function* (
    permission: "screen" | "pointer" | "click" | "keyboard",
  ) {
    const platform = yield* HostProcess.Platform;
    const environment = yield* HostProcess.Environment;
    const current = yield* getSettings;
    if (!current.enableComputerUseSupport || !current.enableAgentComputerUseAccess) {
      return yield* error(
        "permission",
        "Computer Use is off. Enable it and grant agent access in Settings > Integrations > Computer Use.",
      );
    }
    if (!current.computerUsePermissions[permission]) {
      return yield* error("permission", `The agent does not have the ${permission} permission.`);
    }
    if (
      (permission === "pointer" || permission === "click") &&
      !current.computerUsePermissions.screen
    ) {
      return yield* error(
        "permission",
        "Screen reading is required for coordinate-based mouse actions.",
      );
    }
    if (
      platform !== "linux" ||
      (environment.XDG_SESSION_TYPE !== "wayland" && !environment.WAYLAND_DISPLAY)
    ) {
      return yield* error(
        "availability",
        "Computer Use currently requires a Linux Wayland desktop with XDG portals and Python GObject/GStreamer bindings.",
      );
    }
    return current.computerUsePermissions;
  });

  const closeSession = async (session: ActiveSession) => {
    try {
      await portalRequest(session.client, { action: "close" });
    } finally {
      session.client.child.stdin.end();
    }
  };

  const close = Effect.fn("ComputerUseService.close")(function* () {
    if (!active) return;
    const session = active;
    active = undefined;
    yield* Effect.tryPromise({
      try: () => closeSession(session),
      catch: (cause) => error("close", "Could not close the computer control session.", cause),
    });
  });

  yield* Effect.addFinalizer(() => close().pipe(Effect.ignore));

  const settingsChanges = yield* settings.subscribeChanges.pipe(
    Effect.mapError((cause) => error("close", "Could not observe Computer Use settings.", cause)),
  );
  yield* Stream.runForEach(settingsChanges, (next) =>
    active !== undefined &&
    (!next.enableComputerUseSupport ||
      !next.enableAgentComputerUseAccess ||
      permissionKey(next.computerUsePermissions) !== active.permissionsKey)
      ? close().pipe(Effect.ignore)
      : Effect.void,
  ).pipe(Effect.forkScoped);

  let opening: { readonly key: string; readonly promise: Promise<ActiveSession> } | undefined;
  const startSession = (
    permissions: ServerSettingsValue["computerUsePermissions"],
  ): Promise<ActiveSession> => {
    const key = permissionKey(permissions);
    if (active?.client.closed) active = undefined;
    if (active?.permissionsKey === key) return Promise.resolve(active);
    if (opening) {
      if (opening.key === key) return opening.promise;
      return opening.promise.then(() => startSession(permissions));
    }
    const promise = (async () => {
      if (active) {
        const previous = active;
        active = undefined;
        await closeSession(previous);
      }
      const client = createPortalClient();
      try {
        const started = await portalRequest(client, { action: "start", permissions });
        const session: ActiveSession = {
          client,
          streamId: permissions.screen ? Number(started.streamId) : null,
          width: Number(started.screenWidth ?? 0),
          height: Number(started.screenHeight ?? 0),
          frameWidth: Number(started.frameWidth ?? 0),
          frameHeight: Number(started.frameHeight ?? 0),
          permissionsKey: key,
        };
        active = session;
        return session;
      } catch (cause) {
        client.child.kill("SIGTERM");
        throw cause;
      }
    })().finally(() => {
      if (opening?.promise === promise) opening = undefined;
    });
    opening = { key, promise };
    return promise;
  };

  const requireSession = Effect.fn("ComputerUseService.requireSession")(function* (
    permission: "screen" | "pointer" | "click" | "keyboard",
  ) {
    yield* enabledFor(permission);
    const current = yield* getSettings;
    const session = yield* Effect.tryPromise({
      try: () => startSession(current.computerUsePermissions),
      catch: (cause) =>
        error(
          "portal",
          cause instanceof Error ? cause.message : "Could not start the desktop control session.",
          cause,
        ),
    });
    const latest = yield* getSettings;
    if (
      !latest.enableComputerUseSupport ||
      !latest.enableAgentComputerUseAccess ||
      permissionKey(latest.computerUsePermissions) !== session.permissionsKey
    ) {
      yield* close();
      return yield* error("permission", "Computer Use permissions changed during screen approval.");
    }
    return session;
  });

  const runAction = (
    session: ActiveSession,
    command: Record<string, unknown>,
    operation: ComputerUseError["operation"],
  ) =>
    Effect.tryPromise({
      try: () => portalRequest(session.client, command),
      catch: (cause) =>
        error(
          operation,
          cause instanceof Error
            ? cause.message
            : "The desktop rejected the requested computer action.",
          cause,
        ),
    });

  const screenshot: ComputerUseService["Service"]["screenshot"] = Effect.fn(
    "ComputerUseService.screenshot",
  )(function* ({ includeImage }: { readonly includeImage?: boolean }) {
    const session = yield* requireSession("screen");
    const shouldIncludeImage = includeImage !== false;
    const result = yield* runAction(
      session,
      { action: shouldIncludeImage ? "screenshot" : "dimensions" },
      "capture",
    );
    const data = result.png;
    if (shouldIncludeImage && typeof data !== "string")
      return yield* error("capture", "The desktop returned an invalid screen frame.");
    return {
      imageData: typeof data === "string" ? data : null,
      screenWidth: session.width,
      screenHeight: session.height,
      imageWidth: session.frameWidth,
      imageHeight: session.frameHeight,
    };
  });

  const movePointer: ComputerUseService["Service"]["movePointer"] = Effect.fn(
    "ComputerUseService.movePointer",
  )(function* ({ x, y }) {
    const session = yield* requireSession("pointer");
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      y < 0 ||
      x > session.frameWidth ||
      y > session.frameHeight
    ) {
      return yield* error("pointer", "Pointer coordinates are outside the selected screen.");
    }
    return yield* runAction(session, { action: "move", x, y }, "pointer").pipe(Effect.asVoid);
  });

  const click: ComputerUseService["Service"]["click"] = Effect.fn("ComputerUseService.click")(
    function* ({ x, y, button = "left", clickCount = 1 }) {
      const session = yield* requireSession("click");
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > session.frameWidth ||
        y > session.frameHeight
      ) {
        return yield* error("click", "Click coordinates are outside the selected screen.");
      }
      return yield* runAction(session, { action: "click", x, y, button, clickCount }, "click").pipe(
        Effect.asVoid,
      );
    },
  );

  const drag: ComputerUseService["Service"]["drag"] = Effect.fn("ComputerUseService.drag")(
    function* ({ startX, startY, endX, endY, button = "left" }) {
      yield* enabledFor("pointer");
      const session = yield* requireSession("click");
      const points = [startX, startY, endX, endY];
      if (
        points.some((point) => !Number.isFinite(point)) ||
        startX < 0 ||
        startY < 0 ||
        endX < 0 ||
        endY < 0 ||
        startX > session.frameWidth ||
        endX > session.frameWidth ||
        startY > session.frameHeight ||
        endY > session.frameHeight
      ) {
        return yield* error("pointer", "Drag coordinates are outside the selected screen.");
      }
      return yield* runAction(
        session,
        { action: "drag", startX, startY, endX, endY, button },
        "pointer",
      ).pipe(Effect.asVoid);
    },
  );

  const scroll: ComputerUseService["Service"]["scroll"] = Effect.fn("ComputerUseService.scroll")(
    function* ({ x, y, deltaX = 0, deltaY = 0 }) {
      const session = yield* requireSession("pointer");
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > session.frameWidth ||
        y > session.frameHeight ||
        !Number.isFinite(deltaX) ||
        !Number.isFinite(deltaY) ||
        Math.abs(deltaX) > 100 ||
        Math.abs(deltaY) > 100 ||
        (deltaX === 0 && deltaY === 0)
      ) {
        return yield* error("pointer", "Invalid scroll coordinates or distance.");
      }
      return yield* runAction(session, { action: "scroll", x, y, deltaX, deltaY }, "pointer").pipe(
        Effect.asVoid,
      );
    },
  );

  const typeText: ComputerUseService["Service"]["typeText"] = Effect.fn(
    "ComputerUseService.typeText",
  )(function* ({ text }) {
    const session = yield* requireSession("keyboard");
    if (text.length > MAX_TEXT_LENGTH) {
      return yield* error("keyboard", `Text is limited to ${MAX_TEXT_LENGTH} characters per call.`);
    }
    return yield* runAction(session, { action: "type", text }, "keyboard").pipe(Effect.asVoid);
  });

  const pressKey: ComputerUseService["Service"]["pressKey"] = Effect.fn(
    "ComputerUseService.pressKey",
  )(function* ({ key, modifiers = [] }) {
    const session = yield* requireSession("keyboard");
    if (key.length > 20 || modifiers.length > 3 || new Set(modifiers).size !== modifiers.length) {
      return yield* error("keyboard", "Use a supported key and up to three distinct modifiers.");
    }
    return yield* runAction(session, { action: "press_key", key, modifiers }, "keyboard").pipe(
      Effect.asVoid,
    );
  });

  const selectScreen = Effect.fn("ComputerUseService.selectScreen")(function* () {
    yield* enabledFor("screen");
    const current = yield* getSettings;
    yield* close();
    const session = yield* Effect.tryPromise({
      try: () => startSession(current.computerUsePermissions),
      catch: (cause) =>
        error("portal", "Screen selection or desktop permission was cancelled or denied.", cause),
    });
    const latest = yield* getSettings;
    if (
      !latest.enableComputerUseSupport ||
      !latest.enableAgentComputerUseAccess ||
      permissionKey(latest.computerUsePermissions) !== session.permissionsKey
    ) {
      yield* close();
      return yield* error("permission", "Computer Use permissions changed during screen approval.");
    }
  });

  return ComputerUseService.of({
    selectScreen: selectScreen(),
    screenshot,
    movePointer,
    click,
    drag,
    scroll,
    typeText,
    pressKey,
    close: close(),
  });
});

export const layer = Layer.effect(ComputerUseService, make);
