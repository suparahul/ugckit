# Brief: video planning and scripting system (proposal only)

Goal: propose a PLAN (for the founder to review) for the second half of the AI UGC video system in ugckit: the video PLANNING and SCRIPTING system. This is design only. Do not build skills, do not generate anything, do not spend money, do not commit or push. Write the proposal as one markdown file at research/ai-ugc/VIDEO-PLANNING-PLAN.md in the ugckit repo and stop when it is ready for review.

Repo: /Users/rahulsingh/Documents/code-max/AI UGC/ugckit (branch ai-ugc-character-pipeline). The shipped kit lives under template/. The first half of the video system (character pipeline: persona-identity, character-voice, character-shots, storyboard, character-generate, review, app insertion, assembly) is already built on this branch. It consumes a hand-written plan; see template/docs/, the example plan plan.example.json (find it in the repo) and research/ai-ugc/METHODOLOGY.md. The planning system you design must OUTPUT that plan format (or propose precise changes to it).

The model to copy: slideshows. Read template/brain/SLIDESHOW-ANATOMY.md, template/brain/learnings-slideshows.md, template/brain/ACCOUNT-ARCHITECTURE.md, template/AGENTS.md and the slideshow skills in the kit. Slideshows have an anatomical structure where you switch parameters and get a tangible, repeatable piece of content. Videos need the same: a clean video anatomy (parameters/slots such as format, hook type, beats, product presence, app presence, length, cast, setting, CTA, etc. — you decide the right set) so a video is planned by choosing values, not by free-writing.

Inputs to distil (be judicious; much of this is noise):
1. /Users/rahulsingh/Documents/code-max/organic-factory/HOOKS-AND-VIDEO-CONSOLIDATION-BRIEF.md — a dump from earlier agents. Keep only what is relevant and say what you dropped and why.
2. research/ai-ugc/SCRIPT-LEARNINGS.md (script learnings from X articles; biased toward paid AI UGC ad pitches; only briefly covers reaction videos like "seven years shopping at X, now I found this"; barely covers soft organic videos where the app is never named, e.g. a gym person logging sets). The system must cover pitch/ad, reaction/discovery AND soft organic formats.
3. Benchmark apps in the founder's local Organic Factory: /Users/rahulsingh/Documents/code-max/organic-factory/research/catwise/ (potto, umax and others there). Read-only. Use them to ground the inbuilt intelligence.

Three layers of intelligence; define each and how they merge:
A. Inbuilt intelligence shipped in the kit: compiled from the X article learnings and the benchmark apps. Generic, curated, small.
B. The user's own competitor analysis, run when they set up organic-factory (fetches their competitor apps' videos). Define what it extracts and where it is stored.
C. Niche analysis in general (not just competitors), which reveals hooks and patterns. Define it likewise.

Hard requirement: neat and clean-cut. No clutter of random hook lists. Hooks and patterns live inside a small structured taxonomy with clear slots, evidence and provenance (inbuilt vs competitor vs niche), with a rule for how new findings are merged or rejected rather than appended.

Scope: only the structure and skills that plan a video end to end (from objective/handle to a locked plan the character pipeline can run). The Atlas UI is out of scope; mention only the data it would read.

The proposal should contain: the video anatomy (slots and allowed values); the knowledge files and their schema; the skills (names, inputs, outputs, order) and where they hook into AGENTS.md and the existing pipeline folders; how setup-time competitor and niche analysis feed it; how the locked plan is produced and approved; what is dropped from the consolidation brief; open questions for the founder; and a phased build order. Keep it tight. When done, print a short summary and the file path.
