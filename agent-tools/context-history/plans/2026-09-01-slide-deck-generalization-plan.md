# Plan: Generalizing slide deck theme/mechanics/content

Status: **drafted, not yet implemented**
Supersedes: options presented in `../2026-08-generalizing-slide-behavior.md`
Decision recorded: 2026-09-01, after Chelsea reviewed the option sets with her audience

## Priorities that drove this decision (Chelsea's words, 2026-09-01)

1. **Distribution has to be trivially easy.** A recipient gets one small file (or a
   zipped folder) and just opens it. No script-running, no build step, no risk of
   moving a file out of its folder and breaking a relative link.
2. **Theme portability is low-value.** Chelsea rarely reuses a theme across decks,
   and her themes are small — a handful of colors, not a full design system.
3. **Mechanics portability is the important part.** Prev/next nav, the slide
   counter ("x / y"), the notes toggle, and — especially — the cumulative timer in
   the bottom-right corner must work identically in every deck, every time.

## Chosen options (from the four option sets)

- **A3** — ship a single generated, self-contained `.html` file per deck. Chelsea
  runs a small build step while authoring; her audience never does.
- **B1** — theme = CSS custom properties (colors only) in one `theme.css` per deck.
- **C1** — leave inline hardcoded colors inside bespoke slide content alone; they're
  content, not theme, and reskinning them isn't worth the effort for how rarely
  themes get reused.
- **D2** — new decks start from a minimal template (chrome markup + links to the
  shared mechanics), not by copying an old deck's full content.

Explicitly **not** doing: B3 (extending theme tokens to fonts/spacing/box styles),
C2/C3 (making bespoke inline content theme-aware or pattern-extracted), D3
(scaffolding tooling/manifest). None of these serve the stated priorities right now;
revisit only if deck volume or theme-reuse frequency actually goes up.

## Target repo structure

```
mechanics/
  mechanics.css     — shared chrome layout/styling (nav, counter, notes panel,
                       slide-time corner clock, chrome-hidden/notes-visible rules,
                       base .slide layout). References colors only via
                       var(--...) — never a hardcoded hex. One copy, used by
                       every deck.
  mechanics.js       — shared behavior: goTo/toggleNotes/toggleChrome, the
                       cumulative timer-from-notes calculation, the keydown
                       handler (arrows, N, P, Home, End). Moved verbatim from
                       the current deck's <script> block — it already doesn't
                       reference theme values.

templates/
  deck-template/
    index.html       — starting point for a new deck: chrome markup (#nav,
                       #counter, #notes-btn, #slide-time, #notes-panel) plus
                       <link>/<script src> tags pointing at the shared
                       mechanics/ and a local theme.css, one placeholder slide.
    theme.css         — starter set of color custom properties to fill in.

decks/
  <deck-slug>/
    index.html        — authoring file for that deck: same shape as the
                         template, but with real slides pasted in. Opens
                         directly over file:// during authoring — mechanics.css
                         and mechanics.js are linked, not yet inlined — so
                         Chelsea gets a live, buildless preview loop while
                         writing.
    theme.css          — that deck's color custom properties only.

build.js             — `node build.js decks/<slug> dist/<slug>.html`. Reads the
                        deck's index.html and inlines the three linked files
                        (mechanics.css, mechanics.js, theme.css) into <style>/
                        <script> tags in place, stripping the <link>/<script src>
                        tags. Output has zero external references.

dist/
  <slug>.html         — the file Chelsea actually sends. Self-contained,
                        openable directly from anywhere (email attachment,
                        USB stick, wherever) with no siblings required.
```

### Why this satisfies the three priorities

- **Priority 1 (easy distribution):** `dist/<slug>.html` is the only thing that
  ever leaves Chelsea's machine. No folder, no relative paths, no build step for
  the recipient.
- **Priority 2 (theme, low investment):** `theme.css` is small and swappable —
  copy the template's `theme.css`, change a handful of hex values, done. No
  tooling built for a problem Chelsea doesn't have.
- **Priority 3 (mechanics, high value):** `mechanics.css`/`mechanics.js` are
  single shared files. Every deck's nav, counter, notes toggle, and timer come
  from the same source, so a fix or improvement made once is inherited by every
  past and future deck the next time it's rebuilt.

## Migration phases

**Phase 1 — build the generalized system, prove it with disposable fixture decks.**
Create `mechanics/`, `templates/`, `build.js`, and two tiny fixture decks purely to
exercise the build/inline/theme-swap mechanism end-to-end, independent of the real
talk content. This is the phase this plan covers in full, including the failing
tests below.

