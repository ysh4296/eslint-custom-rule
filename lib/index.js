"use strict";

const fs = require("fs");
const path = require("path");

const rulesDir = path.join(__dirname, "rules");

// lib/rules/*.js 를 자동으로 읽어 { "rule-name": rule } 형태로 export
/** @type {Record<string, import("eslint").Rule.RuleModule>} */
const rules = fs
  .readdirSync(rulesDir)
  .filter((file) => file.endsWith(".js"))
  .reduce((acc, file) => {
    acc[path.basename(file, ".js")] = require(path.join(rulesDir, file));
    return acc;
  }, {});

module.exports = {
  rules,
};
