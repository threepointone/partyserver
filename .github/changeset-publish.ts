import { $ } from "bun";

await $`bun ./.github/resolve-workspace-versions.ts`;
await $`bunx changeset publish`;
