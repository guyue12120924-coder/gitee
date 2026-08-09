# Release node

Current release candidate: `1.0.0-rc.1`

Release-candidate branch:

```text
release/v1.0.0-rc.1
```

The branch was created from the completed RC metadata commit:

```text
f74a1fa64cb0d434ccb8168294db1f14b7795e9e
```

Runtime / UI freeze commit:

```text
ede63f66f9d31ca06dde7bb4d90f390afc73da53
```

All commits between the runtime/UI freeze and the RC branch point are documentation, version metadata, or static-audit changes; they do not change the model/API generation runtime.

## Automated release verification

The production `Static Check` workflow was executed through temporary non-merge pull requests so the GitHub runner could validate the actual repository tree without adding test-only files to `main`.

Final verification run `#100` completed successfully:

- `Run static audit`: `success`
- `Run responsive browser smoke`: `success`
- Desktop viewports: `1366×768`, `1536×864`, `1920×1080`
- Mobile/tablet viewports: `390×844`, `430×932`, `768×1024`
- Four workflow switching, upload-card presence, Wan/Hunyuan creator controls, Prompt/Generate reachability, Inspector Bottom Sheet, model-menu bounds, Focus/Gallery state, Lightbox and Drawers were exercised without page errors.

The temporary verification PR was closed without merging and its test branch was reset to the clean `main` tree.

This automated browser smoke does not emulate a physical phone soft keyboard/safe-area implementation and does not call Gitee generation APIs.

If an emergency rollback is needed before `v1.0.0`, use `release/v1.0.0-rc.1` for the complete release-candidate tree or the runtime/UI freeze commit above for the application-code freeze point.

No Git tag is created by the available repository connector in this release-preparation pass. Promotion to `v1.0.0` still requires the credential-dependent Gitee API smoke test and, for maximum confidence, a real-device soft-keyboard/safe-area check.
