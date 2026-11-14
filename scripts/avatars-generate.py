#!/usr/bin/env python3
# Génère les avatars du jeu : docs/avatars-apercu.html (aperçu), shared/avatars.ts (liste et prix) et front/src/avatars/svg.ts (dessins).
# Pour changer un dessin ou un prix : modifier ce fichier puis lancer  python3 scripts/avatars-generate.py  (les deux fichiers générés sont à committer).
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
A = {}  # id -> (nom, prix, fond, corps SVG)
def add(i, nom, prix, fond, corps): A[i] = (nom, prix, fond, corps)

wheel = lambda x, y, r, c="#1f2937", h="#9ca3af": f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/><circle cx="{x}" cy="{y}" r="{r/2.6:.1f}" fill="{h}"/>'
face = lambda cx, cy, r: f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#f3c9a0"/><circle cx="{cx-7}" cy="{cy}" r="2.2" fill="#1f2937"/><circle cx="{cx+7}" cy="{cy}" r="2.2" fill="#1f2937"/>'

# --- Gratuits : trains et personnages ---
add("loco", "Locomotive à vapeur", 0, "#cfe8ff", f'''<rect x="0" y="80" width="100" height="20" fill="#9bd66f"/><rect x="0" y="80" width="100" height="3" fill="#475569"/>
<rect x="24" y="34" width="12" height="4" fill="#111827"/><rect x="27" y="38" width="6" height="10" fill="#111827"/><rect x="20" y="46" width="46" height="22" rx="3" fill="#374151"/>
<rect x="58" y="34" width="22" height="34" rx="2" fill="#b91c1c"/><rect x="55" y="31" width="28" height="5" fill="#7f1d1d"/><rect x="63" y="40" width="10" height="10" fill="#fde68a"/>{wheel(32,72,8)}{wheel(52,72,8)}{wheel(72,74,6)}''')
add("wagon", "Wagon", 0, "#fde7c7", f'''<rect x="0" y="82" width="100" height="18" fill="#c9b784"/><rect x="0" y="82" width="100" height="3" fill="#475569"/>
<rect x="14" y="40" width="72" height="34" rx="4" fill="#2563eb"/><rect x="14" y="54" width="72" height="4" fill="#fff"/>
<rect x="22" y="44" width="11" height="8" fill="#fde68a"/><rect x="38" y="44" width="11" height="8" fill="#fde68a"/><rect x="54" y="44" width="11" height="8" fill="#fde68a"/><rect x="70" y="44" width="11" height="8" fill="#fde68a"/>{wheel(30,78,7)}{wheel(70,78,7)}''')
add("gare", "Gare", 0, "#fbe3e3", '''<rect x="18" y="46" width="64" height="32" fill="#fdf3dc"/><polygon points="12,48 50,24 88,48" fill="#b45309"/><rect x="44" y="58" width="12" height="20" fill="#7c2d12"/>
<rect x="26" y="54" width="12" height="12" fill="#93c5fd"/><rect x="62" y="54" width="12" height="12" fill="#93c5fd"/><circle cx="50" cy="40" r="5.5" fill="#fff" stroke="#374151" stroke-width="1.5"/><rect x="8" y="78" width="84" height="7" fill="#94a3b8"/>''')
add("conducteur", "Conducteur", 0, "#cfe8ff", f'''<path d="M18 100 q0 -24 32 -24 q32 0 32 24z" fill="#1e3a8a"/><polygon points="43,77 57,77 50,90" fill="#fff"/>
{face(50,56,20)}<rect x="30" y="28" width="40" height="11" rx="4" fill="#1e3a8a"/><rect x="28" y="37" width="48" height="5" rx="2" fill="#172554"/><circle cx="50" cy="33" r="3" fill="#fbbf24"/>
<path d="M42 65 q8 5 16 0" fill="none" stroke="#5b3a21" stroke-width="3" stroke-linecap="round"/>''')
add("controleur", "Contrôleur", 0, "#fde7c7", f'''<path d="M18 100 q0 -24 32 -24 q32 0 32 24z" fill="#b91c1c"/><circle cx="50" cy="86" r="2" fill="#fbbf24"/><circle cx="50" cy="94" r="2" fill="#fbbf24"/>
<path d="M62 78 q10 6 4 18" fill="none" stroke="#fbbf24" stroke-width="1.5"/><circle cx="66" cy="97" r="4" fill="#fbbf24"/>
{face(50,56,20)}<rect x="32" y="24" width="36" height="14" rx="3" fill="#b91c1c"/><rect x="29" y="37" width="42" height="4" rx="2" fill="#7f1d1d"/><rect x="32" y="32" width="36" height="3" fill="#fff"/>
<path d="M43 65 q7 5 14 0" fill="none" stroke="#7c2d12" stroke-width="2.5" stroke-linecap="round"/>''')

