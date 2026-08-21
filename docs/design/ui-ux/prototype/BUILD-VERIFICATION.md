# UI Reference Prototype — First Candidate Build Verification (Historical)

Status: **SUPERSEDED — FIRST CANDIDATE REJECTED BY OWNER**

This file is retained only as verification history for the first prototype candidate based on:

```text
app/index.html
app/prototype.css
app/prototype.js
app/fixtures.js
app/review-patch.css
app/review-patch.js
```

That candidate is **not** the active product-reference demo and must not be used for runtime implementation.

The owner rejected it because it materially drifted from Reviewed intent:

1. Offline/Standalone dice presentation read as a detached roll surface instead of rolling inside the current Character Sheet.
2. Connected Play did not strictly preserve the reviewed upper Actor Board -> Scene -> lower Actor Board -> persistent Command Center topology.

The active replacement is:

```text
app/final-spec.html
```

Use:

- `OWNER-CORRECTIONS.md` for the controlling owner corrections;
- `FINAL-SPEC-VERIFICATION.md` for current static verification;
- `PROTOTYPE-ACCEPTANCE.md` for the current acceptance gate.

Historical first-candidate verification has no authority to restore its UI behavior.
