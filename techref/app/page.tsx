"use client";

import React, { useState } from "react";
import Image from "next/image";
import rawOperations from "@/content/api/v1/operations.json";
import rawSearchIndex from "@/content/search-index.json";
import { OperationSpec, SearchDocEntry } from "@/types/techref-spec";
import { Sidebar, NavSection } from "@/components/navigation/Sidebar";
import { SearchModal } from "@/components/navigation/SearchModal";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { SchemaTable } from "@/components/api/SchemaTable";
import { ApiPlayground } from "@/components/api/ApiPlayground";

const operations = rawOperations as unknown as OperationSpec[];
const searchIndex = rawSearchIndex as unknown as SearchDocEntry[];

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Developer Guides",
    badge: "v1.4",
    items: [
      { id: "guide-quickstart", title: "Quickstart & Setup", category: "Guides" },
      { id: "guide-architecture", title: "Distributed Ingestion Blueprint", category: "Architecture" },
      { id: "guide-auth", title: "Authentication & Zero-Trust", category: "Security" },
    ],
  },
  {
    title: "Core API Reference",
    badge: "OpenAPI 3.0",
    items: operations.map((op) => ({
      id: op.id,
      title: op.path,
      method: op.method,
      badge: op.tags[0],
    })),
  },
  {
    title: "SDKs & Tooling",
    items: [
      { id: "sdk-typescript", title: "TypeScript & Node.js", badge: "TS" },
      { id: "sdk-python", title: "Python AsyncIO", badge: "Py" },
      { id: "sdk-rust", title: "Rust (Tokio / Reqwest)", badge: "Rs" },
      { id: "sdk-go", title: "Go Client Library", badge: "Go" },
    ],
  },
  {
    title: "Releases",
    items: [{ id: "changelog", title: "Changelog v1.4.0", badge: "Latest" }],
  },
];

