#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["schemdraw>=0.23"]
# ///
"""Draw the wiring schematics in docs/ with Schemdraw.

    uv run scripts/render_wiring.py        # writes docs/wiring-*.svg

Three drawings, matching the sections of docs/WIRING.md:

    wiring-hv.svg          mains: outlet, cord, gland, live-only fuse, two NEMA 5-15R receptacles, both wall-warts
    wiring-lv-power.svg    the two DC rails: Wago rails, relay contact, projector, DigiAMP+
    wiring-lv-signals.svg  the Pi header: every GPIO used, the IR LED driver

Ratings are the examples from WIRING.md "AC fuse and DC protection" (stock 21 V 2.28 A wall-wart,
12-24 V 2.5 A second one); size yours from your own labels. Keep this file in step with
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
    x_wall = 6.6
    d.add(elm.Line().at((x_cord, yL)).to((x_wall, yL)).color(LIVE))
    d.add(elm.Line().at((x_cord, yN)).to((x_wall, yN)).color(NEUTRAL))
    d.add(elm.Line().at((x_cord, yE)).to((x_wall, yE)).color(EARTH).linestyle('--'))
    note(d, (x_cord + 0.15, yL + 0.2), 'L  black / smooth / narrow blade', halign='left', color=LIVE)
    note(d, (x_cord + 0.15, yN + 0.2), 'N  white / ribbed / wide blade', halign='left', color=NEUTRAL)
    note(d, (x_cord + 0.15, yE + 0.2), 'E  green; land it anyway', halign='left', color=EARTH)
    note(d, ((x_cord + x_wall) / 2 - 0.4, 2.6),
         'Outdoor cord, SJTW 18 AWG or better, 3-wire.\nAny extension-cord joint in a weatherproof box, off the ground.\n'
         'Drip loop outside, below the gland.')

    # rear wall with the cord grip
    d.add(elm.Line().at((x_wall, 3.6)).to((x_wall, -8.6)).linestyle(':').color(NOTE))
    box(d, x_wall - 0.3, -1.9, x_wall + 0.3, 1.9)
    note(d, (x_wall, -2.3), 'PG9 cord grip\n(rear-left corner,\nbeside the plate)')
    note(d, (x_wall - 0.4, 3.7), 'OUTSIDE', halign='right')
    note(d, (x_wall + 0.4, 3.7), 'INSIDE: power shelf, AC side of the barrier (the receptacle plate)', halign='left')

    # live-only fuse; neutral and earth straight through
    x_rc = 13.4
    d.add(elm.Line().at((x_wall + 0.3, yL)).to((x_wall + 3.0, yL)).color(LIVE))
    d.add(elm.Fuse().right().color(LIVE)
          .label('F1  5 x 20 mm, time-delay (T), 250 V, LIVE ONLY\n'
                 'about 1.5x both wall-warts\' input currents; example 3 A T', loc='bottom', fontsize=FSS, ofst=0.15))
    d.add(elm.Line().to((x_rc, yL)).color(LIVE))
    d.add(elm.Line().at((x_wall + 0.3, yN)).to((x_rc, yN)).color(NEUTRAL))
    d.add(elm.Line().at((x_wall + 0.3, yE)).to((x_rc, yE)).color(EARTH).linestyle('--'))

    # the two receptacles: the lower one takes the cord, the upper is jumpered from its piggyback tabs
    H = 4.0
    def rcpt(x, name):
        return d.add(ic([pin('brass', 'L', 'L', pos=0.5 + (yL - yN) / (H - 1)), pin('silver', 'L', 'N', pos=0.5),
                         pin('green', 'L', 'E', pos=0.5 + (yE - yN) / (H - 1)),
                         pin('', 'R', 'Lo', pos=0.5 + (yL - yN) / (H - 1)), pin('', 'R', 'No', pos=0.5),
                         pin('', 'R', 'Eo', pos=0.5 + (yE - yN) / (H - 1)),
                         pin('prongs', 'B', 'face', pos=0.5)],
                        size=(3.0, H)).at((x, yN)).anchor('N').label(name, fontsize=FSS))
    r1 = rcpt(x_rc, 'NEMA 5-15R\nlower')
    note(d, (r1.center[0] - 0.2, r1.center[1] + 2.6), 'brass = narrow slot = L\nsilver = wide slot = N\n4.8 mm tabs, fully insulated quick-connects')
    x_r2 = r1.Lo[0] + 2.0
    r2 = rcpt(x_r2, 'NEMA 5-15R\nupper')
    for a, b, col, ls in ((r1.Lo, r2.L, LIVE, '-'), (r1.No, r2.N, NEUTRAL, '-'), (r1.Eo, r2.E, EARTH, '--')):
        d.add(elm.Line().at(a).to(b).color(col).linestyle(ls))
    note(d, ((r1.Lo[0] + r2.L[0]) / 2, yL + 0.25), 'jumper: piggyback\nquick-connects', fontsize=FSS - 1)
    note(d, ((r1.Lo[0] + r2.L[0]) / 2, yE - 0.3), 'stacked on the plate,\nfacing the divider', fontsize=FSS - 1)

    # the wall-warts hang on their prongs; the stock one stands on the shelf, the second rests on it
    def wart(rc, y, name, note_text=None):
        w = d.add(ic([pin('AC', 'T', 'ac', pos=0.5), pin('+', 'R', 'pos', pos=0.66), pin('-', 'R', 'neg', pos=0.34)],
                     size=(3.0, 2.6)).at((rc.face[0], y)).anchor('ac').label(name, fontsize=FSS))
        d.add(elm.Line().at(rc.face).to(w.ac).color(NOTE))
        if note_text:
            note(d, (w.center[0], w.center[1] - 1.7), note_text)
        return w
    w1 = wart(r1, yE - 2.0, 'Stock wall-wart\nunmodified\n21 V 2.28 A out', 'MX48CC-210228US\ncentre +, 2-pin,\ncaptive DC cord')
    w2 = wart(r2, yE - 2.0, 'Second wall-wart\nunmodified\n12-24 V, 2.5-3 A out\nfor the Pi + DigiAMP+')

    # the barrier and its notch; both DC cords cross through it
    x_bar = w2.pos[0] + 1.6
    d.add(elm.Line().at((x_bar, 3.6)).to((x_bar, w1.pos[1] + 0.7)).color(NOTE).linewidth(3))
    d.add(elm.Line().at((x_bar, w2.center[1] - 2.7)).to((x_bar, -8.6)).color(NOTE).linewidth(3))
    note(d, (x_bar, 3.7), 'barrier')
    y_w2bot = w2.center[1] - 1.3
    note(d, (x_bar + 0.15, y_w2bot - 1.6), 'notch at the\nbarrier foot', halign='left')
    # second wall-wart's cord: 12-24 V, straight out
    y24p, y24n = w2.pos[1], w2.neg[1]
    d.add(elm.Line().at(w2.pos).to((x_bar + 1.2, y24p)).color(POS))
    d.add(elm.Line().at(w2.neg).to((x_bar + 1.2, y24n)).color(NEG))
    # stock wall-wart's cord: 21 V, routed under the second wall-wart
    y21p, y21n = y_w2bot - 0.5, y_w2bot - 1.0
    d.add(elm.Line().at(w1.pos).to((w1.pos[0] + 0.5, w1.pos[1])).color(POS))
    d.add(elm.Line().to((w1.pos[0] + 0.5, y21p)).color(POS))
    d.add(elm.Line().to((x_bar + 1.2, y21p)).color(POS))
    d.add(elm.Line().at(w1.neg).to((w1.neg[0] + 0.9, w1.neg[1])).color(NEG))
    d.add(elm.Line().to((w1.neg[0] + 0.9, y21n)).color(NEG))
    d.add(elm.Line().to((x_bar + 1.2, y21n)).color(NEG))
    note(d, (x_bar + 1.3, y24p), '12-24 V +', halign='left', color=POS, fontsize=FS)
    note(d, (x_bar + 1.3, y24n), '12-24 V -', halign='left', color=NEG, fontsize=FS)
    note(d, (x_bar + 1.3, y21p), '21 V +', halign='left', color=POS, fontsize=FS)
    note(d, (x_bar + 1.3, y21n), '21 V -', halign='left', color=NEG, fontsize=FS)
    note(d, (x_bar + 1.3, y21n - 1.9), 'captive DC cords, cut and spliced\non the low-voltage side\n(wiring-lv-power.svg)', halign='left')

    note(d, (x_wall + 0.4, -8.9),
         'Every AC joint inside a connector shell or heat-shrink; no bare metal. The tabs sit behind the plate, in the corner with the gland. '
         'Flame-retardant (V-0) PETG for the shelf.', halign='left')
    d.save(str(path))


# ----------------------------------------------------------------------------
# Low voltage: the two DC rails
# ----------------------------------------------------------------------------
def draw_lv_power(path):
    d = drawing()

    # stock wall-wart: 21 V, the projector alone
    w1 = d.add(ic([pin('+', 'R', 'pos', pos=0.72), pin('-', 'R', 'neg', pos=0.28)],
                  size=(3.0, 2.4)).at((0, 0.6)).anchor('pos')
               .label('Stock wall-wart\n21 V 2.28 A', fontsize=FSS))
    note(d, (w1.center[0], w1.center[1] - 1.6), 'DC cord cut a hand\'s width from its plug;\nlabel says centre +: confirm with a meter')
    d.add(elm.Line().at(w1.pos).right(0.6).color(POS))
    f1 = d.add(elm.Line().right(3).color(POS))
    x_bp = f1.end[0] + 2.4   # second + rail
    x_bn = x_bp + 1.6        # shared - rail
    x_load = x_bn + 8.0
    yp = f1.end[1]
    d.add(elm.Line().at(f1.end).right(2.4).color(POS))
    d.add(elm.Switch().right().color(POS)
          .label('K1  relay contact\nCOM / NO, fallback only\nnever in the - line', loc='top', fontsize=FSS, ofst=0.15))
    d.add(elm.Line().to((x_load, yp)).color(POS))
    note(d, (f1.end[0] + 1.2, yp - 0.3), '18 AWG', fontsize=FSS - 2)
    proj = d.add(ic([pin('+', 'L', 'pos', pos=0.75), pin('-', 'L', 'neg', pos=0.25)], size=(3.2, 2.6))
                 .at((x_load, yp)).anchor('pos')
                 .label('Projector\nbarrel plug', fontsize=FSS))
    note(d, (proj.center[0], proj.center[1] - 1.8), 'its own cable, spliced back')

    # the shared - rail: both wall-warts' minuses, every load's return
    y_top = w1.neg[1] + 0.3
    y_bot = -10.6
    d.add(elm.Line().at(w1.neg).to((x_bn, w1.neg[1])).color(NEG))
    d.add(elm.Dot().at((x_bn, w1.neg[1])).color(NEG))
    d.add(elm.Line().at((x_bn, y_top)).to((x_bn, y_bot)).color(NEG).linewidth(3))
    note(d, (x_bn + 0.3, w1.neg[1] - 0.3), '18 AWG', halign='left', fontsize=FSS - 2)
    d.add(elm.Dot().at((x_bn, proj.neg[1])).color(NEG))
    d.add(elm.Line().at((x_bn, proj.neg[1])).to(proj.neg).color(NEG))
    note(d, (proj.neg[0] - 0.3, proj.neg[1] - 0.3), '- straight through, 18 AWG', halign='right', fontsize=FSS - 2)
    note(d, (x_bn + 0.3, w1.neg[1] - 1.1), 'Wago 221, - rail\nboth minuses joined: the HDMI shield\nties the grounds anyway', halign='left', color=NEG)

    # second wall-wart: 12-24 V for the Pi and DigiAMP+
    w2 = d.add(ic([pin('-', 'R', 'neg', pos=0.72), pin('+', 'R', 'pos', pos=0.28)],
                  size=(3.0, 2.4)).at((0, -3.6)).anchor('neg')
               .label('Second wall-wart\n12-24 V, 2.5-3 A', fontsize=FSS))
    note(d, (w2.center[0], w2.center[1] - 1.6), 'same treatment')
    d.add(elm.Line().at(w2.neg).to((x_bn, w2.neg[1])).color(NEG))
    d.add(elm.Dot().at((x_bn, w2.neg[1])).color(NEG))
    d.add(elm.Line().at(w2.pos).right(0.6).color(POS))
    f2 = d.add(elm.Line().right(3).color(POS))
    d.add(elm.Line().at(f2.end).to((x_bp, f2.end[1])).color(POS))
    d.add(elm.Dot().at((x_bp, f2.end[1])).color(POS))
    d.add(elm.Line().at((x_bp, f2.end[1])).to((x_bp, y_bot)).color(POS).linewidth(3))
    note(d, (x_bp - 0.3, f2.end[1] + 0.4), 'Wago 221\n12-24 V + rail', halign='right', color=POS)
    note(d, ((x_bp + x_bn) / 2 + 1.5, y_bot - 0.4), '18 AWG from the wall-warts; each branch in its own gauge')

    # --- DigiAMP+ branch; the DigiAMP+ powers the Pi over the header; speakers out
    ya = -7.0
    d.add(elm.Dot().at((x_bp, ya)).color(POS))
    d.add(elm.Line().at((x_bp, ya)).to((x_load, ya)).color(POS))
    note(d, (x_bn + 0.3, ya + 0.25), '20 AWG', halign='left', fontsize=FSS - 2)
    amp = d.add(ic([pin('+', 'L', 'pos', pos=0.82), pin('-', 'L', 'neg', pos=0.62),
                    pin('5 V', 'R', 'v5', pos=0.86), pin('GND', 'R', 'gnd', pos=0.68),
                    pin('SPK+', 'R', 'spkp', pos=0.28), pin('SPK-', 'R', 'spkn', pos=0.12)],
                   size=(4.6, 4.0)).at((x_load, ya)).anchor('pos')
                .label('Raspberry Pi DigiAMP+\n12-24 V in (P5 or barrel)', fontsize=FSS))
    d.add(elm.Dot().at((x_bn, amp.neg[1])).color(NEG))
    d.add(elm.Line().at((x_bn, amp.neg[1])).to(amp.neg).color(NEG))
    note(d, (x_bn + 0.3, amp.neg[1] - 0.3), '20 AWG', halign='left', fontsize=FSS - 2)
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
    XR1 = 6.4                  # right

    def wire(points, color=SIG):
        for a, b in zip(points, points[1:]):
            d.add(elm.Line().at(a).to(b).color(color))

    # ---------------- left side (odd pins)
    # PIR, straight off GPIO17
    pir = d.add(ic([pin('OUT', 'R', 'out'), pin('VCC', 'L', 'vcc', pos=0.75, pin='5 V, pin 2'),
                    pin('GND', 'L', 'gnd', pos=0.25, pin='GND, pin 9')], size=(3.0, 1.4))
                .at((XL1, y(11))).anchor('out').label('HC-SR501 PIR\n(rear wall)', fontsize=FSS - 1))
    wire([(XLW, y(11)), pir.out])
    note(d, ((XLW + XL1) / 2, y(11) + 0.2), 'OUT, 3.3 V logic', fontsize=FSS - 2, color=SIG)

    # relay coil side, straight off GPIO27, in the far column so the wire passes under the PIR
    relay = d.add(ic([pin('IN', 'R', 'inp'),
                      pin('VCC', 'L', 'vcc', pos=0.88, pin='5 V, pin 4'), pin('GND', 'L', 'gnd', pos=0.63, pin='GND, pin 14'),
                      pin('COM', 'L', 'com', pos=0.37, pin='21 V + from the wall-wart'), pin('NO', 'L', 'no', pos=0.12, pin='+ to projector')],
                     size=(3.0, 3.2)).at((XL2, y(13))).anchor('inp')
                  .label('Relay module\n5 V coil, opto in\nACTIVE-LOW', fontsize=FSS - 2))
    wire([(XLW, y(13)), relay.inp])
    note(d, ((XLW + XL1) / 2, y(13) - 0.32), 'high = contact open (from boot)', fontsize=FSS - 2, color=SIG)

    # IR LED driver: GPIO16 (pin 36, right column; GPIO22 is the DigiAMP+ mute line) -> R1 -> Q1 base;
    # 5 V -> D1 -> R2 -> collector; emitter -> GND. The wire comes round under the header to the
    # driver on the left.
    yb = y(11) - 5.6
    y_ir = y(39) - 1.0               # under the header
    x_ir = -3.0                      # left of the pin labels
    wire([(XRW, y(36)), (6.3, y(36)), (6.3, y_ir), (x_ir, y_ir), (x_ir, yb), (-4.6, yb)])
    note(d, (XRW + 0.1, y(36) + 0.2), 'to the IR LED driver (left)', halign='left', fontsize=FSS - 2, color=SIG)
    d.add(elm.Resistor().at((-4.6, yb)).left().length(1.2).color(SIG).label('R1 1 k', fontsize=FSS - 1))
    q1 = d.add(elm.BjtNpn(circle=True).right().reverse().at((-5.8, yb)).anchor('base')
               .label('Q1\nBC337 / 2N2222', loc='left', fontsize=FSS - 2, ofst=0.3))
    d.add(elm.Line().at(q1.emitter).down(0.3).color(NEG))
    d.add(elm.Ground().label('GND', loc='bottom', fontsize=FSS - 1, ofst=0.1))
    d.add(elm.Line().at(q1.collector).up(0.3).color(POS))
    d.add(elm.Resistor().up().length(1.1).color(POS).label('R2 47 R', loc='right', fontsize=FSS - 1))
    d.add(elm.LED().up().length(1.1).color(POS).label('D1  940 nm IR LED\nin ir_holder, aimed\nat the projector', loc='right', fontsize=FSS - 2, ofst=0.45))
    d.add(elm.Vdd().label('5 V', fontsize=FSS - 1))
    note(d, (q1.collector[0] - 0.8, yb + 2.2), 'the LED runs on Q1:\na GPIO pin sources\n16 mA at most', halign='right')

    # ---------------- right side (even pins)
    rx = d.add(ic([pin('OUT', 'L', 'out'), pin('VS', 'R', 'vs', pos=0.75, pin='3.3 V, pin 17'),
                   pin('GND', 'R', 'gnd', pos=0.25, pin='GND')], size=(3.6, 1.4))
               .at((XR1, y(16))).anchor('out').label('TSOP38238\nIR receiver', fontsize=FSS - 2))
    note(d, (rx.center[0], rx.center[1] - 1.05), 'optional: learns the remote\'s power code')
    wire([(XRW, y(16)), rx.out])

    note(d, (0.6, y_ir - 1.4),
         'Pin numbers are the header\'s physical pins; GPIO numbers are BCM. HDMI from the Pi to the projector carries CEC, the default power control.\n'
         'Service pins: PIR 17, relay 27, IR LED 16, IR receiver 23. GPIO 22 is the DigiAMP+ mute line.')
    d.save(str(path))


if __name__ == '__main__':
    draw_hv(DOCS / 'wiring-hv.svg')
    draw_lv_power(DOCS / 'wiring-lv-power.svg')
    draw_lv_signals(DOCS / 'wiring-lv-signals.svg')
    for p in sorted(DOCS.glob('wiring-*.svg')):
        print(f'{p.relative_to(DOCS.parent)}  {p.stat().st_size // 1024} KiB')
