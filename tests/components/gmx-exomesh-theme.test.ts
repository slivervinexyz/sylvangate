import { describe, expect, it } from "vitest";
import {
  GMX_EXOMESH_HEADER_BADGE_LABEL,
  GMX_EXOMESH_BG,
  GMX_EXOMESH_SURFACE,
  GMX_OFFICIAL_BLUE,
} from "../../src/lib/gui-bridge/grant-audit/gmx-exomesh-theme";

describe("gmx-exomesh-theme", () => {
  it("uses official GMX blue badge label in header pill SSOT", () => {
    expect(GMX_EXOMESH_HEADER_BADGE_LABEL).toBe(
      "[ 🛡️ TAILOR-MADE FOR GMX v2 ARBITRUM EXOMESH: ACTIVE ]",
    );
  });

  it("defines ExoMesh AF palette tokens", () => {
    expect(GMX_EXOMESH_BG).toBe("#090d16");
    expect(GMX_EXOMESH_SURFACE).toBe("#101626");
    expect(GMX_OFFICIAL_BLUE).toBe("#2d42fc");
  });
});
