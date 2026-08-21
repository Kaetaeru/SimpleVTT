# SimpleVTT UI Contract QA Acceptance Matrix

Status: **Runtime-preparation and runtime-QA checklist derived from accepted UI contracts**

이 문서는 화면이 "비슷하게 생겼다"는 것만으로 통과시키지 않기 위한 검증표다.

각 runtime slice는 자신이 건드린 행을 반드시 검증한다.

범례:

```text
PASS       = contract와 일치
FAIL       = material implementation drift
BLOCKED    = 필요한 Domain/Architecture contract가 아직 없음
N/A        = 해당 slice에 적용되지 않음
```

---

# 1. Fail-fast product identity

| ID | Requirement | PASS evidence | Automatic FAIL | Authority |
| --- | --- | --- | --- | --- |
| QA-ID-01 | Core is mapless | No Core battlemap/token/grid in touched UI | Actor x/y/tactical map introduced | `docs/design/README.md`, `movement-modules.md` |
| QA-ID-02 | Actor is not map token | ActorCard/ActorBoard primary representation | draggable token becomes Core primary Actor UI | Surface/Component contract |
| QA-ID-03 | Handout is presentation | image modes only | token/grid/targeting on Handout | accepted prototype/contracts |
| QA-ID-04 | Tutorial first | fresh state -> Tutorial | fresh state -> Home directly | Product Decision/contracts |
| QA-ID-05 | Same Character across Sheet layouts | presentation only switches | separate Official/SVTT Character models | Character/Surface contract |
| QA-ID-06 | No hidden tactical scaffolding | no unused Core coordinate/token architecture added "for later" | hidden map state introduced without module scope | movement policy |

Any FAIL in this section blocks merge/release for broad UI work.

---

# 2. First-run / Product Shell

| ID | Requirement | PASS evidence | FAIL example |
| --- | --- | --- | --- |
| QA-NAV-01 | Tutorial is first meaningful fresh-use panel | deterministic fresh-use test / visual | Home card substitutes tutorial |
| QA-NAV-02 | Tutorial contains Sheet choice | Official-style + SimpleVTT + change-later copy | choice deferred/omitted |
| QA-NAV-03 | Tutorial covers Standalone/Host/Join orientation | all three visible/explained | only Character explained |
| QA-NAV-04 | Tutorial can reopen later | Settings/Help path | first-run-only inaccessible content |
| QA-NAV-05 | Global nav order | Home / Characters / Session / Content / Rules / Settings | permanent Play nav peer or left sidebar primary IA |
| QA-NAV-06 | Live Return to Play preserves context | return to exact session/role | Host becomes Player / new session created |

---

# 3. Character / Standalone

| ID | Requirement | PASS evidence | FAIL example | Authority |
| --- | --- | --- | --- | --- |
| QA-CHAR-01 | CharacterCard opens exact Character | ID/revision matches clicked Character | opens last/default Character | Character lifecycle |
| QA-CHAR-02 | Sheet layout is presentation | values/state same across layouts | layout change mutates rules data | Surface contract |
| QA-CHAR-03 | Standalone roll stays on Sheet | Sheet remains mounted during animation | Dice route/modal/window | accepted prototype/contracts |
| QA-CHAR-04 | Roll result is not physics-derived | supplied/local authoritative result drives face/total | random CSS/physics decides outcome | rules authority |
| QA-CHAR-05 | Reduced Motion preserves result/order | same state, less movement | result disappears/changes | Interaction contract |
| QA-CHAR-06 | Create/Edit uses canonical flow | actual dynamic plan/validation source | UI-owned invented rules wizard | Character contracts |
| QA-CHAR-07 | Level Up uses canonical progression | preview/choice/validation/commit | UI applies level math itself | Character contracts |

---

# 4. Session lifecycle and role

