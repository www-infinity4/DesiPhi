# DesiPhi

DesiPhi is the **design/polish engine** of the Phi system. It decides *how* components look, feel,
animate, resize and respond. It is framework-independent plain ES-module JavaScript with no
dependencies and no DOM coupling, so it runs on its own today and can later be imported by LayaPhi and Code Phi.

## Responsibility split

```
User intent → LayaPhi → DesiPhi → Code Phi
```

| Phi | Owns |
| --- | --- |
| LayaPhi | WHAT components exist, their ids, types, content and structural arrangement |
| DesiPhi | HOW they look, feel, animate, resize and respond (styling only) |
| Code Phi | Turning the resulting specification into the working educational website |

DesiPhi never adds, deletes, retypes, reorders or edits the content of LayaPhi components. Component
`id`, `type` and `layout` are protected; the engine rejects any operation touching them, and
`validateDesign()` reports a design in which they differ from what LayaPhi supplied.

## Quick start

```js
import { createEngine } from './src/index.js';

const engine = createEngine();
engine.createDesign({
  pageType: 'education',
  components: [{ id: 'hero', type: 'hero' }, { id: 'quiz', type: 'quiz' }]
}, { theme: 'educational' });

engine.updateComponent('hero', { sizing: { minHeight: '240px' } });
engine.setResponsiveOverride('hero', 'mobile', { sizing: { minHeight: '160px' } });
engine.lockProperty('hero', 'sizing.minHeight');
engine.updateComponent('hero', { sizing: { minHeight: '10px' } }); // { ok:false, errors:[{code:'LOCKED_PROPERTY',...}] }
```

* `npm test` – run the test suite (Node ≥ 18, `node:test`, no dependencies).
* Demo: serve the repo root with any static server (ES modules need http), e.g.
  `python3 -m http.server 8080`, then open `http://localhost:8080/demo/`.

## Architecture

```
src/
  index.js                 public entry
  engine/                  design-engine (API), design-state (pure helpers/resolution),
                           command-engine (operation format), design-validator
  controls/                one normalized control model per concern (+ common validators, breakpoints)
  components/              token-derived default styling per component type
  themes/                  presets (token sets) and theme-engine (resolve/extend)
  history/                 undo/redo stack and named snapshots
  locks/                   design-lock (component / property / global locks)
  adapters/                layaphi-adapter (ingest + preservation check), codephi-adapter (output spec)
  schema/                  design + component schema constants
test/  demo/
```

Decisions: the design object is the single source of truth (the demo DOM is only a view); every mutating
method is atomic and never throws on bad input (it returns `{ ok:false, errors:[{code,message,...}] }`);
designs are plain JSON so they can be exported, diffed, snapshotted and stored by any later layer.

## Design schema

```jsonc
{
  "schema": "desiphi.design", "version": 2,
  "theme": "educational", "pageType": "education",
  "tokens": { "colors": {}, "typography": {}, "spacing": {}, "shape": {}, "effects": {}, "motion": {} },
  "source": { "components": [{ "id": "hero", "type": "hero" }] },   // what LayaPhi supplied
  "order": ["hero"],
  "components": {
    "hero": {
      "id": "hero", "type": "hero",
      "layout": { },                                  // LayaPhi content/structure, untouched
      "style": { "sizing": { "minHeight": "240px" } }, // component-specific overrides (sparse)
      "responsive": { "mobile": {}, "tablet": {}, "desktop": {}, "wide": {} },
      "targets": { "hero/heading": { "id": "heading", "role": "heading", "style": {}, "responsive": {} } }
    }
  },
  "locks": { "global": [], "components": { "hero": { "locked": false, "properties": [] } } },
  "designIntensity": { "value": 50, "categories": { "motion": 50, "decoration": 50 } },
  "constraints": { "reducedMotion": false, "preserveLayaPhiStructure": true }
}
```

Style groups (also the property-path prefixes): `typography`, `colors`, `sizing`, `shape`, `spacing`,
`positioning`, `imagery`, `effects`, `motion`, `accessibility`. Required spec areas map as follows:
borders → `shape.border`; shadows/blur/glass/glow/texture → `effects`; opacity/gradients → `colors`;
icons, characters/mascots, GIF settings → `imagery`; motion/transitions → `motion`;
navigation/cards/buttons/media/decorative styling → per-type defaults in `components/*` plus ordinary
style overrides on those components. Stored `style` is sparse: only what differs from token-derived defaults.
A property path is dotted (`shape.border.width`); setting a value to `null` removes an override.

## Control modules (`src/controls`)

| Module | Group | Fields |
| --- | --- | --- |
| typography | `typography` | fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, align, textWidth |
| sizing | `sizing` | width, height, min/maxWidth, min/maxHeight, aspectRatio, scale |
| shaping | `shape` | radius, border{width,style,color}, mask, clip, shape |
| spacing | `spacing` | margin, padding, gap |
| positioning | `positioning` | align, position, offsetX, offsetY, zIndex |
| colors | `colors` | foreground, background, surface, accent, border, gradient, opacity |
| effects | `effects` | shadow, blur, glass, glow, texture, depth |
| animation | `motion` | enabled, transition, duration, entrance, exit, hover, scroll, reducedMotion |
| imagery | `imagery` | fit, position, icon, character, gif{autoplay,loop} |
| accessibility | `accessibility` | focusVisible, focusOutline, minTouchTarget (+ the validation hooks) |
| responsive | – | breakpoint model |

