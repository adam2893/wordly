#!/usr/bin/env python3
"""Generate the hand-built SVG theme backgrounds in public/images/themes/.

Each background is portrait (1080x1920) like the other theme art: the
busiest detail sits at the top (behind the header) and bottom (behind the
keyboard), with calmer space in the middle where the board goes. Random
placement is seeded, so re-running produces identical files.

Usage:  python3 tools/make_theme_art.py
"""

import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "images", "themes")
W, H = 1080, 1920


def svg(body, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice">\n'
        f"<defs>{defs}</defs>\n{body}\n</svg>\n"
    )


def f(n):
    return f"{n:.1f}".rstrip("0").rstrip(".")


# -------------------------------------------------------------- terminal

BOOT_LOG = [
    "WORDLY BIOS v2.84  (C) 1984 LEXICON SYSTEMS",
    "MEMORY TEST ........ 640K OK",
    "DETECTING DRIVES ... A: B: C:",
    "LOADING DICTIONARY.DAT",
    "  172823 ENTRIES INDEXED",
    "MOUNTING /GAMES ....... OK",
    "  WORDLY.EXE   BEE.EXE   BOXED.EXE",
    "",
    "C:\\> RUN WORDLY",
    "READY.",
]


def terminal():
    defs = """
<radialGradient id="screen" cx="0.5" cy="0.45" r="0.75">
  <stop offset="0" stop-color="#062a0a"/><stop offset="0.55" stop-color="#021405"/>
  <stop offset="1" stop-color="#000000"/>
</radialGradient>
<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
  <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.85"/>
</radialGradient>
<pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
  <path d="M60,0 H0 V60" fill="none" stroke="#33ff33" stroke-width="1" opacity="0.07"/>
</pattern>
"""
    b = [f'<rect width="{W}" height="{H}" fill="url(#screen)"/>', f'<rect width="{W}" height="{H}" fill="url(#grid)"/>']
    b.append('<g font-family="Courier New, Consolas, monospace" font-size="30" fill="#33ff33" opacity="0.32">')
    for i, line in enumerate(BOOT_LOG):
        esc = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        b.append(f'<text x="60" y="{210 + i * 44}" xml:space="preserve">{esc}</text>')
    b.append('<rect x="60" y="{}" width="18" height="30" opacity="1"/>'.format(210 + len(BOOT_LOG) * 44 - 24))
    b.append("</g>")
    # memory-dump style hex rows along the bottom
    rnd = random.Random(3)
    b.append('<g font-family="Courier New, Consolas, monospace" font-size="24" fill="#33ff33" opacity="0.16">')
    for i in range(12):
        addr = f"{0x7C00 + i * 16:04X}"
        row = " ".join(f"{rnd.randrange(256):02X}" for _ in range(12))
        b.append(f'<text x="60" y="{1400 + i * 36}">{addr}: {row}</text>')
    b.append("</g>")
    b.append(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    b.append(f'<rect x="14" y="14" width="{W - 28}" height="{H - 28}" rx="60" fill="none" stroke="#33ff33" stroke-width="3" opacity="0.18"/>')
    return svg("\n".join(b), defs)


# -------------------------------------------------------------- bubblegum

def bubblegum():
    rnd = random.Random(11)
    ink = "#5a2a52"
    palette = ["#ff8fc7", "#8fd9a8", "#ffd479", "#c7a8ff", "#8fd3ff", "#ffb38a"]
    defs = """
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffd6ea"/><stop offset="0.5" stop-color="#fff0f6"/>
  <stop offset="1" stop-color="#eadcff"/>
</linearGradient>
<pattern id="dots" width="44" height="44" patternUnits="userSpaceOnUse">
  <circle cx="22" cy="22" r="3" fill="#ff8fc7" opacity="0.22"/>
</pattern>
"""
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', f'<rect width="{W}" height="{H}" fill="url(#dots)"/>']

    # scalloped cloud band across the top
    top = [f'<path fill="#ffffff" stroke="{ink}" stroke-width="6" d="M-20,0 L-20,150']
    x = -20
    while x < W + 20:
        r = rnd.uniform(55, 85)
        top.append(f" a{f(r)},{f(r * 0.8)} 0 0 0 {f(r * 2)},0")
        x += r * 2
    top.append(f' L{f(x)},0 Z"/>')
    b.append("".join(top))

    def bubble(cx, cy, r, color):
        return (
            f'<circle cx="{f(cx + r * 0.08)}" cy="{f(cy + r * 0.1)}" r="{f(r)}" fill="{ink}" opacity="0.9"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{color}" stroke="{ink}" stroke-width="6"/>'
            f'<path d="M{f(cx - r * 0.62)},{f(cy - r * 0.05)} A{f(r * 0.62)},{f(r * 0.62)} 0 0 1 {f(cx - r * 0.05)},{f(cy - r * 0.62)}" '
            f'fill="none" stroke="#ffffff" stroke-width="{f(max(6, r * 0.12))}" stroke-linecap="round"/>'
            f'<circle cx="{f(cx + r * 0.1)}" cy="{f(cy - r * 0.68)}" r="{f(max(4, r * 0.07))}" fill="#ffffff"/>'
        )

    bubbles = [
        (130, 330, 120, palette[0]), (930, 300, 95, palette[4]), (720, 420, 50, palette[2]),
        (330, 470, 38, palette[3]), (1010, 640, 60, palette[1]), (60, 720, 45, palette[2]),
        (150, 1530, 110, palette[1]), (960, 1480, 130, palette[3]), (560, 1640, 70, palette[5]),
        (780, 1720, 40, palette[0]), (330, 1320, 34, palette[4]),
    ]
    # sprinkles everywhere except the board's middle band
    for _ in range(140):
        sx, sy = rnd.uniform(0, W), rnd.uniform(160, H)
        if 820 < sy < 1260 and 120 < sx < 960:
            continue
        ang = rnd.uniform(0, 180)
        c = rnd.choice(palette)
        b.append(f'<rect x="{f(sx - 16)}" y="{f(sy - 5)}" width="32" height="10" rx="5" fill="{c}" stroke="{ink}" stroke-width="2.5" transform="rotate({f(ang)} {f(sx)} {f(sy)})"/>')
    for cx, cy, r, c in bubbles:
        b.append(bubble(cx, cy, r, c))

    # candy-stripe wave at the bottom
    stripe_defs = (
        '<pattern id="stripes" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">'
        '<rect width="80" height="80" fill="#ffffff"/><rect width="40" height="80" fill="#ff8fc7"/></pattern>'
    )
    wave = f'<path fill="url(#stripes)" stroke="{ink}" stroke-width="6" d="M-20,1800'
    x = -20
    up = True
    while x < W + 20:
        wave += f" q70,{-50 if up else 50} 140,0"
        x += 140
        up = not up
    wave += f' L{x},{H + 20} L-20,{H + 20} Z"/>'
    b.append(wave)
    return svg("\n".join(b), defs + stripe_defs)


# --------------------------------------------------------------- art deco

def art_deco():
    gold, champagne, emerald = "#d4af37", "#e8d5a3", "#1f6f63"
    defs = f"""
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#07090d"/><stop offset="0.5" stop-color="#0d141b"/>
  <stop offset="1" stop-color="#07090d"/>
</linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#f3dc8a"/><stop offset="0.5" stop-color="{gold}"/>
  <stop offset="1" stop-color="#9c7a22"/>
</linearGradient>
<radialGradient id="halo" cx="0.5" cy="0.12" r="0.5">
  <stop offset="0" stop-color="{gold}" stop-opacity="0.22"/>
  <stop offset="1" stop-color="{gold}" stop-opacity="0"/>
</radialGradient>
"""
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', f'<rect width="{W}" height="{H}" fill="url(#halo)"/>']

    # sunburst fan hanging from the top center
    cx, cy = 540, 60
    for i in range(37):
        a = math.radians(180 - i * 5)
        x2, y2 = cx + math.cos(a) * 620, cy + math.sin(a) * -620
        if y2 < cy:
            y2 = cy + (cy - y2)
        w = 2.5 if i % 2 else 1.2
        b.append(f'<line x1="{cx}" y1="{cy}" x2="{f(x2)}" y2="{f(abs(y2))}" stroke="{gold}" stroke-width="{w}" opacity="{0.55 if i % 2 else 0.3}"/>')
    for r, sw, o in [(140, 3, 0.9), (170, 1.5, 0.7), (330, 3, 0.6), (360, 1.5, 0.45), (560, 2, 0.35)]:
        b.append(f'<path d="M{cx - r},{cy} A{r},{r} 0 0 0 {cx + r},{cy}" fill="none" stroke="{gold}" stroke-width="{sw}" opacity="{o}"/>')
    b.append(f'<path d="M{cx - 110},{cy} A110,110 0 0 0 {cx + 110},{cy} Z" fill="url(#gold)"/>')
    for i in range(9):
        a = math.radians(180 - (i + 0.5) * 20)
        x1, y1 = cx + math.cos(a) * 30, cy - math.sin(a) * -30
        x2, y2 = cx + math.cos(a) * 100, cy - math.sin(a) * -100
        b.append(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="#07090d" stroke-width="5"/>')

    # double frame lines down both sides with chevron stacks
    for x in (36, 52, W - 52, W - 36):
        b.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="{gold}" stroke-width="{2 if x in (36, W - 36) else 1}" opacity="0.6"/>')
    for side in (1, -1):
        x0 = 44 if side == 1 else W - 44
        for i in range(5):
            y = 760 + i * 34
            b.append(f'<path d="M{x0 - 22},{y} L{x0},{y + 18} L{x0 + 22},{y}" fill="none" stroke="{gold}" stroke-width="2" opacity="{0.7 - i * 0.1}"/>')

    # stepped skyline across the bottom
    bldg = []
    rnd = random.Random(5)
    x = 70
    heights = [260, 380, 300, 520, 340, 640, 360, 480, 300, 420, 260]
    widths = [80, 90, 70, 100, 80, 120, 80, 100, 70, 90, 80]
    for h, w in zip(heights, widths):
        top = H - h
        steps = 3
        d = f"M{x},{H} L{x},{top + steps * 30}"
        for s in range(steps):
            inset = (s + 1) * w * 0.12
            d += f" L{f(x + inset - w * 0.12)},{top + (steps - s) * 30} L{f(x + inset)},{top + (steps - s) * 30}"
        d += f" L{f(x + w / 2)},{top - 40}"
        for s in reversed(range(steps)):
            inset = (s + 1) * w * 0.12
            d += f" L{f(x + w - inset)},{top + (steps - s) * 30} L{f(x + w - inset + w * 0.12)},{top + (steps - s) * 30}"
        d += f" L{x + w},{top + steps * 30} L{x + w},{H} Z"
        bldg.append(f'<path d="{d}" fill="#0b1117" stroke="{gold}" stroke-width="2" opacity="0.95"/>')
        # lit window columns
        for wx in (x + w * 0.3, x + w * 0.5, x + w * 0.7):
            for wy in range(int(top + 140), H - 30, 46):
                if rnd.random() < 0.4:
                    bldg.append(f'<rect x="{f(wx - 3)}" y="{wy}" width="6" height="18" fill="{champagne}" opacity="{f(rnd.uniform(0.35, 0.8))}"/>')
        x += w + 8
    b += bldg
    b.append(f'<rect x="0" y="{H - 6}" width="{W}" height="6" fill="{gold}"/>')
    # emerald diamond accents
    for dx, dy in [(540, 880), (190, 1210), (890, 1210)]:
        b.append(f'<path d="M{dx},{dy - 22} L{dx + 14},{dy} L{dx},{dy + 22} L{dx - 14},{dy} Z" fill="{emerald}" stroke="{gold}" stroke-width="2" opacity="0.55"/>')
    return svg("\n".join(b), defs)


# --------------------------------------------------------------- tropical

def palm(x, y, scale, flip, color):
    """A palm tree leaning in from a side edge: curved trunk plus fronds."""
    sx = -1 if flip else 1
    parts = []
    # trunk: a tapered curve from the ground up to the crown
    tx, ty = x + sx * 160 * scale, y - 520 * scale
    parts.append(
        f'<path d="M{f(x - 22 * scale)},{f(y)} Q{f(x + sx * 40 * scale)},{f(y - 300 * scale)} {f(tx)},{f(ty)} '
        f'L{f(tx + sx * 18 * scale)},{f(ty + 10 * scale)} Q{f(x + sx * 70 * scale)},{f(y - 290 * scale)} {f(x + 22 * scale)},{f(y)} Z" fill="{color}"/>'
    )
    for i in range(7):
        a = math.radians(-170 + i * 28)
        length = (230 + (i % 2) * 60) * scale
        ex, ey = tx + math.cos(a) * length * sx, ty + math.sin(a) * length * 0.75 + 60 * scale
        mx, my = tx + math.cos(a) * length * 0.5 * sx, ty + math.sin(a) * length * 0.55 - 30 * scale
        w = 26 * scale
        parts.append(
            f'<path d="M{f(tx)},{f(ty)} Q{f(mx)},{f(my - w)} {f(ex)},{f(ey)} Q{f(mx)},{f(my + w)} {f(tx)},{f(ty)} Z" fill="{color}"/>'
        )
    for cx in (-14, 8, 26):
        parts.append(f'<circle cx="{f(tx + sx * cx * scale)}" cy="{f(ty + 22 * scale)}" r="{f(14 * scale)}" fill="{color}"/>')
    return "".join(parts)


def hibiscus(cx, cy, r, petal, center):
    out = []
    for i in range(5):
        a = math.radians(i * 72 - 90)
        px, py = cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55
        out.append(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(r * 0.55)}" ry="{f(r * 0.42)}" fill="{petal}" transform="rotate({f(i * 72)} {f(px)} {f(py)})"/>')
    out.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.2)}" fill="{center}"/>')
    a = math.radians(-40)
    out.append(f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(cx + math.cos(a) * r * 0.75)}" y2="{f(cy + math.sin(a) * r * 0.75)}" stroke="{center}" stroke-width="{f(r * 0.06)}" stroke-linecap="round"/>')
    return "".join(out)


