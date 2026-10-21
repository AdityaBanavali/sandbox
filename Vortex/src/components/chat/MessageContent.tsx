import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MessageContentProps {
  content: string;
  onInsertAtCursor?: (code: string) => void;
  onCreateNewFile?: (code: string, language: string) => void;
  accentColor: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  onInsertAtCursor,
  onCreateNewFile,
  accentColor,
}) => {
  // Parse markdown code fences ```lang\ncode```
  const parts: { type: 'text' | 'code'; language?: string; content: string }[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2],
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  return (
    <div className="space-y-2 select-text">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={idx}
              language={part.language || 'typescript'}
              code={part.content.trim()}
              onInsertAtCursor={onInsertAtCursor}
              onCreateNewFile={onCreateNewFile}
              accentColor={accentColor}
            />
          );
        }
        return (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed text-[13px] text-zinc-200">
            {part.content.trim()}
          </div>
        );
      })}
    </div>
  );
};
