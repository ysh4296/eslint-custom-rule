"use strict";

const assert = require("assert");
const plugin = require("../../lib");

describe("plugin index", () => {
  it("exports every rule in lib/rules", () => {
    assert.ok(plugin.rules["no-korean-literal-in-jsx"]);
  });
});
