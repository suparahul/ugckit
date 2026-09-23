---
name: posting-provider
description: Phase 8, the first send — the just-in-time connection to the posting service. Post Bridge by default: the key through ./ugckit key postbridge, the accounts connected by the user, the handle map written by posting-accounts.mjs. Another service: one provider file with five operations, written from its API docs, one dry run. Never in Setup.
---

# Phase 8 — the posting service, connected at the first send

    node scripts/posting-accounts.mjs <slug>                      map the plan's handles to the connected accounts
    node scripts/posting-accounts.mjs <slug> --provider <name>    another service's provider file

Runs when `post` finds no `production/posting-accounts.json`, or a planned handle not
mapped in it, or an account an identity declares (its `## Accounts` table: the
Instagram row) not connected yet. Never in Setup, never in the handles phase. The plan's `Posting service:`
line names the service; the connection is made now.

## Post Bridge (the default)

1. **The key.** `./ugckit key postbridge` — the user runs it in their own terminal (in
   Claude Code with `!` in front); it asks for the key from the Post Bridge dashboard →
   API Keys and hides what they type. Never ask for the key in the chat. Wait for
   "done".
2. **The accounts.** A recipe with a tick, naming each account with its platform, from
   each identity's `HANDLE.md` (the `## Accounts` table; no table is one TikTok account
   with the handle's name): "In Post Bridge, connect @hannah.catmom and @catwise.app as
   TikTok accounts (Accounts → Connect → TikTok, log in as that handle), and
   @hannah.catmom_ as an Instagram account (Accounts → Connect → Instagram, log in with
   Instagram's own login; the account must be a professional account, a Facebook Page
   is not needed). Tick 'connected' on the handle page when they are there." Each
   connected account uses one account of the Post Bridge plan; at the plan's cap Post
   Bridge refuses the next one. The Organic Factory UI writes `account.connect` (with
   `data.platform`) when the map is refreshed.
3. **The map.** Run `scripts/posting-accounts.mjs <slug>`. It lists the accounts Post
   Bridge holds and writes `posting-accounts.json`: per handle, one entry per platform
   with `provider: "postbridge"`. An account matches only when its platform **and** its
   username are the ones the identity declares; no name is guessed (an Instagram account
   with the TikTok name is not taken unless the table names it). A declared account it
   could not find is written as `null` and named, so the user connects it and you run it
   again. An account Post Bridge holds that no identity declares is printed as such: add
   its row to the identity's `## Accounts` table (the `handles` skill, step 1), or leave
   it. No restart is needed: the send reads the file live.

Post Bridge has its own subscription; the kit knows no per-call cost.

## Another service

The user names it and points you at its API documentation. Then:

1. Copy `scripts/lib/posting/TEMPLATE.mjs` to `scripts/lib/posting/<name>.mjs` and
   write the five operations from the docs: `accounts` (list the connected accounts,
   write the map with `provider: "<name>"`, one entry per platform account the
   identities declare), `send` (upload the finals in slide order, one leg per platform
   of the post, create a photo post as a draft or scheduled, append `posting.sent` with
   `data.legs` when there is more than TikTok, and `posting.failed` per failed leg),
   `status`,
   `sync` (the posted url and the numbers → `posted.link`, `posted`, `outcome.sync`;
   reuse the Monid link match of `atlas/lib/tiktok-link.ts` for a draft the service
   cannot see), `reschedule` (→ `posting.rescheduled`). The template says what each
   writes.
2. The key: `./ugckit key <name>` stores `<NAME>_API_KEY`; the file reads it from `.env`.
3. One dry run: `node scripts/posting-send.mjs <slug> --post <key>` must print the
   selection and send nothing; then `posting-accounts.mjs <slug>` writes the map.
4. Update the plan's `Posting service:` line to the name. The same file later carries
   the video pipeline's delivered files.

## Finish

Report the map: each handle and platform → account id, or "not connected". Then continue the `post`
skill.
