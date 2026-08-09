# Release node

Current release candidate: `1.0.0-rc.1`

Runtime / UI freeze commit:

```text
ede63f66f9d31ca06dde7bb4d90f390afc73da53
```

All commits after that freeze in this release-preparation pass are documentation, version metadata, or static-audit changes; they do not change the model/API generation runtime.

No Git tag is created by this repository connector in this release-preparation pass. If an emergency rollback is needed before v1.0.0, the runtime freeze commit above is the known application-code rollback point.

Promotion to `v1.0.0` requires the manual regression items in `docs/V1-RC1-REGRESSION-REPORT.md` and `docs/V1-RELEASE-CHECKLIST.md` to pass.
