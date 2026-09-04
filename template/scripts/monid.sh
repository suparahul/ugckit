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
  local tmp="$out.part" err="$out.err" attempt=1 wait=20
  # An HTML error page instead of JSON is transient: Monid or the upstream actor was
  # busy. It also happens with nothing else running, so the lock alone is not enough.
  # Retry, waiting longer each time. The wallet is checked once so an empty one is not
  # mistaken for a bad moment (rule 13).
  while :; do
    rm -f "$tmp"
    # -o writes the file AND echoes the whole payload; a 50-post scrape down the terminal
    # is thousands of lines of noise in the agent's context. The file is the output.
    if NO_COLOR=1 monid run -p "$provider" -e "$endpoint" -i "$input" -w 120 -o "$tmp" >/dev/null 2>"$err" \
       && [ -s "$tmp" ] && json_rows "$tmp" >/dev/null; then
      rm -f "$err"
      break
    fi
    # Why did it fail? Show the last real line of the CLI's message, or the start of
    # the file if the CLI thought it succeeded (RULE 14: a non-empty file is not data).
    local why
    why=$(grep -v '^\s*$' "$err" 2>/dev/null | tail -1 | cut -c1-160)
    [ -n "$why" ] || why=$(head -c 160 "$tmp" 2>/dev/null | tr '\n' ' ')
    echo "  attempt $attempt failed: $why" >&2
    if grep -qi 'unauthori\|401\|invalid.*key\|no api key' "$err" 2>/dev/null; then
      echo "  that is the key, not the API. Fix it with: ./ugckit key" >&2
      monid_unlock; rm -f "$tmp"; return 1
    fi
    if [ "$attempt" -eq 1 ]; then
      local bal
      bal=$(NO_COLOR=1 monid balance 2>/dev/null | grep -o 'Balance: .*' || true)
      [ -n "$bal" ] && echo "  wallet: $bal" >&2
      case "$bal" in *'$0.0'*) echo "  the wallet is empty -- top up at https://app.monid.ai, then re-run" >&2
                              monid_unlock; rm -f "$tmp"; return 1 ;; esac
    fi
    if [ "$attempt" -ge 3 ]; then
      monid_unlock; rm -f "$tmp"
      echo "  gave up after 3 attempts. Monid is having a bad moment: wait a few minutes and" >&2
      echo "  re-run this exact command. Everything already downloaded is kept." >&2
      echo "  (full error: $err)" >&2
      return 1
    fi
    echo "  waiting ${wait}s, then retrying ($((attempt + 1))/3)" >&2
    sleep "$wait"; wait=$((wait * 3)); attempt=$((attempt + 1))
  done
  monid_unlock
  mv "$tmp" "$out"
  return 0
}

# RULE 11: the CDN link Monid already returned, fetched directly. Never yt-dlp.
#
# Some networks block one TikTok CDN host and not another (seen Sep 2026: tiktokcdn.com
# hangs, tiktokcdn-us.com answers, from the same machine). A blocked host never refuses,
# it just never answers, so a 180s timeout per file turns one account into hours of
# nothing. Connect fails fast, and after three connect failures in a row a host is
# marked dead for the rest of the run and skipped without waiting.
DEAD_HOSTS=""
_host_of() { printf '%s' "$1" | sed -E 's#^[a-z]+://([^/]+).*#\1#'; }
fetch_cdn() {
  local url="$1" out="$2" host rc
  [ -s "$out" ] && return 0
  [ -n "$url" ] && [ "$url" != "null" ] || { echo "  no url" >&2; return 1; }
  host=$(_host_of "$url")
  case " $DEAD_HOSTS " in *" $host "*) return 1 ;; esac
  curl -sfL --connect-timeout 10 --max-time 180 -A "Mozilla/5.0" \
       -H "Referer: https://www.tiktok.com/" -o "$out.part" "$url"
  rc=$?
  if [ "$rc" -ne 0 ] || [ ! -s "$out.part" ]; then
    rm -f "$out.part"
    # 28 = timed out, 7 = could not connect, 6 = could not resolve: the network, not
    # the URL. Three in a row from one host and it is dead for this run.
    if [ "$rc" = 28 ] || [ "$rc" = 7 ] || [ "$rc" = 6 ]; then
      _CDN_FAILS="${_CDN_FAILS:-} $host"
      if [ "$(printf '%s\n' $_CDN_FAILS | grep -cx "$host")" -ge 3 ]; then
        DEAD_HOSTS="$DEAD_HOSTS $host"
        echo "  $host does not answer from this network -- skipping it for the rest of this run." >&2
        echo "  (a VPN or another network fixes it; the paid data is saved, re-run to fetch later)" >&2
      fi
    fi
    return 1
  fi
  _CDN_FAILS=$(printf '%s\n' ${_CDN_FAILS:-} | grep -vx "$host" | tr '\n' ' ')
  mv "$out.part" "$out"
}

# A cover frame taken from the video itself, for when the cover CDN is blocked but the
# video CDN is not. Reads only the first frame, so it moves a few hundred KB, not the clip.
frame_from_video() {
  local url="$1" out="$2" host
  [ -n "$url" ] && [ "$url" != "null" ] || return 1
  host=$(_host_of "$url")
  case " $DEAD_HOSTS " in *" $host "*) return 1 ;; esac
  ffmpeg -v error -y -rw_timeout 15000000 -user_agent "Mozilla/5.0" \
         -headers $'Referer: https://www.tiktok.com/\r\n' \
         -i "$url" -frames:v 1 -q:v 3 "$out" 2>/dev/null && [ -s "$out" ]
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
