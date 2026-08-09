# Changelog

All notable project changes are recorded here. The project follows Semantic Versioning after the v1 release line.

## [1.0.0-rc.1] - 2026-08-09

First v1 release candidate. This build freezes the current Creator Studio architecture for final browser/API regression before v1.0.0.

### Added

- Four creator workflows: Text-to-Image, Image Edit, Image-to-Video and Text-to-Video.
- Centralized model Registry and task-specific Adapter layer.
- Adapter-driven parameter UI with basic, advanced and developer disclosure levels.
- Creator Studio layout with workflow rail, Canvas, Inspector and Prompt Composer.
- Focus/Gallery result presentation, Lightbox actions and generated-image reuse for Edit / I2V.
- Task lifecycle center with request attempts, polling, errors and local stop controls.
- Persistent browser history with filtering, export and parameter reuse.
- Prompt templates, local prompt enhancement and limited multi-model image comparison.
- Responsive mobile creator UI with Bottom Sheet parameters, safe-area handling and soft-keyboard adaptation.
- System / light / dark appearance settings.
- Static release audit in GitHub Actions.

### Changed

- Model menus are created lazily on first open.
- Hidden History no longer rebuilds on every task update.
- Generated images use lazy decoding and videos preload metadata only.
- Canvas output is isolated by workflow instead of sharing one visual result state.
- Hunyuan video frames are represented as user-facing duration in the primary UI.
- Wan2.2 resolution presets are represented as ratio + quality controls in the primary UI.
- API/Adapter/debug information is moved behind progressive disclosure.

### Fixed

- Removed broad MutationObserver feedback loops that could make the page unresponsive.
- Compatibility retries stop after accepted or non-retryable responses to reduce duplicate video-task risk.
- I2V/T2V task attribution uses payload/endpoint evidence rather than model ID alone.
- Model health no longer treats user/auth/network/timeout errors as permanent model failures.
- IndexedDB and localStorage history fallback records are merged and deduplicated.
- API proxy forwards only an explicit header allowlist and validates upstream path segments.
- Download proxy blocks unsafe/private targets and validates redirects.

### Release status

- Code/static audit: release candidate prepared.
- Desktop creator flow: previously user-tested during iterative development.
- Mobile browser regression: must still be completed on at least 390×844, 430×932 and 768×1024 before promoting this build to v1.0.0.
- Live Gitee API smoke tests are not performed automatically by CI because they require a user API credential and can consume quota.

## Versioning

- `1.0.x`: bug fixes and compatibility fixes.
- `1.1.x`: backward-compatible features and new model adapters.
- `2.x`: major architecture or workflow changes.
