"""Rendu SVG + contrôles anti-chevauchement. Sans dépendance (stdlib)."""
import json, math, shutil, subprocess
from pathlib import Path

THEME = json.loads((Path(__file__).parent / "theme.json").read_text(encoding="utf-8"))
HEAD, COLW, LANE_H, TOP = 130, 230, 150, 56
NW, NH, GW, GH, R = 170, 76, 150, 104, 17
FS = 12
CHAR = 0.60  # largeur moyenne d'un caractère / taille de police (estimation prudente)


def tw(s, fs=FS): return len(s) * fs * CHAR


def wrap(text, width, fs=FS):
    maxc = max(4, int(width / (fs * CHAR)))
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if len(t) <= maxc or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class Layout:
    def __init__(self, p):
        self.p = p
        self.lane_y = {l[0]: TOP + i * LANE_H for i, l in enumerate(p.lanes)}
        self.ncols = max(n.col for n in p.nodes.values()) + 1
        self.W = HEAD + self.ncols * COLW
        self.H = TOP + len(p.lanes) * LANE_H
        self.texts = []   # (x0,y0,x1,y1,desc)
        self.rects = {}   # id -> (x0,y0,x1,y1) forme
        self.segs = []    # (flowidx, (x0,y0,x1,y1))
        self.errors = []

    def cx(self, n): return HEAD + n.col * COLW + COLW / 2
    def cy(self, n): return self.lane_y[n.lane] + LANE_H / 2

    def size(self, n):
        if n.kind == "gateway": return GW, GH
        if n.kind == "task": return NW, NH
        return 2 * R, 2 * R


def build(p):
    L = Layout(p)
    out = []
    A = out.append
    f, t = THEME["font"], THEME["text"]
    A(f'<svg xmlns="http://www.w3.org/2000/svg" width="{L.W}" height="{L.H}" viewBox="0 0 {L.W} {L.H}" font-family="{f}" font-size="{FS}">')
    A(f'<rect width="{L.W}" height="{L.H}" fill="{THEME["background"]}"/>')
    A(f'<text x="14" y="30" font-size="18" font-weight="bold" fill="{t}">{esc(p.title)}</text>')
    L.texts.append((14, 14, 14 + tw(p.title, 18), 34, "titre"))
    # couloirs
    for lid, lname, role in p.lanes:
        y = L.lane_y[lid]
        fill = THEME["lane_roles"][role]["fill"]
        A(f'<rect x="0" y="{y}" width="{L.W}" height="{LANE_H}" fill="{fill}" stroke="{THEME["lane_border"]}"/>')
        A(f'<rect x="0" y="{y}" width="{HEAD - 30}" height="{LANE_H}" fill="{fill}" stroke="{THEME["lane_border"]}"/>')
        ls = wrap(lname, HEAD - 50, 13)
        cyl = y + LANE_H / 2
        for i, s in enumerate(ls):
            ty = cyl + (i - (len(ls) - 1) / 2) * 16 + 4
            A(f'<text x="{(HEAD-30)/2}" y="{ty}" text-anchor="middle" font-size="13" font-weight="bold" fill="{t}">{esc(s)}</text>')
            L.texts.append(((HEAD-30)/2 - tw(s, 13)/2, ty - 12, (HEAD-30)/2 + tw(s, 13)/2, ty + 4, f"couloir {lid}"))
    # formes
    shapes = []
    for n in p.nodes.values():
        x, y = L.cx(n), L.cy(n)
        w, h = L.size(n)
        L.rects[n.id] = (x - w/2, y - h/2, x + w/2, y + h/2)
        k = THEME["kinds"][n.kind]
        if n.kind in ("start", "end", "error"):
            sw = 1.6 if n.kind == "start" else 4
            shapes.append(f'<circle cx="{x}" cy="{y}" r="{R}" fill="{k["fill"]}" stroke="{k["stroke"]}" stroke-width="{sw}"/>')
            if n.kind == "error":
                shapes.append(f'<path d="M{x-7},{y-7} L{x+7},{y+7} M{x+7},{y-7} L{x-7},{y+7}" stroke="{k["stroke"]}" stroke-width="2.4"/>')
            if n.kind == "start":   # libellé sous le cercle (rien n'arrive par le bas)
                lines = wrap(n.label, COLW - 40)
                if len(lines) > 4: L.errors.append(f"{p.slug}: libellé trop long ({n.id})")
                for i, s in enumerate(lines):
                    ty = y + R + 15 + i * 14
                    shapes.append(f'<text x="{x}" y="{ty}" text-anchor="middle" fill="{t}">{esc(s)}</text>')
                    L.texts.append((x - tw(s)/2, ty - 11, x + tw(s)/2, ty + 3, f"début {n.id}"))
            else:                   # fins : libellé à droite, jamais traversé par un flux
                lines = wrap(n.label, 80, 11)
                if len(lines) > 6: L.errors.append(f"{p.slug}: libellé trop long ({n.id})")
                for i, s in enumerate(lines):
                    ty = y + (i - (len(lines) - 1) / 2) * 13 + 4
                    shapes.append(f'<text x="{x+R+7}" y="{ty}" font-size="11" fill="{t}">{esc(s)}</text>')
                    L.texts.append((x + R + 7, ty - 10, x + R + 7 + tw(s, 11), ty + 3, f"fin {n.id}"))
        elif n.kind == "task":
            shapes.append(f'<rect x="{x-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="10" fill="{k["fill"]}" stroke="{k["stroke"]}" stroke-width="1.8"/>')
            lines = wrap(n.label, w - 16)
            if len(lines) * 14 > h - 8: L.errors.append(f"{p.slug}: texte déborde de la tâche {n.id} ({len(lines)} lignes)")
            for i, s in enumerate(lines):
                ty = y + (i - (len(lines) - 1) / 2) * 14 + 4
                shapes.append(f'<text x="{x}" y="{ty}" text-anchor="middle" fill="{t}">{esc(s)}</text>')
                if tw(s) > w - 8: L.errors.append(f"{p.slug}: ligne trop large dans {n.id}: {s}")
        else:
            shapes.append(f'<polygon points="{x},{y-h/2} {x+w/2},{y} {x},{y+h/2} {x-w/2},{y}" fill="{k["fill"]}" stroke="{k["stroke"]}" stroke-width="2"/>')
            lines = wrap(n.label, w * 0.52, 11)
            if len(lines) > 4: L.errors.append(f"{p.slug}: texte déborde de la passerelle {n.id}")
            for i, s in enumerate(lines):
                ty = y + (i - (len(lines) - 1) / 2) * 13 + 4
                shapes.append(f'<text x="{x}" y="{ty}" text-anchor="middle" font-size="11" fill="{t}">{esc(s)}</text>')
                if tw(s, 11) > w * 0.55: L.errors.append(f"{p.slug}: ligne trop large dans passerelle {n.id}: {s}")
    # flux (traits simples, sans pointe de flèche)
    flows = []
    for i, (a, b, lab) in enumerate(p.flows):
        na, nb = p.nodes[a], p.nodes[b]
        ra, rb = L.rects[a], L.rects[b]
        ax, ay, bx, by = L.cx(na), L.cy(na), L.cx(nb), L.cy(nb)
        if nb.col < na.col or (nb.col == na.col and nb.lane == na.lane):
            L.errors.append(f"{p.slug}: flux {a}->{b} non orienté vers la droite/vertical"); continue
        if nb.col == na.col:
            if by > ay: pts = [(ax, ra[3]), (ax, rb[1])]; lp = (ax + 6, ra[3] + 15, "start")
            else:       pts = [(ax, ra[1]), (ax, rb[3])]; lp = (ax + 6, ra[1] - 6, "start")
        elif na.kind == "gateway" and nb.lane != na.lane:
            if by > ay: pts = [(ax, ra[3]), (ax, by), (rb[0], by)]; lp = (ax + 6, ra[3] + 15, "start")
            else:       pts = [(ax, ra[1]), (ax, by), (rb[0], by)]; lp = (ax + 6, ra[1] - 6, "start")
        else:
            mx = rb[0] - 28
            pts = [(ra[2], ay)]
            if abs(ay - by) > 1: pts += [(mx, ay), (mx, by)]
            pts.append((rb[0], by))
            lp = (ra[2] + 5, ay - 6, "start")
        flows.append(f'<polyline points="{" ".join(f"{x},{y}" for x, y in pts)}" fill="none" stroke="{THEME["line"]}" stroke-width="1.8"/>')
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            L.segs.append((i, (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))))
        if lab:
            x, y, _ = lp
            flows.append(f'<text x="{x}" y="{y}" font-size="11" font-weight="bold" fill="{t}">{esc(lab)}</text>')
            L.texts.append((x, y - 11, x + tw(lab, 11), y + 3, f"étiquette {a}->{b}"))
    out += flows + shapes
    A("</svg>")
    return L, "\n".join(out)


