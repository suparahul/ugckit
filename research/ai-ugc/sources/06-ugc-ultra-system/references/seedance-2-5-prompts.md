---
name: seedance-2-5-prompts
description: Write Seedance 2.5 (Dreamina) video prompts to ByteDance's official specification. Use when the user wants to generate, edit or extend a video with Seedance or Dreamina - text-to-video, image/video/audio references, keeping characters consistent across shots, 30-second staged videos, timestamp pacing, replacing a subject or background in an existing clip, editing audio channels, extending a video forwards or backwards, first/last frame and keyframe control, storyboard grids, coarse or fine blockout rendering, one-click videos from a batch of images, seamless transitions between two clips, emotional direction, or cinematography terms.
---

# Seedance 2.5 Prompt Writer

Turns a plain-English description into a Seedance 2.5 prompt written to ByteDance's official specification.

Seedance 2.5 is unusually literal. It does what you ask, but only if you say which reference is which, what must not change, and how the frame should look when each beat ends. Most bad output is an underspecified prompt, not a model failure.

Everything below is transcribed from the official **Dreamina Seedance 2.5 Prompt Guide** (ByteDance, 31 July 2026): **23 task types**, **67 templates and worked examples**, **75 documented failure modes**.

## How to use this

1. Work out which task type the request is, from the table below.
2. Jump to that section and use its template.
3. Ask the user for anything genuinely missing rather than inventing it -- especially, for any edit, **what must stay unchanged**.
4. Output the finished prompt in a code block so it can be copied straight out.
5. Run the pre-submission checklist at the bottom before handing it over.

