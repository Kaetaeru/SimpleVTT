# Prototype App Boundary

Status: **Standalone review candidate created**

This directory contains the SimpleVTT UI Reference Prototype. It is a design/review artifact, not production runtime code.

Current files:

```text
index.html          # review entry / Prototype Controls shell
prototype.css       # main reference visual system
prototype.js        # mock interaction/surface renderer
fixtures.js         # synthetic scenario/data fixtures
review-patch.css    # review-only fixes layered after main CSS
review-patch.js     # direct Surface navigation + standalone-roll review helpers
```

Open `index.html` in a browser with the files kept together in this directory.

Hard rules:

- do not import production `src/` UI;
- do not call real backend/network/storage;
- do not implement D&D/rules authority;
- do not treat fixtures as production schemas;
- keep Prototype Controls visibly separate from intended product UI;
- no runtime SimpleVTT implementation belongs here.

The current candidate is waiting for browser/owner visual and interaction review. Static verification is recorded in `../BUILD-VERIFICATION.md`.

Prototype acceptance is separate and remains pending in `../PROTOTYPE-ACCEPTANCE.md`.