def _hit(a, b, m=1):
    return a[0] < b[2] - m and b[0] < a[2] - m and a[1] < b[3] - m and b[1] < a[3] - m


def check(p):
    L, _ = build(p)
    errs = list(L.errors)
    T = L.texts
    for i in range(len(T)):
        for j in range(i + 1, len(T)):
            if _hit(T[i][:4], T[j][:4]): errs.append(f"{p.slug}: chevauchement de libellés « {T[i][4]} » / « {T[j][4]} »")
    for tx in T:
        for fi, sg in L.segs:
            if _hit(tx[:4], (sg[0] - 2, sg[1] - 2, sg[2] + 2, sg[3] + 2), 0): errs.append(f"{p.slug}: trait du flux {p.flows[fi][0]}->{p.flows[fi][1]} sur le libellé « {tx[4]} »")
        for nid, r in L.rects.items():
            if tx[4].endswith(nid) or tx[4].startswith("titre") or tx[4].startswith("couloir"): continue
            if _hit(tx[:4], r): errs.append(f"{p.slug}: libellé « {tx[4]} » sur la forme {nid}")
    for fi, sg in L.segs:
        a, b, _ = p.flows[fi]
        for nid, r in L.rects.items():
            if nid in (a, b): continue
            if _hit(sg, r, 0): errs.append(f"{p.slug}: flux {a}->{b} traverse la forme {nid}")
    for tx in T:
        if tx[2] > L.W or tx[0] < 0 or tx[3] > L.H: errs.append(f"{p.slug}: libellé « {tx[4]} » hors image")
    return sorted(set(errs))


def render_svg(p): return build(p)[1]


def to_png(svg_path):
    png = svg_path.with_suffix(".png")
    for cmd in (["rsvg-convert", "-o", str(png), str(svg_path)], ["convert", "-density", "110", str(svg_path), str(png)]):
        if shutil.which(cmd[0]):
            if subprocess.run(cmd, capture_output=True).returncode == 0: return png
    return None