# --- Animaux du jeu ---
add("chat", "Chat", 0, "#fde7c7", '''<polygon points="28,44 32,16 48,33" fill="#9ca3af"/><polygon points="72,44 68,16 52,33" fill="#9ca3af"/><polygon points="33,38 34,24 42,33" fill="#f9a8d4"/><polygon points="67,38 66,24 58,33" fill="#f9a8d4"/>
<circle cx="50" cy="56" r="25" fill="#9ca3af"/><ellipse cx="41" cy="52" rx="4" ry="5" fill="#fde68a"/><ellipse cx="59" cy="52" rx="4" ry="5" fill="#fde68a"/><rect x="40" y="48" width="2" height="9" fill="#111827"/><rect x="58" y="48" width="2" height="9" fill="#111827"/>
<polygon points="46,62 54,62 50,67" fill="#f472b6"/><path d="M50 67 q-5 5 -9 2 M50 67 q5 5 9 2" fill="none" stroke="#374151" stroke-width="1.5"/>
<g stroke="#fff" stroke-width="1.2"><line x1="22" y1="62" x2="38" y2="64"/><line x1="22" y1="68" x2="38" y2="67"/><line x1="78" y1="62" x2="62" y2="64"/><line x1="78" y1="68" x2="62" y2="67"/></g>''')
add("lapin", "Lapin", 0, "#dff3e3", '''<ellipse cx="40" cy="30" rx="7" ry="19" fill="#f3f4f6"/><ellipse cx="60" cy="30" rx="7" ry="19" fill="#f3f4f6"/><ellipse cx="40" cy="32" rx="3" ry="13" fill="#fbcfe8"/><ellipse cx="60" cy="32" rx="3" ry="13" fill="#fbcfe8"/>
<circle cx="50" cy="64" r="22" fill="#f3f4f6"/><circle cx="42" cy="60" r="2.5" fill="#1f2937"/><circle cx="58" cy="60" r="2.5" fill="#1f2937"/><circle cx="50" cy="67" r="3" fill="#f472b6"/>
<rect x="47" y="71" width="6" height="7" rx="1.5" fill="#fff" stroke="#9ca3af" stroke-width="1"/>''')
add("canard", "Canard", 0, "#cfe8ff", '''<rect x="0" y="76" width="100" height="24" fill="#4aa8e8"/><ellipse cx="46" cy="66" rx="28" ry="17" fill="#fde047"/><circle cx="64" cy="42" r="14" fill="#fde047"/>
<polygon points="74,41 90,46 74,51" fill="#f97316"/><circle cx="66" cy="38" r="2.3" fill="#1f2937"/><ellipse cx="40" cy="66" rx="14" ry="8" fill="#eab308"/><path d="M0 78 q12 -4 24 0 t24 0 t24 0 t24 0" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>''')
add("ecureuil", "Écureuil", 150, "#dff3e3", '''<path d="M30 74 C4 64 8 18 34 22 C20 34 26 54 42 62Z" fill="#ea580c"/><ellipse cx="46" cy="68" rx="17" ry="20" fill="#c2410c"/><circle cx="54" cy="44" r="13" fill="#c2410c"/>
<polygon points="46,34 48,22 55,32" fill="#c2410c"/><polygon points="60,34 64,23 66,36" fill="#c2410c"/><ellipse cx="50" cy="72" rx="9" ry="13" fill="#fde7c7"/><circle cx="58" cy="42" r="2.3" fill="#1f2937"/><circle cx="65" cy="47" r="2.3" fill="#1f2937"/>
<rect x="8" y="88" width="84" height="5" fill="#5b3a21"/>''')
add("hibou", "Hibou", 150, "#1f2a44", '''<circle cx="80" cy="18" r="8" fill="#e5e7eb"/><polygon points="30,28 42,40 28,42" fill="#78350f"/><polygon points="70,28 58,40 72,42" fill="#78350f"/><ellipse cx="50" cy="58" rx="23" ry="28" fill="#78350f"/><ellipse cx="50" cy="68" rx="14" ry="18" fill="#d6b88a"/>
<circle cx="40" cy="46" r="9" fill="#fde68a"/><circle cx="60" cy="46" r="9" fill="#fde68a"/><circle cx="40" cy="46" r="3.5" fill="#111827"/><circle cx="60" cy="46" r="3.5" fill="#111827"/><polygon points="46,52 54,52 50,60" fill="#f59e0b"/><rect x="16" y="86" width="68" height="5" rx="2" fill="#5b3a21"/>''')
add("cerf", "Cerf", 300, "#dff3e3", '''<g stroke="#5b3a21" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M41 50 L37 28 M38 38 L28 32 M37 30 L34 22"/><path d="M59 50 L63 28 M62 38 L72 32 M63 30 L66 22"/></g>
<ellipse cx="33" cy="54" rx="8" ry="4" fill="#a16207"/><ellipse cx="67" cy="54" rx="8" ry="4" fill="#a16207"/><ellipse cx="50" cy="66" rx="15" ry="20" fill="#a16207"/><ellipse cx="50" cy="80" rx="9" ry="7" fill="#d6b88a"/>
<circle cx="43" cy="62" r="2.3" fill="#1f2937"/><circle cx="57" cy="62" r="2.3" fill="#1f2937"/><ellipse cx="50" cy="84" rx="4" ry="2.5" fill="#1f2937"/>''')
add("aigle", "Aigle", 300, "#bfe3f5", '''<ellipse cx="50" cy="82" rx="26" ry="20" fill="#5b3a21"/><circle cx="50" cy="48" r="19" fill="#fff"/><path d="M42 40 L52 44" stroke="#374151" stroke-width="3" stroke-linecap="round"/>
<circle cx="53" cy="47" r="3" fill="#1f2937"/><path d="M58 50 Q78 50 72 64 Q62 62 58 58Z" fill="#fbbf24"/>''')
add("perroquet", "Perroquet", 300, "#bbf7d0", '''<rect x="12" y="86" width="76" height="5" rx="2" fill="#5b3a21"/><ellipse cx="44" cy="70" rx="19" ry="22" fill="#22c55e"/><ellipse cx="34" cy="70" rx="6" ry="14" fill="#3b82f6"/><circle cx="50" cy="42" r="17" fill="#ef4444"/>
<circle cx="56" cy="38" r="5" fill="#fff"/><circle cx="57" cy="38" r="2.3" fill="#1f2937"/><path d="M62 42 Q82 42 76 58 Q66 56 62 50Z" fill="#f5f5f4" stroke="#9ca3af" stroke-width="1"/>''')
add("loup", "Loup", 500, "#1e293b", '''<circle cx="76" cy="20" r="9" fill="#e5e7eb"/><polygon points="28,48 30,14 48,34" fill="#6b7280"/><polygon points="72,48 70,14 52,34" fill="#6b7280"/><polygon points="33,40 33,24 43,34" fill="#374151"/><polygon points="67,40 67,24 57,34" fill="#374151"/>
<circle cx="50" cy="58" r="24" fill="#6b7280"/><polygon points="26,60 40,72 28,76" fill="#9ca3af"/><polygon points="74,60 60,72 72,76" fill="#9ca3af"/><ellipse cx="50" cy="70" rx="12" ry="11" fill="#d1d5db"/>
<ellipse cx="40" cy="54" rx="4" ry="2.6" fill="#fde047"/><ellipse cx="60" cy="54" rx="4" ry="2.6" fill="#fde047"/><rect x="39.3" y="52" width="1.4" height="4" fill="#111827"/><rect x="59.3" y="52" width="1.4" height="4" fill="#111827"/>
<ellipse cx="50" cy="64" rx="4.5" ry="3.2" fill="#111827"/><path d="M50 67 L50 72 M44 74 q6 4 12 0" fill="none" stroke="#374151" stroke-width="1.8"/>''')

