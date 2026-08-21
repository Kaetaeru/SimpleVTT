# Prototype App Boundary

Status: **Final-Spec replacement review candidate created**

This directory contains non-production SimpleVTT UI Reference Prototype artifacts.

## Active review entry

Open:

```text
final-spec.html
```

Active files:

```text
final-spec.html              # active Final-Spec review entry / prototype-only UI Lab
final-spec.css               # core final-spec visual system
final-spec-coverage.css      # extended final-spec review states/layers
final-spec.js                # mock Character/Play interactions
final-spec-fixtures.js       # explicit synthetic roll/target/session fixtures
final-spec-stability.js      # same-mounted-Sheet roll + hover/focus + Product Shell completion
final-spec-coverage.js       # First Run/Builder/Level Up/import/interrupt/full-sheet/resize coverage
```

The active demo implements `../OWNER-CORRECTIONS.md`, including:

- every Offline/Standalone roll stays inside the currently mounted Character Sheet;
- ordinary Standalone roll does not remount/navigate the Sheet just to show dice;
- Connected Play preserves upper opposing Actor Board -> central Scene -> lower allied Actor Board -> persistent Command Center;
- Initiative overlays Scene top edge without replacing Actor Boards;
- Connected dice use the central Scene/Table and results remain scene-integrated.

The extended Final-Spec layer also includes reference states for First Run, Builder, Level Up, Content Import, Main Hand unavailable, Reaction/Interrupt, Concentration response, Quick Sheet, Full Sheet, reconnect, utility resize and destructive confirmation.

## Historical rejected candidate

The following files are retained for traceability only:

```text
index.html
prototype.css
prototype.js
fixtures.js
review-patch.css
review-patch.js
```

Status: **REJECTED / SUPERSEDED FOR REVIEW**

Do not use them as the intended product UI or as runtime implementation reference.

## Hard rules

- do not import production `src/` UI;
- do not call real backend/network/storage;
- do not implement D&D/rules authority;
- do not treat fixtures as production schemas;
- keep prototype controls visibly separate from intended product UI;
- no runtime SimpleVTT implementation belongs here.

Static replacement verification is recorded in `../FINAL-SPEC-VERIFICATION.md`.

Prototype acceptance remains pending in `../PROTOTYPE-ACCEPTANCE.md`.
