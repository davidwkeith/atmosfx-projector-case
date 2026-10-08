#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["schemdraw>=0.23"]
# ///
"""Draw the wiring schematics in docs/ with Schemdraw.

    uv run scripts/render_wiring.py        # writes docs/wiring-*.svg

Three drawings, matching the sections of docs/WIRING.md:

    wiring-hv.svg          mains: outlet, AC cord (molded plugs, not cut), cord clamp, the 24 V desktop brick
    wiring-lv-power.svg    the one DC rail: Y-splitter, projector, DigiAMP+ (relay contact only as the CEC fallback)
    wiring-lv-signals.svg  the Pi header: every GPIO used; relay and IR LED are CEC fallbacks

The supply is the Parts Express 24 V 5 A desktop brick (label values to be read on arrival). Keep this file in step with
WIRING.md, pi/README.md ("GPIO pins and wiring") and BOM.md.
"""
from pathlib import Path

import schemdraw
import schemdraw.elements as elm

schemdraw.use('svg')
schemdraw.svgconfig.text = 'text'   # keep text as <text>, not glyph paths: small files, selectable
DOCS = Path(__file__).resolve().parent.parent / 'docs'

LIVE, NEUTRAL, EARTH = '#c62828', '#757575', '#2e7d32'
POS, NEG, SIG = '#c62828', '#212121', '#1565c0'
NOTE = '#555555'
FS = 12          # label font size
FSS = 10         # small notes


def note(d, xy, text, **kw):
    """Free-standing note text."""
    kw.setdefault('fontsize', FSS)
    kw.setdefault('color', NOTE)
    d.add(elm.Label().at(xy).label(text, **kw))


def ic(pins, size, **kw):
    # .right(): elements inherit the drawing direction of whatever was added before them,
    # so a box placed after a leftward line would come out mirrored.
    # IcPin pos maps to 0.5 + pos * (height - 1) along the side.
    return elm.Ic(pins=pins, size=size, **kw).right()


def pin(name, side, anchor=None, **kw):
    kw.setdefault('lblsize', FSS)
    return elm.IcPin(name=name, side=side, anchorname=anchor or name, **kw)


# ----------------------------------------------------------------------------
# High voltage: the AC side of the barrier
# ----------------------------------------------------------------------------
def drawing():
    """A Drawing built with explicit add() calls. No `with` block: inside one, schemdraw
    auto-adds every element it constructs, and add() would place each twice."""
    d = schemdraw.Drawing(show=False)
    d.config(unit=2, fontsize=FS, lw=1.6)
    return d


def box(d, x0, y0, x1, y1, **kw):
    """Plain rectangle from absolute corners (Rect places relative to the cursor)."""
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        d.add(elm.Line().at(a).to(b).color(kw.get('color', NOTE)).linewidth(kw.get('lw', 1.2)))