# --- Trains du monde ---
add("tgv", "TGV (France)", 300, "#e8f0fb", f'''<rect x="0" y="78" width="100" height="22" fill="#cbd5e1"/><rect x="0" y="76" width="100" height="3" fill="#475569"/>
<path d="M8 72 L8 54 Q8 46 18 46 L60 46 Q80 48 94 66 L94 72Z" fill="#e5e7eb"/><rect x="8" y="62" width="86" height="4" fill="#1d4ed8"/><rect x="8" y="59" width="80" height="2" fill="#dc2626"/>
<rect x="16" y="50" width="38" height="7" rx="2" fill="#1e3a8a"/><polygon points="64,50 80,57 64,58" fill="#1e3a8a"/>{wheel(24,74,5)}{wheel(46,74,5)}{wheel(72,74,5)}''')
add("shinkansen", "Shinkansen (Japon)", 300, "#e0f2fe", f'''<polygon points="50,80 70,36 90,80" fill="#93c5fd"/><polygon points="70,36 63,48 70,45 77,48" fill="#fff"/><rect x="0" y="78" width="100" height="22" fill="#d1d5db"/><rect x="0" y="76" width="100" height="3" fill="#475569"/>
<path d="M4 72 L4 56 Q4 50 12 50 L44 50 Q76 52 96 70 L96 72Z" fill="#fff" stroke="#cbd5e1" stroke-width="1"/><rect x="4" y="62" width="88" height="3" fill="#0ea5e9"/>
<g fill="#1e3a8a"><rect x="12" y="54" width="6" height="5" rx="1"/><rect x="21" y="54" width="6" height="5" rx="1"/><rect x="30" y="54" width="6" height="5" rx="1"/><rect x="39" y="54" width="6" height="5" rx="1"/></g>{wheel(22,74,4.5)}{wheel(44,74,4.5)}{wheel(70,74,4.5)}''')
add("suisse", "Train des Alpes (Suisse)", 300, "#dbeafe", f'''<polygon points="-4,76 26,32 56,76" fill="#94a3b8"/><polygon points="26,32 19,44 26,41 33,44" fill="#fff"/><polygon points="40,76 70,40 104,76" fill="#7c8aa0"/><polygon points="70,40 63,50 70,47 77,50" fill="#fff"/>
<rect x="0" y="78" width="100" height="22" fill="#86efac"/><line x1="0" y1="40" x2="100" y2="40" stroke="#374151" stroke-width="1.5"/><path d="M42 54 L50 40 L58 54" fill="none" stroke="#374151" stroke-width="2"/>
<rect x="12" y="54" width="76" height="22" rx="4" fill="#dc2626"/><rect x="12" y="66" width="76" height="3" fill="#fff"/><rect x="18" y="57" width="64" height="7" rx="1.5" fill="#bfdbfe"/>{wheel(28,78,4.5)}{wheel(72,78,4.5)}''')
add("orient", "Orient-Express", 500, "#1e293b", f'''<circle cx="18" cy="20" r="7" fill="#fde68a"/><g fill="#fff"><circle cx="48" cy="12" r="1.2"/><circle cx="68" cy="22" r="1.2"/><circle cx="88" cy="10" r="1.2"/></g>
<circle cx="32" cy="22" r="5" fill="#e5e7eb" opacity=".55"/><circle cx="38" cy="12" r="4" fill="#e5e7eb" opacity=".4"/><rect x="0" y="82" width="100" height="18" fill="#0f172a"/><rect x="0" y="82" width="100" height="3" fill="#475569"/>
<rect x="24" y="32" width="12" height="4" fill="#fbbf24"/><rect x="27" y="36" width="6" height="11" fill="#fbbf24"/><rect x="20" y="46" width="46" height="22" rx="3" fill="#1e3a8a"/><rect x="20" y="56" width="46" height="3" fill="#fbbf24"/>
<rect x="58" y="36" width="24" height="32" rx="2" fill="#1e3a8a"/><rect x="55" y="33" width="30" height="4" fill="#fbbf24"/><rect x="64" y="42" width="10" height="10" fill="#fde68a"/>{wheel(32,72,8,"#fbbf24","#1e3a8a")}{wheel(52,72,8,"#fbbf24","#1e3a8a")}{wheel(74,74,6,"#fbbf24","#1e3a8a")}''')

