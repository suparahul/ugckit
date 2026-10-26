---
name: infographic
description: Phase 8, a post made from a design template instead of one generated picture — the art from the app's asset library (generated once), the layout and every word in a spec the user edits on the post page (sliders, drag, words, TikTok and Instagram layouts, animation, the App callout). Use for a signs poster, a chart, a reasons card, a list card, a text wall, a storybook page or a reel of short clips. Free after the assets exist.
---

# Phase 8 — a post from a design template

An image generator is good at drawing a character or an icon and bad at layout and type: every "a bit bigger", "more
space" or "move it up" costs a new generation that ignores half the ask. So a design template is three layers, and
only the first ever touches the generator:

1. **Assets** — `apps/<slug>/brand/assets/`: characters, icons and app screens with transparent backgrounds, no
   text, listed in `assets.json` (`[{ "id", "file", "w", "h", "kind": "character" | "icon" | "tile" | "picture" |
   "screen", "note" }]`). Generated once, reused by every post. The editor's Pictures section picks any of them per
   slot. Look in `assets.json` before drawing anything.
2. **Templates** — `atlas/lib/infographic.ts`. One pure function draws a spec as SVG; the post page, the PNG, the
   Instagram picture and every video frame share it, so the editor shows exactly what is exported.
   - `hub`: a title, an optional definition, eight labelled icons in a 3–2–3 grid round a centre picture, a closing
     bubble. Signs lists, "what it looks like".
   - `cube`: a title, a pill, a grid of pastel cubes with a number (or one text), a unit and a label, a picture on
     each. Charts by age, by step, by category.
   - `card`: one "reasons why" card at 3:4 — heading, body, a picture standing in the lower half, an optional inset
     icon in a circle, a footer; `cover: true` drops the card for a cover slide.
   - `page`: a storybook slide: one picture full-bleed (a library asset, or the post's own render, asset id
     `post/<post dir>/slide-NN/<file>`; the editor lists the post's renders), an optional paper band over its top,
     the heading and lines typeset on it, an optional app screen. One spec per slide: a slideshow of pages is edited
     slide by slide.
   - `list`: a heading, a tag and 3–5 rows on a card, a picture.
   - `wall`: a headline and a few lines on one card, all at once, over one background, still or drifting (up to four
     backgrounds cross-fade); `content.video` lays the words over a background video instead.
   - `clips`: three to five short videos (the app's own, a demo; `items[].video` is a URL or a path), each with a
     name and a line, an intro (a plain card or a fast preview of the clips) and an end card with the callout.
3. **The spec** — `production/files/<post>/compose/slide-NN.json`: the template, the words, which asset goes where,
   the size and spacing values, the user's hand moves (`nudge`), the deleted blocks (`hidden`), the callout's words
   (`content.callout`), the animation (`anim`) and the Instagram 4:5 layout (`variants.instagram`). This is the
   post's design.

**The look** is the app's, not the template's: `apps/<slug>/brand/style.json` (`atlas/lib/brand.ts`) sets the page,
the type and the callout colours (`style`), the callout's words, screens and saved wordings (`callout`), and the
app's own template styles for the studio's dropdown (`styles`). Every key is optional: without the file the kit's
neutral look is used and the callout's words come from `product.json`. Write the file once, from the brand (its
HANDLE.md, its icon, its store screenshots), never from a reference's colours or font, and show it to the user.

```json
{
  "style": { "bg": "#F6F1EB", "ink": "#1F1B18", "accent": "#E07A4F", "font": "Arial Rounded MT Bold", "bodyFont": "Helvetica Neue, Arial",
             "calloutFill": "#F3ECE5", "calloutLine": "#DCCFC3" },
  "callout": { "name": "Pawly", "line": "the cat care app", "screens": [["screen-home", "Home"], ["screen-chat", "Ask"]],
               "wordings": [["Know every sign on Pawly", "+ ask the vet chat anything", "Signs hub"]] },
  "styles": { "slideshow": [{ "key": "letters", "label": "Letter to my cat", "desc": "Slideshow of crayon drawings, one idea per slide" }] }
}
```

## Make one

1. The deck names the slide as a design: a **Layout** line says "template <name>, spec in
   files/<post>/compose/slide-NN.json" (the build reads it as a note, never as on-image text). A deck of reasons
   cards has one spec per slide.
2. Start from a starter: `node scripts/compose.mjs <slug> <post key> <n> --from hub|cube|card|page|wall|list|clips`
   (the app's own `apps/<slug>/brand/templates/<name>.json` when it has one, else the kit's `assets/templates/`),
   then change its words and asset ids. When the user has tuned a design they like, copy that spec to
   `apps/<slug>/brand/templates/<name>.json`: it is the app's starter from then on.
3. `node scripts/compose.mjs <slug> <post key> <n> --dry` says where the design ends. A hub with a callout is fitted
   on its first render (while the slide has no placed callout): the rows spread until the design ends near 74%, and
   the callout is placed 2.5% under it. `--no-fit` skips it.
4. `node scripts/compose.mjs <slug> <post key> <n>` renders the TikTok picture as the slide's candidate
   (`slide.upload`, `data.source: "compose"`), redraws the callout from its words, and renders the Instagram picture
   when the spec has a 4:5 layout. Add `--video` for the animated post.
5. Send the user to the post page: **Edit design** opens the editor — the TikTok and Instagram tabs, the App callout
   field, a slider for every size and gap, the words, drag any element or the callout, arrow keys to nudge, − / + to
   scale, Delete to remove a block (Restore brings it back), the animation with Play. **Save design** renders a new
   candidate; **Save and export video** also renders the MP4s. A change the user asks for in chat is a spec edit and
   a re-run of step 4, never a new generation.

## The App callout

One field, first under the picture, in the design editor and in the layout editor of every photo or illustrated
slide: None, the App Store listing banner (four looks), the phone banner with an app screen (the `screens` of
style.json, else every asset of kind `screen`), the logo-and-text card (the user's own words, or a saved wording),
or an app screenshot pasted on the slide and dragged into place (assets named `phone-*` or `screen-sim-*`). A banner
is drawn to the post's `cards/1-custom.png` and placed by the slide's `slide.layout` card; the compositor (`render`)
pastes it, and the screenshot, on any slide, with or without a Cards row in the deck. "None" pastes nothing, even on a
slide whose deck lists a card.

## Missing art

Add the pictures to `apps/<slug>/brand/assets/sheets.json` (`{ "style", "references", "sheets": [{ "name", "size",
"rows", "cols", "kind", "prompt", "ids" }] }`; a sheet is 6 or 9 pictures, well apart, on flat light grey, no words)
and run `scripts/codex-assets.sh <slug> <sheet-name>` in the background: Codex draws the sheet on the user's plan
(about two minutes a sheet) and `scripts/asset-sheet-cut.mjs` cuts it into assets in reading order. One picture from
any render: `scripts/asset-cutout.mjs <slug> <id> <render.png> <x0,y0,x1,y1>`. Look at every cut on the brand's page
colour before using it.

## Where it goes

- The callout is placed by the slide's `slide.layout` card (the editor writes it); the compositor pastes it on the
  TikTok picture as on any slide.
- Instagram: with a 4:5 layout, `render` takes `compose/slide-NN.instagram.png` (callout pasted) for
  `final/instagram/` instead of fitting the 9:16 picture into 4:5 with blurred sides.
- Video: `video/compose-final.mp4` (and `video/instagram/compose-final.mp4`), drawn frame by frame from the spec, so
  the words never blur, then the post's music laid in when one is chosen (the post page's Music, else the handle's
  `Music:` group: `assets/music/README.md`). The post page shows it, and the send uploads a one-card post's video to
  every platform instead of its picture. A slideshow of pages goes out as the slideshow and, on Instagram, as its reel
  (the `render` skill, § The reel).
