import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SpeechControls from "./SpeechControls.vue";

describe("SpeechControls", () => {
  it("SC1: shows Start button when idle", () => {
    const wrapper = mount(SpeechControls, { props: { appState: "idle" } });
    expect(wrapper.text()).toContain("Start");
  });

  it("SC2: shows Stop button when listening", () => {
    const wrapper = mount(SpeechControls, {
      props: { appState: "listening" },
    });
    expect(wrapper.text()).toContain("Stop");
    expect(wrapper.text()).toContain("Listening");
  });

  it("SC3: shows Thinking when thinking", () => {
    const wrapper = mount(SpeechControls, {
      props: { appState: "thinking" },
    });
    expect(wrapper.text()).toContain("Thinking");
  });

  it("SC4: shows Speaking when speaking", () => {
    const wrapper = mount(SpeechControls, {
      props: { appState: "speaking" },
    });
    expect(wrapper.text()).toContain("Speaking");
  });
});