# --- Décors ---
add("lune", "Lune", 300, "#0f172a", '''<g fill="#fff"><circle cx="18" cy="18" r="1.5"/><circle cx="40" cy="12" r="1"/><circle cx="84" cy="50" r="1.5"/></g><circle cx="64" cy="30" r="15" fill="#e5e7eb"/><circle cx="59" cy="26" r="3" fill="#cbd5e1"/><circle cx="69" cy="35" r="2.5" fill="#cbd5e1"/>
<rect x="0" y="68" width="100" height="32" fill="#94a3b8"/><ellipse cx="26" cy="82" rx="9" ry="3" fill="#7c8aa0"/><ellipse cx="72" cy="88" rx="12" ry="3.5" fill="#7c8aa0"/><rect x="0" y="74" width="100" height="3" fill="#475569"/>''')
add("sucette", "Sucette", 150, "#fde1f0", '''<circle cx="50" cy="42" r="24" fill="#f472b6"/><path d="M50 42 m0 0 a4 4 0 1 1 6 0 a8 8 0 1 1 -12 0 a12 12 0 1 1 18 0 a16 16 0 1 1 -24 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><rect x="48" y="64" width="4" height="26" fill="#fef3c7"/>''')
add("neon", "Ville néon", 500, "#0b1020", '''<defs><linearGradient id="gn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0abfc"/><stop offset="1" stop-color="#fb7185"/></linearGradient></defs>
<circle cx="50" cy="46" r="17" fill="url(#gn)"/><rect x="0" y="50" width="100" height="50" fill="#0b1020"/><line x1="0" y1="52" x2="100" y2="52" stroke="#22d3ee" stroke-width="1.5"/>
<line x1="30" y1="96" x2="46" y2="52" stroke="#22d3ee" stroke-width="3" stroke-linecap="round"/><line x1="70" y1="96" x2="54" y2="52" stroke="#22d3ee" stroke-width="3" stroke-linecap="round"/>
<g stroke="#e879f9" stroke-width="2"><line x1="42" y1="62" x2="58" y2="62"/><line x1="38" y1="72" x2="62" y2="72"/><line x1="34" y1="84" x2="66" y2="84"/></g>''')

# ===================== Nouveautés : personnages, décors, trains =====================
# --- Personnages ---
add("chef", "Chef de gare", 150, "#fbe3e3", f'''<path d="M18 100 q0 -24 32 -24 q32 0 32 24z" fill="#1f2937"/><rect x="44" y="76" width="12" height="10" fill="#fff"/>
<rect x="76" y="62" width="3" height="38" fill="#6b7280"/><circle cx="77.5" cy="54" r="12" fill="#dc2626"/><rect x="69" y="52" width="17" height="4" fill="#fff"/>
{face(42,58,18)}<rect x="26" y="24" width="32" height="14" rx="3" fill="#dc2626"/><rect x="23" y="36" width="38" height="4" rx="2" fill="#7f1d1d"/><rect x="26" y="31" width="32" height="3" fill="#fbbf24"/>''')
add("mecano", "Mécanicien", 150, "#fde7c7", f'''<path d="M16 100 q0 -24 34 -24 q34 0 34 24z" fill="#1d4ed8"/><rect x="36" y="76" width="6" height="24" fill="#1e40af"/><rect x="58" y="76" width="6" height="24" fill="#1e40af"/>
{face(50,58,20)}<ellipse cx="60" cy="66" rx="5" ry="3" fill="#6b7280" opacity=".55"/><path d="M30 42 q20 -22 40 0z" fill="#6b7280"/><rect x="28" y="40" width="44" height="5" rx="2" fill="#4b5563"/>
<circle cx="42" cy="44" r="6" fill="#93c5fd" stroke="#374151" stroke-width="2"/><circle cx="58" cy="44" r="6" fill="#93c5fd" stroke="#374151" stroke-width="2"/>
<path d="M43 68 q7 4 14 0" fill="none" stroke="#7c2d12" stroke-width="2.5" stroke-linecap="round"/>''')
add("voyageur", "Voyageur", 150, "#dff3e3", f'''<path d="M14 100 q0 -22 30 -22 q30 0 30 22z" fill="#0ea5e9"/>{face(44,58,18)}
<ellipse cx="44" cy="44" rx="26" ry="5" fill="#e5c07b"/><rect x="32" y="28" width="24" height="16" rx="6" fill="#e5c07b"/><rect x="32" y="38" width="24" height="4" fill="#dc2626"/>
<rect x="58" y="74" width="30" height="20" rx="3" fill="#92400e"/><rect x="66" y="69" width="14" height="6" rx="2" fill="none" stroke="#5b3a21" stroke-width="2.5"/><rect x="58" y="82" width="30" height="3" fill="#5b3a21"/>
<path d="M40 66 q4 4 8 0" fill="none" stroke="#7c2d12" stroke-width="2.5" stroke-linecap="round"/>''')
add("cowboy", "Cow-boy", 300, "#fcd9b6", f'''<path d="M18 100 q0 -22 32 -22 q32 0 32 22z" fill="#b45309"/><polygon points="34,74 66,74 50,92" fill="#dc2626"/>{face(50,58,19)}
<path d="M44 66 q6 5 12 0" fill="none" stroke="#5b3a21" stroke-width="3" stroke-linecap="round"/><rect x="36" y="22" width="28" height="22" rx="9" fill="#7c2d12"/><rect x="36" y="36" width="28" height="4" fill="#fbbf24"/>
<path d="M14 46 Q50 56 86 46 Q74 36 50 40 Q26 36 14 46Z" fill="#7c2d12"/>''')
add("astronaute", "Astronaute", 300, "#0f172a", '''<g fill="#fff"><circle cx="14" cy="16" r="1.4"/><circle cx="84" cy="20" r="1.2"/><circle cx="90" cy="60" r="1.4"/></g><path d="M14 100 q0 -22 36 -22 q36 0 36 22z" fill="#f3f4f6"/><rect x="42" y="82" width="16" height="6" rx="2" fill="#ef4444"/>
<circle cx="50" cy="50" r="30" fill="#e5e7eb"/><ellipse cx="50" cy="50" rx="22" ry="18" fill="#1e3a8a"/><ellipse cx="42" cy="44" rx="7" ry="4" fill="#93c5fd" opacity=".7"/><rect x="48" y="14" width="4" height="8" fill="#9ca3af"/><circle cx="50" cy="13" r="3" fill="#ef4444"/>''')
add("robot", "Robot", 500, "#0b1020", '''<rect x="24" y="86" width="52" height="14" rx="4" fill="#64748b"/><rect x="42" y="72" width="16" height="16" fill="#475569"/><rect x="48" y="12" width="4" height="14" fill="#94a3b8"/><circle cx="50" cy="12" r="4.5" fill="#f472b6"/>
<rect x="26" y="26" width="48" height="46" rx="8" fill="#94a3b8"/><rect x="33" y="38" width="12" height="10" rx="2" fill="#22d3ee"/><rect x="55" y="38" width="12" height="10" rx="2" fill="#22d3ee"/>
<rect x="36" y="58" width="28" height="6" rx="2" fill="#1f2937"/><g stroke="#94a3b8" stroke-width="1.5"><line x1="42" y1="58" x2="42" y2="64"/><line x1="50" y1="58" x2="50" y2="64"/><line x1="58" y1="58" x2="58" y2="64"/></g><rect x="18" y="40" width="8" height="14" rx="2" fill="#64748b"/><rect x="74" y="40" width="8" height="14" rx="2" fill="#64748b"/>''')

