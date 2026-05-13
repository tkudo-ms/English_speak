import { ref } from "vue";
import type { ChatMessage, OpenAIChatChunk, AppError } from "../types";
import { useSettings } from "./useSettings";

export function useChat() {
  const { settings } = useSettings();

  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const currentAssistantText = ref("");
  const error = ref<AppError | null>(null);

  let sentenceCallback: ((sentence: string) => void) | null = null;
  let systemPrompt = settings.value.systemPrompt;

  // Abbreviations that should not trigger sentence splits
  const ABBREVIATIONS =
    /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|U\.S|U\.K|e\.g|i\.e)\.\s*$/;

  function onSentence(callback: (sentence: string) => void) {
    sentenceCallback = callback;
  }

  function setSystemPrompt(prompt: string) {
    systemPrompt = prompt;
  }

  function clearHistory() {
    messages.value = [];
    currentAssistantText.value = "";
    error.value = null;
  }

  async function sendMessage(text: string): Promise<void> {
    error.value = null;

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    messages.value.push(userMessage);

    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.value.map((m) => ({ role: m.role, content: m.content })),
    ];

    const endpoint = settings.value.openaiEndpoint.replace(/\/$/, "");
    const url = `${endpoint}/openai/v1/chat/completions`;

    isStreaming.value = true;
    currentAssistantText.value = "";
    let sentenceBuffer = "";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": settings.value.openaiKey,
        },
        body: JSON.stringify({
          model: settings.value.openaiDeployment,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 256,
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        let message = "OpenAI API error";
        if (status === 401)
          message = "Authentication failed. Check your API key.";
        else if (status === 429)
          message = "Rate limited. Please wait and try again.";
        error.value = {
          source: "openai",
          message,
          detail: `Status: ${status}`,
        };
        isStreaming.value = false;
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const chunk: OpenAIChatChunk = JSON.parse(data);
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              currentAssistantText.value += content;
              sentenceBuffer += content;

              // Check for sentence boundaries: .!?…
              // But skip abbreviations (Mr. Dr. etc.)
              // And treat consecutive !? as single boundary
              if (
                (/[.!?…]\s*$/.test(sentenceBuffer) ||
                  /\.{3}\s*$/.test(sentenceBuffer)) &&
                !ABBREVIATIONS.test(sentenceBuffer)
              ) {
                sentenceCallback?.(sentenceBuffer.trim());
                sentenceBuffer = "";
              }
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      // flush remaining buffer
      if (sentenceBuffer.trim()) {
        sentenceCallback?.(sentenceBuffer.trim());
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: currentAssistantText.value,
        timestamp: Date.now(),
      };
      messages.value.push(assistantMessage);
    } catch (e) {
      error.value = {
        source: "openai",
        message: "Network error. Check your connection.",
        detail: e instanceof Error ? e.message : String(e),
      };
    } finally {
      isStreaming.value = false;
    }
  }

  return {
    messages,
    isStreaming,
    currentAssistantText,
    error,
    sendMessage,
    clearHistory,
    setSystemPrompt,
    onSentence,
  };
}
