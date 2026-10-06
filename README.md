# Slide decks

Single-file HTML slide decks with a shared presenter mode (speaker notes, a running
timer, hideable chrome). You write a deck as a small folder; the build script squashes
it into one self-contained `.html` file you can share anywhere.

All commands run from the repo root:

```
cd ~/teaching/agentic-coding-live
npm install          # first time only
```

---

## 1. Begin a new deck

Copy the template into `decks/`, giving the folder your deck's name:

```
cp -r templates/deck-template decks/my-talk
```

The folder **must** live directly under `decks/`. The template finds the shared
presenter code at `../../mechanics/`, so a deck anywhere else will load without
its navigation, notes, or styling.

You now have two files to edit:

| File | What it's for |
|---|---|
| `decks/my-talk/index.html` | Your slides. Change the `<title>` and add slides. |
| `decks/my-talk/theme.css` | Your deck's colors (see [Theming](#theming)). |

### Adding slides

Each slide is a `div` with class `slide`. Put the speaker notes for that slide in an
`<aside class="notes">` inside it:

```html
<div class="slide active" id="s1">
  <div class="section-label">Intro</div>
  <h2>First slide</h2>
  <aside class="notes">What I'll say on this slide.</aside>
</div>

<div class="slide" id="s2">
  <h2>Second slide</h2>
  <img src="diagram.png" alt="Architecture diagram">
  <aside class="notes">What I'll say on this one.</aside>
</div>
```

- Only the **first** slide gets `active`.
- Put all slides **above** the `<div id="slide-time">` line. Leave the timer, notes
  panel, nav, and `<script>` blocks at the bottom of the template as they are.
  The presenter controls need them.
- Put images in the deck folder and reference them with a relative path
  (`src="diagram.png"`).
- To add time for a slide that runs longer than its notes (a demo, a video), add
  `data-extra-seconds="90"` to that slide's `div`. The timer otherwise assumes you
  speak your notes at 120 words per minute.

### Previewing while you work

Open `decks/my-talk/index.html` directly in a browser. No build step is needed for
previewing. Reload to see your changes.

| Key | Action |
|---|---|
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| `Home` / `End` | First / last slide |
| `N` | Show / hide speaker notes |
| `P` | Hide / show the nav bar (presentation mode) |

The deck remembers which slide you were on when you reload.

### Theming

`theme.css` sets these variables, and the shared mechanics use them everywhere:

```css
:root {
  --bg: #f0f2f8;              /* page background behind slides */
  --text: #1a1e30;            /* body text */
  --slide-bg: #ffffff;        /* slide background */
  --accent: #2a5fd4;          /* headings, highlights */
  --nav-bg: rgba(240,242,248,0.92);
  --nav-border: #b0bcd8;
  --nav-text: #4a5880;
  --counter-text: #7080a8;    /* "3 / 12" slide counter */
  --timer-text: rgba(0,0,0,0.18);
}
```

Any other styling for your deck (a title-slide layout, for example) can go in
`theme.css` or in a `<style>` block in `index.html`. For a worked example, see
`decks/unbounded-contexts/`.

---

## 2. Prepare the deck for distribution

Build the deck into a single file:

```
node build.js decks/my-talk dist/my-talk.html
```

The build reads `decks/my-talk/index.html` and inlines everything it links to:

- each `<link rel="stylesheet">` (your `theme.css` and the shared `mechanics.css`)
  becomes a `<style>` block
- each `<script src>` (the shared `mechanics.js`) becomes an inline `<script>`
- each local `<img src>` becomes a base64 `data:` URI (png, jpg, gif, svg, webp)

This gives you one `.html` file with no external files. It works offline, by
email, or on any static host.

The build **stops with an error** if an image is missing or has an unsupported
type, for example:

```
Error: Image not found: diagram.png (resolved to /…/decks/my-talk/diagram.png)
```

Fix the path or add the file, then build again.

**What the build does not inline:** images referenced from CSS (`background:
url(...)`) and remote images (`https://...`). Remote images stay as links, so they
need an internet connection when you present. To embed an image, use a local file
in an `<img>` tag.

Before sharing, open `dist/my-talk.html` in a browser and click through it to check
that it looks the same as your preview.

---

## 3. Find the distribution artifact to share

The file to share is the output path you gave the build:

```
dist/my-talk.html
```

That one file is the whole deck. It doesn't need the `decks/`, `mechanics/`, or
image files next to it. Upload it to any static host (for example, GitHub Pages,
Netlify Drop, or your own site), attach it to an email, or put it in a shared drive.
Anyone who opens it gets the full deck, including the notes (`N`) and presenter
controls.

Note that `dist/` is in `.gitignore`. Built files are not committed, so rebuild
whenever you change the deck. If you want the built file in version control or
somewhere permanent, copy it out of `dist/`.

---

## Quick reference

```
cp -r templates/deck-template decks/my-talk         # 1. start
open decks/my-talk/index.html                        #    preview
node build.js decks/my-talk dist/my-talk.html        # 2. build
open dist/my-talk.html                               # 3. check, then share this file
npx playwright test                                  # run the test suite
```
