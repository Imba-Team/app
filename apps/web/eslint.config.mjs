import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unicorn from "eslint-plugin-unicorn";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": [
        "warn",
        {
          case: "camelCase",
          ignore: [
            // shadcn/ui primitives are generated as kebab-case — leave them alone.
            "^components/ui/",
            // Next.js app router requires these specific names.
            "^(page|layout|loading|error|not-found|template|default|route|global-error|instrumentation)\\.(t|j)sx?$",
            // Config / dotfiles.
            "^next\\.config\\.",
            "^tailwind\\.config\\.",
            "^postcss\\.config\\.",
            "^eslint\\.config\\.",
          ],
        },
      ],
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "variable",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase"],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/api/generated.ts",
  ]),
]);

export default eslintConfig;
