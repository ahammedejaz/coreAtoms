# Core Atoms storefront design system: "The Formulary"

Recorded from the built storefront in `frontend/` on 2026-09-05 and extended
on 2026-09-06 with the physical layer, the real-jar treatment and the Site
content model. The tokens
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
  titles 2.25rem / 3rem; section titles elsewhere 1.5rem to 2.25rem;
  ingredient cells 1.15rem / 1.3rem; card names 15px semibold; body copy in
  the content sections 14px on 1.6 line-height.
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
  It appears twice: the ingredient panel on the product page and the daily
  schedule on the home page. It is the grammar for tabular truth, never a
  card style; anything without rows and a rule stays on `.panel`.

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
  stays on bone tiles everywhere else.
- Density is part of the material. Sections run 56 to 80px of vertical
  padding and alternate canvas, white and bone bands (navy for the proof
  band) so the page reads as composed rather than sparse. A first-time
  visitor comparing stores should find the answers on this page, not in a
  gap.
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
  fades; the pillars panel rises last and overlaps the hero's foot; category
  tiles lift their photograph and reveal an arrow on hover; proof numerals
  count up once when 60% in view (1.6s, 120ms stagger, en-IN grouping);
  testimonials run as two marquee strips (`.marquee`, opposite directions,
  paused on hover and focus); the manifesto brightens one word at a time as
  it crosses the middle of the viewport. The content sections (standard,
  ingredient index, education, FAQ) use `ScrollReveal` entrances
  only; their job is to be read.
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
  viewport as their containing block); with the curtain on, the arriving page
  uses `.page-arrive` instead.
- The physical layer (`components/fx/`, switched in `context/MotionContext`
  from the `site_motion` setting and gated by pointer, viewport and
  reduced-motion): Lenis smooth scrolling (`SmoothScroll`, lerp 0.1, with
  `useScrollLock` for the drawer, menu, filter sheet and promo so overlays
  stop the page underneath), a two-pixel amber reading line at the top and a
  draggable ink rail replacing the native scrollbar on every device, a
  three-pixel pill that fades out at rest on touch screens (`Scrollbar`),
  a navy curtain that wipes over route changes carrying the destination's
  name (`RouteCurtain`: 300ms cover, 60ms hold, 560ms reveal), a faint film
  grain over the page (`Grain`, multiply at 0.055), headings that rise word by
  word from a mask when they scroll into view (`RevealText`), product and
  category tiles that tilt toward the pointer with a sweeping sheen (`Tilt`),
  and primary buttons that lean toward the pointer (`Magnetic`). A custom
  pointer with "View" labels exists (`Cursor`) but ships off.
- The real jar. Every product photograph is delivered as a portrait 4:5
  canvas (1200×1500) on pure white with the product centred and filling about
  three-quarters of the height (`frontend/public/products/` holds the current
  range, built from the 3D pack mockups and the studio jar shots). Product
  tiles and the product-page gallery use `object-contain`, so a photograph of
  any shape sits whole and centred rather than being cropped, and the white
  ground disappears into the bone tile through the multiply blend. Because the
  ground is a flat near-white sweep, `utils/cutout.js` lifts the jar off it in
  the browser: a fill from the border marks the backdrop and the shadow by
  walking only along paths that keep moving away from the backdrop colour
  (so it never pours into a nearly white pack panel or follows a bright edge
  line into an enclosed white patch), the photographed shadow becomes alpha,
  the anti-aliased rim is matted so no pale fringe is left around a dark jar,
  and the crop is centred on the jar with room for that shadow. The result is a
  plain `<img>` (`components/Cutout`) that can stand on navy or bone with its
  own shadow. It appears on the category index's stage (the hovered
  category's jar, swapped only once the next cutout is ready so the field is
  never empty). That is the only place it appears. A rendered
  three-dimensional jar was built for the hero, product page, login, cart and
  404 and rejected on 2026-09-05 (beside the real photography it read as a
  plastic toy); the cutout that replaced it on those pages was removed on
  2026-09-06 at the owner's request. The hero is the photograph and the words
  alone; the "What's inside" panel is the plain Supplement Facts table; the
  login panel is a photograph under a navy scrim; the empty cart and the 404
  carry an icon and a numeral. Do not bring back rendered product imagery,
  and do not put a jar back on any of those pages.
- Pinned stories: the Formulary standard pins its `.facts` panel while the six
  rules scroll past, each filling its row as it crosses the middle of the
  viewport; two full-bleed photo breaks (the second and third hero
  photographs) grow from an inset frame to the full width as they enter.
- Everything collapses under `prefers-reduced-motion`.

## Components and where they live

- Shell: `AnnouncementBar` (free-shipping threshold, COD, lab testing),
  `Navbar` (search with live suggestions, category row, cart trigger),
  `CartDrawer` (opens on every add via `CartContext.lastAction`), `Footer`.
