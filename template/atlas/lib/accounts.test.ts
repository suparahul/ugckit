/**
 * The `## Accounts` table of a HANDLE.md (lib/accounts.ts): no file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { declaredAccounts, handleOf } from "./accounts.ts";

const HEAD = `# @hannah.catmom — Hannah

Handle: @hannah.catmom
Platform: tiktok
Role: main persona
Created: 2026-09-14
`;

test("no ## Accounts: one TikTok account, from the head lines", () => {
  assert.deepEqual(declaredAccounts(HEAD + "\n## Persona\n\nA cat mom.\n", "hannah.catmom"), [
    { platform: "tiktok", account: "@hannah.catmom", created: "2026-09-14", role: "primary" },
  ]);
});

test("no Platform: line and no table: TikTok, the folder name when there is no Handle: line or title", () => {
  assert.deepEqual(declaredAccounts("Role: brand handle\n", "catwise.app"), [{ platform: "tiktok", account: "@catwise.app", created: null, role: "primary" }]);
  assert.equal(handleOf("# Hannah\n", "hannah.catmom"), "@hannah.catmom");
});

test("## Accounts: two accounts with different names, TikTok primary", () => {
  const md = HEAD + `
## Accounts

| Platform | Account | Created | Role | Status |
|---|---|---|---|---|
| instagram | @hannah.catmom_ | 2026-09-22 | repost | connected |
| tiktok | @hannah.catmom | 2026-09-14 | primary | connected |

## Persona

A cat mom.
`;
  assert.deepEqual(declaredAccounts(md, "hannah.catmom"), [
    { platform: "tiktok", account: "@hannah.catmom", created: "2026-09-14", role: "primary" },
    { platform: "instagram", account: "@hannah.catmom_", created: "2026-09-22", role: "repost" },
  ]);
});

test("## Accounts: no row marked primary → the account Handle: names; an unknown platform and a second row for one platform are ignored", () => {
  const md = HEAD + `
## Accounts

| Platform | Account | Created | Role |
|---|---|---|---|
| tiktok | hannah.catmom | not recorded | |
| instagram | \`@hannah.catmom_\` | | |
| youtube | @hannah | | |
| tiktok | @other | | |
`;
  const a = declaredAccounts(md, "hannah.catmom");
  assert.deepEqual(a.map((x) => [x.platform, x.account, x.role, x.created]), [
    ["tiktok", "@hannah.catmom", "primary", null],
    ["instagram", "@hannah.catmom_", "repost", null],
  ]);
});