# --- Trains : variantes ---
add("metro", "Métro", 150, "#111827", '''<path d="M10 100 V60 Q10 12 50 12 Q90 12 90 60 V100" fill="none" stroke="#4b5563" stroke-width="5"/><circle cx="50" cy="24" r="7" fill="#fff" stroke="#dc2626" stroke-width="2.5"/>
<rect x="26" y="38" width="48" height="40" rx="10" fill="#e5e7eb"/><rect x="32" y="43" width="36" height="16" rx="4" fill="#1e3a8a"/><rect x="26" y="62" width="48" height="5" fill="#22c55e"/><circle cx="35" cy="72" r="3.5" fill="#fde68a"/><circle cx="65" cy="72" r="3.5" fill="#fde68a"/>
<rect x="0" y="86" width="100" height="14" fill="#374151"/><g stroke="#9ca3af" stroke-width="2"><line x1="30" y1="86" x2="22" y2="100"/><line x1="70" y1="86" x2="78" y2="100"/></g>''')
add("tram", "Tramway", 150, "#fde7c7", f'''<line x1="0" y1="24" x2="100" y2="24" stroke="#374151" stroke-width="1.5"/><path d="M44 42 L56 24" stroke="#374151" stroke-width="2.5" fill="none"/>
<rect x="0" y="80" width="100" height="20" fill="#c9b784"/><rect x="0" y="78" width="100" height="3" fill="#475569"/><rect x="10" y="42" width="80" height="34" rx="8" fill="#facc15"/><rect x="10" y="62" width="80" height="4" fill="#fff"/>
<g fill="#bfdbfe"><rect x="16" y="47" width="14" height="12" rx="2"/><rect x="34" y="47" width="14" height="12" rx="2"/><rect x="52" y="47" width="14" height="12" rx="2"/><rect x="70" y="47" width="14" height="12" rx="2"/></g>{wheel(26,77,4.5)}{wheel(74,77,4.5)}''')
add("diesel", "Locomotive diesel", 150, "#dbeafe", f'''<rect x="0" y="82" width="100" height="18" fill="#9ca3af"/><rect x="0" y="80" width="100" height="3" fill="#475569"/><rect x="8" y="50" width="84" height="26" rx="4" fill="#ea580c"/><rect x="60" y="38" width="30" height="38" rx="4" fill="#ea580c"/>
<rect x="66" y="42" width="18" height="12" rx="2" fill="#bfdbfe"/><rect x="8" y="62" width="84" height="4" fill="#fff"/><g stroke="#7c2d12" stroke-width="2"><line x1="16" y1="54" x2="16" y2="60"/><line x1="22" y1="54" x2="22" y2="60"/><line x1="28" y1="54" x2="28" y2="60"/><line x1="34" y1="54" x2="34" y2="60"/></g>
<rect x="16" y="74" width="26" height="6" rx="2" fill="#374151"/><rect x="58" y="74" width="26" height="6" rx="2" fill="#374151"/>{wheel(22,78,3.5)}{wheel(36,78,3.5)}{wheel(64,78,3.5)}{wheel(78,78,3.5)}''')
add("fret", "Train de marchandises", 150, "#fde7c7", f'''<rect x="0" y="82" width="100" height="18" fill="#c9b784"/><rect x="0" y="80" width="100" height="3" fill="#475569"/><rect x="4" y="68" width="92" height="4" fill="#374151"/>
<rect x="12" y="44" width="76" height="26" rx="13" fill="#4b5563"/><rect x="44" y="38" width="12" height="7" rx="2" fill="#374151"/><g stroke="#9ca3af" stroke-width="2"><line x1="30" y1="44" x2="30" y2="70"/><line x1="70" y1="44" x2="70" y2="70"/></g>
<rect x="16" y="74" width="68" height="5" fill="#1f2937"/>{wheel(26,78,4)}{wheel(36,78,4)}{wheel(64,78,4)}{wheel(74,78,4)}''')
add("monorail", "Monorail", 300, "#bfe3f5", f'''<rect x="30" y="74" width="7" height="26" fill="#9ca3af"/><rect x="66" y="74" width="7" height="26" fill="#9ca3af"/><rect x="0" y="66" width="100" height="9" fill="#cbd5e1"/><rect x="0" y="72" width="100" height="3" fill="#94a3b8"/>
<rect x="12" y="40" width="76" height="26" rx="13" fill="#f3f4f6"/><rect x="12" y="54" width="76" height="4" fill="#0ea5e9"/><g fill="#1e3a8a"><rect x="22" y="44" width="10" height="7" rx="2"/><rect x="36" y="44" width="10" height="7" rx="2"/><rect x="50" y="44" width="10" height="7" rx="2"/><rect x="68" y="44" width="12" height="7" rx="3"/></g>''')
add("cremaillere", "Train à crémaillère", 300, "#bfe3f5", f'''<polygon points="0,88 100,44 100,100 0,100" fill="#86efac"/><line x1="0" y1="88" x2="100" y2="44" stroke="#475569" stroke-width="3"/>
<g stroke="#475569" stroke-width="1.6"><line x1="10" y1="83" x2="12" y2="88"/><line x1="22" y1="78" x2="24" y2="83"/><line x1="34" y1="73" x2="36" y2="78"/><line x1="62" y1="61" x2="64" y2="66"/><line x1="74" y1="56" x2="76" y2="61"/><line x1="86" y1="51" x2="88" y2="56"/></g>
<g transform="rotate(-24 50 66)"><rect x="28" y="46" width="44" height="20" rx="4" fill="#dc2626"/><rect x="28" y="57" width="44" height="3" fill="#fff"/><rect x="34" y="50" width="9" height="6" fill="#bfdbfe"/><rect x="47" y="50" width="9" height="6" fill="#bfdbfe"/><rect x="60" y="50" width="9" height="6" fill="#bfdbfe"/><circle cx="38" cy="68" r="3.5" fill="#1f2937"/><circle cx="62" cy="68" r="3.5" fill="#1f2937"/></g>''')
add("us", "Train du Far West", 300, "#fcd9b6", f'''<rect x="0" y="82" width="100" height="18" fill="#e9cf8e"/><rect x="0" y="80" width="100" height="3" fill="#475569"/>
<path d="M24 46 L30 30 L44 30 L50 46Z" fill="#111827"/><rect x="26" y="46" width="44" height="22" rx="3" fill="#374151"/><rect x="26" y="54" width="44" height="3" fill="#fbbf24"/><rect x="62" y="34" width="24" height="34" rx="2" fill="#7c2d12"/><rect x="59" y="31" width="30" height="4" fill="#5b3a21"/><rect x="68" y="40" width="10" height="9" fill="#fde68a"/>
<circle cx="24" cy="56" r="5" fill="#fde68a" stroke="#374151" stroke-width="1.5"/><polygon points="6,80 22,68 22,80" fill="#4b5563"/>{wheel(38,72,8)}{wheel(56,72,8)}{wheel(76,74,6)}''')

