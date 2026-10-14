import assert from "assert";
import plugin from "../../lib";

describe("plugin index", () => {
  it("exports every rule in lib/rules", () => {
    assert.ok(plugin.rules["no-korean-literal-in-jsx"]);
  });
});