| ID | Requirement | PASS evidence | FAIL example |
| --- | --- | --- | --- |
| QA-SES-01 | Host flow distinct | Host setup exists independently | combined ambiguous Host/Join funnel |
| QA-SES-02 | Join flow distinct | Join + Character select | Join skips Character contract |
| QA-SES-03 | Host=DM | connected host shows DM role only | Host/Player combination |
| QA-SES-04 | Client=Player | connected client shows Player role only | Client/DM combination |
| QA-SES-05 | Host Open -> live Freeform | no Ready/Start gate | Lobby/Preparing reintroduced |
| QA-SES-06 | Zero Players valid for Host | DM Play usable alone | Session blocked until Player ready |
| QA-SES-07 | Join enters current live mode | if host in Initiative, client sees current Initiative | client forced through new Freeform |
| QA-SES-08 | No Character blocks Join | Create/Import recovery | anonymous/spectator auto-join |
| QA-SES-09 | Product nav preserves role/session | Return to Play restores exact connected context | role/mode reset |
| QA-SES-10 | Reconnect does not create Ready loop | prior context preserved + recovery | reconnect sends to Lobby |

---

# 5. Connected Play composition

| ID | Required stable region | PASS | FAIL |
| --- | --- | --- | --- |
| QA-PLAY-01 | Play chrome/status | visible compact session context | giant debug/protocol header |
| QA-PLAY-02 | Upper Actor Board | NPC/Neutral/Hostile cards | opposing Actors only as central tokens |
| QA-PLAY-03 | Central Play Context | context/dice/result/Handout, non-tactical | grid/terrain/token layout |
| QA-PLAY-04 | Lower Actor Board | Player/Allied cards | permanent left portrait rail replacing board |
| QA-PLAY-05 | Persistent Command Center | remains through key states | disappears on targeting/resolution |
| QA-PLAY-06 | DM/Player share skeleton | role controls differ, structure same | two unrelated workspace architectures |

---

# 6. Freeform / Initiative

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-MODE-01 | Freeform no turn order | no fake current turn | arbitrary current-turn highlight |
| QA-MODE-02 | Freeform no fake turn economy | no spent Action/Bonus/Movement ledger | Initiative economy shown as active |
| QA-MODE-03 | Capabilities remain discoverable in Freeform | Command Center/Hotbar remains | hidden behind intent funnel |
| QA-MODE-04 | Initiative extends same Play | compact tracker/economy added | separate combat route |
| QA-MODE-05 | Actor Boards remain Initiative | same boards visible | initiative list replaces them |
| QA-MODE-06 | End Turn only where meaningful | shown according to authoritative state | global End Turn in Freeform |

---

# 7. Actor state semantics

For a representative ActorCard verify independent presentation of:

```text
controlled
currentTurn
selected
contextFocus
targetValid
targetInvalid
targetSelected
```

| ID | Requirement | FAIL condition |
| --- | --- | --- |
| QA-ACTOR-01 | States independently representable | one generic highlight used for all |
| QA-ACTOR-02 | Relation not color-only | only red/blue with no redundant cue |
| QA-ACTOR-03 | Invalid Actor remains visible | removed from board while targeting |
| QA-ACTOR-04 | Invalid reason comes from projection | UI invents range/LoS reason |
| QA-ACTOR-05 | Many Actors preserve card minimum | cards collapse to unreadable dots |
| QA-ACTOR-06 | Board overflow supported | layout overlaps/overcompresses |
| QA-ACTOR-07 | DM control updates actual Actor context | default Player Character remains in Command Center |

---

# 8. Actor click precedence

Required order:

```text
1 selected-action targeting
2 explicit DM control mode
3 ordinary context selection
4 default hostile Main Hand path
```

| ID | Test | PASS | FAIL |
| --- | --- | --- | --- |
| QA-CLICK-01 | action selected + Actor click | targeting occurs | control/default attack fires |
| QA-CLICK-02 | DM control mode + hostile click | control/context occurs | default attack fires first |
| QA-CLICK-03 | ordinary click | inspection/selection as designed | target state invented |
| QA-CLICK-04 | default hostile path | only canonical Main Hand relation | first available capability used |

---

# 9. Targeting

| ID | Requirement | PASS | FAIL | Blocker |
| --- | --- | --- | --- | --- |
| QA-TGT-01 | eligibility supplied | UI consumes projection | UI calculates distance/LoS | Domain |
| QA-TGT-02 | single valid target immediate submit | no routine confirmation | confirm modal every attack | — |
| QA-TGT-03 | multi target explicit Execute | set retained until Execute | first click auto-submits | — |
| QA-TGT-04 | area-like manual set | Actor list/checklist | AoE map template | mapless guard |
| QA-TGT-05 | Main Hand no fallback | unavailable reason and stop | weapon/spell fallback | `GAP-MAIN-HAND-CANONICAL-RELATION` for exact runtime relation |

