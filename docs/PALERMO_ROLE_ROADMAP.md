# Palermo role and animation roadmap

Palermo supports 4–20 active players. A role is not enabled in the deck until
its action, reconnect behavior, departure replacement, private HUD, resolution
order, sound, 3D animation, and automated branch recording all exist.

## Core deck (enabled)

| Players | Mafia | Town powers | Discussion | Vote |
| --- | ---: | --- | ---: | ---: |
| 4–6 | 1 | Detective; Doctor from 5 | 60s | 30s |
| 7–10 | 2 | Detective, Doctor | 68–92s | 30–34s |
| 11–14 | 3 | Detective, Doctor | 100–124s | 36–42s |
| 15–18 | 4 | Detective, Doctor | 132–150s | 44–50s |
| 19–20 | 5 | Detective, Doctor | 150s | 52–54s |

Multiple Mafia submit independently. A unique plurality selects the target; a
tie means no Mafia attack. Teammate names are private Mafia intel.

## Expansion roles

Introduce one at a time behind a host-selectable “Expanded roles” ruleset.

1. **Don (Mafia)** — resolves a tied Mafia choice. Visual: cane signal in the
   alley before the assassin route begins.
2. **Bodyguard (Town)** — intercepts one attack and is eliminated instead.
   Visual: doorway sprint, shield impact, then the guard falls.
3. **Mayor (Town)** — may reveal once; votes count twice after revealing.
   Visual: balcony spotlight and a gold ballot seal on later votes.
4. **Vigilante (Town)** — one shot per game. A wrong civilian shot also removes
   the Vigilante. Visual: separate blue rooftop trace, never reused from Mafia.
5. **Maniac (Independent)** — one private kill and a separate win condition.
   Visual: purple backstreet route and distinct crime-scene treatment so two
   attacks remain readable.
6. **Role blocker (Town or Independent variant)** — prevents one night action.
   Visual: target door chains shut before action resolution.

## Night resolution order

Role block → protection/interception → Mafia plurality/Don tie-break →
Vigilante → Maniac → Detective result → deaths and win checks.

Each action is an immutable, player-authenticated choice for one round and one
phase. Replayed offline actions replace that player’s prior choice, never add a
second action. A departed role is either privately reassigned by the recovery
engine or retired before resolution.

## Large-crowd rendering budget

- Up to 10 residents: one doorway per resident.
- 11–20 residents: two offset residents per home; no shared coordinates.
- Above 12 residents: render at device pixel ratio 1 and disable dynamic
  shadows while retaining character animation and cinematic effects.
- Character travel uses continuous route interpolation and phase timestamps;
  recordings must not use fixed sleeps to advance phases.
