<script setup lang="ts">
import type { AppState } from "../types";

defineProps<{ appState: AppState }>();
const emit = defineEmits<{ start: []; stop: []; reset: [] }>();

const stateLabels: Record<AppState, string> = {
  idle: "Ready",
  listening: "🎤 Listening...",
  thinking: "💭 Thinking...",
  speaking: "🔊 Speaking...",
};
</script>

<template>
  <div class="speech-controls">
    <span class="state-label">{{ stateLabels[appState] }}</span>
    <div class="buttons">
      <button
        v-if="appState === 'idle'"
        class="btn-start"
        @click="emit('start')"
      >
        🎤 Start
      </button>
      <button v-else class="btn-stop" @click="emit('stop')">⏹ Stop</button>
      <button class="btn-reset" @click="emit('reset')">🔄 Reset</button>
    </div>
  </div>
</template>

<style scoped>
.speech-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.state-label {
  font-size: 0.85rem;
  color: #666;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-start {
  background: #42b883;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
}

.btn-stop {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
}

.btn-reset {
  background: #eee;
  color: #333;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
}
</style>
