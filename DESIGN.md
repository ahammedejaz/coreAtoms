# Core Atoms storefront design system: "The Formulary"

Recorded from the built storefront in `frontend/` on 2026-09-05. The tokens
live in `frontend/src/index.css` (`@theme` block plus `@layer components`);
this file explains the decisions behind them so later work extends the world
instead of polishing over it.

## Thesis

Core Atoms sells disclosed, lab-verified formulas. The storefront therefore
reads like the product's own label: navy fields with fine grain carry the
moments that persuade (hero, proof band, cart drawer, auth panel), warm bone
paper carries everything the visitor operates, ink hairlines replace card
borders, and one amber spark (the logo's orange O) marks the headline accent, ratings,
savings and the free-shipping meter. It refuses the cream-and-serif
apothecary and the white-card-grid template.

## Color

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Ink | `--color-ink` | `#121B2B` | Headings, body on paper, primary text |
| Navy field | `--color-navy-950` … `--color-brand` | `#08132A` … `#1e3a5f` | Announcement bar, hero, facts band, auth panel, primary buttons |
| Navy soft | `--color-brand-soft`, `--color-navy-100/200` | `#EEF3F9` … | Selected states, status chips |
| Canvas | `--color-canvas` | `#FAF9F6` | Page background |
| Bone | `--color-bone`, `--color-bone-deep` | `#F3F0EA`, `#EAE5DC` | Product tiles, footer, quiet panels, meter track |
| Line | `--color-line`, `--color-line-strong` | `#E5E0D6`, `#CFC7B9` | The only borders on paper |
| Amber | `--color-amber`, `--color-amber-deep`, `--color-amber-soft` | `#F59E0B`, `#B45309`, `#FDF1D6` | Hero headline accent, active slide dot, stars, savings pills, CoreCoins |
| Emerald / red | Tailwind `emerald-*`, `red-*` | | Stock, free shipping, errors only |

Strategy is "Committed": navy owns whole regions (roughly a quarter of the
home page), never scattered accents on a neutral ground. Product photography
sits on bone tiles with `mix-blend-mode: multiply` (`.product-img`) so the
studio backdrop disappears and the bottle looks placed, not pasted.

## Type

- Display: Bricolage Grotesque Variable (`--font-display`) for h1, h2,
  prices, the facts panel and the 404 numeral. Tracking `-0.03em` to
  `-0.035em`, line-height 0.95 to 1.05, `text-wrap: balance`.
- Body: Instrument Sans Variable (`--font-sans`). Body copy 15 to 17px,
  metadata 11.5 to 13px, all numbers `tabular-nums`.
- Scale on a page: hero 2.75rem / 4.25rem / 5.5rem; manifesto 2.6rem /
  3.75rem / 5rem; proof numerals 2.75rem / 3.75rem (worded values a step
  smaller so they hold one line); home section titles 2.25rem / 3rem; page
  titles 2.25rem / 3rem; section titles elsewhere 1.5rem to 2.25rem; category
  index rows 1.6rem / 2.6rem / 3.4rem; card names 15px semibold.
- No eyebrow labels above headings. `.section-label` survives only for the
  admin dashboard.

## Shape

- Controls are pills: `.btn-primary`, `.btn-secondary` (alias `.btn-ghost`),
  `.btn-inverse` and `.btn-outline-inverse` on navy, `.btn-icon` circles,
  chips, search, steppers and variant pickers.
- Inputs are 12px (`.input`).
- Panels are 20px (`.panel`, `--radius-panel`), tiles and hero frames 24 to
  28px (`--radius-tile`).
- The Supplement Facts panel (`.facts`) is the one square-cornered object:
  6px radius, 1.5px ink border, 8px title rule, 4px sub rule, hairline rows.

## Depth and material

- Paper surfaces use hairlines, not shadows. Elevation is reserved for things
  that float: the cart drawer (`--shadow-drawer`), the hero frame and facts
  panel (`--shadow-frame`), tile add buttons (`--shadow-float`), search
  suggestions (`--shadow-lift-lg`).
- Navy fields are `.field-navy` (two radial washes over brand navy) with
  `.grain` (SVG turbulence at 9% overlay) for a matte, printed feel.
- There is no brand glyph. The wordmark is the only mark; empty states, the
  announcement bar and the auth panel rely on type and navy fields alone.
  (The earlier atom mark and its orbit rings were removed on 2026-09-05 at
  the owner's request; do not reintroduce decorative geometry.)
- Photography carries the first viewport: full-bleed lifestyle slides from
  `homepage_hero_images` sit under a navy scrim (`.hero-slide`, a 9s
  push-in on the active slide, a crossfade every 6s). Product photography
  stays on bone tiles; the spotlight tile drifts against the scroll.
- Icons for admin-authored labels come from `HintIcon`, which maps the text
  ("Lab Tested", "COD Available") to one lucide glyph, so emoji saved in
  `app_settings` never reach the web storefront.

## Motion

- Easing tokens: `--ease-out-strong` for entrances and hovers,
  `--ease-in-out-strong` for on-screen moves, `--ease-drawer` for sheets.
- One authored moment per surface. Home, top to bottom: the headline
  reveals word by word from a mask (`.word-mask`, 900ms, 55ms stagger),
  then body, pills and trust points rise in turn (`animate-rise`), and on
  scroll the photograph drifts slower than the page while the copy sinks and
  fades; the pillars panel rises last and overlaps the hero's foot; the
  spotlight bottle drifts against the scroll; category rows float a
  photograph in beside the pointer and slide the label 12px; proof numerals
  count up once when 60% in view (1.6s, 120ms stagger, en-IN grouping);
  testimonials run as two marquee strips (`.marquee`, opposite directions,
  paused on hover and focus); the manifesto brightens one word at a time as
  it crosses the middle of the viewport.
- Elsewhere: the drawer's 420ms in / 260ms out slide; the cart badge `pop`;
  card hover lift with a crossfade to the second photo; `ScrollReveal`
  entrances at 700ms with 24px of travel and a 5px blur that clears.
- Motion (`motion/react`, v13) is used only where a value must follow the
  scroll position or count (hero and spotlight parallax, manifesto words,
  proof numerals). Everything else is CSS keyframes and transitions.
- Horizontal strips (best sellers, recently viewed, shop chips) are
  scroll-snap containers with `scroll-px` matching their padding, so the
  first tile snaps to the container edge rather than the screen edge.
- Routes fade in with `.page-enter` (opacity only, so fixed children keep the
  viewport as their containing block).
- Everything collapses under `prefers-reduced-motion`.

## Components and where they live

- Shell: `AnnouncementBar` (free-shipping threshold, COD, lab testing),
  `Navbar` (search with live suggestions, category row, cart trigger),
  `CartDrawer` (opens on every add via `CartContext.lastAction`), `Footer`.
- Home (`components/home/`): `Hero` (photograph slides, masked headline,
  lead-product fallback when no slides are saved), `Pillars` (white panel
  overlapping the hero), `Spotlight` (one formula large, with benefit chips
  from `best_for` and the highlights list), `CategoryIndex` ("Find your
  formula" as typographic rows with live counts), `ProofBand` (navy field,
  counting stats), `Manifesto` (scroll-revealed statement). `Home.jsx` only
  loads settings and orders these sections; every string and image is
  admin-controlled.
- Catalogue: `ProductCard` (4:5 bone tile, hover swap, round add button in
  the tile corner, then category, name, stars and a price row), `ShopFilters`
  (native inputs drawn as navy rings and squares), `Testimonials` (marquee
  strips with a store-wide rating summary), `RecentlyViewed` (localStorage
  `coreatoms_recent`).
- Product page: sticky gallery, buy column without card shells, monograph
  sections with the heading in the left column, `.facts` ingredient panel,
  `StickyAddToCart` on phones.
- Account: `AuthShell` split layout for login, forgot and reset.
- Documents: `LegalPage` with an "On this page" rail built from section
  titles; `FAQPage` accordion groups.

## Rules that keep the world intact

- Never introduce a second card style; content on paper is separated by
  hairlines or bone panels.
- Never add an eyebrow label, a section number or a middle-dot separator.
- No brand glyph, orbit rings or other decorative geometry: photography,
  type and navy fields do the work.
- Keep navy for whole regions and primary controls; do not use it as a tint
  on random cards.
- Amber is the only spark. Emerald and red are semantics, never decoration.
- Icons come from lucide-react at stroke 1.5 to 1.75. No emoji, no inline
  heroicons.
- Admin pages inherit tokens and `.card`; the storefront never uses `.card`.
