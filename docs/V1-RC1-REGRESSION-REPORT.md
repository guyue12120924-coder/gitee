# v1.0.0-rc.1 Regression Report

Date: 2026-08-09

## Scope

This report freezes the current v1 release candidate after the Creator Studio, performance cleanup and mobile-specific polish passes.

Release-candidate branch: `release/v1.0.0-rc.1`

RC metadata commit: `f74a1fa64cb0d434ccb8168294db1f14b7795e9e`

Runtime / UI freeze commit: `ede63f66f9d31ca06dde7bb4d90f390afc73da53`

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
- Release metadata is protected by static checks so `VERSION`, README and CHANGELOG cannot silently drift.

## User-validated behavior during the iterative desktop pass

During the Creator Studio refinement, the deployed desktop workflow was exercised after the workflow-isolation, Inspector, Composer, upload, duration and gallery changes, and no blocking issue was reported at that point. The later runtime/UI freeze did not add another model/API generation path.

This is useful regression evidence, but it is not a substitute for the explicit final viewport matrix below.

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

## External validation still required before v1.0.0

These checks depend on a real browser/device viewport or on the user's Gitee API credential. They cannot be truthfully marked as executed by repository/static inspection alone.

### Desktop viewport matrix

- 1366×768
- 1536×864
- 1920×1080

Check four workflows, model menu, upload cards, Prompt Tools, Focus/Gallery, Lightbox, Task, History and Settings.

### Mobile / tablet viewport matrix

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

## Release decision

`1.0.0-rc.1` is the completed repository-side release candidate. The dedicated rollback branch is `release/v1.0.0-rc.1`.

Do not relabel it as `1.0.0` until the browser/device and credential-dependent checks above are confirmed. This keeps the published version claim aligned with the actual validation evidence.
