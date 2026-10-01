# Malipo Connect — design

The merchant-facing setup app at `connect.kioskpay.co.ke`. A merchant adds a till, paybill, or
bank account, confirms it, copies one request, and starts taking M-Pesa payments.

## Intent

**Operate, not Persuade.** This is a tool a shop owner uses once to get wired up and returns to
when something needs changing. Scannability, consistent placement, and the real usage scene outrank
expression; the brand lives in precise details rather than in decoration.

Every page answers one of four questions: *where does my money go*, *do I have keys*, *what is
happening to my payments*, or *how do I integrate this*. The chrome should make those four answers
obvious without reading.

## Brand

Inherited from [KioskPay www](../www/DESIGN.md) — soft gray ground, pale yellow beams, M-Pesa teal,
ink CTAs, spaced wordmark, Sora, `--ease-out` motion. Nothing in the app invents a new palette.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#bfc3c7` | Page ground, behind the yellow beams |
| `--ink` | `#0a0a0a` | Rail, primary CTAs, code blocks |
| `--surface` | `#ffffff` | Cards |
| `--yellow` | `#fef27f` | Accent CTA, current step, beams, rail top bar |
| `--mpesa` / `--teal` | `#0f6b68` | Kickers, verified states, focus ring |
| `--danger` | `#9b1c1c` | Errors, degraded service |
| `--r-xs` … `--r-xl` | `6px` … `24px` | Buttons are square-ish; cards are not |
| Font | Sora Variable | Display + body |
| Motion | `--ease-out` / `--dur*` | Entrances, hover lift |

## Layers

Styles are three files, loaded in order by every layout. Keep the split — a single flat sheet is
what made these pages hard to change.

| File | Owns |
|---|---|
| `styles/tokens.css` | Tokens, reset, base type, the gray ground + beams. **Decisions only.** |
| `styles/shell.css` | App chrome: rail, top bar, page frame, stepper, auth split. |
| `styles/components.css` | The widget vocabulary: cards, buttons, fields, tables, pills, callouts. |

## Layout

Desktop-first, three shells:

- **`layouts/AppLayout.astro`** — the signed-in app. Persistent ink rail (grouped *Payments* /
  *Account* nav, service health, sign out), translucent top bar (breadcrumb + merchant), and a wide
  canvas up to `--canvas`. Two-column work surfaces use `.split` (primary + 21rem aside); paired
  cards use `.grid-2`. This is the shape most pages should have.
- **`layouts/AuthLayout.astro`** — sign-in and sign-up. Dark pitch panel left, form right.
- **`layouts/AuthLayout` is not used by `/guide`** — the guide (`bare`) carries its own header and a
  sticky contents rail, because it is read rather than operated on.

Every page opens with `.page-head`: kicker → `h1` → lede on the left, actions on the right. That
pairing is the main organisational tool; content below it is grouped into `.card`s.

## Rules

- **One primary CTA per view.** Accent (`--yellow`) is reserved for the next step and destructive-
  feeling emphasis; primary (`--ink`) is the main action; everything else is ghost.
- **Status is a dot plus a word.** `.pill` always renders a leading dot so state is not carried by
  colour alone. `In use` / `Ready` / `Needs confirmation` are the only destination states.
- **Numbers are tabular.** Money, counts, till numbers, and paybills all set `font-variant-numeric:
  tabular-nums` so columns scan.
- **Short values get short inputs.** `.field-sm` caps a till or paybill field; a 700px-wide input
  for seven digits reads as broken.
- **Code is dark on light ground.** `.snippet` is ink with yellow text, carried across the app, the
  settings page, and the guide.
- **Errors say what to do.** `.callout-error` replaces the old bare `.err`; `.callout-warn` is used
  for "not yet" states rather than treating them as failures.

## Motion

Restrained on purpose. `.btn`, `.choice label`, and `.bank-chip` lift 1–2px on hover; the stepper
fills; the service dot pulses only while its state is unknown. Everything collapses under
`prefers-reduced-motion`.

## Gotchas

- **Astro drops the space *before* an element that starts a line.** Prose with an inline
  `<a>`/`<code>`/`<strong>` on its own line needs an explicit `{" "}` at the end of the previous
  line or the sentence runs together.
- **`[hidden]` is force-restored** in `tokens.css` because components set explicit `display`, which
  would otherwise beat the UA rule. The destination form toggles several panels this way.
- **The guide is checked against `docs/INTEGRATION.md`** by `npm run check:guide`. Changing the text
  inside any `<pre class="snippet">` on `/guide` will fail the build until both copies agree.