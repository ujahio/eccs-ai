# Design System: E-Clinical Case Solutions

Source: Adobe XD share, full 149-screen grid for `E - CLINIC PROJECT (FINAL)`
Design pages with inspiration from screens in https://xd.adobe.com/view/1ebfe4d0-4adc-4530-8fe6-f01acf215225-4bec/grid.

This design system is based on the visible desktop and mobile screens in the XD grid, including landing pages, login/reset flows, doctor/admin dashboards, case creation, case studies, student case-taking flows, CME questions, feedback, certificates, account settings, signup, payment, onboarding, splash/loading screens, success states, and modal overlays. Color values are approximate from the shared XD visuals.

## 1. Visual Theme & Atmosphere

E-Clinical is a calm, clinical, education-focused SaaS experience. It should feel credible, restrained, and task-oriented rather than decorative. The product uses a mostly white interface with pale gray canvases, dark slate actions, teal brand accents, and very light borders. Marketing pages introduce warmth through medical photography, while logged-in workflows rely on quiet cards, forms, tabs, and step-by-step progression.

The overall density is medium-light: generous whitespace, large desktop content panels, compact mobile screens, and sparse use of color. The design philosophy is "clinical clarity": every screen should make the current task obvious, reduce visual noise, and preserve a steady primary action at the bottom or top-right of the workflow.

Core product areas visible in the grid:

- Public landing pages with hero imagery and objectives content.
- Authentication: splash, login, forgot password, reset password, create account.
- Doctor/admin dashboard: case studies, case creation, materials/deadlines, CME setup, final review, responses, and feedback.
- Student experience: dashboard, case presentation, case model answers, CME questions, feedback, certification, certificate download.
- Account settings: personal details, password, profession details, and payment.
- Mobile workflows for case creation, account settings, case studies, responses, feedback, onboarding, and signup.
- Modal overlays for details, confirmations, filters, date pickers, certificate previews, and success messages.

## 2. Color Palette & Roles

| Semantic Name   | Hex                         | Role                                                          |
| --------------- | --------------------------- | ------------------------------------------------------------- |
| White           | `#FFFFFF`                   | Main surfaces, cards, forms, nav bars, splash background      |
| App Canvas      | `#F8FAFB`                   | Page background, dashboard canvas, form sections              |
| Soft Section    | `#F2F7F8`                   | Light marketing sections and subtle content bands             |
| Border Gray     | `#E5EBEF`                   | Card borders, dividers, input strokes, table lines            |
| Muted Gray      | `#4B5A67`                   | Body copy, metadata, placeholders, secondary labels           |
| Disabled Gray   | `#C8D0D6`                   | Disabled labels, inactive buttons, low-priority icons         |
| Primary Text    | `#223244`                   | Headings, titles, navigation, important labels                |
| Primary Action  | `#2F4358`                   | Filled CTA buttons, sticky action bars, active tab underlines |
| Action Hover    | `#253647`                   | Hover/pressed state for primary actions                       |
| Brand Teal      | `#159A9C`                   | Logo mark, brand detail, selected accents                     |
| Success Mint    | `#40DDB5`                   | Success check icons, completed states, positive confirmations |
| Success Soft    | `#DDFBF3`                   | Success notification backgrounds and selected chips           |
| Error Red       | `#D85B5B`                   | Validation errors, destructive/error copy                     |
| Warning Gold    | `#F3B64B`                   | Payment/attention hints where needed                          |
| Overlay Slate   | `#2F4050` at 70-80% opacity | Modal scrims and dimmed background states                     |
| Chip Background | `#F4F7F9`                   | Count chips, filters, quiet status labels                     |
| Photo Dark Teal | `#062F37`                   | Dark photographic dashboard hero panels                       |

Use the palette semantically. Most screens should be white, pale gray, dark slate, and small teal/mint accents. Avoid turning teal into the primary button color; the XD system consistently reserves dark slate for primary actions.

## 3. Typography Rules

Use `Nunito Sans` as the implementation default for the entire application. If the primary font is unavailable, use `Montserrat`, `Avenir`, or `Inter` as ordered fallback options before system sans-serif fonts.