export default function TechRefApp() {
  const [activeSection, setActiveSection] = useState<string>("guide-quickstart");
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const activeOp = operations.find((op) => op.id === activeSection);

  const handleSearchSelect = (item: SearchDocEntry) => {
    if (item.url.includes("#")) {
      const targetId = item.url.split("#")[1];
      setActiveSection(targetId);
    }
  };

  return (
    <div className="min-h-screen bg-[#04070e] text-slate-100 cyber-grid selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        indexData={searchIndex}
        onSelect={handleSearchSelect}
      />

      {/* Global Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
          {/* Brand & Crazy Icon */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-fuchsia-500/20 to-purple-900/40 p-1 border border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.25)]">
              <Image
                src="/crazy-icon.png"
                alt="TechRef Holographic Quantum Icon"
                width={36}
                height={36}
                className="rounded-lg object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent">
                  TECHREF
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                  Portal v1.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Open-Source API Reference & Developer Atlas
              </p>
            </div>
          </div>

          {/* Search Trigger Bar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-3 px-4 py-2 text-xs font-mono rounded-xl bg-slate-900/80 border border-white/10 hover:border-cyan-400/50 text-slate-400 hover:text-white transition-all shadow-inner"
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Quick search specs & docs...</span>
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
                ⌘K
              </kbd>
            </button>

            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Spec Synced
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-Column Documentation Layout */}
      <div className="max-w-7xl mx-auto flex">
        {/* Left Multi-Tier Collapsible Sidebar */}
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          sections={NAV_SECTIONS}
        />

        {/* Center Main Reading Content */}
        <main className="flex-1 min-w-0 p-6 sm:p-10 max-w-4xl space-y-12">
          {/* Active API Endpoint View */}
          {activeOp ? (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <div className="flex items-center gap-2 mb-2 font-mono text-xs text-cyan-400 uppercase tracking-widest">
                  <span>API Reference</span>
                  <span>/</span>
                  <span>{activeOp.tags[0]}</span>
                </div>
                <h1 id={activeOp.id} className="text-3xl font-black text-white tracking-tight mb-3">
                  {activeOp.title}
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed font-mono">
                  {activeOp.description}
                </p>
              </div>

              {/* Parameter Specifications */}
              {activeOp.parameters.length > 0 && (
                <div className="space-y-3">
                  <h2 id="parameters" className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
                    Request Parameters
                  </h2>
                  <div className="space-y-2">
                    {activeOp.parameters.map((p) => (
                      <div key={p.name} className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40 text-xs font-mono">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-cyan-300">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 uppercase">
                            {p.in}
                          </span>
                          <span className="text-slate-400">{p.schema.type}</span>
                          {p.required && (
                            <span className="text-rose-400 text-[10px] font-bold">REQUIRED</span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-slate-400 mt-1.5 leading-relaxed">{p.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Body Nested Schema */}
              {activeOp.requestBody && (
                <div className="space-y-3">
                  <h2 id="request-body-schema" className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
                    Request Body Schema (JSON)
                  </h2>
                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
                    <SchemaTable schema={activeOp.requestBody} />
                  </div>
                </div>
              )}

              {/* Response Status Codes & Schemas */}
              <div className="space-y-3">
                <h2 id="response-schemas" className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
                  Response Contracts
                </h2>
                <div className="space-y-3">
                  {Object.entries(activeOp.responses).map(([code, resp]) => (
                    <div key={code} className="p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-2">
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          code.startsWith("2") ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}>
                          HTTP {code}
                        </span>
                        <span className="text-xs text-slate-300">{resp.description}</span>
                      </div>
                      {resp.schema && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <SchemaTable schema={resp.schema} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Interactive Playground & Code Gen */}
              <div className="space-y-3 pt-4">
                <h2 id="interactive-console" className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/10 pb-2">
                  Interactive Console & Multi-Language Snippet
                </h2>
                <ApiPlayground operation={activeOp} />
              </div>
            </div>
          ) : activeSection === "guide-quickstart" ? (
            /* Quickstart Guide */
            <div className="space-y-8 animate-fadeIn font-mono">
              <div>
                <span className="text-xs text-cyan-400 uppercase tracking-widest">Developer Guides</span>
                <h1 id="quickstart" className="text-3xl font-black text-white tracking-tight mt-1 mb-3">
                  TechRef Quickstart & Ingestion Protocol
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Learn how to ingest OpenAPI 3.0/Swagger specifications, authenticate against the sandbox API, and execute
                  resilient distributed RPC requests using idiomatic SDK clients.
                </p>
              </div>

              <Callout type="tip" title="Zero Ingestion Downtime">
                The TechRef ingestion workflow validates schemas with OpenAPI 3.0 and builds deterministic TypeScript ASTs
                at build time with zero client bundle overhead.
              </Callout>

              <div className="space-y-3">
                <h2 id="step-1-environment" className="text-lg font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                  1. Setup API Keys & Environment
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Export your scoped sandbox token to your local environment or `.env.local` configuration:
                </p>
                <pre className="p-4 rounded-xl bg-black/60 border border-white/10 text-cyan-300 text-xs overflow-x-auto">
                  <code>export TECHREF_API_KEY=&quot;tr_live_948a2bc81048fe&quot;{'\n'}export TECHREF_ENDPOINT=&quot;https://api.techref.dev/v1&quot;</code>
                </pre>
              </div>

              <div className="space-y-3">
                <h2 id="step-2-first-request" className="text-lg font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                  2. Execute Your First API Call
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate vector embeddings or query active telemetry via standard cURL:
                </p>
                <pre className="p-4 rounded-xl bg-black/60 border border-white/10 text-cyan-300 text-xs overflow-x-auto">
                  <code>{`curl -X POST "https://api.techref.dev/v1/embeddings" \\
  -H "Authorization: Bearer $TECHREF_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"text-embedding-3-large","input":["Hello TechRef"]}'`}</code>
                </pre>
              </div>

              <Callout type="warning" title="Rate Limits & Concurrency">
                Standard free tier keys enforce a concurrency ceiling of 60 requests per minute with exponential backoff on HTTP 429.
              </Callout>
            </div>
          ) : activeSection === "guide-architecture" ? (
            /* Architecture Guide */
            <div className="space-y-8 animate-fadeIn font-mono">
              <div>
                <span className="text-xs text-cyan-400 uppercase tracking-widest">System Architecture</span>
                <h1 id="architecture-blueprint" className="text-3xl font-black text-white tracking-tight mt-1 mb-3">
                  Distributed Ingestion Architecture
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  High-throughput architecture patterns for streaming telemetry, vector embeddings, and partitioned
                  consensus using Raft and Kafka message queues.
                </p>
              </div>

              <div className="space-y-3">
                <h2 id="pipeline-topology" className="text-lg font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                  Pipeline Ingestion Topology
                </h2>
                <div className="p-6 rounded-2xl bg-black/70 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed">
                  <pre className="overflow-x-auto">
{`[Edge Clients] ---> [Next.js 16 Edge Gateway / Auth Proxy]
                           |
                           v
                   [Kafka Partition Topic]
                           |
      +--------------------+--------------------+
      |                                         |
      v                                         v
[Tokio Stream Worker A]               [Tokio Stream Worker B]
      |                                         |
      +--------------------+--------------------+
                           |
                           v
              [pgvector + RocksDB State Engine]`}
                  </pre>
                </div>
              </div>

              <Callout type="note" title="Backpressure Strategy">
                Workers deploy bounded Tokio mpsc channels with high-watermark backpressure triggers to prevent memory exhaustion
                during sudden ingestion bursts.
              </Callout>
            </div>
          ) : activeSection === "guide-auth" ? (
            /* Auth Guide */
            <div className="space-y-8 animate-fadeIn font-mono">
              <div>
                <span className="text-xs text-cyan-400 uppercase tracking-widest">Security Specifications</span>
                <h1 id="zero-trust-auth" className="text-3xl font-black text-white tracking-tight mt-1 mb-3">
                  Authentication & Passkey Verification
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  TechRef enforces modern cryptographic security standards using FIDO2 WebAuthn biometric credentials and
                  scoped short-lived JWT bearer tokens.
                </p>
              </div>

              <div className="space-y-3">
                <h2 id="token-scopes" className="text-lg font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                  Token Scope Hierarchy
                </h2>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-2">
                  <li><code className="text-cyan-400">embeddings:write</code> — Generate high-dimensional vector representations.</li>
                  <li><code className="text-cyan-400">pipelines:read</code> — Stream telemetry and inspect worker consumer lag.</li>
                  <li><code className="text-cyan-400">admin:revoke</code> — Invalidate API keys and broadcast distributed eviction events.</li>
                </ul>
              </div>
            </div>
          ) : activeSection.startsWith("sdk-") ? (
            /* SDKs View */
            <div className="space-y-8 animate-fadeIn font-mono">
              <div>
                <span className="text-xs text-cyan-400 uppercase tracking-widest">Client Libraries</span>
                <h1 id="sdk-reference" className="text-3xl font-black text-white tracking-tight mt-1 mb-3">
                  Official SDK Distributions
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Idiomatic, production-hardened libraries featuring built-in retries, circuit breakers, and full TypeScript/Python typings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-300">TypeScript / Node</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">v1.4.0</span>
                  </div>
                  <pre className="p-3 bg-black/60 rounded-lg text-xs text-slate-300">npm install @techref/sdk</pre>
                </div>

                <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-300">Python (AsyncIO)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">v1.4.0</span>
                  </div>
                  <pre className="p-3 bg-black/60 rounded-lg text-xs text-slate-300">pip install techref-sdk</pre>
                </div>

                <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-300">Rust (Tokio)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">v0.8.2</span>
                  </div>
                  <pre className="p-3 bg-black/60 rounded-lg text-xs text-slate-300">cargo add techref</pre>
                </div>

                <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-300">Go (net/http)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">v1.2.0</span>
                  </div>
                  <pre className="p-3 bg-black/60 rounded-lg text-xs text-slate-300">go get github.com/techref/go-sdk</pre>
                </div>
              </div>
            </div>
          ) : (
            /* Changelog View */
            <div className="space-y-8 animate-fadeIn font-mono">
              <div>
                <span className="text-xs text-cyan-400 uppercase tracking-widest">Version Releases</span>
                <h1 id="changelog" className="text-3xl font-black text-white tracking-tight mt-1 mb-3">
                  Changelog & Release Notes
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Chronological record of platform upgrades, schema migrations, and compiler improvements.
                </p>
              </div>

              <div className="border-l border-white/10 pl-4 space-y-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500 text-black font-bold text-xs">v1.4.0</span>
                    <span className="text-xs text-slate-400">September 2026</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">Turbopack Compiler & HNSW Vector Indexing</h3>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                    <li>Added sub-millisecond pgvector cosine similarity search retrieval.</li>
                    <li>Upgraded to Next.js 16.3.4 with Turbopack and React 19.</li>
                    <li>Interactive multi-language playground supporting cURL, Python, JS, Rust, Go.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Floating "On This Page" Table of Contents */}
        <TableOfContents />
      </div>
    </div>
  );
}
