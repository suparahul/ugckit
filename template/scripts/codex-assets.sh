#!/usr/bin/env bash
# The asset library's art sheets, drawn by one background `codex exec` on the user's Codex plan
# (the `infographic` skill), then cut into assets.
#
#   scripts/codex-assets.sh <slug> [sheet-name ...]
#
# Reads apps/<slug>/brand/assets/sheets.json ({style, references, sheets: [{name, size, rows,
# cols, kind, prompt, ids}]}). Draws each named sheet (all when none is named) to
# apps/<slug>/brand/assets/sheets/<name>.png, then runs scripts/asset-sheet-cut.mjs on every
# sheet this run made. The same checks as codex-images.sh: the login first, and a run counts
# only when the turn completed and the sheet file is newer than the run's start.
set -uo pipefail
[ $# -ge 1 ] || { sed -n 2,12p "$0"; exit 2; }
SLUG=$1; shift
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPTS/.." && pwd)"
ADIR="$ROOT/apps/$SLUG/brand/assets"
SPEC="$ADIR/sheets.json"
[ -f "$SPEC" ] || { echo "no $SPEC" >&2; exit 2; }
mkdir -p "$ADIR/sheets"

command -v codex >/dev/null 2>&1 || { echo "codex not found: npm install -g @openai/codex, then codex login" >&2; exit 3; }
STATUS=$(codex login status 2>&1 | tail -1); echo "login: $STATUS"
case "$STATUS" in *"Logged in"*) ;; *) echo "Not logged in to Codex. Run: codex login" >&2; exit 3 ;; esac

# The instruction and the list of sheets, from the spec.
python3 - "$SPEC" "$ADIR" "$ROOT/apps/$SLUG" "$@" > "$ADIR/sheets/instruction.txt" <<'PY'
import json, sys
spec, adir, appdir, names = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3], sys.argv[4:]
sheets = [s for s in spec["sheets"] if not names or s["name"] in names]
print("You are drawing art sheets for an app's illustration library. Use your built-in image generation tool,")
print("one call per sheet (never one call for several sheets, never code that calls an image API). The attached")
print("images are references: a character sheet is the identity of the character, a card or a page is the style only.")
print()
for s in sheets:
    print(f"Sheet {s['name']}: ask for {s['size']}. Prompt, used as written:")
    print(f"  {s['prompt']} {spec['style']}")
    print(f"  Copy the generated file to {adir}/sheets/{s['name']}.png (overwrite).")
    print()
print(f"When every sheet is done, write {adir}/sheets/result.md with one line per sheet, \"<name>: <file>\" or")
print("\"<name>: FAILED <why>\", then \"done\". Your last message is that file's contents and nothing else.")
PY
# The spec's references, plus any a named sheet adds with its own "references" (paths under apps/<slug>/).
REFS=$(python3 -c "
import json,sys
d=json.load(open(sys.argv[1])); names=sys.argv[3:]
refs=list(d['references'])
for s in d['sheets']:
    if names and s['name'] in names: refs += [r for r in s.get('references',[]) if r not in refs]
print('\n'.join(sys.argv[2]+'/'+r for r in refs))" "$SPEC" "$ROOT/apps/$SLUG" "$@")
IARGS=(); while IFS= read -r f; do [ -n "$f" ] && IARGS+=(-i "$f"); done <<< "$REFS"
NAMES=$(python3 -c "import json,sys; n=sys.argv[2:]; print(' '.join(s['name'] for s in json.load(open(sys.argv[1]))['sheets'] if not n or s['name'] in n))" "$SPEC" "$@")
echo "codex exec: sheets $NAMES; about two minutes each"
START=$(date +%s)
codex exec -C "$ROOT" -s workspace-write --skip-git-repo-check --ephemeral --json \
  -o "$ADIR/sheets/result.md" ${IARGS[@]+"${IARGS[@]}"} - \
  < "$ADIR/sheets/instruction.txt" > "$ADIR/sheets/events.jsonl" 2> "$ADIR/sheets/stderr.txt"
echo "codex exec exited $? after $(( $(date +%s) - START )) s"
if grep -q '"turn.failed"' "$ADIR/sheets/events.jsonl" || ! grep -q '"turn.completed"' "$ADIR/sheets/events.jsonl"; then
  echo "FAILED: codex did not complete the turn." >&2
  grep -o '"message":"[^"]*"' "$ADIR/sheets/events.jsonl" | tail -1 | cut -d'"' -f4 >&2
fi
RC=0
for n in $NAMES; do
  f="$ADIR/sheets/$n.png"
  if [ -f "$f" ] && [ "$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")" -ge "$START" ]; then
    node "$SCRIPTS/asset-sheet-cut.mjs" "$SLUG" "$n" || RC=1
  else
    echo "FAILED: no new sheet $n this run" >&2; RC=1
  fi
done
exit $RC
