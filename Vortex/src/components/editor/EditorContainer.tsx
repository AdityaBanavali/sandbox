import React from 'react';
import { EditorPane } from './EditorPane';
import type { MonacoEditorHandle } from './MonacoEditorWrapper';
import type { CursorPosition, EditorDiagnostics, EditorPaneState, SplitDirection, ThemeConfig } from '../../types/editor';

interface EditorContainerProps {
  pane1: EditorPaneState;
  pane2: EditorPaneState;
  activePaneId: 'pane-1' | 'pane-2';
  isSplit: boolean;
  splitDirection: SplitDirection;
  themeConfig: ThemeConfig;
  fontSize?: number;
  minimapEnabled?: boolean;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  onSetActivePane: (paneId: 'pane-1' | 'pane-2') => void;
  onSelectTab: (paneId: 'pane-1' | 'pane-2', index: number) => void;
  onCloseTab: (paneId: 'pane-1' | 'pane-2', index: number) => void;
  onCloseOthers: (paneId: 'pane-1' | 'pane-2', index: number) => void;
  onCloseAll: (paneId: 'pane-1' | 'pane-2') => void;
  onFileContentChange: (paneId: 'pane-1' | 'pane-2', newContent: string) => void;
  onCursorChange: (paneId: 'pane-1' | 'pane-2', pos: CursorPosition) => void;
  onDiagnosticsChange: (diag: EditorDiagnostics) => void;
  onSaveFile: (paneId: 'pane-1' | 'pane-2') => void;
  onSplit: (direction: SplitDirection) => void;
  onClosePane: () => void;
  onOpenCommandPalette?: () => void;
  pane1Ref?: React.Ref<MonacoEditorHandle>;
  pane2Ref?: React.Ref<MonacoEditorHandle>;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  pane1,
  pane2,
  activePaneId,
  isSplit,
  splitDirection,
  themeConfig,
  fontSize,
  minimapEnabled,
  tabSize,
  wordWrap,
  onSetActivePane,
  onSelectTab,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onFileContentChange,
  onCursorChange,
  onDiagnosticsChange,
  onSaveFile,
  onSplit,
  onClosePane,
  onOpenCommandPalette,
  pane1Ref,
  pane2Ref,
}) => {
  return (
    <div
      className={`relative flex h-full w-full overflow-hidden ${
        isSplit
          ? splitDirection === 'horizontal'
            ? 'flex-row'
            : 'flex-col'
          : 'flex-col'
      }`}
    >
      {/* Pane 1 */}
      <div className="relative flex h-full flex-1 overflow-hidden min-w-0 min-h-0">
        <EditorPane
          ref={pane1Ref}
          paneId="pane-1"
          isActive={activePaneId === 'pane-1'}
          onFocus={() => onSetActivePane('pane-1')}
          files={pane1.openFiles}
          activeFileIndex={pane1.activeFileIndex}
          onSelectTab={(idx) => onSelectTab('pane-1', idx)}
          onCloseTab={(idx) => onCloseTab('pane-1', idx)}
          onCloseOthers={(idx) => onCloseOthers('pane-1', idx)}
          onCloseAll={() => onCloseAll('pane-1')}
          onFileContentChange={(content) => onFileContentChange('pane-1', content)}
          onCursorChange={(pos) => onCursorChange('pane-1', pos)}
          onDiagnosticsChange={onDiagnosticsChange}
          onSaveFile={() => onSaveFile('pane-1')}
          isSplit={isSplit}
          splitDirection={splitDirection}
          onSplit={onSplit}
          onClosePane={undefined}
          themeConfig={themeConfig}
          fontSize={fontSize}
          minimapEnabled={minimapEnabled}
          tabSize={tabSize}
          wordWrap={wordWrap}
          onOpenCommandPalette={onOpenCommandPalette}
        />
      </div>

      {/* Pane 2 (When Split is Active) */}
      {isSplit && (
        <>
          {/* Split divider bar */}
          <div
            className={`shrink-0 bg-white/[0.08] ${
              splitDirection === 'horizontal'
                ? 'w-[2px] cursor-col-resize hover:bg-purple-500'
                : 'h-[2px] cursor-row-resize hover:bg-purple-500'
            }`}
          />

          <div className="relative flex h-full flex-1 overflow-hidden min-w-0 min-h-0">
            <EditorPane
              ref={pane2Ref}
              paneId="pane-2"
              isActive={activePaneId === 'pane-2'}
              onFocus={() => onSetActivePane('pane-2')}
              files={pane2.openFiles}
              activeFileIndex={pane2.activeFileIndex}
              onSelectTab={(idx) => onSelectTab('pane-2', idx)}
              onCloseTab={(idx) => onCloseTab('pane-2', idx)}
              onCloseOthers={(idx) => onCloseOthers('pane-2', idx)}
              onCloseAll={() => onCloseAll('pane-2')}
              onFileContentChange={(content) => onFileContentChange('pane-2', content)}
              onCursorChange={(pos) => onCursorChange('pane-2', pos)}
              onDiagnosticsChange={onDiagnosticsChange}
              onSaveFile={() => onSaveFile('pane-2')}
              isSplit={isSplit}
              splitDirection={splitDirection}
              onSplit={onSplit}
              onClosePane={onClosePane}
              themeConfig={themeConfig}
              fontSize={fontSize}
              minimapEnabled={minimapEnabled}
              tabSize={tabSize}
              wordWrap={wordWrap}
              onOpenCommandPalette={onOpenCommandPalette}
            />
          </div>
        </>
      )}
    </div>
  );
};
