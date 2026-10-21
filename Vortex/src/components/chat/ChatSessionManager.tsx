import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Send,
  Loader2,
  Zap,
  FileCode,
  Check,
} from 'lucide-react';
import type { ChatMessage, ChatSession } from '../../types/chat';
import type { OpenFile } from '../../types/editor';
import { MessageContent } from './MessageContent';
import { AiService } from '../../services/aiService';

const SESSIONS_STORAGE_KEY = 'vortex_chat_sessions_v1';

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Code Assistant',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: 'msg-init-1',
        role: 'assistant',
        content: `👋 Hello! I am Vortex AI, your pair programming assistant.\n\nAsk me anything about your active code, ask to generate new algorithms, or request refactoring. Any code snippet I generate can be injected directly into your editor with **"Insert at Cursor"**!`,
        timestamp: new Date().toLocaleTimeString(),
        modelUsed: 'gemini-3.6-flash',
      },
    ],
  },
];

interface ChatSessionManagerProps {
  currentFile?: OpenFile;
  onInsertAtCursor?: (code: string) => void;
  onCreateNewFile?: (code: string, language: string) => void;
  accentColor: string;
  isCompact?: boolean;
}

export const ChatSessionManager: React.FC<ChatSessionManagerProps> = ({
  currentFile,
  onInsertAtCursor,
  onCreateNewFile,
  accentColor,
  isCompact = false,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load chat sessions:', e);
    }
    return INITIAL_SESSIONS;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    sessions[0]?.id || 'session-1'
  );
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Renaming title state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to save chat sessions:', e);
    }
  }, [sessions]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const handleCreateSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `Chat ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'New session started. How can I help you with your code?',
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // Clear messages of only session
      setSessions([
        {
          id: `session-${Date.now()}`,
          title: 'Code Assistant',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        },
      ]);
      return;
    }

    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleSaveRename = (sessionId: string) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s))
    );
    setEditingSessionId(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const prompt = inputVal.trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString(),
    };

    // Update active session messages
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: [...s.messages, userMsg],
              updatedAt: new Date().toISOString(),
              // Auto-rename session if it's new
              title: s.title.startsWith('Chat ') ? prompt.substring(0, 24) : s.title,
            }
          : s
      )
    );

    setInputVal('');
    setIsLoading(true);

    try {
      const response = await AiService.sendPrompt(prompt, {
        codeContext: currentFile?.content,
        filePath: currentFile?.path,
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toLocaleTimeString(),
        modelUsed: response.modelUsed,
        durationMs: response.durationMs,
        fallbackOccurred: response.fallbackOccurred,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: [...s.messages, assistantMsg], updatedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `⚠️ Failed to get AI response: ${err?.message || 'Connection error'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: [...s.messages, errorMsg], updatedAt: new Date().toISOString() }
            : s
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0b0b0f] select-text">
      {/* Session Threads Tab Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#111116] px-2 select-none">
        <div className="flex h-full items-center gap-1 overflow-x-auto scrollbar-none">
          {sessions.map((sess) => {
            const isActive = sess.id === activeSession.id;
            const isEditing = editingSessionId === sess.id;

            return (
              <div
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                className={`group flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[11.5px] transition-colors border ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-200 border-purple-500/30 font-medium'
                    : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <Sparkles size={11} className={isActive ? 'text-purple-400' : 'text-zinc-500'} />

                {isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(sess.id);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    onBlur={() => handleSaveRename(sess.id)}
                    autoFocus
                    className="h-4 w-20 rounded bg-black px-1 text-[11px] text-white outline-none border border-purple-500"
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      setEditingSessionId(sess.id);
                      setEditingTitle(sess.title);
                    }}
                    className="max-w-[90px] truncate"
                    title={sess.title}
                  >
                    {sess.title}
                  </span>
                )}

                {isActive && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(sess.id);
                      setEditingTitle(sess.title);
                    }}
                    title="Rename session"
                    className="hidden group-hover:block text-zinc-500 hover:text-white"
                  >
                    <Edit2 size={10} />
                  </button>
                )}

                <button
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  title="Close session"
                  className="hidden group-hover:block text-zinc-500 hover:text-red-400 ml-0.5"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleCreateSession}
          title="Start New Chat Session"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 transition-colors ml-1"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSession.messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold select-none ${
                msg.role === 'assistant'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'bg-white/[0.08] text-zinc-300'
              }`}
            >
              {msg.role === 'assistant' ? <Sparkles size={12} /> : 'U'}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-zinc-400 select-none">
                  {msg.role === 'assistant' ? 'Vortex Copilot' : 'You'}
                </span>
                <span className="text-[10px] text-zinc-600 select-none">{msg.timestamp}</span>

                {msg.modelUsed && (
                  <span className="flex items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.2 text-[9px] font-mono text-zinc-400 select-none">
                    <Zap size={9} className="text-purple-400" />
                    {msg.modelUsed}
                    {msg.fallbackOccurred && (
                      <span className="text-amber-400">(fallback)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Message Content with interactive CodeBlocks */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 shadow-sm">
                <MessageContent
                  content={msg.content}
                  onInsertAtCursor={onInsertAtCursor}
                  onCreateNewFile={onCreateNewFile}
                  accentColor={accentColor}
                />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 pl-9 text-[12px] text-purple-400 animate-pulse">
            <Loader2 size={13} className="animate-spin" />
            <span>Analyzing code context and streaming response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form & Context Indicator */}
      <div className="border-t border-white/[0.06] bg-[#0e0e13] p-3 space-y-2">
        {/* Active file context indicator */}
        {currentFile && (
          <div className="flex items-center justify-between text-[11px] text-zinc-500 select-none">
            <div className="flex items-center gap-1 truncate">
              <FileCode size={11} className="text-purple-400 shrink-0" />
              <span className="truncate">Context: {currentFile.path}</span>
            </div>
            <span className="text-emerald-400 font-mono text-[10px] shrink-0">Attached</span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isLoading}
            placeholder="Ask about your code, ask to generate functions, or debug..."
            className="flex-1 rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/60 focus:outline-none select-text"
          />
          <button
            type="submit"
            disabled={isLoading || !inputVal.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow transition-all disabled:opacity-40 select-none"
            style={{ backgroundColor: accentColor }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
