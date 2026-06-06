import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiConfig } from '../../config/configuration';

// Minimal OpenRouter HTTP wrapper. We don't pull in the openai SDK because
// we only need the chat-completions endpoint and the OpenAI client adds a
// lot of surface area (retries, streaming machinery, etc.) we'd then have
// to neuter to keep behavior predictable behind a strict per-request
// timeout.

// One tool call the LLM is forced to emit. `arguments` is the JSON string
// matching the tool's parameters schema — service callers JSON.parse it.
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCallOptions {
  model: string;
  messages: ChatMessage[];
  // Tool-calling forces JSON-schema compliance. tool_choice: 'required'
  // means the model must call SOMETHING — we always pass exactly one tool
  // so it's effectively "call this tool with these args".
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  toolChoice?: { type: 'function'; function: { name: string } } | 'auto' | 'required';
  // 0 for parsers (deterministic), small (0.3) for rerankers (slight variation
  // helps avoid same-rank ties when scores are close).
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterResponse {
  toolCalls: ToolCall[];
  // Free-text response (when no tools or model chose not to call one).
  // Rerankers use this; parsers reject any response without a tool call.
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const ai = this.config.get<AiConfig>('ai')!;
    this.apiKey = ai.openrouterApiKey;
    this.timeoutMs = ai.requestTimeoutMs;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Throws on transport error or non-2xx. Caller catches + logs + may fall
  // back. Per-request AbortController guards against the upstream hanging
  // longer than AI_REQUEST_TIMEOUT_MS — a request thread blocked for 60s
  // on a hung LLM is a real outage vector, the timeout caps it.
  async chat(opts: OpenRouterCallOptions): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.tools) body.tools = opts.tools;
    if (opts.toolChoice) body.tool_choice = opts.toolChoice;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          // OpenRouter surfaces these in the dashboard for usage analytics.
          // Optional; helps the operator see which app is burning tokens.
          // Must be ASCII — fetch's Headers reject non-ByteString values
          // (the original "Hôm Nay Đi Đâu" threw at runtime).
          'HTTP-Referer': 'https://homnaydidau.local',
          'X-Title': 'Hom Nay Di Dau',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      const isAbort = (e as Error).name === 'AbortError';
      throw new Error(
        isAbort
          ? `LLM call timed out after ${this.timeoutMs}ms (${opts.model})`
          : `LLM transport error: ${String(e)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `OpenRouter HTTP ${res.status}: ${errBody.slice(0, 500)} (${opts.model})`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string; tool_calls?: ToolCall[] };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      error?: { message: string };
    };
    if (data.error) {
      throw new Error(`OpenRouter error: ${data.error.message}`);
    }

    const msg = data.choices?.[0]?.message ?? {};
    return {
      toolCalls: msg.tool_calls ?? [],
      content: msg.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }
}
