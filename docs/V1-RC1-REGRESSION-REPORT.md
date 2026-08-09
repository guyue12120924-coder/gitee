# v1.0.0-rc.1 Regression Report

Date: 2026-08-09

## Scope

This report freezes the current v1 release candidate after the Creator Studio, performance cleanup and mobile-specific polish passes.

## Code-level regression completed

- Four workflow routing remains centralized through the original compatibility selector and task-specific model selectors.
- Registry / Adapter / Runtime dependency order is explicit in `index.html`.
- Legacy patch files remain deleted and are rejected by the static audit if reintroduced.
- Accepted / non-retryable video responses stop compatibility retry loops.
- Task attribution differentiates I2V and T2V using request payload / endpoint evidence.
- Task tracker ignores updates after a terminal state.
- History merges IndexedDB and localStorage fallback records and removes duplicates.
- Hidden History does not continuously rebuild its DOM.
- Model menus are built lazily when opened.
- Gallery and workflow observers are limited to top-level output child changes.
- Mobile polish is event-driven and does not add MutationObserver loops.
- API proxy uses an explicit upstream header allowlist and validates path segments.
- Download proxy validates HTTPS targets and redirects and blocks private-network targets.
- Generated media uses lazy image decoding / metadata-only video preload.
- API Key is masked in static HTML before enhancement JavaScript runs.

## Mobile release-candidate coverage in code

- `viewport-fit=cover`
- `interactive-widget=resizes-content`
- `VisualViewport` keyboard metrics
- safe-area padding
- parameter Bottom Sheet mask / close behavior
- full-width mobile Drawers
- compact mobile model menu
- one-column Gallery
- Lightbox safe-area actions
- 430px narrow-layout overrides
- iOS input font-size protection against automatic zoom

## Manual regression still required before v1.0.0

### Desktop

- 1366×768
- 1536×864
- 1920×1080

Check four workflows, model menu, upload cards, Prompt Tools, Focus/Gallery, Lightbox, Task, History and Settings.

### Mobile / tablet

- 390×844
- 430×932
- 768×1024

Check workflow navigation, Prompt + soft keyboard, Generate reachability, parameter Bottom Sheet, model menu, upload cards, Drawers, Gallery and Lightbox.

### Live Gitee API

Use the user's own API credential and smallest practical requests:

1. one verified text-to-image request;
2. one image-edit request;
3. one short Wan2.2 I2V request;
4. one short Hunyuan T2V request;
5. History refresh and re-use after at least one completed task.

The repository/CI must not contain or store the user's API credential.

## Promotion rule

Promote `1.0.0-rc.1` to `1.0.0` only after the manual desktop/mobile regression above succeeds and no release-blocking API regression is found.
