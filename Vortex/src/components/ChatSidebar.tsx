import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatSidebar({ currentCode }: { currentCode: string }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setLoading(true);

        try {
            const assistantReply = await invoke<string>('query_llm', {
                prompt: currentInput,
                codeContext: currentCode,
                filePath: 'src/App.tsx',
            });

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: assistantReply },
            ]);
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `Error communicating with backend: ${error}` },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <aside className="w-80 border-r border-gray-800 flex flex-col h-full bg-[#202023]">
            <div className="p-4 border-b border-gray-800 font-semibold text-sm tracking-wide text-gray-400">
                AI ASSISTANT
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
                {messages.map((m, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-[#2d2d30]' : 'bg-[#252526] border border-gray-700'}`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                ))}
                {loading && <div className="text-xs text-gray-500 animate-pulse">Thinking...</div>}
            </div>
            <div className="p-3 border-t border-gray-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask AI about your code..."
                        className="flex-1 bg-[#1e1e1e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleSend}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </aside>
    );
}