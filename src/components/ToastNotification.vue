<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import type { AppError } from "../types";

const props = defineProps<{
  error: AppError | null;
}>();

const emit = defineEmits<{
  dismiss: [];
  openSettings: [];
}>();

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.error,
  (err) => {
    if (err) {
      visible.value = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        dismiss();
      }, 3000);
    } else {
      visible.value = false;
    }
  },
);

function dismiss() {
  visible.value = false;
  if (timer) clearTimeout(timer);
  timer = null;
  emit("dismiss");
}

function handleOpenSettings() {
  dismiss();
  emit("openSettings");
}

const isAuthError = ref(false);
watch(
  () => props.error,
  (err) => {
    isAuthError.value = !!(
      err &&
      (err.message.includes("Authentication") ||
        err.message.includes("authentication") ||
        err.message.includes("Check your") ||
        err.detail?.includes("401") ||
        err.detail?.includes("AuthenticationFailure"))
    );
  },
);

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <Transition name="toast">
    <div v-if="visible && error" class="toast" role="alert">
      <div class="toast-content">
        <span class="toast-message">{{ error.message }}</span>
        <button
          v-if="isAuthError"
          class="toast-settings-btn"
          @click="handleOpenSettings"
        >
          Open Settings
        </button>
      </div>
      <button class="toast-close" @click="dismiss" aria-label="Close">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: #e74c3c;
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 90%;
  min-width: 300px;
}

.toast-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.toast-message {
  font-size: 0.9rem;
}

.toast-settings-btn {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  align-self: flex-start;
}

.toast-settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.toast-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
}

.toast-close:hover {
  opacity: 1;
}

.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-1rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-1rem);
}
</style>