- Home (`components/home/`), in page order: `Hero` (photograph slides,
  masked headline, lead-product fallback when no slides are saved),
  `Pillars` (white panel overlapping the hero), `CategoryIndex` (one hairline
  row per category with a numeral, the name set large, the live formula count
  and what those formulas are taken for, beside a navy stage showing the
  hovered category's jar; plus "Shop by goal" chips derived from every
  product's `best_for`; it replaced the photo-tile strip, which repeated the
  same two photographs six times), best sellers (in `Home.jsx`), `PhotoBreak` (a full-bleed photograph with one line, its own
  photograph under Site content → Home or else the second and third hero
  photographs, used
  twice), `Standard` (the six Formulary rules as a pinned story on desktop: a
  navy card holding the current rule's numeral, a six-segment progress line
  and an index of the rules with the numerals in one aligned column, beside
  the rules scrolling past; a hairline list elsewhere. It was first drawn as
  a Supplement Facts label with the numeral bleeding off the corner, which
  the owner rejected on 2026-09-06 as "a supplement info card"; the
  "When to take what" daily-schedule section was removed the same day at
  their request), `IngredientIndex` (the actives across the range as
  a bordered grid with formula counts and a filler cell that closes the last
  row), `ProofBand` (navy field, counting stats), `Testimonials`,
  `Education` (four supplement-literacy panels), `FaqPreview` (five FAQ
  entries shared with the FAQ page), `RecentlyViewed`, `Manifesto`
  (scroll-revealed statement). `Home.jsx` loads settings and renders these
  sections in the order saved under Site content → Home, skipping hidden ones.
  The single-product spotlight and the typographic category rows were
  removed on 2026-09-05 at the owner's request.
- Catalogue: `ProductCard` (4:5 bone tile, hover swap, round add button in
  the tile corner, then category, name, stars and a price row), `ShopFilters`
  (native inputs drawn as navy rings and squares), `Testimonials` (marquee
  strips with a store-wide rating summary), `RecentlyViewed` (localStorage
  `coreatoms_recent`).
- Product page: sticky gallery, buy column without card shells, monograph
  sections with the heading in the left column, the "What's inside"
  Supplement Facts panel, `StickyAddToCart` on phones.
- Account: `AuthShell` split layout for login, forgot and reset. The left
  panel is a photograph (`page_account.panelImage`, else the first hero
  photograph) under a navy scrim, with the logo, an eyebrow pill, the heading
  arriving word by word (`fx/MaskWords`), three numbered points and a
  footnote; on phones it is a short band above the form. The login form opens
  with a segmented Sign in / Create account switch and closes with a lock-icon
  note. Every word, the photograph included, is under Admin → Site content →
  Account pages.
- Documents: `LegalPage` with an "On this page" rail built from section
  titles; `LegalDocument` renders one policy from its content key;
  `FAQPage` accordion groups; `RichText` (paragraphs, bullets, monograph
  headings, `**bold**`, `[label](/path)` links, `{placeholders}`).
- Physical layer: `components/fx/` (`SmoothScroll`, `Scrollbar`, `Cursor`,
  `RouteCurtain`, `Grain`, `RevealText`, `Tilt`, `Magnetic`), orchestrated by
  `layouts/MainLayout.jsx`; `components/Cutout.jsx` with `hooks/useCutout.js`
  and `utils/cutout.js`.

## Where the words live

- Every page's copy is editable under Admin → Site content. The schema in
  `content/siteContent.js` lists sixteen `app_settings` keys (`site_global`,
  `site_motion`, `page_home`, `page_shop`, `page_product`, `page_cart`,
  `page_checkout`, `page_account`, `page_orders`, `page_faq`, `page_contact`,
  `page_legal_terms|privacy|shipping|refund`, `page_errors`) with the fields
  the editor renders and the defaults the storefront ships with. Pages read
  the merged value through `useSiteContent(key)` (`services/siteContent.js`):
  defaults at once, the saved value once loaded, and admin saves pushed into
  open tabs. Objects merge, saved arrays replace defaults wholesale.
- The older Home settings still own the hero (`homepage_hero_images`,
  `homepage_hero_copy`), pillars, categories, featured products, the proof
  band and the manifesto. The standard and education panels can be saved in
  both places; Site content wins when it has them, then `homepage_standards`
  / `homepage_education`, then the defaults.
- Catalogue-derived copy (goals, schedule, ingredient index) is computed in
  `services/homepage.js` from `best_for`, `recommended_stack` and product
  names. The schedule's three "why" sentences live in `SLOT_DEFS` there. `INGREDIENT_ROLES` holds the one-line role for each active; a new
  formula joins the index when its name matches an entry.
- The FAQ lives once, as `page_faq.groups` (defaults in `content/faqs.js`);
  the FAQ page renders all of it and the home page renders the questions
  picked under Site content → Home, matched by text. The four policies are
  rich-text sections in their `page_legal_*` keys and may use `{legalName}`,
  `{supportEmail}` and `{supportPhone}` from Store information.
- Product monographs live on the product row: `about_text` (intro, Uses,
  Why this formula, Key nutrients) and the `details` JSONB (benefits,
  ingredients, howToUse, faqs, safetyInfo). All fifteen active products
  carry one as of 2026-09-05; the admin's structured editor maintains them.
- Health copy is written as general wellness information: "supports",
  "contributes to", "traditionally used for". Nothing claims to diagnose,
  treat, cure or prevent a disease, and certifications are only stated where
  the admin has entered them.

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
- The product is always its photograph. No rendered, illustrated or
  procedural jars; the cutout is the only manipulation, and it goes on navy
  or bone, never over another photograph's subject.
- Effects are switches, not structure: every item in the physical layer can
  be turned off under Site content → Motion and the page must still read.
