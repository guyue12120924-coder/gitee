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

If an emergency rollback is needed before `v1.0.0`, use `release/v1.0.0-rc.1` for the complete release-candidate tree or the runtime/UI freeze commit above for the application-code freeze point.

No Git tag is created by the available repository connector in this release-preparation pass. Promotion to `v1.0.0` requires the manual browser/device and credential-dependent regression items in `docs/V1-RC1-REGRESSION-REPORT.md` and `docs/V1-RELEASE-CHECKLIST.md` to pass.
