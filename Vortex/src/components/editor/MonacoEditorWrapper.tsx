import React, { useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { CursorPosition, EditorDiagnostics, ThemeConfig } from '../../types/editor';
import type { ConflictBlock } from '../../types/git';
import { registerMonacoThemes } from '../../services/themeService';
import { GitService } from '../../services/gitService';
import { ConflictResolver } from '../git/ConflictResolver';

function parseConflictBlocks(content: string): ConflictBlock[] {
  const lines = content.split('\n');
  const blocks: ConflictBlock[] = [];
  let inConflict = false;
  let startLine = 0;
  let currentLabel = '';
  let currentLines: string[] = [];
  let middleLine = 0;
  let incomingLines: string[] = [];
  let pastMiddle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      startLine = lineNum;
      currentLabel = line.replace('<<<<<<<', '').trim() || 'HEAD';
      currentLines = [];
      incomingLines = [];
      pastMiddle = false;
    } else if (inConflict && line.startsWith('=======') && !pastMiddle) {
      middleLine = lineNum;
      pastMiddle = true;
    } else if (inConflict && pastMiddle && line.startsWith('>>>>>>>')) {
      const incomingLabel = line.replace('>>>>>>>', '').trim() || 'Incoming';
      blocks.push({
        id: `conflict-${startLine}-${lineNum}`,
        startLine,
        middleLine,
        endLine: lineNum,
        currentLabel,
        currentContent: currentLines.join('\n'),
        incomingLabel,
        incomingContent: incomingLines.join('\n'),
      });
      inConflict = false;
    } else if (inConflict) {
      if (!pastMiddle) {
        currentLines.push(line);
      } else {
        incomingLines.push(line);
      }
    }
  }

  return blocks;
}

export interface MonacoEditorHandle {
  insertTextAtCursor: (text: string) => void;
  getEditor: () => any;
}

interface MonacoEditorWrapperProps {
  value: string;
  language: string;
  themeConfig: ThemeConfig;
  fontSize?: number;
  minimapEnabled?: boolean;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  onChange: (value: string | undefined) => void;
  onCursorChange?: (pos: CursorPosition) => void;
  onDiagnosticsChange?: (diag: EditorDiagnostics) => void;
  onSave?: () => void;
  focusOnMount?: boolean;
  filePath?: string;
  accentColor?: string;
}