| Style            | Desktop Size | Mobile Size | Weight | Line Height | Usage                                      |
| ---------------- | -----------: | ----------: | -----: | ----------: | ------------------------------------------ |
| Marketing Hero   |      34-42px |     28-32px |    700 |     1.2-1.3 | Landing page headline                      |
| Section Heading  |      24-30px |     22-26px |    700 |         1.3 | Marketing sections, objectives             |
| Page Title       |      18-22px |     16-20px |    600 |        1.35 | Dashboard and workflow titles              |
| Card Title       |      16-18px |     15-17px |    600 |        1.35 | Case names, certificate titles, user names |
| Form Label       |      12-14px |     12-13px |    500 |         1.3 | Input labels and field captions            |
| Body Copy        |      15-18px |     14-16px |    400 |     1.7-1.9 | Long-form case text, landing page copy     |
| Small Body       |      13-14px |     12-14px |    400 |         1.5 | Metadata, submitted dates, helper text     |
| Navigation       |      13-14px |     12-14px |    500 |           1 | Top nav, tab labels, menu labels           |
| Button Label     |      12-14px |     12-13px |    700 |           1 | Uppercase actions                          |
| Certificate Name |      22-30px |     20-24px |    700 |        1.25 | Certificate preview recipient name         |
| Error Text       |      12-13px |        12px |    500 |         1.4 | Validation and inline errors               |

Typography rules:

- Use Title Case for page titles, step labels, section labels, and form labels going forward.
- Use uppercase only for primary CTA buttons and some compact nav/action labels.
- Keep letter spacing neutral; do not over-track labels.
- Long clinical/case text should be readable, with comfortable line height and constrained width.
- Mobile screens should prioritize legibility and avoid tiny paragraphs below 12px.
- Body copy must stay dark enough for comfortable reading. Use `Primary Text` for high-emphasis copy and the darker `Muted Gray` token only for secondary text; do not use pale gray for paragraphs or instructional copy.

## 4. Component Stylings

**Buttons**

- Primary buttons: dark slate background, white uppercase label, 3-4px radius, no heavy shadow. Use for `GET STARTED`, `VIEW CASE STUDY`, `SAVE`, `NEXT`, `SUBMIT`, `DOWNLOAD CERTIFICATE`, and final workflow actions.
- Secondary buttons: white background, slate text, thin border. Use for `LOG IN`, `PREVIOUS`, `CANCEL`, and alternate choices.
- Disabled buttons: pale gray background or reduced opacity, muted text, no shadow.
- Mobile primary actions often sit full-width or near full-width at the bottom of the screen.
- Danger/destructive actions should use red text or border first; reserve filled red for irreversible actions.

**Navigation**

- Public desktop nav: logo left, center/right text links, active underline, login and primary CTA on the right.
- Logged-in desktop nav: logo left, main sections such as Dashboard and Case Studies centered, profile menu right.
- Mobile nav: compact top bar with page title/back affordance; avoid large desktop nav on narrow screens.
- Tabs: thin underline active state, muted inactive labels, no pill-heavy treatment.

**Cards**

- Cards are white with thin gray borders and minimal radius.
- Case cards include icon/title, metadata, count chips, and a clear action.
- Response cards use a circular avatar, bold name, and muted submission date.
- Certificate cards use framed certificate previews with dark slate borders.
- Avoid nested decorative cards; product content should feel flat and structured.

**Forms and Inputs**

- Inputs use white or very pale fill, thin gray border, compact labels, and muted placeholders.
- Form pages are centered on desktop and narrow on mobile.
- Multi-step signup and case creation forms use clear section titles, simple fields, and a primary action at the end.
- Validation should appear inline under the field in red, with the field border changed to red.
- Dropdowns, date pickers, and filter panels should open as white surfaces over a dim slate overlay when modal.

**Modals and Overlays**

- Use a dark slate translucent scrim.
- Modal panels are white, centered, rectangular, and minimally rounded.
- Keep modal copy short, with one primary action and one dismiss/cancel action.
- Certificate preview modals can be larger and more visual, but still use the same restrained shell.

**Status and Feedback**

- Success states use a centered mint check icon, short confirmation text, and a dark primary action.
- Empty/loading states are sparse: centered logo, loader, or small icon with minimal copy.
- Feedback/CME selection states use mint fills or outlines to indicate selected answers.
- Rating feedback can use small stars or compact choice rows, but should stay low-contrast until selected.

**Onboarding**

- Mobile onboarding uses a phone-sized white panel, small logo/illustration screenshot, descriptive copy, pagination dots, and bottom `NEXT` / `PREVIOUS` controls.
- Keep onboarding slides consistent; only the illustration/content should change.

## 5. Layout Principles

The layout system uses an 8px spacing base with generous whitespace on desktop and tighter but still breathable spacing on mobile.

| Token     | Value | Use                                       |
| --------- | ----: | ----------------------------------------- |
| `space-1` |   4px | Micro gaps, icon/text spacing             |
| `space-2` |   8px | Field internals, chip padding             |
| `space-3` |  12px | Compact card padding, mobile gaps         |
| `space-4` |  16px | Form spacing, card inner padding          |
| `space-5` |  24px | Section gaps, card grid gaps              |
| `space-6` |  32px | Desktop panel padding                     |
| `space-7` |  48px | Major section separation                  |
| `space-8` |  72px | Landing hero and large desktop whitespace |

