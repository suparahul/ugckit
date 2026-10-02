/**
 * The `## Accounts` table of a HANDLE.md (lib/accounts.ts): no file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { declaredAccounts, handleOf } from "./accounts.ts";

const HEAD = `# @maya.petmom — Maya

Handle: @maya.petmom
Platform: tiktok
Role: main persona
Created: 2026-09-14
`;

test("no ## Accounts: one TikTok account, from the head lines", () => {
  assert.deepEqual(declaredAccounts(HEAD + "\n## Persona\n\nA cat mom.\n", "maya.petmom"), [
    { platform: "tiktok", account: "@maya.petmom", created: "2026-09-14", role: "primary" },
  ]);
});

test("no Platform: line and no table: TikTok, the folder name when there is no Handle: line or title", () => {
  assert.deepEqual(declaredAccounts("Role: brand handle\n", "pawly.app"), [{ platform: "tiktok", account: "@pawly.app", created: null, role: "primary" }]);
  assert.equal(handleOf("# Maya\n", "maya.petmom"), "@maya.petmom");
});

test("## Accounts: two accounts with different names, TikTok primary", () => {
  const md = HEAD + `
## Accounts

| Platform | Account | Created | Role | Status |
|---|---|---|---|---|
| instagram | @maya.petmom_ | 2026-09-22 | repost | connected |
| tiktok | @maya.petmom | 2026-09-14 | primary | connected |

## Persona

A cat mom.
`;
  assert.deepEqual(declaredAccounts(md, "maya.petmom"), [
    { platform: "tiktok", account: "@maya.petmom", created: "2026-09-14", role: "primary" },
    { platform: "instagram", account: "@maya.petmom_", created: "2026-09-22", role: "repost" },
  ]);
});

test("## Accounts: no row marked primary → the account Handle: names; an unknown platform and a second row for one platform are ignored", () => {
  const md = HEAD + `
## Accounts

| Platform | Account | Created | Role |
|---|---|---|---|
| tiktok | maya.petmom | not recorded | |
| instagram | \`@maya.petmom_\` | | |
| youtube | @maya | | |
| tiktok | @other | | |
`;
  const a = declaredAccounts(md, "maya.petmom");
  assert.deepEqual(a.map((x) => [x.platform, x.account, x.role, x.created]), [
    ["tiktok", "@maya.petmom", "primary", null],
    ["instagram", "@maya.petmom_", "repost", null],
  ]);
});
