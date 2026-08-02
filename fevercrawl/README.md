# Fevercrawl

A browser RPG that hallucinates its own graphics, UI, enemies and abilities.

You went under the abbey with a fever already in you. Some of what you fight is not
there. Some of what your action bar says you can do, you cannot do. The health bar
lies to you, the minimap invents rooms, and the combat log congratulates you for
things that never happened.

**Play:** open `index.html`. No build step, no dependencies, one file.

---

## The mechanic

Everything hangs off one stat: **lucidity** (100 → 0). It bleeds constantly, faster
the deeper you go and every time something real hits you. As it falls, the game
starts lying in escalating layers:

| Lucidity | What starts lying |
|---|---|
| ~85 | walls breathe, colours shift, chromatic fringing |
| ~75 | **phantom enemies** spawn — they chase you, hit you, have health bars |
| ~70 | **fake abilities** appear in empty action-bar slots, with tooltips |
| ~60 | fake status effects, hallucinated loot on the floor, invented combat-log lines |
| ~50 | whispers across the screen, minimap grows rooms that don't exist |
| ~45 | your **real** abilities get disguised under fake names and icons |
| ~35 | the HP number drifts; the lucidity meter itself misreports |
| 0 | **collapse** — real damage ×1.6 and nothing on screen can be trusted |

## Focus — the counter-mechanic

Hold **SHIFT**. The world desaturates and tells the truth for as long as your
composure holds: phantoms go translucent and ring themselves `NOT THERE`, fake
action-bar slots scratch out to `NOT REAL`, imagined wounds drain off your health
bar, hallucinated loot is exposed, and the numbers show their real values.

You move at 45% speed and cannot attack while focusing. Composure runs out in about
three seconds. So the question the whole game asks is: *do you spend the time to
check, with three real things also swinging at you?*

The permanent tell, if you don't want to spend composure: **phantoms cast no shadow.**

## Consequences

- **Kill a phantom** — it dissolves into nothing. −8 lucidity. You just fought air,
  and the fever noticed.
- **Ignore a phantom** that came at you until it fades — +4.5 lucidity. Resisting
  is how you come back.
- **Cast a fake ability** — it costs breath, fizzles, −5 lucidity, and one time in
  six your own hand comes back at you. Sometimes it summons something.
- **Take a real hit** — −1.9 lucidity. The Bellows is worse: its breath spawns two
  phantoms on the spot.

Restore lucidity at wall sconces (kneel with **E**), with clarity tonics, or by
killing things that are actually there.

## Classes

- **Ashen Knight** — heavy melee, slowest lucidity drain. Cleave / Bulwark / Emberstep,
  then *Iron Verdict* at depth 3.
- **Salt Witch** — fragile ranged. Saltbolt / Hexring / Blink, then *Truthfire*, which
  annihilates phantoms outright at no cost to your mind.
- **Fen Herbalist** — poison and clarity. Spore Burst / Root / Clarity Draught, then
  *Lucid Bloom*.

Trinkets: **Mirror Shard** (phantoms shimmer even unfocused), **Leaden Ring** (−28%
lucidity drain), **Bitter Coin** (composure regenerates twice as fast).

## Six floors

The Undercroft → The Bone Ledger → The Weeping Stacks → The Choir Pit →
The Long Kitchen → **The Fevermother**, who periodically becomes several. Only one
of her has a shadow, and damaging the copies heals the real one.

## Controls

| | |
|---|---|
| **WASD** | move |
| **Mouse** | aim · **Click** basic attack |
| **1–6** | abilities |
| **SHIFT** (hold) | focus — see the truth |
| **SPACE** | dodge (i-frames) |
| **E** | descend stairs / kneel at sconce |
| **ESC** | pause |

## Technical

Single `index.html`, ~1500 lines, zero dependencies. Canvas 2D for the world with a
post-process pass (chromatic aberration, scanlines, tearing, difference-blend
flicker, vignette) driven by hallucination level; DOM for the HUD so the action bar
and health bars can be lied to with CSS. Procedural dungeon generation, procedural
sprites, WebAudio synth for all sound including a drone that detunes as you lose
your grip.

The lie system is one director (`directorUpdate`) that scales every falsehood off a
single `hallucination()` value, and one `truth()` value from Focus that subtracts
from it. Every renderer and HUD element consults both.