def draw_hv(path):
    d = drawing()
    yL, yN, yE = 1.4, 0.0, -1.4

    outlet = d.add(elm.OutletB().right().at((0, -0.3))
                   .label('Outdoor GFCI outlet\nin-use cover; test its button', loc='bottom', fontsize=FSS, ofst=0.3))
    # OutletB: hot slot on the right, neutral on the left, ground below.
    # Live leaves over the top, neutral under it, earth out of the bottom: no crossings.
    x_cord = 2.4
    d.add(elm.Line().at(outlet.hot).up(1.0).color(LIVE))
    d.add(elm.Wire('-|').at(d.here).to((x_cord, yL)).color(LIVE))
    d.add(elm.Line().at(outlet.neutral).up(0.45).color(NEUTRAL))
    d.add(elm.Line().to((x_cord - 0.5, d.here[1])).color(NEUTRAL))
    d.add(elm.Line().to((x_cord - 0.5, yN)).color(NEUTRAL))
    d.add(elm.Line().to((x_cord, yN)).color(NEUTRAL))
    d.add(elm.Line().at(outlet.ground).down(0.35).color(EARTH).linestyle('--'))
    d.add(elm.Wire('-|').at(d.here).to((x_cord, yE)).color(EARTH).linestyle('--'))

    # the cord to the rear wall
    x_wall = 7.4
    d.add(elm.Line().at((x_cord, yL)).to((x_wall, yL)).color(LIVE))
    d.add(elm.Line().at((x_cord, yN)).to((x_wall, yN)).color(NEUTRAL))
    d.add(elm.Line().at((x_cord, yE)).to((x_wall, yE)).color(EARTH).linestyle('--'))
    note(d, (x_cord + 0.15, yL + 0.2), 'L  black / smooth / narrow blade', halign='left', color=LIVE)
    note(d, (x_cord + 0.15, yN + 0.2), 'N  white / ribbed / wide blade', halign='left', color=NEUTRAL)
    note(d, (x_cord + 0.15, yE + 0.2), 'E  green; land it anyway', halign='left', color=EARTH)
    note(d, (x_wall - 4.3, 2.8),
         "Standard cord with the brick's molded plug, not cut. Not outdoor-rated:\n"
         'owner accepts one month outside; inspect daily, replace if damaged.\n'
         'Every plug joint in a weatherproof box, off the ground. Drip loop.')

    # rear wall with the cord clamp
    d.add(elm.Line().at((x_wall, 3.6)).to((x_wall, -8.6)).linestyle(':').color(NOTE))
    box(d, x_wall - 0.3, -1.9, x_wall + 0.3, 1.9)
    note(d, (x_wall - 0.5, -2.3), 'cord clamp\n(rear-left corner;\ngrips the jacket)', halign='right')
    note(d, (x_wall - 0.4, 3.7), 'OUTSIDE', halign='right')
    note(d, (x_wall + 0.4, 3.7), 'INSIDE: power shelf', halign='left')

    # the brick: the cord's molded plug goes straight into its inlet; nothing hand-wired
    x_br = 11.8
    d.add(elm.Line().at((x_wall + 0.3, yL)).to((x_br, yL)).color(LIVE))
    d.add(elm.Line().at((x_wall + 0.3, yN)).to((x_br, yN)).color(NEUTRAL))
    d.add(elm.Line().at((x_wall + 0.3, yE)).to((x_br, yE)).color(EARTH).linestyle('--'))
    note(d, ((x_wall + x_br) / 2, yL + 0.3), 'L, N, E inside one molded cord', fontsize=FSS)
    H = 4.0
    br = d.add(ic([pin('L', 'L', 'L', pos=0.5 + (yL - yN) / (H - 1)), pin('N', 'L', 'N', pos=0.5),
                   pin('E', 'L', 'E', pos=0.5 + (yE - yN) / (H - 1)),
                   pin('+', 'R', 'pos', pos=0.7), pin('-', 'R', 'neg', pos=0.3)],
                  size=(4.4, H)).at((x_br, yN)).anchor('N')
               .label('Parts Express brick\n24 V 5 A, 120 W\nAC inlet (type: read the label)', fontsize=FSS))
    d.add(elm.Line().at(br.pos).right(1.6).color(POS))
    d.add(elm.Line().at(br.neg).right(1.6).color(NEG))
    note(d, (br.pos[0] + 1.7, br.pos[1]), '24 V +', halign='left', color=POS, fontsize=FS)
    note(d, (br.neg[0] + 1.7, br.neg[1]), '24 V -', halign='left', color=NEG, fontsize=FS)
    note(d, (br.pos[0] + 1.7, br.neg[1] - 1.4), 'DC cord, not cut:\nplugs into the Y-splitter\n(wiring-lv-power.svg)', halign='left')
    note(d, (x_wall + 0.4, -8.9),
         'No AC fuse and no hand-wired AC: the cord and the brick are listed, molded parts; the GFCI is upstream. '
         'Flame-retardant (V-0) PETG for the shelf.', halign='left')
    d.save(str(path))


