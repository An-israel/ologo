# Changelog

Theme releases are tagged in Git (`v2.0.0` upward). Store schema changes bump `STORE_SCHEMA_VERSION` in `scripts/lib/config.ts`, which setup-store writes to the shop metafield `ornis.schema_version`.

## Unreleased: 2.0.0 (milestones 1 to 3, built before store access)

### New design (operator request: "change the entire UI, make it better")
- Modern fashion-store layout: clean white base, rounded imagery, pill buttons, soft shadows and hover motion.
- Header: white with blur, centred menu, visible search bar on desktop, coral bag count; slim royal blue announcement bar.
- Home: full-width rounded image banner with text over it and two buttons; light trust cards; round category bubbles;
  product cards with a round "+" quick add on the image; split editorial card; colourful gift shortcut cards;
  royal blue newsletter card; dark rounded footer (no duplicate newsletter on the home page).
- Product page: pill size buttons (selected in ink), large rounded gallery, pill Add to bag, floating sticky bar on phones.
- Collection: sky blue header card, pill sort control, ink filter chips.
- New "Surface" colour setting for image backgrounds and soft panels. Preview images now resize like Shopify's CDN.

### Brighter colours (operator request: "colours look faint and dull")
- Vivid palette: royal blue #1D4ED8 header and buttons, navy #172554 footer, sunshine #FFC629 highlights, coral #D9381E,
  raspberry #BE185D, and saturated sky, mint, peach, lilac, butter and pink backgrounds on a pure white page.
- Hero is one solid colour (sky blue by default, editable) instead of a gradient; the trust strip below is navy with
  yellow icons, so the top of the page is one blue family.
- Product photos always show their true colours: they sit in a white frame inside the coloured card, never blended
  with the background. All pairs still pass WCAG AA.

### Font change (operator request)
- Poppins for headings and body, from Shopify's font library (no self-hosted font files). Montserrat or Helvetica can be picked in Theme settings > Typography.

### Colour refresh (operator request: "add life and colour")
- New palette, all editable in Theme settings > Colours and all WCAG AA: Deep teal header and footer, Kingfisher buttons,
  Marigold announcement bar, highlight buttons and heading underlines, Coral labels and New badges, Berry low-stock badges,
  and soft Mint, Peach, Lilac and Butter section backgrounds.
- Hero with a warm gradient, a coral label and a coral highlighted phrase; colourful category cards; tinted product cards;
  multicoloured gift finder; brand-gradient newsletter; coloured trust icons; feather in marigold; new favicon.
- Every product row, editorial and hero section has a background or button colour choice in the theme editor.

### Theme
- New Ornis 2.0 theme on Online Store 2.0: "Plumage" design system (colour and type tokens as theme settings, Poppins for headings and body from Shopify's font library), ORNIS wordmark with feather, and favicon.
- Global: announcement bar (pausable, at least 6 s per message), sticky header with mega menu and full-screen mobile menu, predictive search (keyboard combobox), cart drawer with free-delivery progress, footer with three menus, newsletter, social and payment icons, business details, and cookie preferences link.
- Home: hero (LCP image preloaded), trust strip, category tiles, New in, editorial, gift finder, Picked for you, verified reviews (hidden under 5), About line, newsletter.
- Collection and search: filters (sidebar and drawer), active filter chips, sort, product cards with second image, swatches, quick add, honest badges, Load more that keeps the URL.
- Product: swipeable gallery with counter, thumbnails and zoom, swatches and sizes with sold-out states, fit note, size guide drawer, Klarna message, delivery estimate in UK time, trust points, accordions, Complete the look, You may also like, Recently viewed, sticky add-to-bag, structured data.
- Pages: Contact form, FAQ (metaobjects, FAQPage data), Size guide, Delivery and Returns (facts from shop_info), Track my order, Gift guide, 404, password, gift card.
- Honesty: a compare-at price is only shown with 28+ days of price history. No fake reviews, urgency or stock messages.

### Toolkit
- setup-store, audit-catalogue, normalise-products (with revert), validate-products, prepare-images, import-products, publish-products, set-redirects, weekly-report, smoke-test, backup-export.

### Quality
- Theme Check 0 offences; 34 unit tests; 92 Playwright tests with axe; Lighthouse on the preview: Performance 98 to 99, Accessibility, Best Practices and SEO 100.