def tropical():
    rnd = random.Random(21)
    defs = """
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#0a5d73"/><stop offset="0.35" stop-color="#0b4f5c"/>
  <stop offset="0.7" stop-color="#073a44"/><stop offset="1" stop-color="#05262c"/>
</linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#ffe9a8"/><stop offset="0.6" stop-color="#ffc35a" stop-opacity="0.9"/>
  <stop offset="1" stop-color="#ff9f43" stop-opacity="0"/>
</radialGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#18b6b0"/><stop offset="1" stop-color="#0a7f86"/>
</linearGradient>
"""
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    b.append('<circle cx="760" cy="230" r="210" fill="url(#sun)" opacity="0.85"/>')
    # gentle wave lines across the middle, kept faint for the board
    for i in range(10):
        y = 700 + i * 70
        d = f"M-20,{y}"
        x = -20
        while x < W + 40:
            d += f" q40,-14 80,0 t80,0"
            x += 160
        b.append(f'<path d="{d}" fill="none" stroke="#5fe0d0" stroke-width="3" opacity="{f(0.05 + 0.012 * i)}"/>')
    # sea + sand along the bottom
    b.append(f'<path d="M0,1560 C220,1530 420,1590 620,1560 S960,1530 {W},1570 L{W},{H} L0,{H} Z" fill="url(#sea)" opacity="0.9"/>')
    b.append(f'<path d="M0,1640 C200,1620 380,1665 560,1648 S900,1620 {W},1650 L{W},{H} L0,{H} Z" fill="#5fd3c4" opacity="0.55"/>')
    b.append(f'<path d="M0,1730 C260,1700 520,1760 780,1730 S1000,1715 {W},1725 L{W},{H} L0,{H} Z" fill="#f2d49b"/>')
    for _ in range(90):
        sx, sy = rnd.uniform(0, W), rnd.uniform(1750, H)
        b.append(f'<circle cx="{f(sx)}" cy="{f(sy)}" r="{f(rnd.uniform(1.5, 3.5))}" fill="#c9a66b" opacity="0.6"/>')
    # palms leaning in from both sides
    b.append(palm(-40, 1780, 1.25, False, "#032127"))
    b.append(palm(W + 30, 1820, 1.05, True, "#032127"))
    b.append(palm(1010, 1760, 0.7, True, "#06323a"))
    # leafy corners at the top (behind the header)
    for cx, flip in ((0, 1), (W, -1)):
        for i in range(6):
            a = math.radians(10 + i * 14)
            length = 330 - i * 20
            ex, ey = cx + math.cos(a) * length * flip, math.sin(a) * length
            mx, my = cx + math.cos(a) * length * 0.5 * flip, math.sin(a) * length * 0.5
            b.append(f'<path d="M{cx},-10 Q{f(mx - 30 * flip)},{f(my + 40)} {f(ex)},{f(ey)} Q{f(mx + 30 * flip)},{f(my - 40)} {cx},-10 Z" fill="#0f6b4a" opacity="{f(0.85 - i * 0.08)}"/>')
    for cx, cy, r, c in [(150, 260, 70, "#ff4f7b"), (920, 470, 48, "#ff7a3d"), (980, 1380, 64, "#ff4f7b"), (90, 1300, 44, "#ffb03b")]:
        b.append(hibiscus(cx, cy, r, c, "#ffe066"))
    return svg("\n".join(b), defs)