# ----------------------------------------------------------------------------
# Low voltage: the two DC rails
# ----------------------------------------------------------------------------
def draw_lv_power(path):
    d = drawing()

    w1 = d.add(ic([pin('+', 'R', 'pos', pos=0.72), pin('-', 'R', 'neg', pos=0.28)],
                  size=(3.8, 2.4)).at((0, 0.6)).anchor('pos')
               .label('Parts Express brick\n24 V 5 A', fontsize=FSS))
    note(d, (w1.center[0], w1.center[1] - 1.6), 'DC cord NOT cut. Tip is centre +:\nmeter both Y-splitter legs before connecting')
    yp, yn = w1.pos[1], w1.neg[1]
    x_s = 4.4            # + side of the Y-splitter
    x_n = x_s + 1.6      # - side
    x_load = x_n + 9.0
    d.add(elm.Line().at(w1.pos).to((x_s, yp)).color(POS))
    d.add(elm.Dot().at((x_s, yp)).color(POS))
    d.add(elm.Line().at(w1.neg).to((x_n, yn)).color(NEG))
    d.add(elm.Dot().at((x_n, yn)).color(NEG))
    note(d, (x_n + 0.4, yp - 2.0), '5.5 x 2.5 mm Y-splitter\n(leads rated 5 A, or fused to the lead)', halign='left')

    # projector leg: + through the optional relay contact and the optional buck converter, - straight through
    d.add(elm.Line().at((x_s, yp)).right(1.4).color(POS))
    d.add(elm.Switch().right().color(POS).linestyle('--')
          .label('K1 relay, ONLY if CEC fails\n(cut this leg; never in the -)', loc='top', fontsize=FSS - 1, ofst=0.15))
    d.add(elm.Line().right(0.8).color(POS))
    d.add(elm.Resistor().right().length(1.6).color(POS).linestyle('--')
          .label('buck to 21 V, ONLY if row 4a fails', loc='bottom', fontsize=FSS - 1, ofst=0.25))
    d.add(elm.Line().to((x_load, yp)).color(POS))
    proj = d.add(ic([pin('+', 'L', 'pos', pos=0.75), pin('-', 'L', 'neg', pos=0.25)], size=(3.2, 2.6))
                 .at((x_load, yp)).anchor('pos')
                 .label('Projector\nvia right-angle\n5.5 x 2.5 adapter', fontsize=FSS))
    d.add(elm.Dot().at((x_n, proj.neg[1])).color(NEG))
    d.add(elm.Line().at((x_n, proj.neg[1])).to(proj.neg).color(NEG))
    note(d, (proj.neg[0] - 0.3, proj.neg[1] - 0.3), '- straight through', halign='right', fontsize=FSS - 2)

    # DigiAMP+ leg; the DigiAMP+ powers the Pi over the header; speakers out
    ya = -7.0
    d.add(elm.Line().at((x_s, yp)).to((x_s, ya)).color(POS))
    d.add(elm.Dot().at((x_s, ya)).color(POS))
    d.add(elm.Line().at((x_s, ya)).to((x_load, ya)).color(POS))
    note(d, (x_n + 0.3, ya + 0.25), '20 AWG', halign='left', fontsize=FSS - 2)
    amp = d.add(ic([pin('+', 'L', 'pos', pos=0.82), pin('-', 'L', 'neg', pos=0.62),
                    pin('5 V', 'R', 'v5', pos=0.86), pin('GND', 'R', 'gnd', pos=0.68),
                    pin('SPK+', 'R', 'spkp', pos=0.28), pin('SPK-', 'R', 'spkn', pos=0.12)],
                   size=(4.6, 4.0)).at((x_load, ya)).anchor('pos'))
    note(d, (amp.center[0], amp.center[1] + 2.6), 'Raspberry Pi DigiAMP+, 5.5 x 2.5 mm barrel jack,\ncentre + (12-24 V; 24 V is its ceiling)')
    d.add(elm.Line().at((x_n, proj.neg[1])).to((x_n, amp.neg[1])).color(NEG))
    d.add(elm.Dot().at((x_n, amp.neg[1])).color(NEG))
    d.add(elm.Line().at((x_n, amp.neg[1])).to(amp.neg).color(NEG))
    note(d, (x_n + 0.3, amp.neg[1] - 0.3), '20 AWG', halign='left', fontsize=FSS - 2)
    pi = d.add(ic([pin('5 V', 'L', 'v5', pos=0.72), pin('GND', 'L', 'gnd', pos=0.28)], size=(3.4, 1.6))
               .at((amp.v5[0] + 1.8, amp.v5[1])).anchor('v5')
               .label('Raspberry Pi', fontsize=FSS))
    d.add(elm.Line().at(amp.v5).to(pi.v5).color(POS))
    d.add(elm.Line().at(amp.gnd).to(pi.gnd).color(NEG))
    note(d, (pi.center[0] + 1.9, pi.center[1]),
         'over the 40-pin header; no USB power.\nSignals: wiring-lv-signals.svg', halign='left')
    ymid = (amp.spkp[1] + amp.spkn[1]) / 2
    spk = d.add(elm.Speaker().right().at((amp.spkp[0] + 2.4, ymid + 0.25)).anchor('in1')
                .label('Speakers behind\nthe projection', loc='right', fontsize=FSS, ofst=0.3))
    d.add(elm.Line().at(amp.spkp).to(spk.in1).color(POS))
    d.add(elm.Line().at(amp.spkn).to(spk.in2).color(NEG))
    note(d, (amp.spkp[0] + 1.2, amp.spkn[1] - 0.8),
         '16 AWG zip cord, stripe to +,\nout through the floor chimney', halign='left')
    note(d, (x_load - 4.0, amp.spkn[1] - 3.2),
         'Do not connect the brick to the projector until BRINGUP row 4a passes (its label says 21 V).', halign='left')
    d.save(str(path))

