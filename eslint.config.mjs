import { defineConfig, globalIgnores } from "eslint/config";
import noAutofix from "eslint-plugin-no-autofix";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["node_modules"]), {
  extends: compat.extends("eslint:recommended"),

  plugins: {
    "no-autofix": noAutofix,
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.jest,
      Atomics: "readonly",
      SharedArrayBuffer: "readonly",
      HistoryService: true,
      Characteristic: true,
      Service: true,
      eve: true,
      cachedAccessories: true,
      HomebridgeAPI: true,
    },

    ecmaVersion: 2022,
    sourceType: "module",
  },

  rules: {
    "global-require": "off",

    "no-unused-vars": ["warn", {
      args: "none",
    }],

    "no-mixed-spaces-and-tabs": "warn",
    "no-fallthrough": "off",
    "no-unreachable": "off",
    "no-empty": "off",
    "no-console": "off",
    quotes: "off",
    "brace-style": "off",
    semi: "off",
    "comma-dangle": "off",
    eqeqeq: "off",
    "no-extra-semi": "warn",
    "dot-notation": 0,
    "no-autofix/prefer-const": "warn",

    indent: ["error", 2, {
      SwitchCase: 1,
    }],

    "linebreak-style": ["error", "unix"],
    curly: 0,
  },
}]);