Each module declares typed field specs; unknown properties and invalid values (bad lengths, colors,
out-of-range numbers, unsafe CSS such as `url(...)`/`;`/`{}`) are rejected.

## Engine API (`DesignEngine`)

`createDesign(layoutSpec, {theme})`, `applyDesign({theme, components, responsive})` (bulk, all-or-nothing),
`updateComponent(id, changes)`, `applyTheme(nameOrTheme)`, `setResponsiveOverride(id, breakpoint, changes)`,
`lockComponent/unlockComponent(id)`, `lockProperty/unlockProperty(id, path)`,
`lockGlobalProperty/unlockGlobalProperty(path)`, `undo()`, `redo()`, `snapshot(label)`,
`restoreSnapshot(id)`, `validateDesign()`, `exportDesign()`, `importDesign(objOrJson)`,
`resolveStyle(id, breakpoint?)`, `transaction(fn)`. Only the targeted component is touched by
`updateComponent`; nothing is regenerated.

## Lock system

* **Component lock** – nothing on that component (style or responsive overrides) can change.
* **Property lock** – a path (or a whole group such as `shape`) on one component.
* **Global lock** – a path locked for every component *and* for theme tokens.

A change touching any locked property is **rejected as a whole and reported** (`LOCKED_COMPONENT`,
`LOCKED_PROPERTY`, `LOCKED_GLOBAL`); it is never silently applied or dropped. Applying a theme does not
change the look of locked components/properties: their previously resolved values are pinned into the
component's own style. A theme that would change a globally locked token is rejected. Locks live in the
design, so they are exported, snapshotted and undoable.

## History

`undo`/`redo` keep full-design states in a bounded linear stack (limit configurable, default 100).
`snapshot(label)` stores the full design including locks; `restoreSnapshot(id)` restores it (the restore
is itself undoable). No database; snapshot store has `toJSON()/load()` for later persistence.

## Responsive system

Breakpoints: `mobile` (≤767), `tablet` (768–1023), `desktop` (1024–1439), `wide` (≥1440). Each component has
a sparse override object per breakpoint, validated like normal style and subject to locks. Overrides apply
**only to their own breakpoint** and never modify base values, so mobile gets its own deliberate values rather
than a shrunken desktop. `resolveStyle(id, bp)` = token defaults ← component style ← that breakpoint's override.

## Natural-language command preparation

`createCommandEngine(engine, { interpreter })` defines a deterministic operation format
(`updateComponent`, `setResponsiveOverride`, `applyTheme`, `applyDesign`, lock/unlock ops, `undo`, `redo`,
`snapshot`) executed atomically. No LLM is bundled: passing a string without an interpreter returns
`NO_INTERPRETER`. A later AI layer supplies `interpreter(text, {design}) → operations[]`, e.g.

* "Make the hero shorter." → `{op:'updateComponent', componentId:'hero', changes:{sizing:{minHeight:'200px'}}}`
* "Round these cards more." → `{op:'updateComponent', componentId:'lesson-cards', changes:{shape:{radius:'24px'}}}`
* "Keep everything else exactly the same." → emit only targeted operations (and optionally `lockComponent` ops).

Interpreter output passes the same validation and locks as hand-written operations.

## Themes

`educational`, `editorial`, `minimal`, `playful`, `technical` are token sets (colors, typography, spacing, shape,
effects, motion) for testing the engine, not final Phi branding. Themes may only carry tokens (never content);
component defaults are derived from tokens; `extendTheme(base, name, overrides)` derives variants.

## Accessibility

`validateDesign()` returns `{ ok, errors, warnings }`. Warnings (never auto-fixes) cover: text contrast
(WCAG ratios, large-text aware), small/tight/long-line typography, interactive touch targets (default 44px),
disabled focus indicators, animation kept under reduced motion, identical fg/bg, extreme z-index and media
without alt/decorative flag. Checked at the base and at every breakpoint that has overrides.

## Adapters

* **LayaPhi → DesiPhi**: `createLayaPhiAdapter()` → `{ ingest(layoutSpec), verify(layoutSpec, design) }`. Layout:
  `{ pageType, components: [{ id, type, ...anyContentOrStructure }] }`; ids must be unique and match `[A-Za-z][A-Za-z0-9_-]*`.
* Layout updates: `engine.syncLayout(newLayoutSpec)` returns an updated design plus
  `{ added, removed, preserved, changed, warnings }`. Styles are preserved only for exact stable IDs/paths.
* **DesiPhi → Code Phi**: `toCodePhiSpec(design)` returns identity, LayaPhi content references, resolved tokens,
  base and breakpoint styles, nested target styles, effects/motion, accessibility and constraints.

## How another Phi app calls DesiPhi