# --- Décors ---
add("neige", "Bonhomme de neige", 150, "#e0f2fe", '''<rect x="0" y="80" width="100" height="20" fill="#fff"/><circle cx="50" cy="74" r="17" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/><circle cx="50" cy="52" r="12.5" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/><circle cx="50" cy="35" r="9.5" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/>
<rect x="43" y="19" width="14" height="10" fill="#111827"/><rect x="40" y="27" width="20" height="3" fill="#111827"/><circle cx="46.5" cy="34" r="1.5" fill="#111827"/><circle cx="53.5" cy="34" r="1.5" fill="#111827"/><polygon points="50,37 62,39 50,41" fill="#f97316"/>
<rect x="40" y="43" width="20" height="4" fill="#dc2626"/><circle cx="50" cy="56" r="1.5" fill="#111827"/><circle cx="50" cy="63" r="1.5" fill="#111827"/>''')
add("cactus", "Cactus", 150, "#fde7c7", '''<circle cx="80" cy="22" r="9" fill="#fbbf24"/><rect x="0" y="80" width="100" height="20" fill="#e9cf8e"/><g stroke="#3f9d4a" stroke-width="9" stroke-linecap="round" fill="none"><line x1="50" y1="78" x2="50" y2="30"/><path d="M50 62 H36 V46"/><path d="M50 54 H64 V38"/></g><circle cx="50" cy="26" r="3.5" fill="#f472b6"/>''')
add("palmier", "Île tropicale", 150, "#bfe3f5", '''<rect x="0" y="74" width="100" height="26" fill="#4aa8e8"/><ellipse cx="50" cy="78" rx="38" ry="8" fill="#f2dba0"/><path d="M50 78 Q43 54 53 34" fill="none" stroke="#92400e" stroke-width="5" stroke-linecap="round"/>
<g fill="#22a34a"><path d="M53 34 Q32 20 14 34 Q36 30 53 34Z"/><path d="M53 34 Q74 20 92 34 Q70 30 53 34Z"/><path d="M53 34 Q40 12 24 14 Q42 22 53 34Z"/><path d="M53 34 Q66 12 82 14 Q64 22 53 34Z"/></g><circle cx="50" cy="36" r="3" fill="#78350f"/><circle cx="56" cy="38" r="3" fill="#78350f"/>''')
add("moulin", "Moulin à vent", 150, "#cfe8ff", '''<rect x="0" y="78" width="100" height="22" fill="#9bd66f"/><polygon points="40,80 60,80 56,44 44,44" fill="#fdf3dc"/><rect x="47" y="66" width="6" height="14" fill="#7c2d12"/><polygon points="41,44 59,44 50,33" fill="#b45309"/>
<g stroke="#7c2d12" stroke-width="3" stroke-linecap="round"><line x1="50" y1="44" x2="26" y2="20"/><line x1="50" y1="44" x2="74" y2="20"/><line x1="50" y1="44" x2="74" y2="68"/><line x1="50" y1="44" x2="26" y2="68"/></g>
<g fill="#fff" opacity=".9"><polygon points="28,18 36,16 32,26"/><polygon points="72,18 64,16 68,26"/><polygon points="72,70 64,72 68,62"/><polygon points="28,70 36,72 32,62"/></g><circle cx="50" cy="44" r="4" fill="#5b3a21"/>''')
add("foret", "Forêt", 150, "#dff3e3", '''<rect x="0" y="82" width="100" height="18" fill="#68b563"/><rect x="46" y="76" width="8" height="10" fill="#5b3a21"/>
<polygon points="50,14 36,40 64,40" fill="#2f7d4a"/><polygon points="50,26 32,56 68,56" fill="#2a7040"/><polygon points="50,40 28,76 72,76" fill="#25663d"/>
<polygon points="18,50 10,70 26,70" fill="#3a9158"/><rect x="16" y="68" width="4" height="8" fill="#5b3a21"/><polygon points="82,52 74,72 90,72" fill="#3a9158"/><rect x="80" y="70" width="4" height="8" fill="#5b3a21"/>''')
add("ville", "Ville", 300, "#bfe3f5", '''<circle cx="82" cy="20" r="8" fill="#fde68a"/><rect x="0" y="86" width="100" height="14" fill="#6b7280"/><rect x="12" y="50" width="22" height="36" fill="#6b7280"/><rect x="36" y="30" width="24" height="56" fill="#475569"/><rect x="62" y="44" width="22" height="42" fill="#64748b"/>
<g fill="#fde68a"><rect x="16" y="55" width="5" height="5"/><rect x="25" y="55" width="5" height="5"/><rect x="16" y="66" width="5" height="5"/><rect x="25" y="66" width="5" height="5"/><rect x="41" y="36" width="5" height="5"/><rect x="50" y="36" width="5" height="5"/><rect x="41" y="48" width="5" height="5"/><rect x="50" y="48" width="5" height="5"/><rect x="41" y="60" width="5" height="5"/><rect x="50" y="60" width="5" height="5"/><rect x="66" y="50" width="5" height="5"/><rect x="75" y="50" width="5" height="5"/><rect x="66" y="62" width="5" height="5"/><rect x="75" y="62" width="5" height="5"/></g>''')

