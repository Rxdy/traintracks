<script setup lang="ts">
// Moulin à vent (plaine) : quatre ailes identiques, à 90° l'une de l'autre, qui tournent d'un mouvement régulier
// autour du moyeu (50, 40). Case de 100×100.
</script>
<template>
  <g>
    <ellipse cx="50" cy="88" rx="26" ry="6" fill="#000" opacity="0.14" />
    <path d="M34 86 L40 40 H60 L66 86 Z" fill="#f4ead2" stroke="#a8977a" stroke-width="2.5" stroke-linejoin="round" />
    <rect x="45" y="64" width="10" height="22" rx="2" fill="#7a4e2d" />
    <path d="M36 42 L50 25 L64 42 Z" fill="#9a3412" stroke="#00000030" stroke-width="2" stroke-linejoin="round" />
    <!-- ailes : le groupe tourne autour de son origine (le moyeu), chaque aile est le même dessin tourné de 0/90/180/270° -->
    <g transform="translate(50 40)">
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" calcMode="linear" />
        <g v-for="a in [0, 90, 180, 270]" :key="a" :transform="`rotate(${a})`">
          <path d="M-2 -6 L-2 -36 L-14 -36 L-14 -12 L-2 -12 Z" fill="#fff" stroke="#a8977a" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M-14 -24 H-2 M-8 -36 V-12" stroke="#a8977a" stroke-width="1" />
          <rect x="-1.2" y="-38" width="2.4" height="38" fill="#7a4e2d" />
        </g>
      </g>
    </g>
    <circle cx="50" cy="40" r="4.5" fill="#7a4e2d" stroke="#5a3515" stroke-width="1.5" />
  </g>
</template>
