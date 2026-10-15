import assert from "assert";
import plugin from "../../lib";

describe("plugin index", () => {
  it("exports every rule in lib/rules", () => {
    assert.deepStrictEqual(Object.keys(plugin.rules).sort(), [
      "no-korean-literal-in-jsx",
      "no-unstable-hook-return",
      "require-format",
      "zustand-require-shallow",
      "zustand-store-naming",
    ]);
  });
});
