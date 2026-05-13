<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import type { ChatMessage } from "../types";
import MessageBubble from "./MessageBubble.vue";

const props = defineProps<{
  messages: ChatMessage[];
  interimText: string;
  currentAssistantText: string;
  isStreaming: boolean;
}>();

const chatContainer = ref<HTMLElement | null>(null);

watch(
  () => [props.messages.length, props.currentAssistantText],
  async () => {
    await nextTick();
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  },
);
</script>

<template>
  <div class="chat-view" ref="chatContainer">
    <MessageBubble v-for="(msg, i) in messages" :key="i" :message="msg" />

    <!-- Streaming assistant response -->
    <div
      v-if="isStreaming && currentAssistantText"
      class="bubble assistant streaming"
    >
      <span class="icon">🤖</span>
      <div class="content">
        {{ currentAssistantText }}<span class="cursor">▌</span>
      </div>
    </div>

    <!-- Interim speech text -->
    <div v-if="interimText" class="bubble user interim">
      <span class="icon">👤</span>
      <div class="content">{{ interimText }}...</div>
    </div>

    <div
      v-if="messages.length === 0 && !interimText && !isStreaming"
      class="empty"
    >
      <p>Press <strong>Start</strong> and begin speaking in English!</p>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

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

.interim .content {
  opacity: 0.7;
  font-style: italic;
}

.streaming .cursor {
  animation: blink 0.7s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #888;
}
</style>
