#!/usr/bin/env bash
# Stage 3: the verbatim layer (local faster-whisper). Runs offline, costs nothing.
# Usage: scripts/transcribe.sh <name> [model]
#
# Two passes:
#   1. VAD on  — clean verbatim transcript, the clean read.
#   2. VAD off + word timestamps — recovers the pauses, breaths and hesitations that
#      pass 1 strips. Adjectives like "moderate pace" are useless to a generation
#      prompt; numbers are not.
set -euo pipefail

[ $# -ge 1 ] || { echo "usage: $0 <name> [model]" >&2; exit 2; }
NAME=$1
MODEL=${2:-base.en}
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
VRB="$PROJ/pipeline/03-verbatim/$NAME"
WAV="$VRB/seg.wav"
PY="$PROJ/.venv/bin/python3"

[ -f "$WAV" ] || { echo "missing $WAV — run scripts/ingest.sh first" >&2; exit 1; }
[ -x "$PY" ]  || { echo "missing venv — run: python3 -m venv .venv && .venv/bin/pip install faster-whisper" >&2; exit 1; }

"$PY" - "$WAV" "$MODEL" "$VRB" <<'PY'
import sys, json, re
from faster_whisper import WhisperModel

wav, model_name, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
m = WhisperModel(model_name, device="cpu", compute_type="int8")

def words_in(t):
    return re.findall(r"[\w']+", t)

# ---------- pass 1: clean verbatim ----------
segs, info = m.transcribe(wav, vad_filter=True)
segs = list(segs)
lines, total = [], 0
for s in segs:
    text = s.text.strip()
    # PRESENTER is a stand-in. Speaker assignment is a breakdown-stage judgement, not Whisper's.
    lines.append({"start": round(s.start, 2), "end": round(s.end, 2),
                  "speaker": "PRESENTER", "text": text})
    total += len(words_in(text))

dur = info.duration
wpm = (total / dur * 60) if dur else 0

with open(f"{outdir}/transcript.txt", "w") as f:
    for l in lines:
        f.write(f'[{l["start"]:5.2f} - {l["end"]:5.2f}] {l["speaker"]}: "{l["text"]}"\n')
json.dump({"model": model_name, "duration_s": round(dur, 2), "word_count": total,
           "wpm": round(wpm, 1), "lines": lines},
          open(f"{outdir}/transcript.json", "w"), indent=2)

print(open(f"{outdir}/transcript.txt").read())
print(f"words={total}  duration={dur:.2f}s  wpm={wpm:.1f}"
      f"   (~175 = short-form ad pace, ~150 = diary/vlog)")

# ---------- pass 2: prosody ----------
# VAD off so silence survives; word timestamps so gaps are measurable.
segs2, _ = m.transcribe(wav, vad_filter=False, word_timestamps=True)
words = [w for s in segs2 for w in (s.words or [])]
# Whisper loops at the end of audio, emitting a run of repeated words all stamped at the
# same instant. Those tokens have no duration and are not speech — they inflate wpm badly.
# Drop them, and record how many were dropped so a bad take is visible rather than silent.
_raw = len(words)
words = [w for w in words if (w.end - w.start) > 0.01]
_dropped = _raw - len(words)
if _dropped:
    print(f"  (dropped {_dropped} zero-duration Whisper hallucination tokens)")

PAUSE_MIN = 0.25          # below this is ordinary co-articulation, not a pause
FILLERS = {"um", "uh", "erm", "hmm", "mm", "like", "so", "well",
           "yeah", "okay", "right", "actually", "basically", "literally"}

pauses = []
for a, b in zip(words, words[1:]):
    gap = b.start - a.end
    if gap >= PAUSE_MIN:
        pauses.append({"after_word": a.word.strip(), "at": round(a.end, 2),
                       "duration": round(gap, 2)})

# Count words the same way pass 1 does. Whisper's word tokens split hyphenated
# compounds ("budget-friendly" -> 2), which inflates wpm relative to pass 1.
n = len(words_in("".join(w.word for w in words)))

lead    = round(words[0].start, 2) if words else 0.0
trail   = round(dur - words[-1].end, 2) if words else 0.0
paused  = sum(p["duration"] for p in pauses)
speaking = max(dur - paused - lead - trail, 0.01)

fillers = {}
for w in words:
    t = re.sub(r"[^\w']", "", w.word).lower()
    if t in FILLERS:
        fillers[t] = fillers.get(t, 0) + 1

prosody = {
    "word_count": n,
    "duration_s": round(dur, 2),
    "overall_wpm": round(n / dur * 60, 1) if dur else 0,
    # Articulation rate excludes pauses: how fast she talks when she IS talking.
    # A big gap between this and overall_wpm means a pausey delivery; a small gap
    # means relentless, no-air-to-scroll-on pacing.
    "articulation_wpm": round(n / speaking * 60, 1),
    "speaking_time_s": round(speaking, 2),
    "paused_time_s": round(paused, 2),
    "silence_ratio": round((paused + lead + trail) / dur, 3) if dur else 0,
    "lead_in_silence_s": lead,
    "trailing_silence_s": trail,
    "pause_count": len(pauses),
    "longest_pause_s": max([p["duration"] for p in pauses], default=0.0),
    "pauses": pauses,
    "filler_words": fillers,
    "filler_total": sum(fillers.values()),
    "hallucinated_tokens_dropped": _dropped,
}
json.dump(prosody, open(f"{outdir}/prosody.json", "w"), indent=2)

with open(f"{outdir}/prosody.txt", "w") as f:
    f.write(f"overall {prosody['overall_wpm']} wpm · articulation {prosody['articulation_wpm']} wpm "
            f"when speaking\n")
    f.write(f"silence {prosody['silence_ratio']*100:.0f}% of runtime "
            f"({prosody['paused_time_s']}s paused, {lead}s lead-in, {trail}s trailing)\n")
    f.write(f"{prosody['pause_count']} pauses >= {PAUSE_MIN}s, longest {prosody['longest_pause_s']}s\n")
    for p in pauses:
        f.write(f"  [{p['at']:5.2f}] {p['duration']:.2f}s after \"{p['after_word']}\"\n")
    f.write(f"fillers: {prosody['filler_total']} "
            f"({', '.join(f'{k}x{v}' for k, v in fillers.items()) or 'none'})\n")

print()
print(open(f"{outdir}/prosody.txt").read())
PY

echo "transcript: $VRB/transcript.txt"
echo "prosody   : $VRB/prosody.txt"
echo
echo "NOTE: Whisper mishears homophones and brand names. Cross-check odd words"
echo "against the contact sheets and the analyzer description before writing the breakdown."
echo "NOTE: pass 2 counts candidate fillers by wordlist — 'like' and 'so' are often real"
echo "words, not hesitations. Read them in context before quoting the number."
