module.exports = {
  reportUnusedDisableDirectives: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    EXPERIMENTAL_useProjectService: true,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:deprecation/recommended"
  ],
  ignorePatterns: [
    "node_modules",
    "dist",
    "coverage",
    ".eslintrc.js",
    "*.d.ts"
  ],
  settings: {
    react: {
      version: "detect"
    },
    formComponents: ["Form"],
    linkComponents: [
      { name: "Link", linkAttribute: "to" },
      { name: "NavLink", linkAttribute: "to" }
    ],
    "import/resolver": {
      typescript: {}
    }
  },
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
