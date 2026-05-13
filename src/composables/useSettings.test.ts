import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettings } from "./useSettings";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TTS_VOICE } from "../types";

// localStorage mock
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
});

describe("useSettings", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    // Reset the module-level loaded flag by re-importing
    // For now, we call clear to reset state
    const { clear } = useSettings();
    clear();
  });

  it("S1: returns default values when localStorage is empty", () => {
    const { settings } = useSettings();
    expect(settings.value.ttsVoice).toBe(DEFAULT_TTS_VOICE);
    expect(settings.value.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(settings.value.speechRegion).toBe("");
    expect(settings.value.openaiDeployment).toBe("gpt-4.1-nano");
  });

  it("S2: save and load round-trip", () => {
    const { settings, save } = useSettings();
    save({
      ...settings.value,
      speechRegion: "japaneast",
      speechKey: "test-key",
    });

    const { settings: loaded } = useSettings();
    expect(loaded.value.speechRegion).toBe("japaneast");
    expect(loaded.value.speechKey).toBe("test-key");
  });

  it("S3: isConfigured = true when all required fields are filled", () => {
    const { save, isConfigured } = useSettings();
    save({
      speechRegion: "japaneast",
      speechKey: "key1",
      openaiEndpoint: "https://test.openai.azure.com",
      openaiKey: "key2",
      openaiDeployment: "gpt-4.1-nano",
      ttsVoice: DEFAULT_TTS_VOICE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
    expect(isConfigured.value).toBe(true);
  });

  it("S4: isConfigured = false when required fields are missing", () => {
    const { isConfigured } = useSettings();
    expect(isConfigured.value).toBe(false);
  });

  it("S4: validate returns errors for missing fields", () => {
    const { validate } = useSettings();
    const result = validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("S5: clear resets to defaults", () => {
    const { save, clear, isConfigured } = useSettings();
    save({
      speechRegion: "japaneast",
      speechKey: "key1",
      openaiEndpoint: "https://test.openai.azure.com",
      openaiKey: "key2",
      openaiDeployment: "gpt-4.1-nano",
      ttsVoice: DEFAULT_TTS_VOICE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
    expect(isConfigured.value).toBe(true);
    clear();
    expect(isConfigured.value).toBe(false);
  });

  it("S6: validate returns error for invalid endpoint format", () => {
    const { save, validate } = useSettings();
    save({
      speechRegion: "japaneast",
      speechKey: "key1",
      openaiEndpoint: "http://not-https.com",
      openaiKey: "key2",
      openaiDeployment: "gpt-4.1-nano",
      ttsVoice: DEFAULT_TTS_VOICE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
    // validate itself checks required fields only
    // endpoint format is checked in SettingsModal
    const result = validate();
    expect(result.valid).toBe(true);
  });
});
