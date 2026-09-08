import { describe, it, expect } from "vitest";
import { csvCell, csvRow, csvDocument } from "@/lib/csv";
import { generateCode, normalizeCode } from "@/lib/codes";

describe("csvCell", () => {
  it("quotes values containing commas, quotes or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  // A cell starting with = is executed as a formula by Excel and Sheets.
  it("neutralizes formula injection", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@import")).toBe("'@import");
  });

  it("quotes a formula that also contains a comma", () => {
    expect(csvCell("=HYPERLINK(1,2)")).toBe('"\'=HYPERLINK(1,2)"');
  });

  it("renders empty values as blanks", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
  });
});

describe("csvRow / csvDocument", () => {
  it("joins cells and rows", () => {
    expect(csvRow(["a", "b"])).toBe("a,b");
    expect(csvDocument([["a"], ["b"]])).toBe("﻿a\r\nb\r\n");
  });
});

describe("codes", () => {
  it("generates codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRTUVWXY2346789]+$/);
      // No characters that are easy to confuse when read off a projector.
      expect(code).not.toMatch(/[O0I1S5]/);
    }
  });

  it("normalizes user-typed codes", () => {
    expect(normalizeCode(" ab c12 ")).toBe("ABC12");
  });
});
