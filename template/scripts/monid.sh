#!/usr/bin/env bash
# Shared plumbing for the research stages (R1-R5). Layout: research/<project>/<app>/<handle>/. Sourced, not run.
#
# Every guard in here exists because its absence cost money or left a silent empty
# folder. See AGENTS.md rules 10-14. Do not route around them.
#
#   monid_run <provider> <endpoint> <input-json> <outfile>
#   fetch_cdn <url> <outfile>
#   verify_video <file>
#   to_jpg <src> <dst> [max-width]
#   spend <project> <usd> <what>
#   research_dir <project>

# The apify TikTok endpoints bill per result, both of them, measured Sep 2026.
PER_RESULT=0.00045
HOOK_MODEL="${HOOK_MODEL:-claude-haiku-4-5-20251001}"

PROJ_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$PROJ_ROOT/research/.monid.lock"

# Prints the row count and returns 0 only if the file is real JSON. python3, not jq:
# python3 is already a hard dependency and jq is not.
json_rows() {
  python3 -c "
import json,sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
print(len(d) if isinstance(d, (list, dict)) else 1)
" "$1" 2>/dev/null
}

research_dir() {
  local d="$PROJ_ROOT/research/$1"
  mkdir -p "$d"
  printf '%s' "$d"
}

# RULE 13: one Monid call at a time. Concurrent calls come back as HTML error pages
# that read exactly like running out of credit. mkdir is the portable atomic lock --
# flock does not exist on macOS.
monid_lock() {
  local waited=0
  mkdir -p "$(dirname "$LOCK")"
  while ! mkdir "$LOCK" 2>/dev/null; do
    if [ "$waited" -eq 0 ]; then echo "  waiting for the Monid lock ($LOCK)"; fi
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 900 ]; then
      echo "  lock held for 15 minutes -- if nothing else is running: rmdir $LOCK" >&2
      return 1
    fi
  done
  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM
}

monid_unlock() { rmdir "$LOCK" 2>/dev/null || true; trap - EXIT INT TERM; }

# Returns 0 having left valid JSON at <outfile>. Idempotent: a previous run's output
# that still parses is reused and costs nothing, which is what makes R1-R4 resumable.
monid_run() {
  local provider="$1" endpoint="$2" input="$3" out="$4"

  if [ -s "$out" ] && json_rows "$out" >/dev/null; then
    echo "  have $(basename "$out") already ($(json_rows "$out") rows) — skipping"
    return 0
  fi

  command -v monid >/dev/null 2>&1 || {
    echo "monid not found — npm install -g @monid-ai/cli" >&2; return 1; }

  monid_lock || return 1
  echo "  monid run -p $provider -e $endpoint"
  local tmp="$out.part"
  rm -f "$tmp"
  # -o writes the file AND echoes the whole payload; a 50-post scrape down the terminal
  # is thousands of lines of noise in the agent's context. The file is the output.
  if ! NO_COLOR=1 monid run -p "$provider" -e "$endpoint" -i "$input" -w 120 -o "$tmp" >/dev/null; then
    monid_unlock
    rm -f "$tmp"
    # "Unexpected token '<'" above means the API answered with an HTML error page. That
    # is the rule 13 symptom and it is NOT the same thing as an empty wallet, however
    # much it looks like one. Wait, check the balance, then retry the same command --
    # everything already downloaded is kept.
    echo "  monid failed. If the error mentions '<html>' the API returned an error page:" >&2
    echo "  wait a minute and re-run this exact command. Otherwise: monid balance" >&2
    return 1
  fi
  monid_unlock

  # RULE 14 / RULE 13: an overloaded Monid answers with an HTML error page. It is a
  # non-empty file with a zero exit code and it is not data. Look at the content.
  if [ ! -s "$tmp" ] || ! json_rows "$tmp" >/dev/null; then
    echo "  the response is not JSON — first 200 characters:" >&2
    head -c 200 "$tmp" >&2; echo >&2
    echo "  if that is HTML, another Monid call was running. Retry, one at a time." >&2
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$out"
  return 0
}

# RULE 11: the CDN link Monid already returned, fetched directly. Never yt-dlp.
fetch_cdn() {
  local url="$1" out="$2"
  [ -s "$out" ] && return 0
  [ -n "$url" ] && [ "$url" != "null" ] || { echo "  no url" >&2; return 1; }
  curl -sfL --max-time 180 -A "Mozilla/5.0" -H "Referer: https://www.tiktok.com/" \
       -o "$out.part" "$url" || { rm -f "$out.part"; return 1; }
  [ -s "$out.part" ] || { rm -f "$out.part"; return 1; }
  mv "$out.part" "$out"
}

# RULE 14: an .mp4 that is really an m4a of the sound is the single most expensive
# failure in this pipeline, because everything downstream keeps going.
verify_video() {
  local f="$1"
  if ffprobe -v error -select_streams v:0 -show_entries stream=codec_type \
       -of csv=p=0 "$f" 2>/dev/null | grep -q video; then
    return 0
  fi
  echo "  no video stream in $(basename "$f") — deleting it (photo post? see RULE 10)" >&2
  rm -f "$f"
  return 1
}

# ffmpeg, not sips: sips is macOS only and ffmpeg is already a hard dependency.
to_jpg() {
  local src="$1" dst="$2" w="${3:-700}"
  ffmpeg -y -loglevel error -i "$src" -vf "scale='min($w,iw)':-2" -q:v 3 "$dst" 2>/dev/null
}

spend() {
  local project="$1" usd="$2"; shift 2
  python3 "$PROJ_ROOT/scripts/state.py" cost "$project" "$usd" "$@"
}
