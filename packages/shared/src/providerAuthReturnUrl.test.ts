import { describe, expect, it } from "vite-plus/test";
import { providerAuthReturnUrl } from "./providerAuthReturnUrl.ts";

describe("provider auth return destinations", () => {
  it.each(["t4code", "t4code-dev", "T4CODE", "T4CODE-dev"])(
    "returns to %s Welcome and the selected settings instance",
    (scheme) => {
      const canonicalScheme = scheme.toLowerCase();
      expect(providerAuthReturnUrl(`${scheme}://app/welcome?code=secret#agents:machine-id`)).toBe(
        `${canonicalScheme}://app/welcome#agents:machine-id`,
      );
      expect(
        providerAuthReturnUrl(`${scheme}://app/settings/providers?instanceId=work&code=secret`),
      ).toBe(`${canonicalScheme}://app/settings/providers?instanceId=work`);
    },
  );
  it.each([
    "t4code://attacker/welcome",
    "t4code://app/welcome/../evil",
    "T4CODE://attacker/welcome",
    "T4CODE://app/welcome/../evil",
    "https://attacker.example/welcome",
  ])("rejects %s", (url) => expect(providerAuthReturnUrl(url)).toBeUndefined());
});