def carte(i):
    nom, prix, fond, corps = A[i]
    badge = "" if prix == 0 else f'<span class="prix">{prix}</span>'
    return (f'<div class="carte" title="{nom}"><svg viewBox="0 0 100 100" role="img" aria-label="{nom}"><defs><clipPath id="c-{i}"><circle cx="50" cy="50" r="50"/></clipPath></defs>'
            f'<g clip-path="url(#c-{i})"><rect width="100" height="100" fill="{fond}"/>{corps}</g></svg>{badge}</div>')

sections = [
  ("Gratuits", "Donnés à tous à l'inscription.", ["loco", "wagon", "gare", "conducteur", "controleur", "chat", "lapin", "canard"]),
  ("Personnages", "", ["chef", "mecano", "voyageur", "cowboy", "astronaute", "robot"]),
  ("Animaux du jeu", "Tous vivent déjà dans le décor, sauf le loup (nouveau).", ["ecureuil", "hibou", "cerf", "aigle", "perroquet", "loup"]),
  ("Trains", "", ["metro", "tram", "diesel", "fret", "tgv", "shinkansen", "suisse", "monorail", "cremaillere", "us", "orient"]),
  ("Décors", "", ["neige", "cactus", "palmier", "moulin", "foret", "ville", "sucette", "lune", "neon"]),
]
corps = "".join(f'<h2>{t}</h2>' + (f'<p>{d}</p>' if d else '') + '<div class="grille">' + "".join(carte(i) for i in ids) + '</div>' for t, d, ids in sections)
def mini(i, k):
    return f'<svg viewBox="0 0 100 100"><defs><clipPath id="p{k}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#p{k})"><rect width="100" height="100" fill="{A[i][2]}"/>{A[i][3]}</g></svg>'
