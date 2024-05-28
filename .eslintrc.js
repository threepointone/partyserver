module.exports = {
  reportUnusedDisableDirectives: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    project: ["./packages/**/tsconfig.json", "./examples/**/tsconfig.json"],
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react-hooks/recommended",
    "plugin:deprecation/recommended"
  ],
  ignorePatterns: [
    "node_modules",
    "dist",
    "coverage",
    ".eslintrc.js",
    "*.d.ts"
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/return-await": "error",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        // vars: "all",
        varsIgnorePattern: "^_",
        // args: "after-used",
        argsIgnorePattern: "^_"
      }
    ]
  },
  root: true
};
