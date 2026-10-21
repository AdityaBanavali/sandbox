import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActivityBar, type ActivityTab } from './components/layout/ActivityBar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { BottomPanel, type BottomPanelTab } from './components/layout/BottomPanel';
import { EditorContainer } from './components/editor/EditorContainer';
import { CommandPalette } from './components/commandPalette/CommandPalette';
import { StorageService, type PersistedWorkspace } from './services/storageService';
import { TauriBridge } from './services/tauriBridge';
import { THEMES } from './services/themeService';
import { getLanguageFromPath } from './services/languageService';
import { GitService } from './services/gitService';
import type { MonacoEditorHandle } from './components/editor/MonacoEditorWrapper';
import type {
  CursorPosition,
  EditorDiagnostics,
  EditorPaneState,
  GitStatus,
  OpenFile,
  SplitDirection,
  ThemeId,
} from './types/editor';
import type { DetailedGitStatus } from './types/git';
import { BranchManagerModal } from './components/git/BranchManagerModal';
import { CommitHistoryModal } from './components/git/CommitHistoryModal';

export default function App() {
  // Load persisted initial state
  const initial = StorageService.load();

  const [pane1, setPane1] = useState<EditorPaneState>(initial.pane1);
  const [pane2, setPane2] = useState<EditorPaneState>(initial.pane2);
  const [activePaneId, setActivePaneId] = useState<'pane-1' | 'pane-2'>(initial.activePaneId);
  const [isSplit, setIsSplit] = useState<boolean>(initial.isSplit);
  const [splitDirection, setSplitDirection] = useState<SplitDirection>(initial.splitDirection);

  const [activeSidebarTab, setActiveSidebarTab] = useState<ActivityTab>(initial.activeSidebarTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(initial.isSidebarOpen);

  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState<boolean>(initial.isBottomPanelOpen);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomPanelTab>(initial.activeBottomTab);

  const [themeId, setThemeId] = useState<ThemeId>(initial.themeId);
  const [editorSettings, setEditorSettings] = useState(initial.editorSettings);

  const [sidebarWidth, setSidebarWidth] = useState<number>(initial.sidebarWidth || 260);
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(initial.bottomPanelHeight || 240);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'files' | 'commands'>('files');

  const [gitStatus, setGitStatus] = useState<GitStatus>({
    branch: 'master',
    isClean: true,
    changedFiles: [],
  });

  const [detailedGitStatus, setDetailedGitStatus] = useState<DetailedGitStatus>({
    branch: 'master',
    isClean: true,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
  });

  const [isBranchManagerOpen, setIsBranchManagerOpen] = useState(false);
  const [isCommitHistoryOpen, setIsCommitHistoryOpen] = useState(false);

  const [diagnostics, setDiagnostics] = useState<EditorDiagnostics>({
    errors: 0,
    warnings: 0,
    infos: 0,
  });

  // Editor instance refs for cursor injection
  const pane1Ref = useRef<MonacoEditorHandle>(null);
  const pane2Ref = useRef<MonacoEditorHandle>(null);

  const currentTheme = THEMES[themeId] || THEMES['vortex-dark'];

  // Apply theme class to document body
  useEffect(() => {
    document.body.className = `theme-${themeId}`;
  }, [themeId]);

  // Periodic Git status check
  const fetchGitStatus = useCallback(async () => {
    try {
      const detailed = await GitService.getDetailedStatus();
      setDetailedGitStatus(detailed);
      setGitStatus({
        branch: detailed.branch,
        isClean: detailed.isClean,
        changedFiles: [
          ...detailed.staged.map((f) => `M ${f.path}`),
          ...detailed.unstaged.map((f) => `M ${f.path}`),
          ...detailed.untracked.map((p) => `?? ${p}`),
        ],
      });
    } catch (e) {
      console.error('fetchGitStatus error:', e);
    }
  }, []);

  useEffect(() => {
    fetchGitStatus();
    const interval = setInterval(fetchGitStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchGitStatus]);

  // Workspace Persistence effect
  useEffect(() => {
    const workspaceState: PersistedWorkspace = {
      pane1,
      pane2,
      isSplit,
      splitDirection,
      activePaneId,
      activeSidebarTab,
      isSidebarOpen,
      sidebarWidth,
      isBottomPanelOpen,
      activeBottomTab,
      bottomPanelHeight,
      themeId,
      editorSettings,
    };
    StorageService.save(workspaceState);
  }, [
    pane1,
    pane2,
    isSplit,
    splitDirection,
    activePaneId,
    activeSidebarTab,
    isSidebarOpen,
    sidebarWidth,
    isBottomPanelOpen,
    activeBottomTab,
    bottomPanelHeight,
    themeId,
    editorSettings,
  ]);

  // Active file helper
  const activePane = activePaneId === 'pane-1' ? pane1 : pane2;
  const activeFile = activePane.openFiles[activePane.activeFileIndex];

  // Open file in active pane
  const handleOpenFile = async (path: string, name?: string) => {
    const fileName = name || path.split('/').pop() || path;
    const content = await TauriBridge.readFile(path);
    const language = getLanguageFromPath(path);

    const updatePane = (prev: EditorPaneState): EditorPaneState => {
      const existingIdx = prev.openFiles.findIndex((f) => f.path === path);
      if (existingIdx >= 0) {
        return { ...prev, activeFileIndex: existingIdx };
      }
      const newFile: OpenFile = {
        name: fileName,
        path,
        content,
        language,
        dirty: false,
      };
      return {
        ...prev,
        openFiles: [...prev.openFiles, newFile],
        activeFileIndex: prev.openFiles.length,
      };
    };

    if (activePaneId === 'pane-1') {
      setPane1(updatePane);
    } else {
      setPane2(updatePane);
    }
  };

  // Tab management handlers
  const handleSelectTab = (paneId: 'pane-1' | 'pane-2', index: number) => {
    setActivePaneId(paneId);
    if (paneId === 'pane-1') {
      setPane1((p) => ({ ...p, activeFileIndex: index }));
    } else {
      setPane2((p) => ({ ...p, activeFileIndex: index }));
    }
  };

  const handleCloseTab = (paneId: 'pane-1' | 'pane-2', index: number) => {
    const update = (p: EditorPaneState): EditorPaneState => {
      const nextFiles = p.openFiles.filter((_, i) => i !== index);
      const nextIdx = Math.max(0, p.activeFileIndex >= nextFiles.length ? nextFiles.length - 1 : p.activeFileIndex);
      return { ...p, openFiles: nextFiles, activeFileIndex: nextIdx };
    };
    if (paneId === 'pane-1') setPane1(update);
    else setPane2(update);
  };

  const handleCloseOthers = (paneId: 'pane-1' | 'pane-2', index: number) => {
    const update = (p: EditorPaneState): EditorPaneState => {
      const target = p.openFiles[index];
      return { ...p, openFiles: target ? [target] : [], activeFileIndex: 0 };
    };
    if (paneId === 'pane-1') setPane1(update);
    else setPane2(update);
  };

  const handleCloseAll = (paneId: 'pane-1' | 'pane-2') => {
    const update = (p: EditorPaneState): EditorPaneState => ({
      ...p,
      openFiles: [],
      activeFileIndex: 0,
    });
    if (paneId === 'pane-1') setPane1(update);
    else setPane2(update);
  };

  // Content change
  const handleFileContentChange = (paneId: 'pane-1' | 'pane-2', newContent: string) => {
    const update = (p: EditorPaneState): EditorPaneState => {
      const files = [...p.openFiles];
      if (files[p.activeFileIndex]) {
        files[p.activeFileIndex] = {
          ...files[p.activeFileIndex],
          content: newContent,
          dirty: true,
        };
      }
      return { ...p, openFiles: files };
    };
    if (paneId === 'pane-1') setPane1(update);
    else setPane2(update);
  };

  // Save active file
  const handleSaveFile = async (paneId?: 'pane-1' | 'pane-2') => {
    const targetPane = (paneId || activePaneId) === 'pane-1' ? pane1 : pane2;
    const file = targetPane.openFiles[targetPane.activeFileIndex];
    if (!file) return;

    try {
      await TauriBridge.writeFile(file.path, file.content);
      const update = (p: EditorPaneState): EditorPaneState => {
        const files = [...p.openFiles];
        if (files[p.activeFileIndex]) {
          files[p.activeFileIndex] = { ...files[p.activeFileIndex], dirty: false };
        }
        return { ...p, openFiles: files };
      };
      if ((paneId || activePaneId) === 'pane-1') setPane1(update);
      else setPane2(update);
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  };

  // Cursor change
  const handleCursorChange = (paneId: 'pane-1' | 'pane-2', pos: CursorPosition) => {
    if (paneId === 'pane-1') {
      setPane1((p) => ({ ...p, cursorPos: pos }));
    } else {
      setPane2((p) => ({ ...p, cursorPos: pos }));
    }
  };

  // Split view controls
  const handleSplit = (direction: SplitDirection) => {
    if (!isSplit) {
      if (pane2.openFiles.length === 0 && pane1.openFiles.length > 0) {
        setPane2({
          ...pane2,
          openFiles: [...pane1.openFiles],
          activeFileIndex: pane1.activeFileIndex,
        });
      }
      setIsSplit(true);
      setSplitDirection(direction);
    } else {
      setSplitDirection(direction);
    }
  };

  const handleClosePane = () => {
    setIsSplit(false);
    setActivePaneId('pane-1');
  };

  const handleToggleSplit = () => {
    if (isSplit) {
      handleClosePane();
    } else {
      handleSplit('horizontal');
    }
  };

  // Interactive Code Block Action: "Insert at Cursor"
  const handleInsertAtCursor = useCallback((code: string) => {
    const targetRef = activePaneId === 'pane-1' ? pane1Ref : pane2Ref;
    if (targetRef.current) {
      targetRef.current.insertTextAtCursor(code);
    } else {
      // Fallback: append or replace in active file content
      const targetPaneSetter = activePaneId === 'pane-1' ? setPane1 : setPane2;
      targetPaneSetter((p) => {
        const files = [...p.openFiles];
        const cur = files[p.activeFileIndex];
        if (cur) {
          files[p.activeFileIndex] = {
            ...cur,
            content: cur.content ? `${cur.content}\n${code}` : code,
            dirty: true,
          };
        }
        return { ...p, openFiles: files };
      });
    }
  }, [activePaneId]);

  // Interactive Code Block Action: "New File with Code"
  const handleCreateNewFile = useCallback((code: string, language: string) => {
    const ext =
      language === 'typescript'
        ? 'ts'
        : language === 'rust'
        ? 'rs'
        : language === 'javascript'
        ? 'js'
        : language === 'python'
        ? 'py'
        : language === 'json'
        ? 'json'
        : 'txt';
    const fileName = `generated-${Date.now()}.${ext}`;
    const newFile: OpenFile = {
      name: fileName,
      path: `src/${fileName}`,
      content: code,
      language,
      dirty: true,
    };
    const targetPaneSetter = activePaneId === 'pane-1' ? setPane1 : setPane2;
    targetPaneSetter((p) => ({
      ...p,
      openFiles: [...p.openFiles, newFile],
      activeFileIndex: p.openFiles.length,
    }));
  }, [activePaneId]);

  // Global Keyboard Shortcuts (Cmd+P, Cmd+Shift+P, Cmd+Shift+F, Ctrl+`, Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+P: Quick Open Files
      if (isMeta && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteMode('files');
        setCommandPaletteOpen(true);
      }

      // Cmd+Shift+P: Command Palette
      if (isMeta && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteMode('commands');
        setCommandPaletteOpen(true);
      }

      // Cmd+Shift+F: Global Search
      if (isMeta && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveSidebarTab('search');
        setIsSidebarOpen(true);
      }

      // Ctrl+` or Cmd+`: Toggle Terminal drawer
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        setIsBottomPanelOpen((prev) => !prev);
      }

      // Cmd+S: Save file
      if (isMeta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile();
      }

      // Cmd+\: Split editor horizontal
      if (isMeta && e.key === '\\') {
        e.preventDefault();
        handleToggleSplit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePaneId, pane1, pane2, isSplit]);

  // Activity bar tab toggle
  const handleSelectActivityTab = (tab: ActivityTab) => {
    if (activeSidebarTab === tab && isSidebarOpen) {
      setIsSidebarOpen(false);
    } else {
      setActiveSidebarTab(tab);
      setIsSidebarOpen(true);
    }
  };

  // Cycle themes helper for Command Palette
  const handleCycleTheme = () => {
    const themesList: ThemeId[] = ['vortex-dark', 'vscode-dark', 'midnight-obsidian', 'vortex-light'];
    const curIdx = themesList.indexOf(themeId);
    const nextTheme = themesList[(curIdx + 1) % themesList.length];
    setThemeId(nextTheme);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#09090c] text-zinc-200 antialiased select-none font-sans">
      {/* Top IDE workspace area: Activity Bar + Sidebar + Editors */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Feature 6: Activity Bar */}
        <ActivityBar
          activeTab={activeSidebarTab}
          isSidebarOpen={isSidebarOpen}
          onSelectTab={handleSelectActivityTab}
          gitChangedCount={
            detailedGitStatus.staged.length +
            detailedGitStatus.unstaged.length +
            detailedGitStatus.untracked.length +
            detailedGitStatus.conflicted.length
          }
          accentColor={currentTheme.accent}
        />

        {/* Feature 2, 6, 7, 11: Sidebar Drawer */}
        <Sidebar
          isOpen={isSidebarOpen}
          activeTab={activeSidebarTab}
          onClose={() => setIsSidebarOpen(false)}
          onOpenFile={handleOpenFile}
          activeFilePath={activeFile?.path}
          onNavigateToMatch={(path) => handleOpenFile(path)}
          currentThemeId={themeId}
          onSelectTheme={setThemeId}
          fontSize={editorSettings.fontSize}
          onChangeFontSize={(size) => setEditorSettings((s) => ({ ...s, fontSize: size }))}
          minimapEnabled={editorSettings.minimap}
          onToggleMinimap={() => setEditorSettings((s) => ({ ...s, minimap: !s.minimap }))}
          tabSize={editorSettings.tabSize}
          onChangeTabSize={(size) => setEditorSettings((s) => ({ ...s, tabSize: size }))}
          wordWrap={editorSettings.wordWrap}
          onToggleWordWrap={() =>
            setEditorSettings((s) => ({
              ...s,
              wordWrap: s.wordWrap === 'on' ? 'off' : 'on',
            }))
          }
          accentColor={currentTheme.accent}
          currentFile={activeFile}
          onInsertAtCursor={handleInsertAtCursor}
          onCreateNewFile={handleCreateNewFile}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onOpenBranchManager={() => setIsBranchManagerOpen(true)}
          onOpenCommitHistory={() => setIsCommitHistoryOpen(true)}
          onGitStatusUpdated={(status) => {
            setDetailedGitStatus(status);
            setGitStatus({
              branch: status.branch,
              isClean: status.isClean,
              changedFiles: [
                ...status.staged.map((f: any) => `M ${f.path}`),
                ...status.unstaged.map((f: any) => `M ${f.path}`),
                ...status.untracked.map((p: string) => `?? ${p}`),
              ],
            });
          }}
        />

        {/* Center Canvas: Split-View Editor Container + Bottom Panel */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Features 1, 8, 9, 10: Editor Container */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <EditorContainer
              pane1={pane1}
              pane2={pane2}
              pane1Ref={pane1Ref}
              pane2Ref={pane2Ref}
              activePaneId={activePaneId}
              isSplit={isSplit}
              splitDirection={splitDirection}
              themeConfig={currentTheme}
              fontSize={editorSettings.fontSize}
              minimapEnabled={editorSettings.minimap}
              tabSize={editorSettings.tabSize}
              wordWrap={editorSettings.wordWrap}
              onSetActivePane={setActivePaneId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onCloseOthers={handleCloseOthers}
              onCloseAll={handleCloseAll}
              onFileContentChange={handleFileContentChange}
              onCursorChange={handleCursorChange}
              onDiagnosticsChange={setDiagnostics}
              onSaveFile={handleSaveFile}
              onSplit={handleSplit}
              onClosePane={handleClosePane}
              onOpenCommandPalette={() => {
                setCommandPaletteMode('files');
                setCommandPaletteOpen(true);
              }}
            />
          </div>

          {/* Feature 3: Integrated Terminal & Bottom Drawer Panel */}
          <BottomPanel
            isOpen={isBottomPanelOpen}
            activeTab={activeBottomTab}
            onSelectTab={setActiveBottomTab}
            onClose={() => setIsBottomPanelOpen(false)}
            diagnostics={diagnostics}
            currentFile={activeFile}
            accentColor={currentTheme.accent}
            onInsertAtCursor={handleInsertAtCursor}
            onCreateNewFile={handleCreateNewFile}
            height={bottomPanelHeight}
            onHeightChange={setBottomPanelHeight}
          />
        </div>
      </div>

      {/* Feature 5: Bottom Status Bar */}
      <StatusBar
        gitBranch={detailedGitStatus.branch || gitStatus.branch}
        isGitClean={detailedGitStatus.isClean}
        gitAhead={detailedGitStatus.ahead}
        gitBehind={detailedGitStatus.behind}
        onOpenBranchManager={() => setIsBranchManagerOpen(true)}
        diagnostics={diagnostics}
        currentLanguage={activeFile?.language || (activeFile ? getLanguageFromPath(activeFile.path) : 'plaintext')}
        cursorPos={activePane.cursorPos}
        encoding="UTF-8"
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleBottomPanel={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
        isSplit={isSplit}
        splitDirection={splitDirection}
        onToggleSplit={handleToggleSplit}
        onSelectLanguage={(lang) => {
          if (activeFile) {
            const update = (p: EditorPaneState): EditorPaneState => {
              const files = [...p.openFiles];
              files[p.activeFileIndex] = { ...files[p.activeFileIndex], language: lang };
              return { ...p, openFiles: files };
            };
            if (activePaneId === 'pane-1') setPane1(update);
            else setPane2(update);
          }
        }}
        accentColor={currentTheme.accent}
      />

      {/* Feature 4: Command Palette Overlay */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenFile={handleOpenFile}
        onToggleTerminal={() => setIsBottomPanelOpen((prev) => !prev)}
        onSplitEditor={handleSplit}
        onToggleTheme={handleCycleTheme}
        onToggleMinimap={() => setEditorSettings((s) => ({ ...s, minimap: !s.minimap }))}
        onSaveActiveFile={handleSaveFile}
        onOpenGlobalSearch={() => {
          setActiveSidebarTab('search');
          setIsSidebarOpen(true);
        }}
        accentColor={currentTheme.accent}
        initialMode={commandPaletteMode}
      />

      {/* Git Branch Manager Modal */}
      <BranchManagerModal
        isOpen={isBranchManagerOpen}
        onClose={() => setIsBranchManagerOpen(false)}
        accentColor={currentTheme.accent}
        currentBranch={detailedGitStatus.branch || gitStatus.branch}
        onBranchSwitched={async (newBranch) => {
          setDetailedGitStatus((prev) => ({ ...prev, branch: newBranch }));
          await fetchGitStatus();
        }}
      />

      {/* Git Commit History Timeline Modal */}
      <CommitHistoryModal
        isOpen={isCommitHistoryOpen}
        onClose={() => setIsCommitHistoryOpen(false)}
        accentColor={currentTheme.accent}
        currentBranch={detailedGitStatus.branch || gitStatus.branch}
      />
    </div>
  );
}