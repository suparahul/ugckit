# Quality Control

Run before final output.

## Drift Check — Mode B

Mark each pass/fail and fix failures before shipping.

- One creator name/identity throughout.
- Face description identical wherever pasted.
- Voice description identical wherever pasted.
- Lighting system identical unless a second setup was explicitly locked.
- Wardrobe identical unless a second outfit was explicitly locked.
- No second person / stranger hands / stock-person B-roll.
- No unplanned room changes.
- Product screen/packaging never contradicts the supplied asset.
- No fake numbers, fake reviews, fake notifications, or invented readable copy.
- 15 TH, 15 HT, 10 BA, 10 CF.
- Hooks are meaningfully distinct.

## Generation Check — hero ads and production prompts

- Format chosen from the product’s core loop, not category alone.
- Reference ad was reduced to structure rather than copied literally.
- Creator reference avoids glamour/AI-coded words.
- Localized skin/hair imperfections are present when casting from scratch.
- Bound creator/product references are individually described by role.
- Product text/branding comes from a clean reference when readability matters.
- Everyone who appears/speaks is planned from the start; no surprise invented humans.
- On-camera dialogue has clear face visibility and lip-sync instruction.
- Physics block matches the action.
- Camera/light are physically coherent.
- No conflicting instructions such as “locked tripod” and “heavy handheld sway” in the same beat.
- On-screen text is included only when intentional.
- Unsupported claims/statistics are removed.
- Negatives target real failure modes rather than random prompt bloat.

## Failure repair

When a generation fails, identify the failure class and patch that layer only:
- face drift → reference binding / creator lock / start frame;
- plastic skin → creator reference realism / lighting / negative;
- bad hands/product contact → shot simplification + physics;
- warped UI/text → stronger product reference + less camera motion;
- bad lip sync → fewer words + clearer on-camera anchors;
- room/outfit drift → restate exact lock, remove decorative scene language;
- ad feels polished → strip cinema/pro-camera terms, simplify set and lighting.