---

# 10. Resolution / response / dice

| ID | Requirement | PASS | FAIL | Blocker |
| --- | --- | --- | --- | --- |
| QA-RES-01 | Play anchors remain | boards/context/Command Center recognizable | full-screen resolution page | — |
| QA-RES-02 | selective locking | only supplied conflicts locked | entire HUD disabled | `GAP-RESOLUTION-SAFE-INTERACTIONS` |
| QA-RES-03 | UI does not derive conflict set | consumes explicit projection | component contains safety rules | same Gap |
| QA-RES-04 | Reaction in context | focused response + surrounding orientation | unrelated full-screen route | Domain timing |
| QA-RES-05 | Concentration values supplied | authoritative DC/modifier/result | UI calculates them | Rules Domain |
| QA-RES-06 | Connected dice presentation-only | authoritative value fixed | physics decides value | Rules/authority |
| QA-RES-07 | Immediate result in context | compact result + Activity path | dedicated Result destination | — |

Rows QA-RES-02/03 remain `BLOCKED` for production semantics until their Gap resolves.

---

# 11. Command Center

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-CMD-01 | controlled Actor summary | actual current controlled Actor | hardcoded Rowan/default PC |
| QA-CMD-02 | capabilities directly discoverable | Hotbar visible | intent-first funnel required first |
| QA-CMD-03 | page family | Mixed/Action/Spell/Item/custom concept | arbitrary incompatible taxonomy |
| QA-CMD-04 | resources authoritative | Actor-specific projection | copied fixture/other Actor resource |
| QA-CMD-05 | skeleton stable | targeting/resolution preserve structure | spinner replaces whole center |
| QA-CMD-06 | unavailable reason discoverable | hover/focus or explicit cue | disabled without explanation where recovery matters |

---

# 12. Utility / layers

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-LAYER-01 | Activity contextual | pane/layer coexists with Play | global Activity destination replacing Play |
| QA-LAYER-02 | Encounter contextual | DM utility | separate permanent workspace replacing core skeleton |
| QA-LAYER-03 | Participants contextual | DM session utility | lobby model reintroduced |
| QA-LAYER-04 | Quick Sheet preserves Play | lightweight overlay/pane | navigates away and loses context |
| QA-LAYER-05 | Full Sheet preserves Session | large layer, same live state | opens separate disconnected app |
| QA-LAYER-06 | Context menu supplementary | inspect/context commands | Attack/Spell/Item duplicates Hotbar |
| QA-LAYER-07 | confirmation used selectively | destructive/necessary only | ordinary target requires modal |

---

# 13. Privacy / Activity

| ID | Requirement | PASS | FAIL | Blocker |
| --- | --- | --- | --- | --- |
| QA-PRIV-01 | DM private item explicit to DM | DM Only label/state | ambiguous private/public | Architecture |
| QA-PRIV-02 | Player gets no private placeholder | absent from projection/DOM | `[Hidden event]` row | `GAP-DM-ONLY-DELIVERY-PROTOCOL` |
| QA-PRIV-03 | CSS hiding not treated as privacy | server/projection boundary | delivered then hidden | same Gap |
| QA-PRIV-04 | later disclosure no reroll | authorized projection of prior outcome | new random outcome | same Gap/domain |
| QA-PRIV-05 | correction preserves history | linked new event | silent overwrite/delete | session runtime |

Production DM-only UI is `BLOCKED` until delivery protocol is explicit.

---

# 14. Handout

| ID | Requirement | PASS | FAIL | Blocker |
| --- | --- | --- | --- | --- |
| QA-HAND-01 | Overlay presentation | image over Play | map/token layer | `GAP-HANDOUT-NETWORK-CONTRACT` for shared runtime |
| QA-HAND-02 | Player local dismiss distinct | only local presentation changes | shared state withdrawn | same Gap |
| QA-HAND-03 | Upper/Full DM shared mode | presentation semantics clear | treated as route/map | same Gap |
| QA-HAND-04 | local zoom/pan only | visual transform | rules distance/target derived from image coordinates | mapless guard |
| QA-HAND-05 | reconnect projection authoritative | exact shared/local state restored by contract | UI guesses prior state | same Gap |

