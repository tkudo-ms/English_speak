<script setup lang="ts">
import { reactive, ref } from "vue";
import { useSettings } from "../composables/useSettings";
import type { AppSettings } from "../types";

defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { settings, save, validate } = useSettings();

const form = reactive<AppSettings>({ ...settings.value });
const errors = ref<string[]>([]);

function handleSave() {
  // Temporarily apply form values to run validate()
  const oldSettings = { ...settings.value };
  settings.value = { ...form };

  const result = validate();

  // Additional endpoint format check (S6 in test-design)
  if (form.openaiEndpoint && !form.openaiEndpoint.startsWith("https://")) {
    result.valid = false;
    result.errors.push("OpenAI Endpoint must start with https://");
  }

  if (!result.valid) {
    errors.value = result.errors;
    // Restore old settings without persisting
    settings.value = oldSettings;
    return;
  }

  errors.value = [];
  save({ ...form });
  emit("close");
}

function handleCancel() {
  Object.assign(form, settings.value);
  errors.value = [];
  emit("close");
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="handleCancel">
    <div class="modal">
      <h2>Settings</h2>

      <div v-if="errors.length" class="errors">
        <p v-for="err in errors" :key="err">{{ err }}</p>
      </div>

      <div class="form-group">
        <label>Speech Region</label>
        <input v-model="form.speechRegion" placeholder="e.g. japaneast" />
      </div>

      <div class="form-group">
        <label>Speech Key</label>
        <input
          v-model="form.speechKey"
          type="password"
          placeholder="Azure Speech key"
        />
      </div>

      <div class="form-group">
        <label>OpenAI Endpoint</label>
        <input
          v-model="form.openaiEndpoint"
          placeholder="https://xxx.openai.azure.com"
        />
      </div>

      <div class="form-group">
        <label>OpenAI Key</label>
        <input
          v-model="form.openaiKey"
          type="password"
          placeholder="Azure OpenAI key"
        />
      </div>

      <div class="form-group">
        <label>OpenAI Deployment</label>
        <input v-model="form.openaiDeployment" placeholder="gpt-4.1-nano" />
      </div>

      <div class="form-group">
        <label>TTS Voice</label>
        <input v-model="form.ttsVoice" placeholder="en-US-JennyNeural" />
      </div>

      <div class="form-group">
        <label>System Prompt</label>
        <textarea v-model="form.systemPrompt" rows="3"></textarea>
      </div>

      <div class="actions">
        <button class="btn-secondary" @click="handleCancel">Cancel</button>
        <button class="btn-primary" @click="handleSave">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h2 {
  margin: 0 0 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #555;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
}

.errors p {
  color: #e74c3c;
  font-size: 0.85rem;
  margin: 0.25rem 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-primary {
  background: #42b883;
  color: #fff;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-secondary {
  background: #eee;
  color: #333;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
}
</style>