Desktop principles:

- Use a centered max-width content area, usually 1100-1280px.
- Landing pages use a two-column hero: copy and CTA on the left, medical photo collage on the right.
- Dashboard pages use full-width top nav, then a centered content panel/grid below.
- Case creation and signup pages use wide forms with generous side margins and a fixed action area near the bottom.
- Long case-reading screens should constrain text width and keep actions easy to find.

Mobile principles:

- Use a narrow single-column canvas with a phone-like content width in prototypes.
- Stack all content vertically.
- Keep the primary action at the bottom, often full-width.
- Use card lists rather than multi-column grids.
- Preserve readable case content with adequate paragraph spacing.

## 6. Depth & Elevation

The system is intentionally flat. Depth comes from layering, borders, and background contrast more than pronounced shadows.

| Level             | Treatment                                                    | Usage                                                      |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Level 0 - Canvas  | `#F8FAFB` or white                                           | Page background                                            |
| Level 1 - Surface | White fill + `#E5EBEF` border                                | Cards, forms, panels                                       |
| Level 2 - Raised  | White fill + soft shadow `0 8px 24px rgba(47, 64, 80, 0.06)` | Dropdowns, profile menus, floating filters                 |
| Level 3 - Modal   | White panel + overlay `rgba(47, 64, 80, 0.72)`               | Dialogs, confirmations, date pickers, certificate previews |
| Level 4 - Focus   | 1px teal or slate outline                                    | Active inputs, focused controls                            |

Avoid heavy shadows. If a component needs separation, first use spacing and a border; add shadow only for overlays or transient floating elements.

## 7. Do's and Don'ts

**Do**

- use images in the `public/images` directory. Move component-used assets there before referencing them. Do not use generate AI generated images.
- Use dark slate for primary actions and active states.
- Keep teal/mint accents sparse and meaningful.
- Build screens from white panels, thin borders, and clear typography.
- Use real clinical imagery on marketing pages, preferably rounded only slightly. Do not add decorative white backgrounds or white borders around marketing images; let image assets sit directly on the section canvas unless the image is part of a true card or certificate preview.
- Keep workflows linear with clear next/previous actions.
- Use centered success states with a mint check icon.
- Keep student case-reading and CME flows calm and readable.
- Use modal scrims consistently for filters, previews, pickers, and confirmations.
- Make mobile screens single-purpose and action-led.

**Don't**

- Do not introduce bright medical-blue gradients or colorful dashboard chrome.
- Do not use large rounded cards, heavy shadows, or decorative background blobs.
- Do not turn every count, chip, or tab into a filled pill.
- Do not crowd forms with too many columns on mobile.
- Do not hide the primary action in long clinical text screens.
- Do not mix several button colors on the same screen.
- Do not use dense table layouts where the XD design uses cards/lists.
- Do not make splash/loading states verbose.
- Do not use marketing-style hero compositions inside operational dashboard pages.

## 8. Responsive Behavior

Breakpoints:

| Breakpoint   |         Width | Behavior                                                        |
| ------------ | ------------: | --------------------------------------------------------------- |
| Mobile       |     `< 640px` | Single column, compact nav, full-width actions, card lists      |
| Tablet       |  `640-1023px` | One or two columns depending on content, reduced hero imagery   |
| Desktop      | `1024-1439px` | Full nav, centered content, two-column hero, multi-card grids   |
| Wide Desktop |   `>= 1440px` | Increase margins/whitespace, keep content max-width constrained |

Responsive rules:

- Touch targets should be at least 44px high.
- Primary mobile actions should be full-width or fixed to the lower content area.
- Card grids collapse from 3 columns to 2 columns to 1 column.
- Form groups collapse to one column on mobile.
- Desktop top navigation becomes a compact menu or simplified header on mobile.
- Large certificate previews scale down while preserving aspect ratio.
- Modal dialogs should use nearly full-width sheets on mobile with internal scrolling where needed.
- Case text screens should avoid horizontal scrolling; keep text width readable and actions below content.

## 9. Agent Prompt Guide

Quick color reference:

- Primary text: `#223244`
- Primary action: `#2F4358`
- Brand teal: `#159A9C`
- Success mint: `#40DDB5`
- Background canvas: `#F8FAFB`
- Surface: `#FFFFFF`
- Border: `#E5EBEF`
- Muted text: `#4B5A67`
- Error: `#D85B5B`
- Overlay: `rgba(47, 64, 80, 0.72)`
