import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes every cell and doubles embedded quotes", () => {
    expect(toCsv(["a"], [['say "hi"']])).toBe('"a"\r\n"say ""hi"""');
  });

  it("neutralises formula-injection prefixes", () => {
    const csv = toCsv(["Name"], [["=1+1"], ["+A1"], ["-A1"], ["@SUM(A1)"]]);
    const cells = csv.split("\r\n").slice(1);
    expect(cells).toEqual(['"\'=1+1"', '"\'+A1"', '"\'-A1"', '"\'@SUM(A1)"']);
  });

  it("leaves ordinary text alone", () => {
    expect(toCsv(["Name"], [["Ada Lovelace"]])).toBe('"Name"\r\n"Ada Lovelace"');
  });

  it("renders null and undefined as empty", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe('"a","b"\r\n"",""');
  });
});
