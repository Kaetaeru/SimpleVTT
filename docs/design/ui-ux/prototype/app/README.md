# Prototype App Boundary

Status: **Reserved — HTML prototype not started**

This directory is reserved for the standalone SimpleVTT UI Reference Prototype.

Expected future files:

```text
index.html
prototype.css
prototype.js
fixtures.js
assets/   # only prototype-created or explicitly safe assets
```

Hard rules:

- do not import production `src/` UI;
- do not call real backend/network/storage;
- do not implement D&D/rules authority;
- do not treat fixtures as production schemas;
- keep Prototype Controls visibly separate from intended product UI;
- no runtime SimpleVTT implementation belongs here.

The prototype is intentionally not built yet. Build only after explicit owner authorization under `../PROTOTYPE-WORK-ORDER.md`.