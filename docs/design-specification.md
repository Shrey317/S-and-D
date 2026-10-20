# Visual and interaction specification

Phase 2 implements the semantic token system, locally bundled fonts, responsive storefront and light/dark/system themes. Product data and purchasing interactions remain assigned to later phases. See the component and verification records for delivered states and checks.

## Brand

Warm modern produce retail: generous spacing, clear prices and selling units, strong product photography, restrained green structure and gold details. Manrope Variable headings and Inter Variable body are bundled from Fontsource with their package licenses. Use tabular numerals for money/reporting in later phases.

| Token        | Light   | Dark    |
| ------------ | ------- | ------- |
| Background   | #F9F7EF | #101D16 |
| Foreground   | #162820 | #F9F7EF |
| Card         | #FFFFFF | #192B20 |
| Primary      | #174D33 | #A8D5AF |
| Primary text | #FFFFFF | #102418 |
| Secondary    | #EAF1E8 | #24392B |
| Muted text   | #4A6053 | #B8C9BA |
| Accent       | #D4A637 | #D4A637 |
| Accent text  | #162820 | #162820 |

Gold is an accent; no small gold-on-white text. Use semantic CSS variables for all component states. Rounded cards (12–16 px), modest borders and restrained shadows. Avoid decorative motion or invented trust badges.

Forest panels locally use a lighter gold, #EFC55F, for small accent text to meet contrast requirements; the main brand gold remains #D4A637.

## Storefront composition

Homepage: announcement → responsive header/search → produce hero with tagline and “Shop Fresh Produce” / “Explore Categories” → category cards → popular products → featured products → verified Why Choose Us content → ordering steps → location/contact/hours → footer/policies.

Catalog categories are Fruits, Vegetables and Extra. Product cards show unit and starting price when variants differ; explicit variant selection determines the purchasable SKU. Search, filter, sort and pagination live in shareable URL state. Popularity derives from qualifying real sales; the new store must not invent sales history. Until the catalog is implemented, previews clearly identify development content.

Product pages: gallery, description, variants, current price/unit, availability, quantity, cart/wishlist actions and related products. Cart explains changed price/stock before checkout. Checkout presents contact → delivery/collection → address → payment → final review with accepted policy versions. No customer-selected delivery slots. COD is delivery-only; payment on collection is collection-only.

Default delivery copy: “Free delivery to eligible Lenasia addresses. We’ll confirm your fulfilment date after reviewing your order.” Show dates only when approved operational rules support them. Order receipt, payment confirmation and fulfilment confirmation must remain distinct.

## Components and responsive behaviour

Phase 2 builds header, announcement bar, mobile navigation, footer, buttons, labelled fields, selectors, filters, category/product cards, cart drawer, dialogs, toasts, skeletons, empty states and confirmation panels. Later phases extend these to dashboards and tables. Every advertised interaction must work or be explicitly unavailable during phased previews.

Use a single-column checkout, a two-column product grid on suitable phones and three/four columns on larger screens. Mobile filters use a keyboard-accessible drawer. Admin tables use compact layouts or labelled scroll regions without losing actions. Avoid a sticky element obscuring focused controls.

System/light/dark mode uses next-themes to apply the preference before paint, persist the selection and allow manual override. Motion respects reduced-motion preferences. Image aspect ratios reserve layout space. The storefront uses an arched produce hero, warm ivory surfaces, forest-green service panels and gold accents; dark mode retains semantic contrast without inverting photographs.

## Accessibility and content

Target WCAG 2.2 AA. Provide semantic headings/landmarks, a skip link, visible focus, accessible error summaries, live cart updates, focus management for dialogs and touch targets of at least 44 px where practical. Test contrast, keyboard-only flow, zoom, reflow and screen readers in later phases; automated testing alone is not conformance.

Use licensed development photography with recorded provenance. Do not call it a photograph of the real shop. Actual location/maps, About copy, policies, prices and claims require verification/owner approval. Do not invent founding dates, suppliers, certifications, ratings or business details.
