import { describe, expect, it } from "@effect/vitest";
import { vi } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";

import * as RelayConfiguration from "../Config.ts";
import * as T4ChatAccounts from "./T4ChatAccounts.ts";

const clerk = vi.hoisted(() => ({
  getUser: async (): Promise<unknown> => ({ primaryEmailAddress: { emailAddress: "a@b.co" } }),
}));
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({ users: { getUser: () => clerk.getUser() } }),
}));

const SECRET = "shared-link-secret";

const relaySettings = (
  t4Chat: RelayConfiguration.T4ChatSettings | null,
): RelayConfiguration.RelayConfiguration["Service"] => ({
  relayIssuer: "https://relay.example.test",
  apns: null,
  clerkSecretKey: Redacted.make("clerk-secret-key"),
  clerkPublishableKey: "pk_test_test",
  clerkJwtAudience: "t4-code-relay",
  apnsDeliveryJobSigningSecret: Redacted.make("apns-delivery-secret"),
  cloudMintPrivateKey: Redacted.make("cloud-mint-private-key"),
  cloudMintPublicKey: "cloud-mint-public-key",
  managedEndpointBaseDomain: undefined,
  managedEndpointNamespace: undefined,
  ...(t4Chat ? { t4Chat } : {}),
});

const fakeT4Chat = (body: unknown, status = 200) => {
  const requests: Array<{ url: string; authorization: string | undefined; body: unknown }> = [];
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      requests.push({
        url: request.url,
        authorization: request.headers["authorization"],
        body:
          request.body._tag === "Uint8Array"
            ? JSON.parse(new TextDecoder().decode(request.body.body))
            : null,
      });
      return HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  );
  return { client, requests };
};

const provide = (
  client: HttpClient.HttpClient,
  t4Chat: RelayConfiguration.T4ChatSettings | null = {
    baseUrl: "https://chat.example.test",
    linkSecret: Redacted.make(SECRET),
  },
) =>
  Effect.provide(
    T4ChatAccounts.layer.pipe(
      Layer.provide(RelayConfiguration.layer(relaySettings(t4Chat))),
      Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
    ),
  );

describe("T4ChatAccounts", () => {
  it.effect("signs link tokens in the format T4 Chat verifies", () =>
    Effect.gen(function* () {
      const accounts = yield* T4ChatAccounts.T4ChatAccounts;
      const url = new URL(yield* accounts.createLinkUrl({ userId: "user_1" }));
      expect(`${url.origin}${url.pathname}`).toBe("https://chat.example.test/link/T4CODE");

      const [payload = "", signature = ""] = (url.searchParams.get("token") ?? "").split(".");
      // Verify with Web Crypto, as T4 Chat does, rather than the signing library.
      const verified = yield* Effect.promise(async () => {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"],
        );
        return crypto.subtle.verify(
          "HMAC",
          key,
          Buffer.from(signature, "base64url"),
          encoder.encode(payload),
        );
      });
      expect(verified).toBe(true);
      expect(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))).toEqual({
        v: 1,
        sub: "user_1",
        email: "a@b.co",
        exp: 600,
      });
    }).pipe(provide(fakeT4Chat({}).client)),
  );

  it.effect("asks T4 Chat for the link with the shared secret", () => {
    const t4Chat = fakeT4Chat({ link: { email: "theo@t4.chat", plan: "premier", linkedAt: 1 } });
    return Effect.gen(function* () {
      const accounts = yield* T4ChatAccounts.T4ChatAccounts;
      const link = yield* accounts.getLink({ userId: "user_1" });
      expect(link).toEqual({ email: "theo@t4.chat", plan: "premier" });
      expect(t4Chat.requests).toEqual([
        {
          url: "https://chat.example.test/api/T4CODE/link",
          authorization: `Bearer ${SECRET}`,
          body: { clerkUserId: "user_1" },
        },
      ]);
    }).pipe(provide(t4Chat.client));
  });

  it.effect("fails instead of guessing when T4 Chat errors", () =>
    Effect.gen(function* () {
      const accounts = yield* T4ChatAccounts.T4ChatAccounts;
      const error = yield* Effect.flip(accounts.getLink({ userId: "user_1" }));
      expect(error._tag).toBe("T4ChatRequestFailed");
    }).pipe(provide(fakeT4Chat({ error: "nope" }, 401).client)),
  );

  it.effect("times out when T4 Chat stalls while sending the body", () => {
    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(new ReadableStream({ start: () => {} }), { status: 200 }),
        ),
      ),
    );
    return Effect.gen(function* () {
      const accounts = yield* T4ChatAccounts.T4ChatAccounts;
      const fiber = yield* Effect.forkChild(Effect.flip(accounts.getLink({ userId: "user_1" })));
      yield* TestClock.adjust("5 seconds");
      const error = yield* Fiber.join(fiber);
      expect(error._tag).toBe("T4ChatRequestFailed");
    }).pipe(provide(client));
  });

  it.effect("times out when Clerk stalls on the email lookup", () =>
    Effect.gen(function* () {
      const getUser = clerk.getUser;
      clerk.getUser = () => new Promise(() => {});
      const accounts = yield* T4ChatAccounts.T4ChatAccounts;
      const fiber = yield* Effect.forkChild(Effect.flip(accounts.createLinkUrl({ userId: "u" })));
      yield* TestClock.adjust("5 seconds");
      const error = yield* Fiber.join(fiber).pipe(
        Effect.ensuring(Effect.sync(() => (clerk.getUser = getUser))),
      );
      expect(error._tag).toBe("ClerkUserLookupFailed");
    }).pipe(provide(fakeT4Chat({}).client)),
  );

  it.effect("reports itself unavailable without a shared secret", () =>
    Effect.gen(function* () {
      const accounts = yield* T4ChatAccounts.T4ChatAccounts;
      expect(accounts.available).toBe(false);
      const error = yield* Effect.flip(accounts.getLink({ userId: "user_1" }));
      expect(error._tag).toBe("T4ChatNotConfigured");
    }).pipe(provide(fakeT4Chat({}).client, null)),
  );
});
