# Aiming the projector

The projector sits on a ball head inside the case. You reach it through the aim hatch without taking the lid off. No tools are needed.

> Nothing has been printed yet. These steps describe the current design; update them after the first fit check.

## Before you start

- Aim in dry weather. With the hatch open the case is not rain-shedding.
- Turn the projector on and play something with straight edges and corners (a grid or test pattern works best). Use the Matter switch in your Home app, or the Play button on the Pi's web page at `videofx-xxxx.local`.
- Know where the hatch is: it's the side wall with the small sloped rain hood. Standing behind the case, facing where it projects, it is on your right.

## Aim range

| Movement | Inside the case |
|---|---|
| Pan (left/right) only | +/-10 deg (beyond this the image clips the window frame; turn the case instead) |
| Tilt (up/down) only | +/-11 deg (the image starts clipping on the window or visor beyond this) |
| Pan and tilt together | +/-8 deg each |
| More upward tilt | Put the case on the two `tilt_riser`s (below): adds 10 deg, so up to about +21 deg |

These assume the Tkisko TO2's short throw (about 0.95:1, derived from its manual) with the image centred on the lens. Measure both (`throw_ratio`, `lens_offset`) and rerun the light-cone check: a shorter throw means a wider cone and less pan, and a projector that throws the image upward ("offset") trades downward tilt for upward.

Past that, the projector hits the window frame, the lid or the Pi divider. Get the case close first and use the ball head for fine adjustment.

## Tilting the case

The ball head can tilt further than the case lets it: past about +11 deg the image clips the top of the window and the visor, and the projector body reaches the lid. For a higher target, tilt the whole case instead. Print two `tilt_riser`s (the same part) and slide one under each front corner, lip against the front wall, so the outer two feet sit on its sloped top and the rear feet stay on the ground. That lifts the front about 52 mm and tilts the case back 10 deg (`riser_a`; reprint with a different angle if you need more or less).

- Put the risers on firm, level ground; the front stakes still go down through their tubes beside them.
- Water on the floor runs to the rear drains, through the divider pass-through into the Pi zone. The sled stands on pads, so it stays dry, but keep the rear drains and the gap under the rear of the case clear.
- A brick or a block of wood does the same job for now (that is how it was first aimed, 2026-10-30); keep it under the front feet only, so the gap under the floor stays open.

## Steps

1. **Place the case.**
   - On the ground: firm, level ground with all feet down, out of puddles, because air comes in through the floor. Turn the whole case until the image lands roughly on target.
   - Either way, keep it low and tilt the image up, so people walking past aren't looking into the lens (a bright "hot spot").
2. **Take off the hatch cover.** If the optional lock screw is fitted (bottom centre of the cover), remove it first. Lift it straight up about 8 mm, until the bolt heads line up with the wide ends of the keyholes, then pull it straight out. Don't pry it.
3. **Support the projector.** Put one hand through the hatch and hold the projector before loosening anything. It weighs about 0.7 kg and will flop if the head is loose.
4. **Loosen the ball head** lock knob just enough that the projector moves with some friction.
5. **Aim.** Move the projector while watching the image. Keep it inside the ranges above. If it touches anything inside, stop: turn or shim the case instead.
6. **Check the edges.** A dark or cut-off corner means the light cone is clipping the window. Bring the image back toward centre and move the case instead.
7. **Lock the ball head** firmly while still holding the projector. Let go, wait a minute, and check the image hasn't drooped.
8. **Focus.** Use the projector's focus control if you can reach it through the hatch. If you can't, remove the four lid screws on the sides of the lid and lift it off.
9. **Hang the cover.** Refit the lock screw if you use one. Line up the wide ends of the keyholes over the four bolt heads, press it flat against the foam, and let it drop about 8 mm so it seats. It should sit flush and not pull straight out.
10. **Final check.** The louver banks are clear of the HDMI cable and the power cord hangs in a drip loop below the cord clamp.

## Troubleshooting

| Problem | Fix |
|---|---|
| Image cut off or dark at one edge | The window is clipping it: recentre the projector and move the case. |
| Can't reach the target | Turn the case for pan. For more upward tilt, use the tilt risers (above); for less, shim under the rear feet. Keep the gap under the floor open. |
| Image droops over time | Retighten the ball head. Check the pedestal screws and the hot-shoe adapter's ring are tight. |
| Image is trapezoidal | Use the projector's keystone setting. Square up the case first, since keystone correction softens the image. |
| Cover won't seat | A bolt is too tight against the wall: back it out half a turn so the head clears the cover. |
