# Build workflow — READ THIS BEFORE EDITING

> **Deploying, not editing? You don't need this file at all.** The repo (and
> every release zip) ships `script.js` and `tailwind.css` already built and
> verified — pushing them to GitHub Pages requires no build, no terminal, no
> npm. Everything below applies only when you want to CHANGE the app.


The repo has **two generated files**. Editing them directly is the #1 way to
lose work or ship a broken page:

| Generated file | Built from | Rebuild command (from `build/`) |
|---|---|---|
| `script.js` | `src/js/*.js` (in `build-js.mjs` manifest order) | `npm run build:js` |
| `tailwind.css` | Tailwind classes found in `index.html` + `script.js` | `npm run build:css` |

Everything else (`index.html`, `clock.html`, `old.html`, `styles.css`,
`bell-engine.js`, `firestore.rules`, ...) is edited directly, no build needed.

## One-time setup (needs Node.js 18+)

    cd build
    npm install

## RULE 1 — script.js is generated. Edit src/js/, then rebuild.

`script.js` is the concatenation of the 27 files in `src/js/`. Edit the
chunk that owns your feature (the filenames say what lives where), then:

    cd build && npm run build:js

Commit **both** the `src/js/` change and the regenerated `script.js`
(GitHub Pages serves `script.js`; the `src/js/` files are for humans).

- Symptom of editing `script.js` directly: your change works until the next
  build silently erases it. Run `npm run check:js` any time to detect drift —
  it fails loudly if `script.js` doesn't match the `src/js/` build.
- The build aborts (leaving the old `script.js` intact) if any chunk has a
  syntax error.
- Adding a new chunk? Create the file in `src/js/` AND add it to `MANIFEST`
  in `build-js.mjs` in the position its code must execute.

## RULE 2 — tailwind.css is generated. New class? Rebuild.

Any time you use a Tailwind class that has **never appeared before** in
`index.html` or `script.js`:

    cd build && npm run build:css

(If you changed `src/js/`, run `build:js` first — the CSS scanner reads the
built `script.js`.) `npm run build` does both in the right order.

- Symptom of forgetting: the new element renders completely unstyled while
  everything else looks fine.
- You do NOT need a CSS rebuild for: JS logic changes, `styles.css` changes,
  theme color changes (CSS variables), or reusing classes that already appear
  somewhere in the two files.
- The scanner reads whole files, so class names in JS string literals
  (ternaries, `VISUAL_CONFIG`, `classList.add('...')`) are found automatically.
  It cannot see a class assembled from pieces at runtime, e.g. `bg-${c}-500`.
  Don't write those for Tailwind classes — or add the finished class names to
  the `safelist` in `tailwind.config.js`. (The `warning-*` animation classes
  live in `styles.css`, not Tailwind — unaffected.)

## After any change to bell-engine.js: run the tests

`bell-engine.js` is the shared time/schedule math used by BOTH the main app
and clock.html (the TVs). It is hand-edited (not generated), but it is the
highest-consequence code in the repo, so:

    cd build && npm test        # 30 unit tests, node:test, no packages needed

Keep the engine pure — no DOM, no Firebase, no app globals. Dependencies come
in as parameters (`previousBells`, `isBellSkipped`). That purity is what makes
it testable and shareable; see the header comment in the file.

## Recommended before every push

    cd build
    npm run build       # rebuild both generated files
    npm run check:js    # confirm no script.js drift
    npm run lint        # no-undef only — this caught 14 real latent
                        #   ReferenceErrors during the v5.72.0 refactor
    npm test            # bell-engine unit tests

## Map: which src/js/ chunk owns what

00 header/version · 01 firebase imports · 02 DOM element consts ·
03 memory management · 04 app state, mute/skip · 05 preferences cloud sync ·
06 countdown warning effects · 07 kiosk mode · 08 theme & display ·
09 picture-in-picture · 10 clock loop & countdown · 11 quick bell broadcast ·
12 quick bell queue · 13 schedule resolution & ringing · 14 schedule list
rendering · 15 firebase init & auth · 16 schedule management (largest) ·
17 share codes · 18 bell CRUD & modals · 19 visual cues & file managers ·
20 day-type schedule calendar (PARKED — see its header) · 21 emergency
schedule shift · 22 edit audit log · 23 clock drift warning ·
24 notification backup ring · 25 status/health view ·
99 init() & event listeners (numbered 99 so future insertions never rename it)

These are stage-1 chunks (shared module scope via concatenation), not yet
true ES modules. Stage 2 — converting chunks to real modules one at a time,
starting with the ones that touch the fewest globals — can happen
incrementally without another big-bang refactor.
