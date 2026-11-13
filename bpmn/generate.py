#!/usr/bin/env python3
"""Génère out/*.png (le SVG n'est qu'un intermédiaire jeté). Échoue si des libellés se chevauchent.
Nécessite rsvg-convert ou ImageMagick. Usage : python3 generate.py"""
import sys, tempfile
from pathlib import Path
from bpmn_kit import render_svg, check, to_png
from processes import ALL

out = Path(__file__).parent / "out"
out.mkdir(exist_ok=True)
for old in out.glob("*"): old.unlink()
errs = []
with tempfile.TemporaryDirectory() as tmp:
    for build in ALL:
        p = build()
        errs += check(p)
        svg = Path(tmp) / f"{p.slug}.svg"
        svg.write_text(render_svg(p), encoding="utf-8")
        png = to_png(svg)
        if png is None:
            sys.exit("Aucun convertisseur SVG→PNG (rsvg-convert ou ImageMagick)")
        png.replace(out / png.name)
if errs:
    print("\n".join(errs)); sys.exit(1)
print(f"{len(ALL)} PNG générés dans {out}")