html = f'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Avatars : aperçu</title>
<style>
  :root {{ --fond:#f4f1ea; --texte:#1f2937; --discret:#6b7280; --carte:#fff; --trait:#e2ded2; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; padding:24px 16px 48px; background:var(--fond); color:var(--texte); font:16px/1.5 system-ui,sans-serif; }}
  main {{ max-width:60rem; margin:0 auto; }}
  h1 {{ font-size:1.5rem; margin:0 0 4px; }} h2 {{ font-size:1.1rem; margin:32px 0 2px; }} p {{ margin:2px 0; color:var(--discret); }}
  .grille {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:12px; margin-top:12px; }}
  .carte {{ position:relative; background:var(--carte); border:1px solid var(--trait); border-radius:14px; padding:10px; }}
  .carte svg {{ width:100%; height:auto; display:block; }}
  .prix {{ position:absolute; right:6px; bottom:6px; min-width:2rem; padding:1px 7px; border-radius:999px; background:#1f2937; color:#fff; font-size:.75rem; font-weight:700; text-align:center; }}
  .petit {{ display:flex; gap:10px; align-items:center; margin-top:12px; background:var(--carte); border:1px solid var(--trait); border-radius:14px; padding:12px; }}
  .petit svg {{ width:36px; height:36px; flex:none; }}
  table {{ border-collapse:collapse; margin-top:8px; background:var(--carte); border:1px solid var(--trait); }}
  td, th {{ padding:6px 12px; text-align:left; border-bottom:1px solid var(--trait); font-size:.9rem; }} th {{ background:#faf8f2; }}
</style></head><body><main>
<h1>Avatars : aperçu</h1>
<p>Dessins provisoires. Aucun nom affiché dans la sélection : seulement l'image, et le prix en pièces sur ceux qui se paient (passe la souris pour voir le nom, utile seulement pour en parler ici).</p>
{corps}
<h2>Taille réelle dans le jeu</h2><p>L'avatar est petit (menu, classement) : il doit rester lisible à 36 pixels.</p>
<div class="petit">{mini("conducteur",1)}{mini("loup",2)}{mini("tgv",3)}{mini("tram",4)}{mini("chat",5)}<span><b>Rudy</b> · niveau 42</span></div>
<h2>Prix possibles</h2><p>Repères : 100 pièces à l'inscription, 10 à 30 par niveau gagné, 20 pour le puzzle du jour.</p>
<table><tr><th>Rareté</th><th>Prix</th><th>Combien de jeu</th></tr>
<tr><td>Gratuit</td><td>0</td><td>donné à l'inscription</td></tr><tr><td>Courant</td><td>150</td><td>environ 10 niveaux</td></tr>
<tr><td>Rare</td><td>300</td><td>environ 20 niveaux</td></tr><tr><td>Très rare</td><td>500</td><td>environ 30 niveaux</td></tr></table>
</main></body></html>'''
open(ROOT + "docs/avatars-apercu.html", "w").write(html)
print(len(A), "avatars,", len(html) // 1024, "Ko")

# ===================== Export pour le jeu : liste partagée (shared/) et dessins (front/) =====================
import json
ORDRE = [  # l'ordre de la sélection : les gratuits d'abord, puis par famille
  ("gratuit", ["loco", "wagon", "gare", "conducteur", "controleur", "chat", "lapin", "canard"]),
  ("personnage", ["chef", "mecano", "voyageur", "cowboy", "astronaute", "robot"]),
  ("animal", ["ecureuil", "hibou", "cerf", "aigle", "perroquet", "loup"]),
  ("train", ["metro", "tram", "diesel", "fret", "tgv", "shinkansen", "suisse", "monorail", "cremaillere", "us", "orient"]),
  ("decor", ["neige", "cactus", "palmier", "moulin", "foret", "ville", "sucette", "lune", "neon"]),
]
ids = [i for _, l in ORDRE for i in l]
assert sorted(ids) == sorted(A), (set(A) ^ set(ids))
lignes = []
for famille, l in ORDRE:
    for i in l:
        lignes.append(f"  {{ id: '{i}', price: {A[i][1]}, family: '{famille}' }},")
ts = """// Avatars : une liste FIXE, choisie dans le jeu (personne n'envoie d'image). Partagée par le serveur (prix, achat) et le navigateur
// (affichage). Les dessins sont dans front/src/avatars/svg.ts. Les 8 premiers sont gratuits et donnés à tous ; les autres s'achètent avec les pièces.
export type AvatarFamily = 'gratuit' | 'personnage' | 'animal' | 'train' | 'decor'
export interface AvatarDef { id: string; price: number; family: AvatarFamily }

export const AVATARS: readonly AvatarDef[] = [
""" + "\n".join(lignes) + """
]

export const AVATAR_IDS: readonly string[] = AVATARS.map((a) => a.id)
export const FREE_AVATARS: readonly string[] = AVATARS.filter((a) => a.price === 0).map((a) => a.id)
export const avatarOf = (id: unknown): AvatarDef | undefined => AVATARS.find((a) => a.id === id)
export const DEFAULT_AVATAR = 'loco'
"""
open(ROOT + "shared/avatars.ts", "w").write(ts)

import os
os.makedirs(ROOT + "front/src/avatars", exist_ok=True)
svg = {i: {"bg": A[i][2], "body": A[i][3].replace("\n", "")} for i in ids}
out = ["// GÉNÉRÉ à partir du jeu de dessins validé (docs/avatars-apercu.html) : dessins fixes écrits par le jeu, jamais envoyés par un joueur.",
       "// Chaque dessin tient dans un carré de 100 × 100 ; l'affichage le découpe en rond (voir Avatar.vue).",
       "export const AVATAR_ART: Record<string, { bg: string; body: string }> = {"]
for i in ids:
    out.append(f"  {i}: {{ bg: {json.dumps(svg[i]['bg'])}, body: {json.dumps(svg[i]['body'], ensure_ascii=False)} }},")
out.append("}")
open(ROOT + "front/src/avatars/svg.ts", "w").write("\n".join(out) + "\n")
print(len(ids), "avatars exportés ;", sum(1 for i in ids if A[i][1] == 0), "gratuits")
