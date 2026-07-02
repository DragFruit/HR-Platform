<template>
  <div class="competency-radar">
    <div v-if="legend" class="competency-radar__legend">
      <span class="competency-radar__legend-swatch" />
      <span>{{ legend }}</span>
    </div>

    <svg
      class="competency-radar__svg"
      :viewBox="`0 0 ${size} ${size}`"
      role="img"
      :aria-label="`Матрица компетенций: ${legend}`"
    >
      <g :transform="`translate(${cx}, ${cy})`">
        <polygon
          v-for="ring in rings"
          :key="`ring-${ring}`"
          :points="ringPoints(ring)"
          class="competency-radar__grid"
        />

        <line
          v-for="(_, i) in axisCount"
          :key="`axis-${i}`"
          :x1="0"
          :y1="0"
          :x2="axisEnd(i).x"
          :y2="axisEnd(i).y"
          class="competency-radar__axis"
        />

        <polygon :points="dataPolygon" class="competency-radar__fill" />
        <polyline :points="dataPolygon" class="competency-radar__stroke" />

        <circle
          v-for="(point, i) in dataPoints"
          :key="`pt-${i}`"
          :cx="point.x"
          :cy="point.y"
          r="3.5"
          class="competency-radar__dot"
        />

        <text
          v-for="(label, i) in labels"
          :key="`lbl-${i}`"
          :x="labelPos(i).x"
          :y="labelPos(i).y"
          class="competency-radar__label"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ label }}
        </text>

        <text
          v-for="tick in scaleTicks"
          :key="`tick-${tick}`"
          :x="0"
          :y="-valueRadius(tick)"
          class="competency-radar__tick"
          text-anchor="middle"
          dominant-baseline="auto"
        >
          {{ tick }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    labels: string[];
    values: number[];
    legend?: string;
    max?: number;
  }>(),
  { max: 10, legend: '' }
);

const size = 320;
const cx = size / 2;
const cy = size / 2;
const radius = 108;
const labelRadius = radius + 28;

const axisCount = computed(() => props.labels.length);
const rings = computed(() => Array.from({ length: props.max }, (_, i) => i + 1));
const scaleTicks = [2, 4, 6, 8, 10];

const angleFor = (index: number) => (-Math.PI / 2) + (index * 2 * Math.PI) / axisCount.value;

const valueRadius = (value: number) => (value / props.max) * radius;

const polar = (index: number, value: number) => {
  const angle = angleFor(index);
  const r = valueRadius(value);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
};

const ringPoints = (level: number) =>
  props.labels
    .map((_, i) => {
      const p = polar(i, level);
      return `${p.x},${p.y}`;
    })
    .join(' ');

const axisEnd = (index: number) => polar(index, props.max);

const dataPoints = computed(() => props.values.map((v, i) => polar(i, v)));

const dataPolygon = computed(() =>
  dataPoints.value.map((p) => `${p.x},${p.y}`).join(' ')
);

const labelPos = (index: number) => {
  const angle = angleFor(index);
  return {
    x: Math.cos(angle) * labelRadius,
    y: Math.sin(angle) * labelRadius
  };
};
</script>
