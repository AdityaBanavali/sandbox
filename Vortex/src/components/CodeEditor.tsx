import Editor from '@monaco-editor/react';

export function CodeEditor({ code, onChange }: { code: string; onChange: (value: string | undefined) => void }) {
    return (
        <div className="flex-1 h-full bg-[#1e1e1e]">
            <Editor
                height="100%"
                defaultLanguage="typescript"
                theme="vs-dark"
                value={code}
                onChange={onChange}
                options={{
                    fontSize: 14,
                    minimap: { enabled: true },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                }}
            />
        </div>
    );
}