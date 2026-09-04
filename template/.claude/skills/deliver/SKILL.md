---
name: deliver
description: Stage 9 — final check, then hand over the file with an honest written summary of what landed and what did not.
---

# Stage 9 — deliver

## Final check

    ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
      -show_entries format=duration,size -of default=nw=1 <final>
    ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,channels \
      -of default=nw=1 <final>

Confirm: duration, 9:16, audio present, and that it plays from first to last frame.

Confirm every open item in `pipeline/state/feedback.jsonl` is addressed or explicitly
listed as not done.

## Delivering the file

If it is over ~25 MB, transcode a preview and send that, with the master's path in the
caption:

    ffmpeg -y -i <final> -vf scale=540:-2 -c:v libx264 -crf 24 -preset slow \
      -c:a aac -b:a 128k <preview>

## The summary

Be straight. State:

- what was asked and what the file is,
- **what worked, with the measurement that proves it** — cut accuracy in ms, pitch spread
  in semitones, transcript match,
- **what did not**, with the timestamp where it is visible,
- computed spend for the project (`scripts/state.py show <project>`),
- what you would change next, and which stage owns it.

Do not describe a defect you did not look for, and do not call something good because
the numbers passed. If you did not examine it, say you did not.

Hand over the file path and the project's page in the review UI (`ugckit ui`,
http://127.0.0.1:7878), where the video plays next to the prompt that made it.

    scripts/state.py set <project> deliver done