# ----------------------------------------------------------------- desert

def saguaro(x, base, h, color):
    w = h * 0.12
    out = [f'<rect x="{f(x - w / 2)}" y="{f(base - h)}" width="{f(w)}" height="{f(h)}" rx="{f(w / 2)}" fill="{color}"/>']
    for side, at, arm in ((-1, 0.55, 0.32), (1, 0.4, 0.28)):
        ay = base - h * at
        ax = x + side * w * 1.6
        out.append(f'<path d="M{f(x)},{f(ay)} H{f(ax)} V{f(ay - h * arm)}" fill="none" stroke="{color}" stroke-width="{f(w * 0.75)}" stroke-linecap="round" stroke-linejoin="round"/>')
    return "".join(out)


def desert():
    rnd = random.Random(31)
    defs = """
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#1b1030"/><stop offset="0.3" stop-color="#4a2245"/>
  <stop offset="0.55" stop-color="#9a3f3a"/><stop offset="0.72" stop-color="#e07a3a"/>
  <stop offset="0.8" stop-color="#f2b05a"/><stop offset="1" stop-color="#f2b05a"/>
</linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#fff1c2"/><stop offset="0.55" stop-color="#ffc45e"/>
  <stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
</radialGradient>
"""
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    # stars in the dark upper sky
    for _ in range(120):
        sx, sy = rnd.uniform(0, W), rnd.uniform(0, 650)
        b.append(f'<circle cx="{f(sx)}" cy="{f(sy)}" r="{f(rnd.uniform(1, 2.8))}" fill="#fff4dc" opacity="{f(rnd.uniform(0.3, 0.9))}"/>')
    b.append('<circle cx="820" cy="190" r="46" fill="#f5ead2" opacity="0.9"/><circle cx="840" cy="178" r="42" fill="#1b1030" opacity="0.95"/>')
    # setting sun behind the mesas
    b.append('<circle cx="380" cy="1470" r="260" fill="url(#sun)"/>')
    # far mesas
    b.append(f'<path d="M0,1500 L70,1500 L95,1400 L330,1400 L360,1500 L560,1500 L590,1440 L700,1440 L730,1500 L{W},1500 L{W},{H} L0,{H} Z" fill="#7a3340" opacity="0.85"/>')
    # near buttes
    b.append(f'<path d="M0,1600 L540,1600 L560,1520 L620,1510 L640,1440 L760,1440 L790,1520 L860,1530 L880,1600 L{W},1600 L{W},{H} L0,{H} Z" fill="#4c1f2e"/>')
    # dunes
    b.append(f'<path d="M0,1690 C240,1640 470,1720 700,1680 S990,1650 {W},1675 L{W},{H} L0,{H} Z" fill="#2c1422"/>')
    b.append(saguaro(170, 1700, 330, "#1c0c16"))
    b.append(saguaro(930, 1690, 240, "#1c0c16"))
    b.append(saguaro(780, 1710, 150, "#241019"))
    # cliff silhouette edges at the top so the header has a dark backing
    b.append(f'<rect width="{W}" height="200" fill="#120a20" opacity="0.35"/>')
    return svg("\n".join(b), defs)


