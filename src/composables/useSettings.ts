import { ref, computed } from "vue";
import type { AppSettings } from "../types";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TTS_VOICE } from "../types";

const STORAGE_KEY = "english-speak-settings";

function getDefaultSettings(): AppSettings {
  return {
    speechRegion: "",
    speechKey: "",
    openaiEndpoint: "",
    openaiKey: "",
    openaiDeployment: "gpt-4.1-nano",
    ttsVoice: DEFAULT_TTS_VOICE,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
}

const settings = ref<AppSettings>(getDefaultSettings());
let loaded = false;

export function useSettings() {
  if (!loaded) {
    load();
    loaded = true;
  }

  const isConfigured = computed(() => {
    const s = settings.value;
    return !!(
      s.speechRegion &&
      s.speechKey &&
      s.openaiEndpoint &&
      s.openaiKey &&
      s.openaiDeployment
    );
  });

  function save(newSettings: AppSettings): void {
    settings.value = { ...newSettings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
  }

  function load(): AppSettings {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        settings.value = { ...getDefaultSettings(), ...JSON.parse(stored) };
      } catch {
        settings.value = getDefaultSettings();
      }
    }
    return settings.value;
  }

  function clear(): void {
    settings.value = getDefaultSettings();
    localStorage.removeItem(STORAGE_KEY);
  }

  function validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const s = settings.value;
    if (!s.speechRegion) errors.push("Speech Region is required");
    if (!s.speechKey) errors.push("Speech Key is required");
    if (!s.openaiEndpoint) errors.push("OpenAI Endpoint is required");
    if (!s.openaiKey) errors.push("OpenAI Key is required");
    if (!s.openaiDeployment) errors.push("OpenAI Deployment is required");
    return { valid: errors.length === 0, errors };
  }

  return {
    settings,
    isConfigured,
    save,
    load,
    clear,
    validate,
  };
}