# ----------------------------------------------------------------------------
# Low voltage: the Pi header and every signal
# ----------------------------------------------------------------------------
GPIO_L = ['3V3', 'GPIO2 DigiAMP+', 'GPIO3 DigiAMP+', 'GPIO4 DigiAMP+', 'GND', 'GPIO17', 'GPIO27', 'GPIO22 DigiAMP+ mute', '3V3',
          'GPIO10', 'GPIO9', 'GPIO11', 'GND', 'ID_SD', 'GPIO5', 'GPIO6', 'GPIO13', 'GPIO19 DigiAMP+', 'GPIO26', 'GND']
GPIO_R = ['5V', '5V', 'GND', 'GPIO14', 'GPIO15', 'GPIO18 DigiAMP+', 'GND', 'GPIO23', 'GPIO24', 'GND',
          'GPIO25', 'GPIO8', 'GPIO7', 'ID_SC', 'GND', 'GPIO12', 'GND', 'GPIO16', 'GPIO20 DigiAMP+', 'GPIO21 DigiAMP+']
PINS_L = [f'{2 * i + 1}  {n}' for i, n in enumerate(GPIO_L)]
PINS_R = [f'{n}  {2 * i + 2}' for i, n in enumerate(GPIO_R)]


def draw_lv_signals(path):
    d = drawing()

    hdr = d.add(elm.Header(rows=20, cols=2, pinsleft=PINS_L, pinsright=PINS_R, shownumber=False,
                           numbering='lr', pinspacing=0.6, pinfontsizeleft=FSS - 1, pinfontsizeright=FSS - 1)
                .right().at((0, 0)).label('Pi 40-pin header, re-exposed on top of the DigiAMP+ (pass-through).\n'
                                  'The DigiAMP+ owns pins 3, 5, 7, 12, 15 (mute), 35, 38 and 40.', loc='top', fontsize=FSS, ofst=0.3))

    def y(n):
        return hdr.absanchors[f'pin{n}'][1]

    XLW, XRW = hdr.absanchors['pin1'][0] - 2.3, hdr.absanchors['pin2'][0] + 2.3   # wires start past the pin labels
    XL1, XL2 = -6.0, -11.6     # near and far device columns, left

    def wire(points, color=SIG):
        for a, b in zip(points, points[1:]):
            d.add(elm.Line().at(a).to(b).color(color))

    # ---------------- left side (odd pins)
    # PIR, straight off GPIO17
    pir = d.add(ic([pin('OUT', 'R', 'out'), pin('VCC', 'L', 'vcc', pos=0.85, pin='5 V, pin 2'),
                    pin('GND', 'L', 'gnd', pos=0.15, pin='GND, pin 9')], size=(3.0, 1.7))
                .at((XL1, y(11))).anchor('out'))
    note(d, (pir.center[0], pir.center[1] + 1.3), 'HC-SR501 PIR (rear wall)')
    wire([(XLW, y(11)), pir.out])
    note(d, ((XLW + XL1) / 2, y(11) + 0.2), 'OUT, 3.3 V logic', fontsize=FSS - 2, color=SIG)

    # relay coil side, straight off GPIO27, in the far column so the wire passes under the PIR
    relay = d.add(ic([pin('IN', 'R', 'inp'),
                      pin('VCC', 'L', 'vcc', pos=0.88, pin='5 V, pin 4'), pin('GND', 'L', 'gnd', pos=0.63, pin='GND, pin 14'),
                      pin('COM', 'L', 'com', pos=0.37, pin='+ from the Y-splitter leg'), pin('NO', 'L', 'no', pos=0.12, pin='+ to projector')],
                     size=(3.0, 3.2)).at((XL2, y(13))).anchor('inp'))
    note(d, (relay.center[0], relay.center[1] + 2.4), 'Relay module, ONLY if CEC fails\n5 V coil, opto in, ACTIVE-LOW')
    wire([(XLW, y(13)), relay.inp])
    note(d, ((XLW + XL1) / 2 - 1.8, y(13) - 0.32), 'high = contact open (from boot)', fontsize=FSS - 2, color=SIG)

    # IR LED, direct drive (CEC fallback): GPIO16 (pin 36, right column; GPIO22 is the DigiAMP+ mute line) -> R1 -> LED -> GND.
    # The wire comes round under the header to the LED on the left.
    yb = y(11) - 5.6
    y_ir = y(39) - 1.0               # under the header
    x_ir = -3.0                      # left of the pin labels
    wire([(XRW, y(36)), (6.3, y(36)), (6.3, y_ir), (x_ir, y_ir), (x_ir, yb)])
    note(d, (XRW + 0.1, y(36) + 0.2), 'to the IR LED (left)', halign='left', fontsize=FSS - 2, color=SIG)
    d.add(elm.Resistor().at((x_ir, yb)).left().length(1.6).color(SIG).label('R1 150 R', loc='top', fontsize=FSS - 1))
    d.add(elm.LED().left().length(1.6).color(POS)
          .label('D1  940 nm IR LED in ir_holder,\nONLY if CEC fails', loc='bottom', fontsize=FSS - 2, ofst=0.7))
    d.add(elm.Line().down(0.4).color(NEG))
    d.add(elm.Ground().label('GND', loc='bottom', fontsize=FSS - 1, ofst=0.1))
    note(d, (x_ir - 2.0, yb + 1.2), "no transistor: about 13 mA, under a pin's 16 mA", halign='right')

    note(d, (0.6, y_ir - 1.4),
         'Pin numbers are the header\'s physical pins; GPIO numbers are BCM. HDMI from the Pi to the projector carries CEC, the default power control.\n'
         'Service pins: PIR 17, relay 27 and IR LED 16 (both CEC fallbacks). The TSOP38238 receiver (GPIO 23) is bench-only, to learn the remote.\nGPIO 22 is the DigiAMP+ mute line.')
    d.save(str(path))


if __name__ == '__main__':
    draw_hv(DOCS / 'wiring-hv.svg')
    draw_lv_power(DOCS / 'wiring-lv-power.svg')
    draw_lv_signals(DOCS / 'wiring-lv-signals.svg')
    for p in sorted(DOCS.glob('wiring-*.svg')):
        print(f'{p.relative_to(DOCS.parent)}  {p.stat().st_size // 1024} KiB')