**Phase 2 — migrate `unbounded_contexts_slides.html` onto the new structure.**
Split its existing `<style>` block into `mechanics.css` (structure) + `theme.css`
(this deck's colors), move its `<script>` block to `mechanics/mechanics.js`
verbatim, move its slide markup (unchanged, including bespoke inline colors per
C1) into `decks/unbounded-contexts/index.html`, build it, and confirm the existing
`tests/slides.spec.js` behavioral assertions hold against the built output. Retire
the old monolithic file once parity is confirmed. **Not started yet** — do this
after Phase 1 is green and Chelsea has looked at the fixture output.

## Verification loop (required before any implementation, per CLAUDE.md)

New spec: `tests/deck-generalization.spec.js`, driving real fixture decks in a real
browser — not reading the diff. It encodes exactly the functionality from
priority 3 plus the portability claim from priority 1 and the theme-swap claim
from priority 2:

1. **Build produces a truly self-contained file** — `build.js` runs against a
   fixture deck; the output contains no `<link>` or `<script src>` tag.
2. **The built file works with zero siblings** — copy *only* the built file into
   an empty temp directory (nothing else present) and open it over `file://`.
   This is the real test of "just open the file."
3. **All the priority-3 functionality works in that isolated file:**
   loads on slide 1, nav prev/next visible and functional, counter reads
   `"1 / N"` and updates, `N` toggles the notes panel, `P` hides nav/counter/
   notes-button while leaving the timer visible, the timer is visible in the
   bottom-right corner, updates between slides, and drops closer to the corner
   once the nav bar is hidden, and arrow keys / `N` still work while chrome is
   hidden.
4. **Theme swap actually changes rendered color, without touching mechanics** —
   build the same fixture slide content with two different `theme.css` files;
   assert the rendered accent color differs between the two outputs while the
   embedded mechanics script is identical between them.
5. **Mechanics really is shared, not forked per deck** — build two different
   fixture decks and assert the inlined mechanics script content is byte-identical
   in both outputs.

As of this plan being written, `mechanics/`, `templates/`, and `build.js` do not
exist yet, so this spec is currently **red for the right reason**: `build.js` is
missing, so every test that depends on a build output fails at that step. Run
`npx playwright test tests/deck-generalization.spec.js` to see this for yourself
before implementation starts.

**Confirmed red on 2026-09-01:** `npx playwright test tests/deck-generalization.spec.js`
→ 6 failed, 3 did not run, every failure is `Cannot find module
'.../build.js'` (thrown from `execFileSync` in each test's `beforeAll`/body).
Nothing fails for an unrelated reason. `npx playwright test tests/slides.spec.js`
(the pre-existing suite) → 8 passed, unaffected by this work so far, as expected
since Phase 1 doesn't touch the original deck.

Implementation is done when this spec is fully green *and* the pre-existing
`tests/slides.spec.js` suite is still green (Phase 1 doesn't touch the original
deck, so that suite shouldn't be affected until Phase 2).

## Open items for Phase 2 (not decided yet)

- Exact split point between "structure" (mechanics.css) and "this deck's
  specific slide-content layout" for `unbounded_contexts_slides.html` — the
  current `<style>` block interleaves both.
- Whether the old `unbounded_contexts_slides/unbounded_contexts_slides.html`
  gets deleted once `dist/unbounded-contexts.html` is verified equivalent, or
  kept around as a historical reference.

**Resolved 2026-09-01:** Split point decided (mechanics.css keeps shared
structure; per-section `.blue/.orange/.green/.purple` accents, title-slide,
bullets, tip/detect/example boxes, two-col layout, and their print overrides
stay as a bespoke `<style>` block inside `decks/unbounded-contexts/index.html`,
per C1 — bespoke content, not shared mechanics). Old monolithic file: **kept**
as a historical reference, not deleted. Phase 2 implemented and verified via
`tests/unbounded-contexts-migration.spec.js` (8/8 passing against the built
output); full suite (25/25) green.

## To do next time

- ~~**`build.js` doesn't inline images.**~~ **Done 2026-10-06.** `build.js`
  now inlines local `<img src>` files as base64 data URIs (`data:`, `http(s):`
  and `//` sources are left as-is). A missing local image or unsupported
  extension fails the build, per Chelsea's call. Covered by
  `tests/build-images.spec.js`. CSS `url(...)`, `srcset`, `<source>` and
  `poster` are still not inlined — no deck uses them yet.
- ~~**Two image files referenced by `unbounded_contexts_slides.html` don't
  exist.**~~ **Done 2026-10-06.** Added `agentic-coding-skill.png` (slide 8)
  and `agentic-coding-live.png` (slide 25) to `decks/unbounded-contexts/` as
  QR codes for their O'Reilly pages, decoded after generation to confirm the
  URLs. The original `unbounded_contexts_slides/` folder still lacks them; it
  is kept only as a historical reference.
- ~~**Notes and the corner timer aren't visible at the same time.**~~
  **Done 2026-10-06** (`1cf4cb2`). The notes panel (z-index 150, opaque)
  covered the timer (z-index 100). `mechanics/mechanics.css` now moves the
  timer left of the panel while notes are showing. Covered by a position
  comparison test in `tests/deck-generalization.spec.js`.
- ~~**Write a README.**~~ **Done 2026-10-06** (`82eb314`). `README.md`
  covers starting a deck from the template, theming, building with
  `build.js`, and sharing the file from `dist/`.
- **Session five: make generated slides visual, not wordy** (raised by
  Chelsea 2026-10-06). The basic creation and presentation features work
  well, but when Claude makes slides they tend to be quite wordy. Chelsea's
  vision for slides is clear visualizations that accurately represent
  concepts and help people understand them, using things like color, shape,
  size, and juxtaposition. Next session: think about how this tool could
  better realize that vision when it's used to generate slide decks.
