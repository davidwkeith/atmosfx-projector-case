#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["schemdraw>=0.23"]
# ///
"""Draw the wiring schematics in docs/ with Schemdraw.

    uv run scripts/render_wiring.py        # writes docs/wiring-*.svg

Three drawings, matching the sections of docs/WIRING.md:

    wiring-hv.svg          mains: outlet, cord, gland, live-only fuse, IEC connector, brick
    wiring-lv-power.svg    the 21 V rail: fuses, Wago splice, relay contact, projector, Amp4, fans
    wiring-lv-signals.svg  the Pi header: every GPIO used, pull-ups, the IR LED driver

Ratings are the examples from WIRING.md "Fuse sizing" (21 V 5 A brick, 3 A
projector); size yours from your own labels. Keep this file in step with
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
    note(d, (x_cord + 0.15, yE + 0.2), 'E  green; C5 / C13 bricks only', halign='left', color=EARTH)
    note(d, ((x_cord + x_wall) / 2 - 0.4, 2.6),
         'Outdoor cord, SJTW 18 AWG or better.\nAny extension-cord joint in a weatherproof box, off the ground.\n'
         'Drip loop outside, below the gland.')

    # rear wall with the cord grip
    d.add(elm.Line().at((x_wall, 3.6)).to((x_wall, -3.2)).linestyle(':').color(NOTE))
    box(d, x_wall - 0.3, -1.9, x_wall + 0.3, 1.9)
    note(d, (x_wall, -2.3), 'PG9 cord grip\n(rear wall)')
    note(d, (x_wall - 0.4, 3.7), 'OUTSIDE', halign='right')
    note(d, (x_wall + 0.4, 3.7), 'INSIDE: power shelf, AC side of the barrier', halign='left')

    # live-only fuse; neutral and earth straight through
    x_iec = 13.0
    d.add(elm.Line().at((x_wall + 0.3, yL)).to((x_wall + 2.2, yL)).color(LIVE))
    d.add(elm.Fuse().right().color(LIVE)
          .label('F1  5 x 20 mm, time-delay (T), 250 V, LIVE ONLY\n'
                 'about 1.5x the brick input current; example 2 A T', loc='bottom', fontsize=FSS, ofst=0.15))
    d.add(elm.Line().to((x_iec, yL)).color(LIVE))
    d.add(elm.Line().at((x_wall + 0.3, yN)).to((x_iec, yN)).color(NEUTRAL))
    d.add(elm.Line().at((x_wall + 0.3, yE)).to((x_iec, yE)).color(EARTH).linestyle('--'))

    # rewireable IEC connector plugged into the brick's inlet
    H = 4.0
    iec = d.add(ic([pin('L', 'L', pos=0.5 + (yL - yN) / (H - 1)), pin('N', 'L', pos=0.5),
                    pin('E', 'L', pos=0.5 + (yE - yN) / (H - 1))],
                   size=(3.0, H)).at((x_iec, yN)).anchor('N')
                .label('Rewireable\nIEC connector\nC7 / C5 / C13', fontsize=FSS, ofst=(0.3, 0)))
    brick = d.add(ic([pin('AC', 'L', 'inlet', pos=0.5),
                      pin('+', 'R', 'pos', pos=0.66), pin('-', 'R', 'neg', pos=0.34)],
                     size=(3.4, H)).at((iec.center[0] + 1.5 + 1.0, yN)).anchor('inlet')
                  .label('DC brick\nunmodified\nlabel: DC 21 V 3 A', fontsize=FSS))
    note(d, (brick.center[0], brick.center[1] - 2.5),
         'The stock brick feeds the projector alone;\n5 A or more to run the Pi, amp and fans too.')

    # the barrier and its notch
    x_bar = brick.pos[0] + 1.4
    d.add(elm.Line().at((x_bar, 3.6)).to((x_bar, -0.1)).color(NOTE).linewidth(3))
    d.add(elm.Line().at((x_bar, -1.1)).to((x_bar, -3.2)).color(NOTE).linewidth(3))
    note(d, (x_bar, 3.7), 'barrier')
    note(d, (x_bar + 0.15, -1.5), 'notch at the\nbarrier foot', halign='left')
    d.add(elm.Line().at(brick.pos).to((x_bar + 1.2, brick.pos[1])).color(POS))
    d.add(elm.Line().at(brick.neg).to((x_bar - 0.5, brick.neg[1])).color(NEG))
    d.add(elm.Line().to((x_bar - 0.5, -0.6)).color(NEG))
    d.add(elm.Line().to((x_bar + 1.2, -0.6)).color(NEG))
    note(d, (x_bar + 1.3, brick.pos[1]), '+ 21 V', halign='left', color=POS, fontsize=FS)
    note(d, (x_bar + 1.3, -0.6), '-', halign='left', color=NEG, fontsize=FS)
    note(d, (x_bar + 1.3, -2.5), 'to the low-voltage side\n(wiring-lv-power.svg)', halign='left')

    note(d, (x_wall + 0.4, -3.4),
         'Every AC joint inside a connector shell or heat-shrink; no bare metal. Flame-retardant (V-0) PETG for the shelf.',
         halign='left')
    d.save(str(path))


# ----------------------------------------------------------------------------
# Low voltage: the 21 V rail
# ----------------------------------------------------------------------------
def draw_lv_power(path):
    d = drawing()

    brick = d.add(ic([pin('+', 'R', 'pos', pos=0.72), pin('-', 'R', 'neg', pos=0.28)],
                     size=(3.0, 2.4)).at((0, 0)).anchor('pos')
                  .label('DC brick\n21 V out', fontsize=FSS))
    note(d, (brick.center[0], brick.center[1] - 1.7),
         'from wiring-hv.svg, through the barrier notch;\ncheck voltage and polarity at the plug before cutting')

    # main fuse in the + line, then the two Wago rails drawn as vertical buses
    d.add(elm.Line().at(brick.pos).right(0.6).color(POS))
    f2 = d.add(elm.Fuse().right().color(POS)
               .label('F2  main DC, blade (ATO)\n<= brick output, >= 1.25x load\nexample: 5 A', loc='top', fontsize=FSS, ofst=0.15))
    x_bp = f2.end[0] + 1.0   # + bus
    x_bn = x_bp + 1.6        # - bus
    y_top, y_bot = 2.2, -10.8
    d.add(elm.Line().at(f2.end).to((x_bp, f2.end[1])).color(POS))
    d.add(elm.Dot().at((x_bp, f2.end[1])).color(POS))
    d.add(elm.Line().at((x_bp, y_top)).to((x_bp, y_bot)).color(POS).linewidth(3))
    d.add(elm.Line().at(brick.neg).to((x_bn, brick.neg[1])).color(NEG))
    d.add(elm.Dot().at((x_bn, brick.neg[1])).color(NEG))
    d.add(elm.Line().at((x_bn, y_top)).to((x_bn, y_bot)).color(NEG).linewidth(3))
    note(d, (x_bp, y_top + 0.3), 'Wago 221\n+ rail', color=POS)
    note(d, (x_bn, y_top + 0.3), 'Wago 221\n- rail', color=NEG)
    note(d, ((x_bp + x_bn) / 2 + 1.5, y_bot - 0.4), '18 AWG from the brick; each branch in its own gauge')

    x_load = x_bn + 8.0

    # --- projector branch: optional fuse, relay contact in the + line only
    yp = 0.6
    d.add(elm.Dot().at((x_bp, yp)).color(POS))
    d.add(elm.Line().at((x_bp, yp)).right(2.8).color(POS))
    note(d, (x_bn + 0.9, yp - 0.3), '18 AWG', fontsize=FSS - 2)
    d.add(elm.Fuse().right().color(POS)
          .label('F3  optional, blade\n1.25x projector input\nexample: 4 A', loc='top', fontsize=FSS, ofst=0.15))
    d.add(elm.Line().right(1.4).color(POS))
    d.add(elm.Switch().right().color(POS)
          .label('K1  relay contact\nCOM / NO, fallback only\nnever in the - line', loc='top', fontsize=FSS, ofst=0.15))
    d.add(elm.Line().to((x_load, yp)).color(POS))
    proj = d.add(ic([pin('+', 'L', 'pos', pos=0.75), pin('-', 'L', 'neg', pos=0.25)], size=(3.2, 2.6))
                 .at((x_load, yp)).anchor('pos')
                 .label('Projector\nbarrel plug', fontsize=FSS))
    note(d, (proj.center[0], proj.center[1] - 1.8), 'its own cable, spliced')
    d.add(elm.Dot().at((x_bn, proj.neg[1])).color(NEG))
    d.add(elm.Line().at((x_bn, proj.neg[1])).to(proj.neg).color(NEG))
    note(d, (proj.neg[0] - 0.3, proj.neg[1] - 0.3), '- straight through, 18 AWG', halign='right', fontsize=FSS - 2)

    # --- Amp4 branch: optional fuse; the Amp4 powers the Pi over the header; speakers out
    ya = -3.6
    d.add(elm.Dot().at((x_bp, ya)).color(POS))
    d.add(elm.Line().at((x_bp, ya)).right(1.4).color(POS))
    f4 = d.add(elm.Fuse().right().color(POS)
               .label('F4  optional, blade\namp at full volume + Pi\nexample: 3 A', loc='top', fontsize=FSS, ofst=0.15))
    d.add(elm.Line().to((x_load, ya)).color(POS))
    note(d, (f4.end[0] + 0.3, ya + 0.25), '20 AWG', halign='left', fontsize=FSS - 2)
    amp = d.add(ic([pin('+', 'L', 'pos', pos=0.82), pin('-', 'L', 'neg', pos=0.62),
                    pin('5 V', 'R', 'v5', pos=0.86), pin('GND', 'R', 'gnd', pos=0.68),
                    pin('SPK+', 'R', 'spkp', pos=0.28), pin('SPK-', 'R', 'spkn', pos=0.12)],
                   size=(4.6, 4.0)).at((x_load, ya)).anchor('pos')
                .label('HiFiBerry Amp4\n12-24 V in', fontsize=FSS))
    d.add(elm.Dot().at((x_bn, amp.neg[1])).color(NEG))
    d.add(elm.Line().at((x_bn, amp.neg[1])).to(amp.neg).color(NEG))
    note(d, (x_bn + 0.3, amp.neg[1] - 0.3), '20 AWG', halign='left', fontsize=FSS - 2)
    # the Pi hangs off the Amp4's header
    pi = d.add(ic([pin('5 V', 'L', 'v5', pos=0.72), pin('GND', 'L', 'gnd', pos=0.28)], size=(3.4, 1.6))
               .at((amp.v5[0] + 1.8, amp.v5[1])).anchor('v5')
               .label('Raspberry Pi', fontsize=FSS))
    d.add(elm.Line().at(amp.v5).to(pi.v5).color(POS))
    d.add(elm.Line().at(amp.gnd).to(pi.gnd).color(NEG))
    note(d, (pi.center[0] + 1.9, pi.center[1]),
         'over the 40-pin header; no USB power.\nSignals: wiring-lv-signals.svg', halign='left')
    # speakers
    ymid = (amp.spkp[1] + amp.spkn[1]) / 2
    spk = d.add(elm.Speaker().right().at((amp.spkp[0] + 2.4, ymid + 0.25)).anchor('in1')
                .label('Speakers behind\nthe projection', loc='right', fontsize=FSS, ofst=0.3))
    d.add(elm.Line().at(amp.spkp).to(spk.in1).color(POS))
    d.add(elm.Line().at(amp.spkn).to(spk.in2).color(NEG))
    note(d, (amp.spkp[0] + 1.2, amp.spkn[1] - 0.8),
         '16 AWG zip cord, stripe to +,\nout through the floor chimney', halign='left')

    # --- fans: 24 V parts on the 21 V rail
    for i, (yf, name) in enumerate(((-7.4, 'Fan 1\nprojector zone'), (-10.2, 'Fan 2\nPi / brick zone'))):
        d.add(elm.Dot().at((x_bp, yf)).color(POS))
        d.add(elm.Line().at((x_bp, yf)).to((x_load, yf)).color(POS))
        fan = d.add(ic([pin('+', 'L', 'pos', pos=0.85), pin('GND', 'L', 'gnd', pos=0.62),
                        pin('PWM', 'L', 'pwm', pos=0.38), pin('TACH', 'L', 'tach', pos=0.15)],
                       size=(4.0, 2.4)).at((x_load, yf)).anchor('pos')
                    .label(name, fontsize=FSS))
        d.add(elm.Dot().at((x_bn, fan.gnd[1])).color(NEG))
        d.add(elm.Line().at((x_bn, fan.gnd[1])).to(fan.gnd).color(NEG))
        d.add(elm.Line().at(fan.pwm).left(0.8).color(SIG))
        d.add(elm.Line().at(fan.tach).left(0.8).color(SIG))
        note(d, (fan.pwm[0] - 0.9, (fan.pwm[1] + fan.tach[1]) / 2), 'to the Pi\n(signals diagram)', halign='right', color=SIG, fontsize=FSS - 2)
        note(d, (fan.center[0] + 2.2, fan.center[1]), '40 x 40 x 10 mm\n24 V 4-pin PWM\n(right wall)', halign='left')
        if i == 0:
            note(d, (x_bn + 0.3, yf + 0.45), '24 AWG. 24 V fans on the 21 V rail: a 12 V fan would burn.\nCommon ground with the Pi.', halign='left')
    d.save(str(path))


# ----------------------------------------------------------------------------
# Low voltage: the Pi header and every signal
# ----------------------------------------------------------------------------
GPIO_L = ['3V3', 'GPIO2 Amp4', 'GPIO3 Amp4', 'GPIO4 Amp4', 'GND', 'GPIO17', 'GPIO27', 'GPIO22', '3V3',
          'GPIO10', 'GPIO9', 'GPIO11', 'GND', 'ID_SD', 'GPIO5', 'GPIO6', 'GPIO13', 'GPIO19 Amp4', 'GPIO26', 'GND']
GPIO_R = ['5V', '5V', 'GND', 'GPIO14', 'GPIO15', 'GPIO18 Amp4', 'GND', 'GPIO23', 'GPIO24', 'GND',
          'GPIO25', 'GPIO8', 'GPIO7', 'ID_SC', 'GND', 'GPIO12', 'GND', 'GPIO16', 'GPIO20 Amp4', 'GPIO21 Amp4']
PINS_L = [f'{2 * i + 1}  {n}' for i, n in enumerate(GPIO_L)]
PINS_R = [f'{n}  {2 * i + 2}' for i, n in enumerate(GPIO_R)]


def draw_lv_signals(path):
    d = drawing()

    hdr = d.add(elm.Header(rows=20, cols=2, pinsleft=PINS_L, pinsright=PINS_R, shownumber=False,
                           numbering='lr', pinspacing=0.6, pinfontsizeleft=FSS - 1, pinfontsizeright=FSS - 1)
                .right().at((0, 0)).label('Pi 40-pin header: stacking header under the Amp4.\n'
                                  'The Amp4 owns pins 3, 5, 7, 12, 35, 38 and 40.', loc='top', fontsize=FSS, ofst=0.3))

    def y(n):
        return hdr.absanchors[f'pin{n}'][1]

    XLW, XRW = hdr.absanchors['pin1'][0] - 2.3, hdr.absanchors['pin2'][0] + 2.3   # wires start past the pin labels
    XL1, XL2 = -6.0, -11.6     # near and far device columns, left
    XR1, XR2 = 6.4, 13.4       # right

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
                      pin('COM', 'L', 'com', pos=0.37, pin='+ from F3'), pin('NO', 'L', 'no', pos=0.12, pin='+ to projector')],
                     size=(3.0, 3.2)).at((XL2, y(13))).anchor('inp')
                  .label('Relay module\n5 V coil, opto in\nACTIVE-LOW', fontsize=FSS - 2))
    wire([(XLW, y(13)), relay.inp])
    note(d, ((XLW + XL1) / 2, y(13) - 0.32), 'high = contact open (from boot)', fontsize=FSS - 2, color=SIG)

    # IR LED driver: GPIO22 -> R1 -> Q1 base; 5 V -> D1 -> R2 -> collector; emitter -> GND
    yb = y(11) - 5.6
    wire([(XLW, y(15)), (-2.6, y(15)), (-2.6, yb), (-4.6, yb)])
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

    # 1-wire bus off GPIO26 with one 4.7 k pull-up and a DS18B20 per zone
    yw = y(37)
    x_hop = -2.6                        # the GPIO13 wire crosses here on its way under the header
    wire([(XLW, yw), (x_hop + 0.18, yw)])
    d.add(elm.Arc2(k=0.6).at((x_hop + 0.18, yw)).to((x_hop - 0.18, yw)).color(SIG))
    wire([(x_hop - 0.18, yw), (-9.0, yw)])
    d.add(elm.Dot().at((-3.8, yw)).color(SIG))
    d.add(elm.Resistor().at((-3.8, yw)).up().length(1.1).color(SIG).label('R3 4.7 k\none per bus', loc='left', fontsize=FSS - 2))
    d.add(elm.Vdd().label('3.3 V', fontsize=FSS - 1))
    note(d, (XLW - 0.1, yw + 0.22), 'DQ, one bus', halign='right', fontsize=FSS - 2, color=SIG)
    for x, name in ((-4.6, 'DS18B20\nprojector zone\n(near the exhaust)'), (-9.0, 'DS18B20\nPi / brick zone')):
        d.add(elm.Dot().at((x, yw)).color(SIG))
        sens = d.add(ic([pin('DQ', 'T', 'dq'), pin('VDD', 'R', 'vdd', pos=0.5, pin='3.3 V'), pin('GND', 'L', 'gnd', pos=0.5, pin='GND')],
                        size=(1.8, 1.2)).at((x, yw)).anchor('dq').label(name, loc='bottom', fontsize=FSS - 2, ofst=0.25))

    # ---------------- right side (even pins)
    rx = d.add(ic([pin('OUT', 'L', 'out'), pin('VS', 'R', 'vs', pos=0.75, pin='3.3 V, pin 17'),
                   pin('GND', 'R', 'gnd', pos=0.25, pin='GND')], size=(3.6, 1.4))
               .at((XR1, y(16))).anchor('out').label('TSOP38238\nIR receiver', fontsize=FSS - 2))
    note(d, (rx.center[0], rx.center[1] - 1.05), 'optional: learns the remote\'s power code')
    wire([(XRW, y(16)), rx.out])

    def fan(y_tach, name):
        f = d.add(ic([pin('TACH', 'L', 'tach', pos=0.75), pin('PWM', 'L', 'pwm', pos=0.25),
                      pin('+', 'R', 'pos', pos=0.75, pin='21 V rail'), pin('GND', 'R', 'gnd', pos=0.25, pin='GND rail')],
                     size=(3.4, 2.4)).at((XR2, y_tach)).anchor('tach').label(name, fontsize=FSS - 1))
        xr = XR2 - 1.4
        d.add(elm.Dot().at((xr, y_tach)).color(SIG))
        wire([(xr, y_tach), f.tach])
        d.add(elm.Resistor().at((xr, y_tach)).up().length(1.0).color(SIG).label('10 k', loc='right', fontsize=FSS - 2))
        d.add(elm.Vdd().label('3.3 V', fontsize=FSS - 1))
        d.add(elm.Resistor().at((XR2 - 1.6, f.pwm[1])).right().length(1.6).color(SIG).label('1 k', fontsize=FSS - 2))
        return f, (xr, y_tach), (XR2 - 1.6, f.pwm[1])

    f1, tach1, pwm1 = fan(y(18), 'Fan 1\nprojector zone')
    wire([(XRW, y(18)), tach1])
    wire([(XRW, y(32)), (3.8, y(32)), (3.8, y(18) - 3.8 - 0.18)])
    wire([(3.8, y(18) - 3.8 + 0.18), (3.8, pwm1[1]), pwm1])
    note(d, (3.9, (y(32) + pwm1[1]) / 2), 'PWM0', halign='left', fontsize=FSS - 2, color=SIG)

    f2, tach2, pwm2 = fan(y(18) - 3.8, 'Fan 2\nPi / brick zone')
    wire([(XRW, y(22)), (3.5, y(22)), (3.5, tach2[1]), tach2])
    # the PWM0 riser crosses fan 2's tach line: hop over it
    d.add(elm.Arc2(k=0.6).at((3.8, tach2[1] - 0.18)).to((3.8, tach2[1] + 0.18)).color(SIG))
    # GPIO13 is on the odd (left) column: its wire goes under the header to the right side
    y_under = y(39) - 1.0
    wire([(XLW, y(33)), (x_hop, y(33)), (x_hop, y_under), (5.4, y_under), (5.4, pwm2[1]), pwm2])
    note(d, (5.5, (y_under + pwm2[1]) / 2), 'PWM1', halign='left', fontsize=FSS - 2, color=SIG)
    note(d, (f2.center[0], f2.center[1] - 1.9),
         'PWM 25 kHz, 3.3 V logic (the fan pulls it up).\nTach: open collector, 2 pulses per rev.\nPull-ups to 3.3 V only, never the rail.')

    note(d, (0.6, y_under - 2.2),
         'Pin numbers are the header\'s physical pins; GPIO numbers are BCM. HDMI from the Pi to the projector carries CEC, the default power control.\n'
         'Service pins: PIR 17, relay 27, IR LED 22, IR receiver 23, fan PWM 12 / 13, fan tach 24 / 25, 1-wire 26.')
    d.save(str(path))


if __name__ == '__main__':
    draw_hv(DOCS / 'wiring-hv.svg')
    draw_lv_power(DOCS / 'wiring-lv-power.svg')
    draw_lv_signals(DOCS / 'wiring-lv-signals.svg')
    for p in sorted(DOCS.glob('wiring-*.svg')):
        print(f'{p.relative_to(DOCS.parent)}  {p.stat().st_size // 1024} KiB')
