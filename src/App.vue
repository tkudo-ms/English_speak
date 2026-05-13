<script setup lang="ts">
import { ref } from "vue";
import { useConversation } from "./composables/useConversation";
import { useSettings } from "./composables/useSettings";
import SettingsModal from "./components/SettingsModal.vue";
import ChatView from "./components/ChatView.vue";
import ChatInput from "./components/ChatInput.vue";
import SpeechControls from "./components/SpeechControls.vue";

const { isConfigured } = useSettings();
const {
  appState,
  messages,
  interimText,
  currentAssistantText,
  isStreaming,
  start,
  stop,
  sendText,
  reset,
} = useConversation();

const showSettings = ref(!isConfigured.value);

function handleStart() {
  if (!isConfigured.value) {
    showSettings.value = true;
    return;
  }
  start();
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>English Speaking Practice</h1>
      <button class="settings-btn" @click="showSettings = true">⚙️</button>
    </header>

    <ChatView
      :messages="messages"
      :interim-text="interimText"
      :current-assistant-text="currentAssistantText"
      :is-streaming="isStreaming"
    />

    <footer class="app-footer">
      <ChatInput @send="sendText" />
      <SpeechControls
        :app-state="appState"
        @start="handleStart"
        @stop="stop"
        @reset="reset"
      />
    </footer>

    <SettingsModal :show="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 700px;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #eee;
}

.app-header h1 {
  font-size: 1.2rem;
  color: #2c3e50;
}

.settings-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
}

.app-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