# ---------------------------------------------------------------- dessert

def dessert():
    rnd = random.Random(41)
    choc, cream = "#5a3221", "#fff6ea"
    defs = """
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fbe3ec"/><stop offset="0.5" stop-color="#fff6ea"/>
  <stop offset="1" stop-color="#fde9d2"/>
</linearGradient>
<pattern id="waffle" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect width="56" height="56" fill="#e6a85c"/><rect x="4" y="4" width="48" height="48" rx="6" fill="#f2c27f"/>
</pattern>
<pattern id="dots" width="48" height="48" patternUnits="userSpaceOnUse">
  <circle cx="24" cy="24" r="3" fill="#e9a7bd" opacity="0.25"/>
</pattern>
"""
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', f'<rect width="{W}" height="{H}" fill="url(#dots)"/>']

    # chocolate ganache dripping from the top edge
    d = "M0,0 L0,120"
    x = 0
    while x < W:
        w = rnd.uniform(60, 120)
        drip = rnd.uniform(40, 170)
        d += f" C{f(x + w * 0.15)},120 {f(x + w * 0.2)},{f(120 + drip)} {f(x + w * 0.5)},{f(120 + drip)}"
        d += f" C{f(x + w * 0.8)},{f(120 + drip)} {f(x + w * 0.85)},120 {f(x + w)},120"
        x += w
    d += f" L{f(x)},0 Z"
    b.append(f'<path d="{d}" fill="{choc}"/>')
    b.append(f'<path d="M0,30 H{W}" stroke="#7a4a33" stroke-width="10" opacity="0.5"/>')
    sprinkle = ["#ff7aa8", "#7cc8f2", "#ffd35c", "#9ad884", "#ffffff"]
    for _ in range(60):
        sx, sy = rnd.uniform(0, W), rnd.uniform(10, 110)
        b.append(f'<rect x="{f(sx - 11)}" y="{f(sy - 3.5)}" width="22" height="7" rx="3.5" fill="{rnd.choice(sprinkle)}" transform="rotate({f(rnd.uniform(0, 180))} {f(sx)} {f(sy)})"/>')

    def donut(cx, cy, r, icing):
        o = [f'<circle cx="{f(cx)}" cy="{f(cy + r * 0.08)}" r="{f(r)}" fill="#c98a4b"/>',
             f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="#e2a86a"/>',
             f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.86)}" fill="{icing}"/>',
             f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.32)}" fill="#fbe3ec"/>']
        for _ in range(int(r / 5)):
            a = rnd.uniform(0, math.tau)
            rr = rnd.uniform(r * 0.42, r * 0.78)
            px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr
            o.append(f'<rect x="{f(px - r * 0.07)}" y="{f(py - r * 0.025)}" width="{f(r * 0.14)}" height="{f(r * 0.05)}" rx="{f(r * 0.025)}" fill="{rnd.choice(sprinkle)}" transform="rotate({f(rnd.uniform(0, 180))} {f(px)} {f(py)})"/>')
        return "".join(o)

    def macaron(cx, cy, w, color):
        h = w * 0.36
        return (f'<rect x="{f(cx - w / 2)}" y="{f(cy - h)}" width="{f(w)}" height="{f(h)}" rx="{f(h / 2)}" fill="{color}"/>'
                f'<rect x="{f(cx - w * 0.46)}" y="{f(cy - h * 0.15)}" width="{f(w * 0.92)}" height="{f(h * 0.3)}" rx="{f(h * 0.15)}" fill="{cream}"/>'
                f'<rect x="{f(cx - w / 2)}" y="{f(cy + h * 0.1)}" width="{f(w)}" height="{f(h)}" rx="{f(h / 2)}" fill="{color}"/>')

    def cone(cx, base, h, scoops):
        w = h * 0.42
        o = [f'<path d="M{f(cx - w / 2)},{f(base - h)} L{f(cx)},{f(base)} L{f(cx + w / 2)},{f(base - h)} Z" fill="url(#waffle)"/>']
        y = base - h
        for i, c in enumerate(scoops):
            r = w * (0.62 - i * 0.06)
            o.append(f'<circle cx="{f(cx)}" cy="{f(y - r * 0.45)}" r="{f(r)}" fill="{c}"/>')
            o.append(f'<path d="M{f(cx - r)},{f(y - r * 0.2)} q{f(r * 0.33)},{f(r * 0.35)} {f(r * 0.66)},0 t{f(r * 0.66)},0 t{f(r * 0.68)},0" fill="{c}"/>')
            y -= r * 1.15
        o.append(f'<circle cx="{f(cx + 4)}" cy="{f(y + 6)}" r="{f(w * 0.12)}" fill="#d62a4b"/>')
        return "".join(o)

    b.append(donut(150, 420, 96, "#ff8fb4"))
    b.append(donut(950, 560, 70, "#7a4a33"))
    b.append(macaron(880, 330, 130, "#a8dcc4"))
    b.append(macaron(110, 690, 90, "#c9b2f0"))
    # bottom: ice cream cones and macarons on a cream ledge
    b.append(f'<rect x="0" y="1790" width="{W}" height="{H - 1790}" fill="#f6dcc0"/>')
    b.append(f'<path d="M0,1790 H{W}" stroke="#e6bf94" stroke-width="8"/>')
    b.append(cone(160, 1790, 300, ["#ffd1dc", "#fff2c9"]))
    b.append(cone(900, 1790, 260, ["#a8dcc4", "#7a4a33"]))
    b.append(macaron(420, 1760, 110, "#ff9fbf"))
    b.append(macaron(560, 1770, 96, "#ffd78a"))
    b.append(macaron(700, 1762, 104, "#c9b2f0"))
    b.append(donut(985, 1190, 62, "#ffd78a"))
    b.append(donut(85, 1230, 54, "#a8dcc4"))
    return svg("\n".join(b), defs)


def main():
    for name, fn in [
        ("terminal", terminal),
        ("bubblegum", bubblegum),
        ("art-deco", art_deco),
        ("tropical", tropical),
        ("desert", desert),
        ("dessert", dessert),
    ]:
        path = os.path.join(OUT, f"{name}.svg")
        with open(path, "w") as fh:
            fh.write(fn())
        print(f"{name}.svg  {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    main()