| Task type | What it is |
|---|---|
| [Text to video](#text-to-video) | the core prompt formula |
| [Reference roles](#reference-roles) | binding @Image / @Video / @Audio |
| [Multi-reference](#multi-reference) | up to 50 materials, cast properly |
| [Audio & text syntax](#audio-text-syntax) | music - SFX - dialogue - subtitles |
| [Staged video](#staged-video) | up to 30 seconds |
| [Timestamps & pacing](#timestamps-pacing) | one-second precision |
| [First & last frame](#first-last-frame) | anchor images |
| [Multi-keyframe sequence](#multi-keyframe-sequence) | ordered stage anchors |
| [General editing](#general-editing) | the base edit pattern |
| [Subject replacement](#subject-replacement) | plus timeline inheritance |
| [Background replacement](#background-replacement) | bounded by the silhouette |
| [Audio editing](#audio-editing) | one channel at a time |
| [Forward extension](#forward-extension) | boundary first, then new |
| [Backward extension](#backward-extension) | new first, then boundary |
| [Storyboard grids](#storyboard-grids) | shot order from a board |
| [Coarse blockout](#coarse-blockout) | grey geometry -> real render |
| [Fine blockout](#fine-blockout) | complete model -> re-render |
| [One-click video](#one-click-video) | a batch of images -> one edit |
| [Seamless transitions](#seamless-transitions) | a bridge between two clips |
| [Emotional direction](#emotional-direction) | observable, not adjectival |
| [Cinematography terms](#cinematography-terms) | basic, popular and niche |
| [Reference material limits](#reference-material-limits) | 50 total, per-type caps |
| [Parameter locks](#parameter-locks) | what you cannot set |

If the request is ambiguous, ask once, then continue.

## Rules that apply to every task

**The core formula.** Everything after the first part is optional:

```
Subject + Action/Event + Scene & Environment + Visual Style + Camera + Audio
```

**Bind every reference individually.** The single most common failure is writing "@Images 1 through 4 define four characters respectively." That never says which image is which character. Instead:

```
<Character A> corresponds to @Image 1. Use only the appearance, hairstyle and clothing.
```

**Always write exclusions.** If a reference contains a background, a person or a composition you do not want carried over, say so: `Do not use the image background.` `Do not use the people in the image.`

**Write mappings in the prompt, not in the image.** Text labels inside a reference are not read as instructions.

**Audio and text syntax:**

| Content | Syntax | Example |
|---|---|---|
| Music | `( )` | `(Soft, rhythmic piano music plays in the background)` |
| Sound effects | `< >` | `<A bell rings in the distance>` |
| Dialogue | `{ }` | `{Hello, welcome back.}` |
| Subtitles | full-width brackets | `[Chapter One: Departure]` written with CJK lenticular brackets |

For non-Chinese dialogue, name the language before the line:

```
Dialogue language: American English. The girl says in natural, conversational
American English: {I thought you were not coming.}
```

**Never put generation parameters in the prompt.** Aspect ratio and duration are set on the generation page or through the API, and some lock automatically.

---

# Generate

_From nothing, or from reference material_

## Text to video

_the core prompt formula_

The base formula. Prompts can flexibly combine these elements, and you may omit any component you do not need -- but each part you drop becomes a decision the model makes without you.

| Element | What it carries |
| --- | --- |
| Subject + action | Who or what is doing what. The foundation of the video. |
| Scene and environment | Location, time, weather, spatial relationships, background state. |
| Visual style | Lighting, colour, materials, image texture, overall mood. |
| Camera movement / cut | Shot size, camera angle, movement, focus subject, shot transitions. |
| Audio | Dialogue, voice characteristics, ambience, sound effects, music. |

**Template**

```
<Subject> performs <primary action or event> in <scene and environment>.
The visuals feature <visual style>.
Use <shot size, camera angle, camera movement, or cuts>.
Audio includes <dialogue, ambience, sound effects, or music>.
```

**Worked example**

```
A ceramic artist finishes a pale blue cup in a studio at dawn, lifts it
from the wheel, and places it in the center of a wooden shelf.

Soft morning light enters through the window. The wet clay has a delicate
sheen, and the workbench remains tidy.

Begin with a medium shot of the wheel-throwing process, slowly push in
toward the cup's surface texture, then cut to a frontal view of the shelf.

Retain the low hum of the pottery wheel, the friction of clay, and subtle
indoor ambience.
```

```
EACH ELEMENT, WRITTEN OUT

SUBJECT + ACTION -- the only non-optional part.
  A ceramic artist finishes a pale blue cup and lifts it from the wheel.

SCENE AND ENVIRONMENT -- location, time, weather, spatial relationships,
background state.
  ...in a studio at dawn. Soft light through the window, workbench tidy.

VISUAL STYLE -- lighting, colour, materials, image texture, overall mood.
  The wet clay has a delicate sheen. Raw handheld footage, visible grain,
  no colour grading.

CAMERA -- shot size, angle, movement, focus subject, transitions.
  Begin on a medium shot, push in slowly toward the surface texture,
  then cut to a frontal view of the shelf.

AUDIO -- dialogue, voice, ambience, effects, music.
  Retain the low hum of the wheel, the friction of clay, indoor ambience.
```

```
THE SAME SUBJECT, THREE LEVELS OF SPECIFICATION

MINIMUM -- subject and action only. Everything else is the model's call.
  A ceramic artist lifts a finished cup from the wheel.

MIDDLE -- adds scene and camera. Style and audio still open.
  A ceramic artist lifts a finished cup from the wheel in a studio at dawn.
  Medium shot, slow push-in toward the cup.

FULL -- nothing left to interpretation.
  A ceramic artist finishes a pale blue cup in a studio at dawn, lifts it
  from the wheel, and places it in the centre of a wooden shelf.
  Soft morning light enters through the window. The wet clay has a delicate
  sheen, and the workbench remains tidy.
  Begin with a medium shot of the wheel-throwing process, slowly push in
  toward the cup's surface texture, then cut to a frontal view of the shelf.
  Retain the low hum of the pottery wheel, the friction of clay, and subtle
  indoor ambience.
```

**What breaks it**

1. **You may omit any components you do not need.** The formula is a menu, not a checklist.
2. **Generation parameters do not belong in the prompt.** Configurable parameters are set on the generation page or through the API.
3. **Style is not a mood word.** "Cinematic" leaves the model free; "soft morning light through a window, visible sensor grain, no colour grading" does not.

**Parameters:** Aspect ratio - settable | Duration - settable

## Reference roles

_binding @Image / @Video / @Audio_

After uploading reference materials, specify exactly what each one contributes. Add exclusions when people, backgrounds or compositions in a material could be unintentionally carried into the output.

**Template**

```
@Image 1 defines <subject>'s <appearance, clothing, structure, or material>.
@Video 1 defines <motion, camera movement, or pacing>.
@Audio 1 defines <character or sound type>'s <voice, dialogue, ambience, or music>.
<Subject> completes <primary action or event> in <scene>.
The visuals feature <visual style>, with <camera treatment>.
```

**Worked example**

```
@Image 1 defines the ceramic artist's facial features, hairstyle, and dark
green apron. Do not use the image background.

@Image 2 defines the wooden workbench, window placement, and morning light
of the pottery studio. Do not use the people in the image.

@Video 1 defines the pacing of throwing clay with both hands, lifting the
cup, and placing it down. Do not use the person's identity, clothing, or
scene from the video.

The ceramic artist finishes a pale blue cup in the pottery studio at dawn,
lifts it from the wheel, and places it in the center of a wooden shelf.

Begin with a medium shot of the wheel-throwing process, then slowly push in
toward the cup's surface texture. Retain the sound of the wheel, the
friction of clay, and indoor ambience.
```

```
SEVERAL VIEWS OF THE SAME OBJECT -- state it explicitly

@Image 1 defines the front view of the same folding desk lamp.
@Image 2 defines the left-side structure of the same folding desk lamp.
@Image 3 defines the right-side structure of the same folding desk lamp.
@Image 4 defines the rear structure of the same folding desk lamp.

All four images define one folding desk lamp. The output must contain only
one lamp throughout.
```

```
WHEN THE REFERENCE VIDEO ALREADY CARRIES THE MOTION

When a reference video already defines the motion, camera movement and
sequence accurately, state only which attributes to inherit. There is no
need to restate every action -- repeating the motion description may
conflict with the reference itself.

A blockout video is the exception. It mainly provides motion and spatial
structure, so the prompt must still define the intended subjects, scene,
action and visual style.
```

**What breaks it**

1. **Exclusions are not optional.** If a reference contains a background, a person or a composition you do not want carried over, say so explicitly.
2. **Material mappings must be written in the prompt.** Do not rely only on text labels inside images, and do not make the model infer which person, prop or scene each material represents.
3. **State the count when several images show one object.** Otherwise you get four lamps instead of four views of one lamp.
4. **Do not re-describe motion a reference video already carries.** It conflicts with the reference.

**Parameters:** Aspect ratio - settable | Duration - settable

## Multi-reference

_up to 50 materials, cast properly_

With many materials the goal is not to put every reference into one sentence, but to define the relationships among characters, props, scenes, actions and audio. Order of work: define each role, map subjects, group by type, profile the recurring ones, then select per scene.

**Template**

```
STEP 1 -- name and map each subject individually

<Character A> corresponds to @Image 1. Use only the appearance, hairstyle
and clothing.
<Character B> corresponds to @Image 2. Use only the appearance, hairstyle
and clothing.
<Prop A> corresponds to @Image 3. Use only the structure, material and colour.
<Scene A> references @Image 4. Use only the spatial layout, architecture and
lighting. Do not use the people in the image.

Do NOT write "@Images 1 through 4 define four characters respectively."
That wording does not state which image corresponds to which character.
```

**Worked example**

```
[Characters]
<Conservator> corresponds to @Image 1. Use only the appearance, hairstyle,
and clothing.
<Registrar> corresponds to @Image 2. Use only the appearance, hairstyle,
and clothing.
<Exhibition Installer> corresponds to @Image 3. Use only the appearance,
hairstyle, and clothing.
<Guide> corresponds to @Image 4. Use only the appearance, hairstyle, and
clothing.
Do not interchange the four characters' appearances, clothing, actions,
positions, or dialogue.

[Props]
<Sample Case> corresponds to @Image 5 and belongs only to <Conservator>.
<Record Board> corresponds to @Image 6 and belongs only to <Registrar>.

[Scenes]
<Conservation Lab> references @Image 7. Use only the space, materials, and
lighting.
<Gallery> references @Image 8. Use only the space, materials, and lighting.

[Motion and Audio]
@Video 1 defines the motion of <Conservator> opening <Sample Case>. Do not
use the person or scene from the video.
@Audio 1 defines <Guide>'s voice and specified dialogue.
```

```
STEP 3 -- a centralised profile for important subjects

When the same character uses several references across multiple scenes,
add a subject profile.

[Subject Profile: Conservator]
Appearance and clothing: @Image 1.
Fixed prop: <Sample Case> from @Image 5.
Locations: <Conservation Lab> and <Gallery>.
Motion references: the case-opening motion from @Video 1 and the
sample-placement motion from @Video 2.
Do not use: other characters' clothing. Do not give this character
<Record Board> or guide equipment.
```

```
STEP 4 -- select references by scene

Scene 1 | Inspection in the Conservation Lab
Use: <Conservator>, <Sample Case>, <Conservation Lab>, and the case-opening
motion from @Video 1.
Event: <Conservator> opens <Sample Case> at the workbench and inspects the
sample inside.
End state: <Conservator> remains on the inner side of the workbench.
<Sample Case> stays beside the conservator's right hand, which is on the
left side of the frame.

Scene 2 | Registration in the Gallery
Use: <Registrar>, <Record Board>, and <Gallery>.
Event: <Registrar> checks the number on <Record Board> beside the display
case.
End state: <Registrar> still holds <Record Board> with both hands. No other
character enters the display-case area.
```

**What breaks it**

1. **The single most common failure:** "@Images 1 through 4 define four characters respectively." That never says which image is which character.
2. **Separate view images beat a collage.** If more than five subjects also require multiple views, place different views in separate images -- independent view images are usually more stable.
3. **The goal is selection, not display.** Multi-reference helps the model select the correct materials for the current scene, not make every material appear at the same time.
4. **Recurring characters need a profile** listing appearance, fixed props, locations, motion references and exclusions in one block.

**Parameters:** Aspect ratio - settable | Duration - settable

## Audio & text syntax

_music - SFX - dialogue - subtitles_

Prompts can be written entirely in natural language. When you need to distinguish music, sound effects, dialogue and subtitles more explicitly, use this syntax.

| Content | Syntax | Example |
| --- | --- | --- |
| Music | ( ) | (Soft, rhythmic piano music plays in the background) |
| Sound effects | < > | <A bell rings in the distance> |
| Dialogue | { } | {Hello, welcome back.} |
| Subtitles | 【 】 | 【Chapter One: Departure】 |

**Template**

```
Dialogue language reinforcement -- when dialogue is not in Chinese,
specify the language before the line:

Dialogue language + regional variety or accent + delivery style
+ speaker + {dialogue}
```

**Worked example**

```
The girl says softly in Japanese: {もう大丈夫です}

Dialogue language: American English. The girl says in natural,
conversational American English: {I thought you weren't coming.}

Dialogue language: authentic Los Angeles English. The young man says in
natural Los Angeles vernacular: {No way, you actually made it.}
```

```
ALL FOUR BRACKETS INSIDE ONE PROMPT

A barista opens the shutter of a small corner cafe at dawn, wipes down the
counter, and starts the first pour of the morning.

Warm low sunlight through the front glass, steam rising, visible sensor
grain. Medium shot, slow push-in toward the cup, then cut to the street.

(Soft, rhythmic piano music plays in the background)
<The metal shutter rattles upward>
<Steam hisses from the wand>
Dialogue language: American English. The barista says in natural,
conversational American English: {First one's always the best one.}
【Chapter One: Opening】
```

```
WHAT EACH BRACKET CONTROLS, AND WHAT IT DOES NOT

( ) music -- the score. Use it for mood, tempo and instrumentation.
    (Soft, rhythmic piano music plays in the background)
    (No music)

< > sound effects -- discrete, source-linked events, one per bracket.
    <A bell rings in the distance>
    <Footsteps reverberate on stone>
    Do not stack five effects into one bracket; give each its own.

{ } dialogue -- the spoken words only. Delivery, speaker and language go
    OUTSIDE the braces, immediately before them.
    The girl says softly in Japanese: {もう大丈夫です}

【 】 subtitles -- burned-in on-screen text, not a transcript of dialogue.
    【Chapter One: Departure】
```

```
THE FULL LANGUAGE FORMULA, SLOT BY SLOT

Dialogue language + regional variety or accent + delivery style
+ speaker + {dialogue}

  Dialogue language ....... American English
  Regional variety ........ authentic Los Angeles English
  Delivery style .......... natural, conversational / softly / flatly
  Speaker ................. the young man / <Presenter> / the barista
  {dialogue} .............. {No way, you actually made it.}

Reach for the full formula when the dialogue text is in English but the
model speaks it in Chinese, or when you need a specific regional variety.
For a single neutral line, language + speaker + {dialogue} is enough.
```

**What breaks it**

1. **Name the language before the line, not after.**
2. **Reinforce when the model drifts.** If the dialogue text is in English but the model speaks it in Chinese, or you need a specific regional variety, use the full formula.
3. **Delivery style is part of the formula.** "Says softly", "says in natural conversational" -- not just the language name.

**Parameters:** Aspect ratio - settable | Duration - settable

---

# Sequence

_Controlling what happens when_

## Staged video

_up to 30 seconds_

When a video contains several events, divide the story into consecutive stages. Give each stage only one primary state change, and state what should be directly visible at the end of that stage.

**Template**

```
[Generation Goal]
Generate a <video type>. The central subject is <subject>, and the primary
event is <story summary>.

[Stage 1]
Initial state: <initial state of characters, props, and scene>.
Primary event: <one primary action or event>.
End state: <character positions, prop ownership, or visible scene state>.

[Stage 2]
Continue from the previous stage: <state that must remain unchanged>.
Primary event: <one primary action or event>.
End state: <observable state>.

[Stage 3]
Primary event: <closing event>.
End state: <final visible state>.

[Maintain Consistency]
Keep <character identity, number of characters, clothing, prop ownership,
spatial direction, and audio relationships> consistent.
```

**Worked example**

```
[Generation Goal]
Generate an instructional video showing a flower shop's order-packing
process. <Florist> and <Store Assistant> arrange, wrap, and hand off a
bouquet together.

[Stage 1]
Initial state: <Florist> stands behind the workbench. Loose flower stems,
scissors, and wrapping paper lie on the tabletop.
Primary event: <Florist> arranges the stems and trims them to length.
End state: <Florist> holds the bouquet in the left hand, and the scissors
are back on the right side of the workbench.

[Stage 2]
Continue from the previous stage: both characters retain the same
identities and clothing, and <Florist> still holds the bouquet.
Primary event: <Store Assistant> unfolds the wrapping paper. <Florist>
places the bouquet inside and ties it with a green ribbon.
End state: the wrapped bouquet lies flat in the center of the workbench,
with the ribbon bow facing the camera.

[Stage 3]
Primary event: <Store Assistant> picks up the bouquet and places it on the
pickup shelf.
End state: the bouquet is centered on the pickup shelf, and both characters
stand behind the workbench inspecting the finished order.

[Maintain Consistency]
Keep <Florist> and <Store Assistant>'s identities, clothing, workbench
orientation, scissors position, and bouquet ownership consistent.
```

**What breaks it**

1. **One primary state change per stage.** Two events in one stage is where sequences start dropping beats.
2. **The end state must be directly visible** -- a position, an object in a hand, a visible scene state. Never a mood.
3. **Each stage restates what must not change.** "Continue from the previous stage: both characters retain the same identities and clothing."
4. **Close with the consistency block.** Character count, clothing, prop ownership, spatial direction and audio relationships all drift without it.

**Parameters:** Aspect ratio - settable | Duration - settable

## Timestamps & pacing

_one-second precision_

For ordinary narratives, use stages by default. Use one-second precision only when you need to control a critical handoff, entrance or exit, transition, or explicit beat.

| Pattern | Example |
| --- | --- |
| Time range | 0-3 seconds... 3-7 seconds... 7-12 seconds... |
| Exact time point | At 5 seconds, the camera whip-pans rapidly to the left and completes the transition. |
| Relative timing | Three seconds after the character presses the button, the room lights gradually turn off. |

**Template**

```
Use time ranges to allocate pacing, exact time points for a single key
event, and relative timing to describe a delay between events.

<start>-<end> seconds: <event>. End state: <observable state>.
<start>-<end> seconds: <event>. End state: <observable state>.
```

**Worked example**

```
0-5 seconds: Show an empty wooden display table. A hand places a white
ceramic plate on it. End state: the hand has left the frame, and only the
white plate remains in the center of the table.

5-10 seconds: Remove the white plate, then place a clear glass on the
table. End state: only the clear glass remains in the center of the table.

10-15 seconds: Remove the clear glass, then place a green ceramic vase on
the table. End state: only the green vase remains in the center of the
table.
```

```
THE THREE PATTERNS, WORKED

TIME RANGE -- allocate a budget to each beat.
  0-3 seconds: the shutter is closed, street empty.
  3-7 seconds: a hand pulls the shutter upward.
  7-12 seconds: the barista steps under it and switches on the lights.

EXACT TIME POINT -- pin one critical moment.
  At 5 seconds, the camera whip-pans rapidly to the left and completes the
  transition.

RELATIVE TIMING -- describe a delay between two events.
  Three seconds after the character presses the button, the room lights
  gradually turn off.
```

```
WHY RANGES DRIFT, AND WHAT TO DO ABOUT IT

A range is an event's TIME BUDGET, not a precise edit point. Actions may
occur slightly before or after a boundary. That is expected, not a failure.

TOO LITTLE CONTENT in a range gives the model more freedom, and it fills
the space with invented motion.
  BAD   0-8 seconds: she stands there.

TOO MUCH CONTENT causes excessive cutting or omitted events.
  BAD   0-3 seconds: she enters, sits, opens the laptop, types, stands,
        crosses the room and opens the door.

NEVER DEMAND A FREQUENCY.
  BAD   Complete three actions in one second.

OVERLAPS ARE NOT RESOLVED FOR YOU.
  BAD   0-5 seconds: ...  /  4-9 seconds: ...
  GOOD  0-5 seconds: ...  /  5-10 seconds: ...
```

**What breaks it**

1. **Time ranges should be consecutive and non-overlapping.**
2. **They represent an event's time budget, not a precise edit point,** so actions may occur slightly before or after a boundary.
3. **Too little content in a range gives the model more freedom;** too much can cause excessive cutting or omitted events.
4. **Do not use timestamps to demand frequencies** such as "complete three actions in one second."

**Parameters:** Aspect ratio - settable | Duration - settable

## First & last frame

_anchor images_

In multimodal reference mode you can state on the first line that @Image 1 is the first frame and @Image 2 is the last frame. There is no need to switch to a separate first/last-frame mode. The system locks the output aspect ratio to the first image, while duration is set on the generation page or through the API.

**Template**

```
@Image 1 is the first frame. It defines the opening composition, subject
position, pose, prop state, scene, and camera direction.
@Image 2 is the last frame. It defines the ending composition, subject
position, pose, prop state, scene, and camera direction.
@Image 3 defines <Subject A>'s <appearance, clothing, structure, or material>.
Do not change the first-frame composition defined by @Image 1 or the
last-frame composition defined by @Image 2.
@Image 4 defines <specified attributes> of <Subject B, prop, or scene>.

<Describe one continuous action or event>.
The video begins naturally from the first frame defined by @Image 1 and
reaches the last frame defined by @Image 2 after the continuous action.
Between the first and last frames, maintain continuity in <character
identity, prop structure and ownership, scene layout, and camera direction>.
```

**Worked example**

```
@Image 1 is the first frame. It defines the opening composition, character
positions, poses, tabletop prop states, perfume-workshop scene, and camera
direction.

@Image 2 is the last frame. It defines the ending composition, character
positions, poses, tabletop prop states, perfume-workshop scene, and camera
direction.

@Image 3 defines <Perfumer>'s face, hairstyle, and dark green apron. Do not
change the first-frame composition defined by @Image 1 or the last-frame
composition defined by @Image 2.

@Image 4 defines <Glass Perfume Bottle>'s shape, material, and label
position.

Starting from the first-frame pose, <Perfumer> picks up a dropper and
<Glass Perfume Bottle>, drips amber fragrance oil into the bottle, swirls
it gently, closes the stopper, places the finished bottle in the center of
the table, and naturally reaches the last frame defined by @Image 2.

Between the first and last frames, maintain continuity in <Perfumer>'s
identity and clothing, bottle count and structure, wooden-table layout,
warm side lighting, and camera direction.
```

**What breaks it**

1. **Describe each anchor image separately.** Do not combine them into a sentence such as "@Images 1 and 2 are the first and last frames."
2. **The first and last images should use the same aspect ratio.** Mismatched ratios may stretch the last frame.
3. **Other references supplement only their specified attributes** and must not replace the first- or last-frame composition.
4. **No separate mode needed.** Declare the anchors inside a normal multimodal prompt.

**Parameters:** Aspect ratio - inherits @Image 1 (locked) | Duration - settable

## Multi-keyframe sequence

_ordered stage anchors_

When separate images define different stages of a process, begin with the order, then describe the key state represented by each image. Independent keyframe images are usually easier to align than several frames combined into one grid.

**Template**

```
Use @Image 1 through @Image N as keyframes in this order.

@Image 1 is the first frame. It defines <opening composition, subject
position, pose, prop state, and camera direction>.
@Image 2 defines the second keyframe: <visible end state of Stage 1>.
@Image 3 defines the third keyframe: <visible end state of Stage 2>.
@Image N is the last frame. It defines <ending composition, subject position,
pose, prop state, and camera direction>.

The video passes through the states defined by @Image 1, @Image 2, @Image 3
and @Image N in order, using continuous action to transition naturally
between stages.
Maintain continuity in <subject identity, prop structure and ownership,
scene layout, lighting, and axis of action> throughout.
```

**Worked example**

```
Use @Image 1 through @Image 4 as keyframes in this order.

@Image 1 is the first frame. It shows an orange paper airplane resting on
the left side of a classroom desk, pointed toward the right, in a
locked-off medium shot.

@Image 2 defines the second keyframe: one hand lifts the same orange paper
airplane from the desk without changing its direction.

@Image 3 defines the third keyframe: the same orange paper airplane passes
the window while the curtain moves slightly to the right.

@Image 4 is the last frame. It shows the same orange paper airplane resting
on the middle shelf of the bookcase on the right, still pointed toward the
right.

The video passes through the states defined by @Image 1, @Image 2, @Image 3,
and @Image 4 in order. Keep flight direction and speed continuous between
stages.

Maintain the paper airplane's orange material, size, and folds, as well as
the classroom layout, afternoon side lighting, and camera axis.
```

**What breaks it**

1. **They control stage order and key states.** They do not reproduce every frame exactly.
2. **Independent images beat a grid.** Several frames combined into one grid are harder to align.
3. **Open with the order statement** before describing any individual keyframe.

**Parameters:** Aspect ratio - inherits @Image 1 (locked) | Duration - settable

---

# Edit

_Changing a video you already have_

## General editing

_the base edit pattern_

When editing an existing video, first define the source video as the sole editing master. Then specify the edit target, edit scope, target material, and content to preserve. The output automatically preserves the input aspect ratio and approximately its duration.

**Template**

```
[Edit Goal]
Edit @Video 1. Within <the entire video or a specific time range>, <add,
remove, replace, or adjust> <visual object, region, or audio category>.

[Source Video Role]
@Video 1 is the sole editing master. It defines <characters, scene, actions,
composition, camera movement, occlusion relationships, audio, and event order>.

[Target Material Role]
@Image 1 or @Audio 1 defines <specified attributes of the target object or sound>.

[Edit Scope]
Modify only <object, region, time range, or audio category>.

[Content to Preserve]
Keep <visual content, motion, audio, and timing relationships that must not
change> from @Video 1.
```

**Worked example**

```
[Edit Goal]
Edit @Video 1. Only from 4-7 seconds, change the cool blue light on the
right wall to warm orange light.

[Source Video Role]
@Video 1 is the sole editing master. It defines the character, room layout,
actions, composition, camera movement, audio, and event order.

[Edit Scope]
Change only the light color on the right wall and the area it illuminates.
Allow the character's skin tone to respond naturally to the environmental
light.

[Content to Preserve]
Keep the character's identity, clothing, expression, position, motion, room
structure, camera movement, dialogue, and ambience from @Video 1.
```

**What breaks it**

1. **"Sole editing master" is load-bearing.** It tells the model the source outranks every other material you attached.
2. **No preserve clause means no guarantees.** Anything you did not name is fair game.
3. **Duration is inherited, not set.** Input-frame processing may introduce a difference of up to approximately 0.3 seconds, usually from transition-frame handling, while overall content and event order remain substantially unchanged.

**Parameters:** Aspect ratio - inherits source (locked) | Duration - inherits source +/-0.3s (locked)

## Subject replacement

_plus timeline inheritance_

A replacement has to pick up the original's entire life in the clip -- not just its look, but every appearance, motion, occlusion and exit at the same timing, duration, path and speed.

**Template**

```
[Edit Goal]
Edit @Video 1. Change only <original object> to <target object>.

[Source Video Role]
@Video 1 is the sole editing master. It defines the original scene, camera
position, camera movement, motion path, occlusion relationships, and event order.

[Target Reference Role]
@Image 1 defines <target object>'s <appearance, structure, or material>.
Do not use <irrelevant background, people, or composition>.

[Edit Scope]
Modify only <specific object and area>. The entire video contains
<number> target object(s). Do not modify <content to preserve>.

[Timeline Inheritance]
<Target object> inherits every appearance, motion, occlusion, and exit of
<original object>, including timing, duration, path, and speed changes.
Except for the object or area explicitly modified above, keep all other
people, props, scene content, camera movements, cuts, and event order from
@Video 1 unchanged.
```

**Worked example**

```
[Edit Goal]
Edit @Video 1. Replace only the yellow folding desk lamp with the white
folding desk lamp in @Image 1.

[Source Video Role]
@Video 1 is the sole editing master. It defines the desk, books, hand
movements, camera position, camera movement, occlusion relationships, and
event order.

[Target Reference Role]
@Image 1 defines only the white folding desk lamp's appearance, structure,
and material. Do not use the image's background, composition, or other
objects.

[Edit Scope]
Keep exactly one white folding desk lamp throughout the video. Replace only
the original yellow folding desk lamp. Do not modify the books, desk,
hands, or background.

[Timeline Inheritance]
The white folding desk lamp inherits every appearance, lamp-arm rotation,
hand occlusion, and exit of the original yellow folding desk lamp,
including timing, path, and speed changes.

Except for the object or area explicitly modified above, keep all other
people, props, scene content, camera movements, cuts, and event order from
@Video 1 unchanged.
```

**What breaks it**

1. **State the count explicitly.** "Exactly one throughout the video" is what prevents a second copy appearing.
2. **Without timeline inheritance** the replacement tends to appear and vanish on its own schedule rather than the original's.
3. **Close with the catch-all clause** covering all other people, props, scene content, camera movements, cuts and event order.
4. **The target reference contributes attributes only.** Exclude its background, composition and other objects.

**Parameters:** Aspect ratio - inherits source (locked) | Duration - inherits source +/-0.3s (locked)

## Background replacement

_bounded by the silhouette_

Same edit shape, with the boundary drawn at the subject's outline. The reference supplies spatial layout, materials, depth of field, ambient colour and lighting direction only -- never its own people or foreground objects.

**Template**

```
[Edit Goal]
Edit @Video 1. Replace only <original background area> with <target
environment> from @Image 1.

[Source Video Role]
@Video 1 is the sole editing master. It defines the people, foreground
objects, actions, composition, camera movement, and event order.

[Target Reference Role]
@Image 1 defines only <target environment>'s spatial layout, materials,
depth of field, ambient colour, and lighting direction.
Do not use the people or foreground objects in the image.

[Edit Scope]
Modify only <background outside the subject's silhouette>. Do not modify
<subject identity, facial features, hairstyle, clothing, expression,
position, size, or motion>.

[Timeline Inheritance]
Keep the character actions and occlusion relationships from @Video 1.
```

**Worked example**

```
@Video 1 is the sole editing master. It defines the people, actions,
composition, camera treatment, and event order.

@Image 1 provides only the spatial layout, depth of field, ambient color,
and lighting direction of a daylit glass greenhouse. Do not use the people
in the image.

Replace only the light gray background outside the person's silhouette in
@Video 1 with the daylit glass greenhouse from @Image 1.

Keep the person's identity, facial features, hairstyle, clothing,
expression, position, size, and arm-raising motion from @Video 1.

Except for the object or area explicitly modified above, keep all other
people, props, scene content, camera movements, cuts, and event order from
@Video 1 unchanged.
```

**What breaks it**

1. **Name the silhouette as the boundary.** "Change the background" without it leaks into the subject.
2. **Keep occlusion relationships** from the source, or the subject starts floating in front of the new space.
3. **Lighting direction is part of the reference's job.** State it, or the subject stays lit for the old room.

**Parameters:** Aspect ratio - inherits source (locked) | Duration - inherits source +/-0.3s (locked)

## Audio editing

_one channel at a time_

Dialogue, language, voice, background music and sound effects can be edited separately. State the speaker or sound category, the intended change, and which other sounds must remain unchanged.

**Template**

```
Edit @Video 1. <Remove / change> only <sound category or speaker>.
Keep <the other audio categories>.
Preserve the visuals, camera treatment and editing rhythm from @Video 1.
```

**Worked example**

```
Edit @Video 1. Remove only the original background music. Keep the
character dialogue, lip sync, ambience, and action sound effects; preserve
the visuals, camera treatment, and editing rhythm from @Video 1.

Edit @Video 1. Change <Presenter>'s spoken language to natural American
English while preserving the dialogue content and speaking times. Keep all
other character voices, background music, ambience, and visuals from
@Video 1.
```

```
THE FOUR CHANNELS, EDITED SEPARATELY

REMOVE THE MUSIC, KEEP EVERYTHING ELSE
  Edit @Video 1. Remove only the original background music. Keep the
  character dialogue, lip sync, ambience, and action sound effects;
  preserve the visuals, camera treatment, and editing rhythm from @Video 1.

CHANGE THE SPOKEN LANGUAGE
  Edit @Video 1. Change <Presenter>'s spoken language to natural American
  English while preserving the dialogue content and speaking times. Keep
  all other character voices, background music, ambience, and visuals.

REMOVE AMBIENCE, KEEP THE REST
  Edit @Video 1. Remove only the room ambience. Keep the character
  dialogue, lip sync, background music, and action sound effects; preserve
  the visuals, camera treatment, and editing rhythm from @Video 1.

CHANGE ONE SPEAKER'S VOICE ONLY
  Edit @Video 1. Change only <Presenter>'s voice characteristics to a
  lower, calmer register, preserving the dialogue content and speaking
  times. Keep all other character voices, music, ambience, and visuals.
```

```
THE SHAPE THAT MAKES IT SAFE

Every audio edit is three clauses, and skipping the third is what lets the
picture drift on an edit you thought was audio-only.

  1  Name the ONE channel you are touching, with "only".
  2  List every channel that stays.
  3  Freeze the visuals, camera treatment and editing rhythm explicitly.

Channels available: dialogue - lip sync - character voice - background
music - ambience - action sound effects.
```

**What breaks it**

1. **Freeze the visuals explicitly,** even on an audio-only edit.
2. **Language changes should preserve dialogue content and speaking times** or lip sync drifts.
3. **Name the speaker,** not "the voice", whenever more than one person talks.

**Parameters:** Aspect ratio - inherits source (locked) | Duration - inherits source +/-0.3s (locked)

---

# Extend

_Building past the edge of an existing clip_

## Forward extension

_boundary first, then new_

Video extension creates content beyond the boundary of a source video. For a forward extension, the extension's first frame should continue from the source video's last frame. First describe that continuous state, then describe what happens afterwards.

**Template**

```
BASIC TEMPLATE

@Video 1 is the source video to extend forward.

Extend @Video 1 forward. The first frame of the extended segment directly
continues from the last frame of @Video 1. Maintain continuity in <subject
pose and orientation>, <prop position>, <background and spatial
relationships>, <camera position and composition>, <lighting>, and
<motion direction>.

Then, <describe the new action, event, camera treatment, or audio to add>.

Throughout the extension, maintain continuity in <character identity and
clothing>, <key props>, <background layout>, and <axis of action>.
Keep each subject as the same continuous instance throughout: do not
duplicate or split it, and keep the person's appearance or the object's
number of parts stable.
```

**Worked example**

```
@Video 1 is the source video to extend forward.

Extend @Video 1 forward. The first frame of the extended segment directly
continues from the last frame of @Video 1. Maintain the same locked-off
medium shot, the orange paper airplane's position and orientation, the
classroom-window background, the afternoon lighting, and its movement
toward the right side of the frame.

Then, the orange paper airplane continues gliding toward the right and
exits the frame while the white curtain beside the window sways slightly.
Keep the camera and classroom background in the state established by the
source video's last frame.
```

```
WITH ADDITIONAL REFERENCE MATERIALS -- template

Define the role of every additional material first, then state that the
source video controls the extension boundary. New materials may supplement
characters, props or audio, but they must not override the source video's
last-frame control over the extension's opening image.

@Image 1 defines <Character A>'s facial features.
@Image 2 defines <Character A>'s clothing.
@Image 3 defines <key prop>'s structure and material.
@Video 1 is the source video to extend forward.

Extend @Video 1 forward. The first frame of the extended segment directly
continues from the last frame of @Video 1. Maintain continuity in
<boundary-frame state>.

Then, <Character A uses the key prop to complete a new action or event>.

Throughout the extension, maintain continuity in <character identity and
clothing>, <key prop>, <background layout>, and <axis of action>.
```

```
WITH ADDITIONAL REFERENCE MATERIALS -- example

@Image 1 defines <Gardener>'s facial features.
@Image 2 defines <Gardener>'s light green work apron.
@Image 3 defines <Wicker Flower Basket>'s structure and material.
@Video 1 is the source video to extend forward.

Extend @Video 1 forward. The first frame of the extended segment directly
continues from the last frame of @Video 1. Maintain the greenhouse
workbench, <Gardener>'s position, and <Wicker Flower Basket>'s position.

Then, <Gardener> lifts <Wicker Flower Basket> with both hands and places it
on the middle shelf of the wooden rack behind them.

Throughout the extension, maintain continuity in <Gardener>'s face, apron,
greenhouse layout, and camera direction.
```

**What breaks it**

1. **Boundary first, new content second.** Reversing the order is what makes joins jump.
2. **Add the no-duplication clause.** Subjects otherwise split or gain parts across the seam.
3. **Additional references must not override the source's last frame** as the extension's opening image.
4. **Boundary frames connect naturally at a visual level.** This does not mean they will be pixel-identical -- inspect both sides of the boundary and the complete extended segment.

**Parameters:** Aspect ratio - inherits source (locked) | Duration - settable

## Backward extension

_new first, then boundary_

Builds the run-up to an existing clip. Inverted order -- describe what happens before the source begins, then define the source's first frame as the explicit end state of the extended segment.

**Template**

```
BASIC TEMPLATE

@Video 1 is the source video to extend backward.

Extend @Video 1 backward. Before the source video begins, <describe the
preceding action, event, camera treatment, or audio>.

The last frame of the extended segment naturally connects to the first frame
of @Video 1: <subject pose and orientation>, <prop position>, and
<background and spatial relationships>. Match the <camera position and
composition>, <lighting>, and <motion direction> of @Video 1's first frame.

Throughout the extension, maintain continuity in <character identity and
clothing>, <key props>, <background layout>, and <axis of action>.
Keep each subject as the same continuous instance throughout.

Writing only "then connect to the source video" may introduce later
characters or effects too early, or cause the image to change again after
reaching the target state.
```

**Worked example**

```
@Video 1 is the source video to extend backward.

Extend @Video 1 backward. Before the source video begins, show an empty
establishing shot of the same glass greenhouse. Morning mist drifts slowly
near the floor, the overhead shade rises gradually, and no people are
present yet.

The last frame of the extended segment naturally connects to the first
frame of @Video 1. Match the greenhouse's central aisle, planting tables on
both sides, glass frame, soft morning light, and locked-off wide
composition. At the end, the shade is fully raised, the aisle is empty, and
the leaves still sway slightly.
```

```
WITH ADDITIONAL REFERENCE MATERIALS -- template

Define each material's role, and state which materials are used in the
backward extension and which should appear only after the source video
begins. This reduces the chance that later characters, props or effects
enter the preceding segment too early.

@Image 1 defines <Character A>'s facial features.
@Image 2 defines <Character A>'s clothing.
@Image 3 defines <key prop>'s structure and material.
@Video 1 is the source video to extend backward.

Extend @Video 1 backward. Before the source video begins, <Character A
completes a preceding action or event>.

The last frame of the extended segment naturally connects to the first
frame of @Video 1: <Character A's pose and orientation>, <key prop's
position and state>, and <other characters' positions>.

<Materials that should appear only after the source video begins> must not
appear early in the backward extension.
```

```
WITH ADDITIONAL REFERENCE MATERIALS -- example

@Image 1 defines <Curator>'s facial features.
@Image 2 defines <Curator>'s dark blue work jacket.
@Image 3 defines <Wooden Display Case>'s structure and material.
@Image 4 defines the gray workwear of two <Exhibition Assistants>.
@Image 5 defines <Exhibition Preparation Room>'s space and lighting.
@Video 1 is the source video to extend backward.

Extend @Video 1 backward. Before the source video begins, <Curator> walks
to the workbench, picks up the closed <Wooden Display Case>, and opens its
lid.

The last frame of the extended segment naturally connects to the first
frame of @Video 1. <Curator> stands in the center of the frame, holding the
open <Wooden Display Case> with both hands. The two <Exhibition Assistants>
stand behind the curator, one on each side. Match the vertical frontal
medium shot, workbench position, preparation-room background, and morning
light from the left established by @Video 1's first frame.
```

**What breaks it**

1. **Writing only "then connect to the source video"** may introduce later characters or effects too early, or cause the image to change again after reaching the target state.
2. **State what must not appear yet.** That clause is what keeps the run-up clean.
3. **The destination is an end state,** described as concretely as any stage ending.
4. **The extended segment's volume may differ slightly** from the source video.

**Parameters:** Aspect ratio - inherits source (locked) | Duration - settable

---

# Build

_Driving generation from boards, blockouts and batches_

## Storyboard grids

_shot order from a board_

A storyboard grid communicates the overall story, shot order and approximate compositions. It is not intended for strict reproduction of every detail in every panel.

**Template**

```
@Image 1 provides an <N-panel storyboard grid> for shot order and
approximate composition. Read it <left to right, top to bottom>.
Do not use the grid's <line-art style, text labels, or placeholder characters>.

@Image 2 defines <Subject A>'s <appearance and clothing>.
@Image 3 defines <key prop or scene>'s <structure, material, or lighting>.

Shot 1: <shot size, subject action, and scene state>.
Shot 2: <shot size, subject action, camera movement, or transition>.
...
Shot N: <closing action and final visible state>.

The final video uses <visual style>. Audio includes <dialogue, ambience,
action sound effects, or music>.
```

**Worked example**

```
@Image 1 provides a four-panel pottery-making storyboard for shot order and
approximate composition. Read it left to right, top to bottom. Do not use
the storyboard's line-art style or text labels.

@Image 2 defines <Ceramic Artist>'s face, short hair, and dark gray apron.
@Image 3 defines <Blue-Glazed Cup>'s proportions, glaze color, and curved
handle.

Shot 1: a wide shot establishes a quiet pottery studio with <Ceramic
Artist> seated at the wheel.
Shot 2: a side medium shot shows both hands shaping the rotating clay as
the cup body takes form.
Shot 3: a close-up shows fingers refining the rim and handle joint while
slip moves slowly over the fingertips.
Shot 4: a medium close-up shows the fired <Blue-Glazed Cup> placed on a
wooden shelf as <Ceramic Artist> withdraws both hands.

Use a realistic documentary look. Retain the wheel's rotation, wet-clay
friction, and studio ambience.
```

**What breaks it**

1. **Prefer no more than 15 panels,** clean line art or simple diagrams, and minimal text labels.
2. **State the reading order explicitly.**
3. **Exclude the board's own style.** Line art, text labels and placeholder characters will otherwise carry into the render.

**Parameters:** Aspect ratio - settable | Duration - settable

## Coarse blockout

_grey geometry -> real render_

Use a coarse blockout to lock action paths, motion direction, blocking, entrances and exits, camera paths, cut points, lighting changes and sound rhythm. Map each geometric object separately to its final subject or prop.

| Blockout information | What to state in the prompt |
| --- | --- |
| Path | Action trajectory, motion direction, subject blocking, and entrance/exit order |
| Camera movement | Camera position, path, direction, and speed changes |
| Lighting | Light direction, brightness changes, and when those changes occur |
| Cuts | Cut positions and the subject/composition before and after each cut |
| Audio | Whether to inherit dialogue, music, ambience, or action sound effects |

**Template**

```
@Video 1 is a coarse blockout reference. It provides only <motion paths,
subject blocking, camera position, camera movement, cuts, lighting changes,
sound rhythm, or spatial relationships>.
Do not use its blockout appearance, materials, or scene.

<Blockout Subject A> in @Video 1 corresponds to <Subject A>.
<Blockout Subject B or geometric prop> in @Video 1 corresponds to <Subject B
or key prop>.

@Image 1 defines <Subject A>'s <appearance, clothing, or structure>.
@Image 2 defines <specified attributes> of <Subject B, key prop, or scene>.

<Subject> completes <primary action or event> in <scene>.
Keep <motion path, blocking, camera movement, cuts, lighting, or sound
rhythm> from @Video 1.
The final video uses <characters, scene, materials, and visual style>.
```

**Worked example**

```
@Video 1 is a coarse blockout reference. It provides only the character's
walking path, cart direction, locked-off camera, one push-in, and two cuts.
Do not use its gray geometry or empty scene.

The tall cylinder in @Video 1 corresponds to <Guide>.
The rectangular block in @Video 1 corresponds to <Mobile Display Cart>.

@Image 1 defines <Guide>'s face, blue uniform, and name badge.
@Image 2 defines <Mobile Display Cart>'s white metal frame and clear cover.
@Image 3 defines the technology gallery's curved walls, gray floor, and
overhead strip lights.

<Guide> pushes <Mobile Display Cart> along the curved wall, stops in front
of the central display, and opens the clear cover.

Keep the walking path, subject blocking, push-in direction, and cut points
from @Video 1.

Use a bright, realistic museum-documentary style. Retain footsteps, wheel
sounds, and gallery ambience.
```

**What breaks it**

1. **Map every geometric object separately** to its final subject or prop.
2. **Prefer simple geometry with clear relationships.** Arms, wings and other appendages should be used only when the action sequence is complete; otherwise they may cause stiff motion or structural misinterpretation.
3. **Decide coarse vs fine before writing.** Coarse controls a motion skeleton, fine controls a complete model -- the prompt structure differs.

**Parameters:** Aspect ratio - settable | Duration - settable

## Fine blockout

_complete model -> re-render_

A fine blockout already contains complete character, prop or scene structures. Use it to change materials, colours, character appearance, scene or overall visual style. Keep the blockout clean: remove path lines, coordinate axes, controllers and camera frustums.

**Template**

```
@Video 1 is a fine blockout reference. Preserve <subject structure, action,
spatial layout, camera position, camera movement, and cuts>.
Do not use its original grey materials or empty background.

@Image 1 defines <subject>'s <character appearance, material, colour, or
surface details>.
@Image 2 defines <scene>'s <space, materials, lighting, or visual style>.

Re-render <subject> from @Video 1 as <final subject>, and re-render the scene
as <final scene>.
Keep <structure, action, camera treatment, and spatial relationships> from
@Video 1. Use <materials, colours, and style>.
```

**Worked example**

```
@Video 1 is a fine blockout reference. Preserve the kinetic sculpture's
complete structure, three-ring rotation relationship, pedestal position,
orbiting camera movement, and cuts. Do not use the gray materials or empty
background.

@Image 1 defines the outer ring's brushed-brass material.
@Image 2 defines the inner blades' translucent blue-glass material.
@Image 3 defines a contemporary gallery with white curved walls, a dark
gray floor, and soft overhead lighting.

Re-render the ring structure from @Video 1 as a kinetic sculpture made of
brass and blue glass, and re-render the scene as a contemporary art
gallery.

Keep the structure, rotation rhythm, orbiting camera movement, and cuts
from @Video 1. Retain the sculpture's low mechanical rotation sound and
quiet interior ambience.
```

**What breaks it**

1. **Keep the blockout clean.** Remove path lines, coordinate axes, controllers, camera frustums and other production markers before using it.
2. **Fine blockouts are for re-rendering,** not for defining motion you have not already modelled.

**Parameters:** Aspect ratio - settable | Duration - settable

## One-click video

_a batch of images -> one edit_

Designed to organise multiple images, or images plus a style-reference video, into a complete video with consistent pacing and visual packaging. Do not write only "turn these materials into a video."

**Template**

```
[Material Roles]
@Image 1 is used for <character, product, scene, or opening image>.
@Image 2 is used for <character, product, scene, or process image>.
@Image 3 is used for <character, product, scene, or ending image>.
@Video 1 is used only for <editing rhythm, transitions, subtitle treatment,
or music style>. Do not use its character identities or scene (optional).

[Arrangement]
Show the images in <upload order, a specified order, or a model-selected
thematic order>.
<State the character, product, location, and event relationships that must
remain consistent>.

[Image Motion]
Apply <subtle live motion, parallax, push-in/pull-out, lateral movement, or
local action> to each image.
Keep <subject appearance, product structure, text, or background
relationships> stable.

[Final Style]
Use <editing rhythm, transition style, subtitle or graphic treatment, and
colour style>.

[Audio]
Include <dialogue, ambience, sound effects, or music>.
```

**Worked example**

```
[Material Roles]
@Image 1 is used for the night-market entrance and opening environment.
@Image 2 is used for <Traveler> walking along the street.
@Image 3 is used for the lantern stall and craft details.
@Image 4 is used for three friends eating together.
@Image 5 is used for the riverside night view and reflections.
@Image 6 is used for the final group photo by the bridge.
@Video 1 is used only for light editing rhythm, hand-drawn stickers, and
transition style. Do not use its character identities or locations.

[Arrangement]
Show @Image 1 through @Image 6 in order to form a complete sequence:
arrival, street exploration, dinner, riverside walk, and group photo.
Keep the three friends' appearances and clothing consistent. Do not mix
their identities.

[Image Motion]
Use slow push-ins and subtle parallax for environment images. Add only
natural blinking, head turns, glass-raising, and slight clothing movement
to character images.
Keep stall structure, table position, and bridge railing stable.

[Final Style]
Use an upbeat travel-video rhythm. Connect scenes with natural occlusion
and similar colors. Keep hand-drawn stickers at the frame edges.

[Audio]
Retain night-market chatter, light dish sounds, and riverside wind, with
upbeat but unobtrusive instrumental music.
```

**What breaks it**

1. **If image order matters, state the exact sequence.** If the model may arrange the materials freely, say that it may organise them by theme.
2. **With several characters or products,** continue to name and bind each one separately.
3. **The style-reference video contributes rhythm only.** Exclude its character identities and locations.

**Parameters:** Aspect ratio - settable | Duration - settable

## Seamless transitions

_a bridge between two clips_

A seamless video transition generates continuous bridge content between two videos. First identify the before-transition and after-transition videos, then describe the trigger action, camera movement, visual transformation, arrival state and audio transition.

| Transition method | What to specify |
| --- | --- |
| Dive or reverse movement | Camera direction, speed change, and when the next scene begins |
| Character rotation | Pose, rotation direction, and how clothing or background changes continuously |
| Foreground occlusion | When the foreground object fills the frame, and the composition that follows |
| Object morph | Corresponding shapes, materials, and the transformation process |
| Push/pull or focus change | Camera movement, focus target, and continuous spatial relationship |

**Template**

```
@Video 1 is the before-transition clip. Use its <ending subject, action,
composition, camera direction, and audio>.
@Video 2 is the after-transition clip. Use its <opening subject, composition,
camera direction, and audio>.

Keep <character identity, product structure, scene, and primary action> stable
in the original portions of @Video 1 and @Video 2.

At the end of @Video 1, <subject or foreground object> triggers the transition
through <action>.
The camera <movement direction and speed change>, while <shape, material, light,
or space> gradually transforms into <corresponding element> at the start of
@Video 2.
The transition ends naturally at @Video 2's opening composition, preserving
continuity in <subject position, camera direction, and motion trend>.
Audio transitions smoothly from <before audio> to <after audio>.
```

**Worked example**

```
@Video 1 is the before-transition clip. Use its rainy night street, red
umbrella, slow push-in, and rain sound.

@Video 2 is the after-transition clip. Use its circular gallery skylight,
upward camera movement, and quiet interior reverberation.

Keep the people, street, gallery structure, and primary actions in the two
original videos stable.

At the end of @Video 1, the red umbrella approaches the camera and
gradually fills the entire frame, triggering the transition.

The camera continues moving forward. The umbrella's circular edge gradually
becomes the skylight's metal ring, and the red fabric transitions into
white daylight passing through the skylight.

The transition ends naturally at @Video 2's upward-looking opening
composition, with the camera movement changing smoothly from forward motion
to an upward rise.

The rain gradually fades into footsteps reverberating inside the gallery.
```

**What breaks it**

1. **A generated bridge is not a pixel-identical edit splice.** The goal is visual and audio continuity.
2. **Keep the original portions stable** by naming character identity, product structure, scene and primary action in both clips.
3. **The arrival state is required.** Say where the transition lands, not just how it starts.

**Parameters:** Aspect ratio - settable | Duration - settable

---

# Direct

_Performance and camera language_

## Emotional direction

_observable, not adjectival_

Emotion words such as tense, warm or oppressive communicate an overall direction, but they leave more room for interpretation in the performance. For more stable control of acting, add directly visible or audible cues.

**Template**

```
SINGLE EMOTIONAL TRANSITION -- default structure

The overall emotion shifts from <starting emotion> to <ending emotion>.
After <triggering event>, <subject> first shows <immediate observable reaction>.
Then, <eyes, brows, mouth, breathing, gaze, or hand movement> gradually
<changes>.
Finally, <subject> expresses <target emotion> through <restrained or explicit
outward behaviour>.

MULTI-STAGE EMOTION -- progress through triggering events

When <subject> hears or sees <first triggering event>, <first observable
reaction>.
When <second triggering event> occurs, <change in expression, gaze, or
breathing>.
After confirming <critical information>, the emotion that <subject> tries to
restrain or conceal gradually becomes visible through <observable behaviour>.
Finally, <subject's final action, expression, or manner of speaking>.
```

**Worked example**

```
Applause marking the end of the performance comes from behind the stage.
The young actor's fingers suddenly stop on the program, the gaze turns
slowly toward the curtain, and the shoulders remain tense.

After confirming that the curtain call is over, the actor exhales softly.
The shoulders gradually relax, a restrained smile appears, and the eyes
slowly well with tears, but the actor never turns to leave.
```

**What breaks it**

1. **You do not need to list every facial detail.** For a single emotional transition, two to four clear cues are usually enough.
2. **Use event-triggered stages only when the emotion changes several times.**
3. **Cues must be directly visible or audible** -- eye movement, brow tension, mouth movement, breathing, gaze direction, hand movement.

**Parameters:** Aspect ratio - settable | Duration - settable

## Cinematography terms

_basic, popular and niche_

Basic camera language and popular camera techniques can be written directly in the prompt. When a term is uncommon, may have several interpretations, or requires precise control, also state which subject it applies to, how the image changes, and the intended visible result.

| Type | Usable directly | Also specify |
| --- | --- | --- |
| Shot size | extreme wide - wide - medium - close-up - extreme close-up | -- |
| Camera movement | push in - pull out - pan - lateral move - follow shot - orbit - dive - dolly out - tilt up - handheld shake | -- |
| Camera position | low angle - overhead view - first-person view | -- |
| One-take shot | yes | The subjects, spaces and events the continuous camera passes through, in order |
| Dolly zoom | yes | The subject size to preserve and whether the background appears to move closer or farther away |
| Aerial view | yes | Viewing height, movement direction, and the environmental area to reveal |
| FPV | yes | First-person flight or traversal path, speed, and turns |
| Bullet time | yes | The action to freeze or slow down and the camera's orbit direction |
| Handheld camera | yes | The subject being followed and the amount of shake |
| Bounce speed ramp | yes | Where the action accelerates, decelerates or rebounds, and its final resting state |

**Template**

```
For a niche term, a term with inconsistent industry usage, or a term the
model may not recognise -- keep the term itself and translate it into a
directly observable visual change:

Cinematography term + target subject + visual change
+ foreground/background relationship + direction or speed
```

**Worked example**

```
Rack focus: shift focus smoothly from the leaves in the foreground to the
person in the background. The leaves gradually blur while the person's face
changes from soft to sharp.

Example 1. Shallow-depth-of-field portrait: keep <Pastry Chef>'s eyes and
face sharp while the glass jars and lights in the background become soft,
circular bokeh.

Example 2. Tracking shot: move horizontally at the same speed as
<Skateboarder>, keeping the subject sharp while the roadside wall forms
horizontal motion blur from right to left.

Example 3. Golden hour: warm, low-angle sunlight enters from behind and to
the left of <Hiker>, casting long shadows across the mountain ridge.

Example 4. Natural vignette: darken the four corners gradually while
keeping the brightness and skin tone of <Pianist> in the center natural,
without a black border.

Example 5. Whip-pan transition: at 5 seconds, move the camera rapidly to
the left. Cut when the foreground bookshelf fully covers the frame, then
continue moving left at a similar speed in the next scene.
```

**What breaks it**

1. **If the frame contains several subjects,** still state which subject the camera follows or revolves around, where the movement begins, and where it ends.
2. **For a precise transition,** also state the trigger time, occluding object, camera direction, transition method, and the composition or motion trend that should continue afterwards.
3. **Aperture, focal length and shutter values can be included,** but the intended visible result is usually clearer than a numeric value alone.

**Parameters:** Aspect ratio - settable | Duration - settable

---

# Limits

_The hard numbers, and what locks automatically_

## Reference material limits

_50 total, per-type caps_

Seedance 2.5 can combine up to 50 reference materials. Each material type follows the input limits below. The recommended ranges are intended to improve generation stability -- they are not capability limits.

| Material type | Input limit | Recommended range |
| --- | --- | --- |
| Images | Up to 30 images, each no larger than 4K | Prefer 1-8 distinct subjects across subject-reference images |
| Videos | Up to 10 videos, combined duration <= 30 seconds | Prefer 1-5 distinct subjects and 5-10 seconds per subject video |
| Audio | Up to 10 audio clips, combined duration <= 30 seconds | Keep only dialogue, voice, ambience or music directly relevant to the task |
| Video editing | A source video may be used together with reference images | Prefer a source video under 20 seconds and 1-5 reference images |

**Template**

```
You may still try ranges above these recommendations. Stability may
decrease as the number of materials grows.

Subject images        9-12 subjects
Subject audio/video   6-10 subjects
Video editing         6-8 reference images
```

**Worked example**

```
If more than five subjects also require multiple views, place different
views in separate images.

Independent view images are usually more stable than combining several
views into one collage.

@Image 1 defines the front view of the same folding desk lamp.
@Image 2 defines the left-side structure of the same folding desk lamp.
@Image 3 defines the right-side structure of the same folding desk lamp.
@Image 4 defines the rear structure of the same folding desk lamp.

All four images define one folding desk lamp. The output must contain only
one lamp throughout.
```

```
PUSHING PAST THE RECOMMENDED RANGE

You may still try ranges above the recommendations. Stability may decrease
as the number of materials grows.

  Subject images          recommended 1-8      stretch 9-12 subjects
  Subject audio/video     recommended 1-5      stretch 6-10 subjects
  Video editing images    recommended 1-5      stretch 6-8 images

The caps themselves are hard: 30 images, 10 videos, 10 audio clips,
50 materials total.
```

```
COMBINED DURATION IS THE REAL CEILING

Video and audio are limited by TOTAL duration, not file count.

  10 clips x 3 seconds  = 30 seconds  -> at the ceiling
  1 clip x 30 seconds   = 30 seconds  -> also at the ceiling
  6 clips x 8 seconds   = 48 seconds  -> over, will not hold

Per-subject video works best at 5-10 seconds. A single 30-second reference
spends the entire budget on one subject.
```

**What breaks it**

1. **Combined duration is the constraint on video and audio,** not file count.
2. **Separate view images beat a collage** once you pass five subjects needing multiple angles.
3. **Trim irrelevant audio.** Keeping only what the task needs is an explicit recommendation.

**Parameters:** Total materials - 50 max (locked) | Video + audio - 30s combined each (locked)

## Parameter locks

_what you cannot set_

Video editing, first-frame or first-and-last-frame generation, and video extension automatically lock some generation parameters based on the input materials. Parameters automatically locked for these tasks cannot be specified separately on the generation page or through the API.

| Task type | Aspect ratio | Duration |
| --- | --- | --- |
| Video editing | Automatically preserves the input video's aspect ratio; cannot be set separately | Automatically preserves approximately the input duration; cannot be set separately. Input-frame processing may introduce a difference of up to approximately 0.3 seconds |
| First / first-and-last frame | Automatically uses the first image's aspect ratio. The first and last images should use the same aspect ratio to avoid stretching the last frame | Can be set |
| Video extension | Automatically preserves the input video's aspect ratio; cannot be set separately | Can be set |

**Template**

```
The ~0.3 second drift on edits

Usually caused by transition-frame handling, while the overall content and
event order remain substantially unchanged.
```

**Worked example**

```
Practical consequences:

A 9:16 source cannot be edited into a 16:9 output. Reframe afterwards.

A 12-second source produces a roughly 12-second edit. You cannot trim or
extend inside an edit task -- use a video extension task for that.

Mismatched first and last anchor ratios stretch the last frame. Match them
before you generate, not after.

An extended segment's audio volume may differ slightly from the source.
```

```
DECIDING BEFORE YOU GENERATE

  Need a specific aspect ratio?
    -> Set it on the FIRST generation. Every edit and extension downstream
       inherits it and cannot change it.

  Need a specific duration?
    -> Editing inherits it. Extension lets you set the NEW segment only.
       First/last-frame lets you set it freely.

  Need to change the ratio of footage you already have?
    -> Not an edit task. Regenerate, or reframe in post.

  Need the clip longer?
    -> Not an edit task. Use a video extension.
```

```
WHAT THE ~0.3 SECOND DRIFT ACTUALLY IS

Video editing automatically preserves approximately the input duration.
Input-frame processing may introduce a difference of up to approximately
0.3 seconds, usually because of transition-frame handling, while the
overall content and event order remain substantially unchanged.

Consequences worth planning around:

  A 12.0s source may return an 11.8s or 12.2s edit.
  Frame-accurate hand-off to an external timeline needs a re-sync.
  Stacking several edits stacks the drift.
  An extended segment's volume may differ slightly from the source.
```

**What breaks it**

1. **Locked means locked.** Specifying a ratio or duration for these tasks in the prompt or the API has no effect.
2. **Plan the ratio before the source exists.** Every downstream edit and extension inherits it.

**Parameters:** Editing - ratio + duration locked (locked) | Extension - ratio locked, duration settable (locked)

---

# Pre-submission checklist

1. Does the prompt clearly state the subject and primary action or event?
2. Does every reference material state what to use **and** what not to use?
3. Is every distinct character, product and prop named and bound to a reference?
4. Are references selected by scene instead of being required to appear all at once?
5. Does each stage of a long video contain only one primary change and a clear end state?
6. Do the number of characters, clothing, prop ownership and spatial relationships stay consistent?
7. For video editing: sole editing master, edit scope, target quantity and content to preserve?
8. Are abstract emotions and cinematography terms paired with directly visible or audible cues?
9. First and last frames: one role per image, and do both images use the same aspect ratio?
10. Does the storyboard state which structure to inherit?
11. For blockouts: did you identify coarse vs fine, and specify the temporal, structural, material and style information to inherit?
12. Do editing, first/last-frame and extension follow their automatically locked ratio and duration rules?
13. For video extension: did you check the boundary image, motion trend and audio continuity?
14. For one-click video: are material roles, image order, motion amount, editing style and audio all defined?
15. For seamless transitions: are the two videos' roles, trigger action, transition process and arrival state defined?

# Hard limits

**Reference materials -- up to 50 total:**

| Type | Limit | Works best |
|---|---|---|
| Images | 30, each 4K or smaller | 1-8 distinct subjects |
| Videos | 10, 30s combined or less | 1-5 subjects, 5-10s each |
| Audio | 10, 30s combined or less | only clips relevant to the task |
| Video editing | 1 source video + reference images | source under 20s, 1-5 reference images |

You may exceed the recommended ranges; stability decreases as material count grows. If more than five subjects each need multiple views, use one image per view -- separate view images hold better than a collage.

**Parameters that lock automatically:**

| Task | Aspect ratio | Duration |
|---|---|---|
| Video editing | Inherits source, cannot be set | Inherits source (+/- 0.3s), cannot be set |
| First / first+last frame | Inherits first image | Settable |
| Video extension | Inherits source, cannot be set | Settable |

# What it will not promise

1. Timestamps allocate time to events. They are not frame-accurate edit points.
2. Video-editing prompts improve the probability that critical events align with the source. They cannot guarantee frame-by-frame overlap.
3. Multi-reference creation selects and combines the correct materials. It does not make every material appear at the same time.
4. For subtitles, formulas, signs, product specs or frame-level timing that must be completely accurate, combine prepared references, generation and post-production.
5. Video editing locks the input's aspect ratio and approximate duration. Output may differ by up to roughly 0.3 seconds.
6. First-frame generation locks the ratio to the first image. Mismatched first and last ratios may stretch the last frame.
7. Video extension locks the input ratio. The extended segment's volume may differ slightly from the source.
8. For one-click video, if image order or character mapping matters, it must be specified explicitly in the prompt.
9. Seamless transitions aim for visual and audio continuity. They do not guarantee pixel-identical preservation of either source video.

---

Assembled by [@twoclipping](https://x.com/twoclipping). This skill routes and fills these templates. It does not generate video.
