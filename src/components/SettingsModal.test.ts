import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsModal from "./SettingsModal.vue";

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

describe("SettingsModal", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it("SM1: renders when show is true", () => {
    const wrapper = mount(SettingsModal, { props: { show: true } });
    expect(wrapper.find(".modal").exists()).toBe(true);
  });

  it("SM1: does not render when show is false", () => {
    const wrapper = mount(SettingsModal, { props: { show: false } });
    expect(wrapper.find(".modal").exists()).toBe(false);
  });

  it("SM4: shows validation errors when required fields are empty", async () => {
    const wrapper = mount(SettingsModal, { props: { show: true } });
    await wrapper.find(".btn-primary").trigger("click");
    expect(wrapper.find(".errors").exists()).toBe(true);
    expect(wrapper.text()).toContain("required");
  });

  it("SM5: cancel emits close without saving", async () => {
    const wrapper = mount(SettingsModal, { props: { show: true } });
    await wrapper.find(".btn-secondary").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
