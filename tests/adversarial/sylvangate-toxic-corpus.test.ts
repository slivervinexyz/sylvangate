import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { writeStateOverride } from "../../src/core/state-store";
import {
  assertCorpusExpect,
  type CorpusCase,
  runCorpusCase,
} from "./helpers/corpus-runner";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures/toxic-corpus-rh.json");
const CASES = JSON.parse(readFileSync(FIXTURE, "utf8")) as CorpusCase[];

afterEach(() => {
  writeStateOverride(null);
});

describe("sylvangate toxic corpus (PR-B · RH subset)", () => {
  for (const caseDef of CASES) {
    it(`${caseDef.id} · ${caseDef.entry}`, async () => {
      const result = await runCorpusCase(caseDef);
      expect(() => assertCorpusExpect(result, caseDef.expect, caseDef.id)).not.toThrow();
    });
  }
});
