"use client";

import React, { useState, useId } from "react";
import { OperationSpec } from "@/types/techref-spec";
import { generateSnippet, CodeLanguage } from "@/lib/codegen";

export interface ApiPlaygroundProps {
  operation: OperationSpec;
}

export const ApiPlayground: React.FC<ApiPlaygroundProps> = ({ operation }) => {
  const baseId = useId();
  const defaultBaseUrl = operation.servers[0]?.url || "https://api.techref.dev/v1";

  const [selectedLang, setSelectedLang] = useState<CodeLanguage>("curl");
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "body">("params");
  const [pathParams, setPathParams] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    operation.parameters
      .filter((p) => p.in === "path")
      .forEach((p) => {
        init[p.name] = (p.schema.example as string) || "";
      });
    return init;
  });

  const [queryParams, setQueryParams] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    operation.parameters
      .filter((p) => p.in === "query")
      .forEach((p) => {
        init[p.name] = p.schema.example !== undefined ? String(p.schema.example) : "";
      });
    return init;
  });

  const [headers, setHeaders] = useState<Record<string, string>>({
    Authorization: "Bearer tr_live_84a92c819bf0",
    Accept: "application/json",
  });

  const [bodyJson, setBodyJson] = useState<string>(() => {
    if (!operation.requestBody?.properties) return "";
    const mockPayload: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(operation.requestBody.properties)) {
      mockPayload[key] = prop.example !== undefined ? prop.example : prop.type === "array" ? [] : "string";
    }
    return JSON.stringify(mockPayload, null, 2);
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [responseOutput, setResponseOutput] = useState<{
    status: number;
    statusText: string;
    timeMs: number;
    data: unknown;
  } | null>(null);

  const snippet = generateSnippet(selectedLang, {
    operation,
    baseUrl: defaultBaseUrl,
    pathParams,
    queryParams,
    headers,
    bodyJson,
  });

  const handleCopySnippet = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    const start = performance.now();
    try {
      // Simulate live network round-trip & verification
      await new Promise((r) => setTimeout(r, 450));

      let mockBody = null;
      if (bodyJson.trim()) {
        try {
          mockBody = JSON.parse(bodyJson);
        } catch {
          mockBody = { raw: bodyJson };
        }
      }

      const mockSuccessData = {
        data: {
          id: "tr_" + Math.random().toString(36).substring(2, 10),
          resource: operation.path,
          method: operation.method,
          status: "processed",
          timestamp: new Date().toISOString(),
          details: mockBody || { message: "Operation verified successfully" },
        },
        meta: {
          trace_id: "trc_live_" + Math.random().toString(36).substring(2, 12),
          server: "ord-edge-01.techref.network",
          rate_limit_remaining: 998,
        },
      };

      setResponseOutput({
        status: 200,
        statusText: "OK",
        timeMs: Math.round(performance.now() - start),
        data: mockSuccessData,
      });
    } catch (err: unknown) {
      setResponseOutput({
        status: 500,
        statusText: "Internal Error",
        timeMs: Math.round(performance.now() - start),
        data: { error: (err as Error).message },
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#070b14] overflow-hidden shadow-2xl text-slate-200">
      {/* Target Title & Method Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0c1222] gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-xs font-mono font-bold rounded-md ${
              operation.method === "GET"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : operation.method === "POST"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : operation.method === "DELETE"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            }`}
          >
            {operation.method}
          </span>
          <span className="font-mono text-sm text-slate-200 font-semibold">{operation.path}</span>
        </div>

        {/* Code Target Switcher */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5">
          {(["curl", "python", "javascript", "go", "rust"] as CodeLanguage[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors uppercase ${
                selectedLang === lang
                  ? "bg-cyan-500 text-black font-extrabold shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {/* Left Pane: Config Inputs */}
        <div className="lg:col-span-5 p-5 space-y-4">
          <div className="flex gap-2 border-b border-white/10 pb-2">
            {(["params", "headers", "body"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
                  activeTab === tab
                    ? "bg-white/10 text-cyan-400 font-bold border border-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "params" && (
            <div className="space-y-3">
              {operation.parameters.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 italic py-2">No path or query parameters required.</p>
              ) : (
                operation.parameters.map((param) => {
                  const inputId = `${baseId}-${param.in}-${param.name}`;
                  return (
                    <div key={param.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor={inputId} className="text-xs font-mono font-medium text-slate-200">
                          {param.name}
                        </label>
                        <span className="text-[10px] font-mono text-slate-500">
                          {param.in} {param.required && "• required"}
                        </span>
                      </div>
                      <input
                        id={inputId}
                        type="text"
                        placeholder={param.description || `Value for ${param.name}`}
                        value={param.in === "path" ? pathParams[param.name] || "" : queryParams[param.name] || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (param.in === "path") {
                            setPathParams((prev) => ({ ...prev, [param.name]: v }));
                          } else {
                            setQueryParams((prev) => ({ ...prev, [param.name]: v }));
                          }
                        }}
                        className="px-3 py-2 text-xs font-mono bg-black/50 border border-white/10 rounded-lg text-cyan-200 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "headers" && (
            <div className="space-y-3">
              {Object.entries(headers).map(([k, v]) => {
                const headerInputId = `${baseId}-header-${k}`;
                return (
                  <div key={k} className="flex flex-col gap-1">
                    <label htmlFor={headerInputId} className="text-xs font-mono text-slate-300">
                      {k}
                    </label>
                    <input
                      id={headerInputId}
                      type="text"
                      value={v}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHeaders((prev) => ({ ...prev, [k]: val }));
                      }}
                      className="px-3 py-2 text-xs font-mono bg-black/50 border border-white/10 rounded-lg text-cyan-200 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "body" && (
            <div>
              <textarea
                value={bodyJson}
                onChange={(e) => setBodyJson(e.target.value)}
                rows={9}
                className="w-full font-mono text-xs p-3 bg-black/50 border border-white/10 rounded-lg text-cyan-200 focus:border-cyan-400 focus:outline-none"
                placeholder="Enter JSON Request Body..."
              />
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-black font-mono font-bold text-xs uppercase tracking-wider hover:opacity-95 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {isExecuting ? "Executing Wire Request..." : "Send Request (Try It Out)"}
          </button>
        </div>

        {/* Right Pane: Live Snippet & Output Response */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-[#04070e]">
          <div>
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10 bg-[#090d18]">
              <span className="text-xs font-mono text-slate-400">Code Snippet ({selectedLang})</span>
              <button
                onClick={handleCopySnippet}
                className="text-[11px] font-mono px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
              >
                {copiedSnippet ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed max-h-60">
              <code>{snippet}</code>
            </pre>
          </div>

          <div className="border-t border-white/10">
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#090d18] border-b border-white/10">
              <span className="text-xs font-mono text-slate-400">Response Wire Console</span>
              {responseOutput && (
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className={responseOutput.status < 300 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {responseOutput.status} {responseOutput.statusText}
                  </span>
                  <span className="text-slate-500">{responseOutput.timeMs}ms</span>
                </div>
              )}
            </div>

            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-52 text-emerald-300 bg-[#03060c]">
              {responseOutput ? (
                <code>{JSON.stringify(responseOutput.data, null, 2)}</code>
              ) : (
                <span className="text-slate-600 italic">Click &quot;Send Request&quot; to execute call against sandbox mock...</span>
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