```js
import { createEngine, createLayaPhiAdapter, toCodePhiSpec } from 'desiphi';
const engine = createEngine();
const created = engine.createDesign(layoutSpecFromLayaPhi);   // validates the layout
if (!created.ok) handle(created.errors);
engine.applyTheme('minimal');
const spec = toCodePhiSpec(engine.exportDesign());            // hand to Code Phi
```

## Phase 2: targets, operations, and renderer boundary

LayaPhi may represent nested design targets inside a component's own layout/content object. DesiPhi
indexes descendants with stable `id` values as style-only records under `component.targets`, using
paths such as `lesson-cards/card-1/image`. Target records never contain or replace LayaPhi content.
Style and responsive overrides are resolved and locked by the complete stable target path.

Selectors are deliberately not CSS selectors and are matched against the DesiPhi model only:

* `#hero` or `hero` – exact component ID.
* `#lesson-cards/card-1/image` – exact nested target path.
* `type:card-grid` and `role:image` – all targets with that type or role.
* `#lesson-cards/*/image` – a path wildcard, with `*` matching one stable ID segment.
* `*` – all targets. Unsupported selector syntax is rejected; arbitrary CSS/DOM queries are not accepted.

The normalized command vocabulary includes `SET`, `ADJUST`, `RESET`, `APPLY_THEME`, `APPLY_PRESET`,
`LOCK`, `UNLOCK`, `HIDE_DECORATION`, `SHOW_DECORATION`, `RESPONSIVE_SET`, `COPY_STYLE`,
`RESET_COMPONENT`, and `RESET_PROPERTY`, in addition to the original lower-camel operations. Example:

```js
commands.run([
  { op: 'SET', selector: '#hero', path: 'sizing.height', value: '420px' },
  { op: 'RESPONSIVE_SET', selector: '#hero', breakpoint: 'mobile', path: 'sizing.height', value: '260px' },
  { op: 'LOCK', selector: '#hero', path: 'sizing.height' }
]);
```

Themes (`PRESETS`) remain site-wide token sets. `VISUAL_PRESETS` are component/role treatments with
`clean`, `soft`, `bold`, `compact`, `editorial`, and `immersive` variants for hero, article, card,
card-grid, timeline, quiz, sources, navigation, and media. They are illustrative, not Phi branding.

`designIntensity` stores a 0–100 policy value and category values; it never rewrites a design. Constraints
are stored with the design and reported as validation warnings without auto-fixing styles; an operation that
introduces a new constraint violation is rejected atomically. Optional visual
fields cover media references/cropping/focal points, gradients/overlays, decorative layers, badges/ribbons,
dividers, textures, icons/characters, motion states, sticky/floating positioning, transforms, depth, glass,
shadow, and glow. These fields are opt-in and use constrained values/asset references rather than raw markup.

### Code Phi renderer contract

Code Phi consumes only the exported spec. It maps component identity and type to renderer-owned semantic
elements, LayaPhi content references to text/media content, and visual properties to renderer-owned CSS
custom properties. Breakpoint properties become responsive CSS rules; motion/effects become declarations
from a renderer-maintained allowlist; media references are resolved through the renderer's asset registry;
hover/focus states map to semantic interactive states. Accessibility metadata and constraints accompany
the output and must be preserved by the renderer.

DesiPhi values are data, never executable markup or arbitrary CSS. A renderer must escape text, validate
asset references, map enums/properties through its own allowlists, and must not evaluate `innerHTML`,
inject arbitrary style text, or run operations against the DOM. This repository does not implement that
renderer.

### Natural-language provider boundary

`interpretDesignCommand(text, context, provider)` accepts a provider that returns normalized operation
objects only. `createCommandEngine(engine, { interpreter })` sends those operations through the same
operation validation, selector resolution, locks, constraints, transactions, and history as direct calls.
The provider receives a cloned context and never receives a mutable design reference. Pipeline:

`natural language → interpreter → normalized operations → validation → locks/constraints → atomic application → updated design`

No AI API is connected. The provider cannot directly mutate design JSON or bypass deterministic validation.

## Assumptions

* The repository was empty, so the project lives at the repo root (the suggested `desiphi/` is the root); `test/fixtures.js` was added as a shared test helper.
* Top-level layout components form an ordered list; nested LayaPhi nodes with stable IDs may also be styled by path.
* Component `type` is an open string; unknown types receive base token defaults.
* Breakpoint overrides apply to their exact breakpoint only (no cascade), width thresholds above are assumed.
* A rejected operation is rejected whole (atomic) rather than partially applied.
* Lengths accept numbers or CSS length strings; colors accept hex/rgb()/hsl(). `colors.surface` is an added token color.
* Contrast is only evaluated when both colors are solid hex/rgb values; gradient/transparent backgrounds are skipped.
* Phi branding, real LayaPhi/Code Phi contracts and any non-education page types are unknown and were not invented.

## Intentionally unfinished

* Persistence (no Cloudflare/storage), multi-user/session handling, diffing UI.
* Final Phi branding/themes, production assets, and a complete Code Phi renderer.
* Accessibility checks are heuristics, not a complete WCAG audit.
