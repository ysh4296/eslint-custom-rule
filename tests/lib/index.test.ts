import assert from "assert";
import plugin from "../../lib";

describe("plugin index", () => {
  it("exports every rule in lib/rules", () => {
    assert.deepStrictEqual(Object.keys(plugin.rules).sort(), [
      "no-korean-literal-in-jsx",
      "require-format",
    ]);
  });
});