export const MonacoEditorWrapper = forwardRef<MonacoEditorHandle, MonacoEditorWrapperProps>(
  (
    {
      value,
      language,
      themeConfig,
      fontSize = 13,
      minimapEnabled = true,
      tabSize = 2,
      wordWrap = 'on',
      onChange,
      onCursorChange,
      onDiagnosticsChange,
      onSave,
      focusOnMount = false,
      filePath,
      accentColor = '#8b7cf6',
    },
    ref
  ) => {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const blameTimeoutRef = useRef<any>(null);
    const blameDecorationsRef = useRef<string[]>([]);

    useImperativeHandle(ref, () => ({
      insertTextAtCursor: (text: string) => {
        if (!editorRef.current) return;
        const selection = editorRef.current.getSelection();
        if (selection) {
          editorRef.current.executeEdits('vortex-ai-insert', [
            {
              range: selection,
              text,
              forceMoveMarkers: true,
            },
          ]);
          editorRef.current.focus();
        }
      },
      getEditor: () => editorRef.current,
    }));

    const handleEditorDidMount: OnMount = (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      registerMonacoThemes(monaco);
      monaco.editor.setTheme(themeConfig.monacoTheme);

      // Configure Monaco TypeScript & React JSX compiler options
      if (monaco.languages?.typescript) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.CommonJS,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          reactNamespace: 'React',
          allowJs: true,
        });

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        });

        // Filter out false-positive module resolution codes for web/Tauri Monaco sandbox
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: [2307, 2686, 7016, 2503],
        });

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: [2307, 2686, 7016, 2503],
        });

        // Ambient type definitions for React, JSX, Lucide, and Tauri
        const ambientTypes = `
          declare module 'react' {
            export = React;
            export as namespace React;
            namespace React {
              export function createElement(type: any, props?: any, ...children: any[]): any;
              export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
              export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
              export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
              export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
              export function useRef<T>(initialValue?: T): { current: T };
              export function useImperativeHandle<T, R extends T>(ref: any, init: () => R, deps?: readonly any[]): void;
              export function forwardRef<T, P = {}>(render: (props: P, ref: any) => any): any;
              export type FC<P = {}> = (props: P) => any;
              export type ReactNode = any;
              export type ComponentType<P = {}> = any;
              export type CSSProperties = Record<string, any>;
              export type MouseEvent<T = any> = any;
              export type KeyboardEvent<T = any> = any;
              export type FormEvent<T = any> = any;
              export type ChangeEvent<T = any> = any;
            }
          }
          declare module 'react/jsx-runtime' {
            export const jsx: any;
            export const jsxs: any;
            export const Fragment: any;
          }
          declare namespace JSX {
            interface IntrinsicElements {
              [elemName: string]: any;
            }
            interface Element {}
          }
          declare module 'lucide-react' {
            export const [key: string]: any;
          }
          declare module '@tauri-apps/api/core' {
            export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
          }
          declare module '@monaco-editor/react' {
            export const Editor: any;
            export default Editor;
          }
        `;

        try {
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            ambientTypes,
            'ts:filename/ambient-react-vortex.d.ts'
          );
          monaco.languages.typescript.javascriptDefaults.addExtraLib(
            ambientTypes,
            'ts:filename/ambient-react-vortex.d.ts'
          );
        } catch {
          // Ambient types already registered
        }
      }

      if (focusOnMount) {
        editor.focus();
      }

      const updateBlameAnnotation = (lineNumber: number) => {
        if (blameTimeoutRef.current) {
          clearTimeout(blameTimeoutRef.current);
        }

        if (!filePath || !editorRef.current || !monacoRef.current) return;

        blameTimeoutRef.current = setTimeout(async () => {
          try {
            const blame = await GitService.getBlameLine(filePath, lineNumber);
            if (!editorRef.current || !monacoRef.current) return;

            const monaco = monacoRef.current;
            const model = editorRef.current.getModel();
            if (!model) return;

            const currentLine = editorRef.current.getPosition()?.lineNumber;
            if (currentLine !== lineNumber) return;

            if (blame && blame.authorName) {
              const lineMaxCol = model.getLineMaxColumn(lineNumber);
              const text = `    ${blame.authorName}, ${blame.relativeTime} • ${blame.summary}`;
              blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, [
                {
                  range: new monaco.Range(lineNumber, lineMaxCol, lineNumber, lineMaxCol),
                  options: {
                    isWholeLine: false,
                    after: {
                      content: text,
                      inlineClassName: 'vortex-git-blame-ghost',
                    },
                  },
                },
              ]);
            } else {
              blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, []);
            }
          } catch {
            if (editorRef.current) {
              blameDecorationsRef.current = editorRef.current.deltaDecorations(blameDecorationsRef.current, []);
            }
          }
        }, 300);
      };

      // Cursor position listener
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.({
          line: e.position.lineNumber,
          column: e.position.column,
        });
        updateBlameAnnotation(e.position.lineNumber);
      });

      // Markers / diagnostics listener
      const updateMarkers = () => {
        const model = editor.getModel();
        if (!model) return;
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        let errors = 0;
        let warnings = 0;
        let infos = 0;

        for (const m of markers) {
          if (m.severity === monaco.MarkerSeverity.Error) errors++;
          else if (m.severity === monaco.MarkerSeverity.Warning) warnings++;
          else if (m.severity === monaco.MarkerSeverity.Info) infos++;
        }

        onDiagnosticsChange?.({ errors, warnings, infos });
      };

      monaco.editor.onDidChangeMarkers(updateMarkers);

      // Bind Ctrl+S / Cmd+S save shortcut
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave?.();
      });
    };

    // Conflict blocks parsing
    const conflictBlocks = useMemo(() => {
      if (!value || !value.includes('<<<<<<<') || !value.includes('>>>>>>>')) {
        return [];
      }
      return parseConflictBlocks(value);
    }, [value]);

    const handleResolveConflictBlock = (
      _blockId: string,
      resolvedContent: string,
      startLine: number,
      endLine: number
    ) => {
      if (editorRef.current && monacoRef.current) {
        const monaco = monacoRef.current;
        const model = editorRef.current.getModel();
        if (model) {
          const lineCount = model.getLineCount();
          const safeEnd = Math.min(endLine, lineCount);
          const maxCol = model.getLineMaxColumn(safeEnd);
          const range = new monaco.Range(startLine, 1, safeEnd, maxCol);
          editorRef.current.executeEdits('resolve-conflict', [
            {
              range,
              text: resolvedContent,
              forceMoveMarkers: true,
            },
          ]);
          const updated = editorRef.current.getValue();
          onChange(updated);
          onSave?.();
        }
      }
    };

    // Sync theme changes
    useEffect(() => {
      if (monacoRef.current) {
        monacoRef.current.editor.setTheme(themeConfig.monacoTheme);
      }
    }, [themeConfig]);

    return (
      <div className="relative h-full w-full flex flex-col overflow-hidden bg-transparent">
        {conflictBlocks.length > 0 && (
          <ConflictResolver
            conflicts={conflictBlocks}
            filePath={filePath || 'untitled'}
            accentColor={accentColor}
            onResolveBlock={handleResolveConflictBlock}
            onResolveAll={() => {}}
          />
        )}

        <div className="flex-1 w-full relative overflow-hidden">
          <Editor
            height="100%"
            width="100%"
            language={language}
            theme={themeConfig.monacoTheme}
            value={value}
            onChange={onChange}
            onMount={handleEditorDidMount}
            loading={
              <div className="flex h-full w-full items-center justify-center text-zinc-500 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
                  <span>Loading Monaco Engine...</span>
                </div>
              </div>
            }
            options={{
              fontSize,
              tabSize,
              wordWrap,
              minimap: {
                enabled: minimapEnabled,
                renderCharacters: true,
                maxColumn: 100,
                scale: 1,
                showSlider: 'mouseover',
              },
              automaticLayout: true,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
              fontLigatures: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              contextmenu: true,
              folding: true,
              lineNumbers: 'on',
              padding: { top: 12, bottom: 12 },
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      </div>
    );
  }
);

MonacoEditorWrapper.displayName = 'MonacoEditorWrapper';
