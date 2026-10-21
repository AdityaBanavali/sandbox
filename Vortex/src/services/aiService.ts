/**
 * AI Service: API Key Vault & Multi-Model Fallback Engine
 */
import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauriBridge';

const CUSTOM_KEY_STORAGE = 'vortex_custom_gemini_api_key';

// Model fallback chain using active, verified Google models
export const FALLBACK_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Fast / Low Latency)' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (High Performance)' },
];

export interface AiResponseResult {
  text: string;
  modelUsed: string;
  fallbackOccurred: boolean;
  durationMs: number;
}

export const AiService = {
  getCustomKey(): string {
    return localStorage.getItem(CUSTOM_KEY_STORAGE) || '';
  },

  hasCustomKey(): boolean {
    return Boolean(this.getCustomKey().trim());
  },

  setCustomKey(key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(CUSTOM_KEY_STORAGE, trimmed);
    } else {
      localStorage.removeItem(CUSTOM_KEY_STORAGE);
    }
  },

  clearCustomKey(): void {
    localStorage.removeItem(CUSTOM_KEY_STORAGE);
  },

  getActiveApiKey(): string {
    const custom = this.getCustomKey();
    if (custom) return custom;
    return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  },

  async testApiKey(key: string): Promise<{ success: boolean; message: string }> {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return { success: false, message: 'API key cannot be blank.' };
    }

    try {
      // 1. Try Tauri native backend execution first
      if (isTauriEnvironment()) {
        try {
          await invoke('query_llm', {
            prompt: 'ping',
            codeContext: null,
            filePath: null,
            apiKey: trimmedKey,
            model: 'gemini-3.6-flash',
          });
          return { success: true, message: 'API Key verified successfully! Connection live.' };
        } catch (tauriErr: any) {
          const errStr = tauriErr?.message || String(tauriErr);
          return { success: false, message: `Validation error: ${errStr}` };
        }
      }

      // 2. Direct browser fetch fallback
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${trimmedKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error?.message || `HTTP ${res.status}`;
        return { success: false, message: `Key validation error: ${errorMsg}` };
      }

      return { success: true, message: 'API Key verified successfully! Connection live.' };
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err?.message || err}` };
    }
  },

  async sendPrompt(
    prompt: string,
    options?: {
      codeContext?: string;
      filePath?: string;
      preferredModel?: string;
    }
  ): Promise<AiResponseResult> {
    const apiKey = this.getActiveApiKey();
    if (!apiKey) {
      throw new Error(
        'No Gemini API key found. Please set VITE_GEMINI_API_KEY in your .env file or save a custom key in Settings -> Custom API Key Vault.'
      );
    }
    const startTime = Date.now();

    const fileContext = options?.codeContext
      ? `\n\nActive File (${options.filePath || 'untitled'}):\n\`\`\`\n${options.codeContext}\n\`\`\``
      : '';

    const systemPrompt = `You are Vortex, an elite AI desktop code editor pair programmer. 
Respond with concise, production-ready code. Whenever providing code, always wrap it in fenced markdown code blocks with the language identifier (e.g. \`\`\`typescript, \`\`\`rust, \`\`\`json, \`\`\`python).`;

    const userMessage = `${prompt}${fileContext}`;

    // Priority models list
    const candidateModels = options?.preferredModel
      ? [
          options.preferredModel,
          ...FALLBACK_MODELS.map((m) => m.id).filter((m) => m !== options.preferredModel),
        ]
      : FALLBACK_MODELS.map((m) => m.id);

    let lastError = 'Unknown error';

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      const isFallback = i > 0;

      // 1. Try Tauri Native Backend first (bypasses browser CORS & WKWebView sandboxes)
      if (isTauriEnvironment()) {
        try {
          const text = await invoke<string>('query_llm', {
            prompt,
            codeContext: options?.codeContext || null,
            filePath: options?.filePath || null,
            apiKey,
            model,
          });

          if (text) {
            return {
              text,
              modelUsed: model,
              fallbackOccurred: isFallback,
              durationMs: Date.now() - startTime,
            };
          }
        } catch (tauriErr: any) {
          lastError = tauriErr?.message || String(tauriErr);
          console.warn(`Tauri native query_llm error with ${model}: ${lastError}. Trying next...`);
        }
      }

      // 2. Browser fetch fallback
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userMessage }] }],
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          lastError = data?.error?.message || `HTTP ${res.status}`;
          console.warn(`Model ${model} failed (${lastError}). Falling back to next model...`);
          continue;
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!reply) {
          lastError = 'Empty response from model';
          continue;
        }

        return {
          text: reply,
          modelUsed: model,
          fallbackOccurred: isFallback,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`Network error with ${model}: ${lastError}. Trying fallback...`);
      }
    }

    throw new Error(`All AI fallback models exhausted. Last error: ${lastError}`);
  },
};