---

# 15. Spatial facts

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-SPAT-01 | coordinate-independent facts | Actor pair + distance/visibility/cover | x/y input |
| QA-SPAT-02 | advanced contextual utility | form/list pane | routine map toolbar |
| QA-SPAT-03 | missing fact not guessed | explicit unavailable/rejection/recovery | derive from card position |
| QA-SPAT-04 | provenance retained where available | source displayed/inspectable | UI fabricates source |

---

# 16. Content / Rules

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-CONT-01 | declarative content lifecycle truthful | valid/warn/block/unsupported | UI silently accepts unsupported |
| QA-CONT-02 | live snapshot stable | local update does not mutate live Session | hot-swap live state |
| QA-RULE-01 | Rules UI renders authoritative composed content | content source projection | hardcoded UI rule logic |
| QA-RULE-02 | UI does not calculate named mechanic | domain resolves | React checks specific spell/feat rules |

---

# 17. Connection / recovery

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-CONN-01 | reconnecting preserves orientation | prior context remains | blank/reset Play |
| QA-CONN-02 | no fake reconnect success | status follows transport | optimistic success invented |
| QA-CONN-03 | disconnected recovery explicit | rejoin/leave path as supported | hidden failure |
| QA-CONN-04 | incompatible state blocks safely | explicit blocker/recovery | continue with guessed compatibility |

---

# 18. Accessibility / responsive

| ID | Requirement | PASS | FAIL |
| --- | --- | --- | --- |
| QA-A11Y-01 | visible focus | keyboard path obvious | focus outline removed |
| QA-A11Y-02 | hover info has focus alternative | keyboard detail available | pointer-only essential reason |
| QA-A11Y-03 | state not color-only | redundant labels/icons/shapes | red/green only |
| QA-A11Y-04 | Reduced Motion | same info/order | functionality/result differs |
| QA-RWD-01 | Narrow desktop keeps Command Center | reachable/usable | hidden behind collapsed mobile nav |
| QA-RWD-02 | Actor cards overflow | min width retained | unreadably compressed |
| QA-RWD-03 | central context remains nonzero | interaction space remains | removed/replaced by mini-map |

---

# 19. Production-data boundary

Search touched runtime code for these anti-patterns.

## Forbidden example logic

```text
if distance <= weaponRange -> valid target
if pendingResolution -> disableAll
if mainHandUnavailable -> chooseNextAction
if event.dmOnly -> render hidden row
actor.x / actor.y used by Core Play UI
prototype fixture imported into src
```

If found in UI layer without explicit owning contract, fail or block the slice.

---

# 20. Runtime slice completion record

Every runtime UI Work Order should end with a table like:

| QA row | Status | Evidence | Notes |
| --- | --- | --- | --- |
| QA-NAV-01 | PASS | test/screenshot/path | — |
| QA-CHAR-03 | PASS | interaction test | — |
| QA-PRIV-02 | BLOCKED | GAP-DM-ONLY... | out of slice |

Do not mark `BLOCKED` as `PASS` by implementing a guess.

---

# 21. Final merge/release questions

For a broad UI slice, answer all:

```text
[ ] Does it still look and behave like the accepted SimpleVTT product?
[ ] Is Core still mapless?
[ ] Did any prototype-only fixture become production authority?
[ ] Did any UI component start calculating rules/network/privacy?
[ ] Did role/session continuity survive navigation?
[ ] Are all touched Behavior Scenarios covered?
[ ] Are all touched QA rows PASS or explicitly BLOCKED/N/A?
[ ] Are blocking Gaps still honestly blocked rather than guessed around?
[ ] Did implementation preserve accessibility and Reduced Motion semantics?
[ ] Did implementation preserve the accepted hierarchy even if exact pixels changed?
```

Broad UI QA is incomplete until these questions have evidence, not just visual similarity.
