<script setup lang="ts">
import type { ChatMessage } from "../types";

defineProps<{ message: ChatMessage }>();
</script>

<template>
  <div class="bubble" :class="message.role">
    <span class="icon">{{ message.role === "assistant" ? "🤖" : "👤" }}</span>
    <div class="content">{{ message.content }}</div>
  </div>
</template>

<style scoped>
.bubble {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  max-width: 85%;
}

.bubble.user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.bubble.assistant {
  margin-right: auto;
}

.icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.content {
  padding: 0.6rem 1rem;
  border-radius: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.assistant .content {
  background: #f0f4f8;
  color: #2c3e50;
}

.user .content {
  background: #42b883;
  color: #fff;
}
</style>
