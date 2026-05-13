<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ send: [text: string] }>();

const inputText = ref("");

function handleSend() {
  const text = inputText.value.trim();
  if (!text) return;
  emit("send", text);
  inputText.value = "";
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="chat-input">
    <input
      v-model="inputText"
      type="text"
      placeholder="Type a message..."
      @keydown="handleKeydown"
    />
    <button class="send-btn" @click="handleSend" :disabled="!inputText.trim()">
      Send
    </button>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  gap: 0.5rem;
}

.chat-input input {
  flex: 1;
  padding: 0.6rem 1rem;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 0.9rem;
  outline: none;
}

.chat-input input:focus {
  border-color: #42b883;
}

.send-btn {
  background: #42b883;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
