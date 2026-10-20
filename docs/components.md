# Storefront components — Phase 2

Local, owned shadcn-style components use Radix primitives, Tailwind semantic tokens and Lucide icons. Radix provides modal focus trapping, Escape dismissal and trigger focus restoration. Tokens and reduced-motion rules live in `src/app/globals.css`.

| Component                      | States and intended use                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                         | Default, outline, ghost and gold; small/default/large/icon sizes; native disabled state; `asChild` for real links. Interactive targets generally at least 44 px.                                  |
| Input                          | Labelled native input with autocomplete, required/max-length, disabled and aria-invalid styles. Contact textarea uses matching tokens.                                                            |
| Dialog                         | Centred confirmation panel or right-hand sheet; accessible title/description, explicit close control, overlay, Escape and focus trap. Enquiry returns focus to the submit button.                 |
| Dropdown menu                  | Keyboard-operable radio choices for Light, Dark and System; checked state exposed to assistive technology.                                                                                        |
| Badge, Skeleton, EmptyState    | Noninteractive status, decorative loading placeholders and honest unavailable states. Skeleton animation is disabled for reduced motion.                                                          |
| CategoryCard                   | Licensed illustration, category name and real URL. Category selection is shareable and survives reload.                                                                                           |
| ProductCard                    | Display contract ready for real database records: name, image, price/unit, category, availability and detail URL. Not rendered with fake product data. Phase 3 owns queries and price formatting. |
| Header and Footer              | Working public navigation, phone links and policy/credit links. Mobile menu is a modal sheet. Account and basket explain their availability without fake login/cart actions.                      |
| ThemeProvider and Reveal       | Persistent system/manual theme, locally rendered content visible without animation, reduced-motion-aware reveal; no hidden initial SSR content.                                                   |
| ContactDetails and CopyAddress | Confirmed address/hours, telephone and manual WhatsApp links. Clipboard success/failure toast reflects the real browser result.                                                                   |
| EnquiryForm                    | Required name/message, bounded local draft, review dialog and explicit WhatsApp handoff. No server submission, storage, automatic send or sent status.                                            |

## Content and layout rules

The layout uses a centred 1200 px maximum content width with responsive gutters. Hero and feature areas stack on smaller screens; category cards expand from one to three columns. The desktop navigation changes to a focus-managed menu below 1024 px. Images reserve aspect ratios and use Next Image responsive sizing.

Main content is keyboard-focusable through the skip link. Every page has one primary heading. Decorative icons are hidden from screen readers; icon-only buttons have accessible names. Foreground/background states derive from semantic tokens. Fixed forest-green areas retain white text in both themes.

The account, basket, catalog and policies are explicitly pending. Policy hub entries are status text, not broken links. The service copy separates shop opening hours, the 19:00 cutoff and eventual fulfilment confirmation. No customer delivery slots, invented prices, fake ratings or fabricated sales history are displayed.

Automated accessibility checks are a baseline, not a claim of WCAG conformance. Screen-reader, real-device and complete transaction accessibility remain part of Phase 9.
