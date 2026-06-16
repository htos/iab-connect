import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// REQ-028 (E5-S3) AC-7 / A51: pure-Node key-parity test — every `automations.*` key (and the
// communication.automations card keys) exists in BOTH de.json and en.json with identical shape.
// No render() → no jsdom / cleanup needed (A46).

function load(locale: string): Record<string, unknown> {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

describe("automations i18n parity", () => {
  const de = load("de");
  const en = load("en");

  it("has an automations namespace in both locales", () => {
    expect(de.automations).toBeDefined();
    expect(en.automations).toBeDefined();
  });

  it("has identical automations key sets in de and en", () => {
    const deKeys = keyPaths(de.automations).sort();
    const enKeys = keyPaths(en.automations).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it("has the communication.automations card keys in both locales", () => {
    const deCard = (de.communication as Record<string, unknown>)
      .automations as Record<string, string>;
    const enCard = (en.communication as Record<string, unknown>)
      .automations as Record<string, string>;
    expect(Object.keys(deCard).sort()).toEqual(["description", "title"]);
    expect(Object.keys(enCard).sort()).toEqual(["description", "title"]);
  });
});
