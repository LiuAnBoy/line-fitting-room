// eslint.config.js
import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier"; // Must be last
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    // Adjust ignores based on your build output directory (e.g., dist, build)
    ignores: ["dist/**/*", "build/**/*", "node_modules/**/*"],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript specific configuration
  {
    files: ["**/*.ts"], // Target only TypeScript files
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true, // Assuming you have a tsconfig.json
        tsconfigRootDir: __dirname,
        ecmaVersion: "latest", // Use modern ECMAScript features
        sourceType: "module", // Use ES Modules
      },
      globals: {
        ...globals.node, // Node.js global variables
        ...globals.es2021, // Globals for ES2021 features
        // Remove browser globals if not needed: ...globals.browser,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules, // Start with recommended TS rules
      // Customize specific rules
      "@typescript-eslint/no-unused-vars": "warn", // Warn about unused vars instead of erroring
      "@typescript-eslint/no-explicit-any": "warn", // Warn about explicit 'any' type
      // Add any other Node.js/TypeScript specific rules here
    },
  },

  // Import sorting for JS and TS files
  {
    files: ["**/*.{js,ts}"], // Apply to both JS and TS files
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error", // Enforce sorting imports
      "simple-import-sort/exports": "error", // Enforce sorting exports
    },
  },

  // Jest configuration files (CommonJS)
  {
    files: ["jest.config.js", "jest.config.*.js"],
    languageOptions: {
      sourceType: "commonjs", // Use CommonJS for Jest config files
      globals: {
        ...globals.node, // Node.js global variables including 'module'
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off", // Allow require() in Jest config
    },
  },

  // Jest test files configuration
  {
    files: [
      "**/__tests__/**/*.{js,ts}",
      "**/*.test.{js,ts}",
      "**/*.spec.{js,ts}",
    ],
    languageOptions: {
      globals: {
        ...globals.jest, // Add Jest global variables
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // Allow 'any' in tests for mocking
    },
  },

  // --- Prettier Integration ---
  // Runs Prettier as an ESLint rule
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Apply prettier formatting rules, overriding ESLint formatting rules
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto", // Or set to 'lf' or 'crlf' as needed
          // Add other Prettier options here if necessary
        },
      ],
    },
  },

  // Disables ESLint rules that conflict with Prettier
  // IMPORTANT: This MUST be the LAST configuration in the array
  prettierConfig,
];
