<script setup lang="ts">
// Moulin à vent (plaine) : les ailes tournent. Case de 100×100.
</script>
<template>
  <g>
    <ellipse cx="50" cy="88" rx="26" ry="6" fill="#000" opacity="0.14" />
    <path d="M34 86 L40 38 H60 L66 86 Z" fill="#f4ead2" stroke="#a8977a" stroke-width="2.5" />
    <rect x="45" y="64" width="10" height="22" rx="2" fill="#7a4e2d" />
    <g transform="translate(50 40)">
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
        <template v-for="a in [0, 90, 180, 270]" :key="a">
          <rect x="-1.5" y="-34" width="3" height="34" fill="#e8e0cc" :transform="`rotate(${a})`" />
          <rect x="0" y="-34" width="12" height="16" fill="#fff" opacity="0.9" :transform="`rotate(${a})`" />
        </template>
      </g>
    </g>
    <path d="M36 42 L50 24 L64 42 Z" fill="#9a3412" />
    <circle cx="50" cy="40" r="4" fill="#7a4e2d" />
  </g>
</template>
