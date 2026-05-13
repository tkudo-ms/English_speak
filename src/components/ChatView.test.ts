import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChatView from "./ChatView.vue";
import type { ChatMessage } from "../types";

describe("ChatView", () => {
  it("CH1: renders messages as MessageBubble components", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello!", timestamp: Date.now() },
      {
        role: "assistant",
        content: "Hi there!",
        timestamp: Date.now(),
      },
    ];
    const wrapper = mount(ChatView, {
      props: {
        messages,
        interimText: "",
        currentAssistantText: "",
        isStreaming: false,
      },
    });
    expect(wrapper.text()).toContain("Hello!");
    expect(wrapper.text()).toContain("Hi there!");
  });

  it("CH3: shows streaming assistant text", () => {
    const wrapper = mount(ChatView, {
      props: {
        messages: [],
        interimText: "",
        currentAssistantText: "I'm thinking about",
        isStreaming: true,
      },
    });
    expect(wrapper.text()).toContain("I'm thinking about");
    expect(wrapper.find(".streaming").exists()).toBe(true);
  });

  it("CH4: shows interim text with muted style", () => {
    const wrapper = mount(ChatView, {
      props: {
        messages: [],
        interimText: "Hello wor",
        currentAssistantText: "",
        isStreaming: false,
      },
    });
    expect(wrapper.text()).toContain("Hello wor");
    expect(wrapper.find(".interim").exists()).toBe(true);
  });

  it("CH1: shows empty state when no messages", () => {
    const wrapper = mount(ChatView, {
      props: {
        messages: [],
        interimText: "",
        currentAssistantText: "",
        isStreaming: false,
      },
    });
    expect(wrapper.find(".empty").exists()).toBe(true);
    expect(wrapper.text()).toContain("Start");
  });
});
