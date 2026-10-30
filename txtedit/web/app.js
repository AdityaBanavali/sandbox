/**
 * txtedit // WebAssembly Piece Table & Trie Autocomplete Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const editor = document.getElementById('editor');
  const caretMirror = document.getElementById('caret-mirror');
  const popup = document.getElementById('autocomplete-popup');
  const suggestionList = document.getElementById('suggestion-list');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnClear = document.getElementById('btn-clear');
  const cursorStatus = document.getElementById('cursor-status');
  const activePrefixLabel = document.getElementById('active-prefix-label');
  const lengthStatus = document.getElementById('length-status');
  const piecesCountBadge = document.getElementById('pieces-count-badge');
  const vocabCountBadge = document.getElementById('vocab-count-badge');
  const vocabFileName = document.getElementById('vocab-file-name');
  const dictUpload = document.getElementById('dict-upload');
  const inspectorContainer = document.getElementById('inspector-container');
  const toast = document.getElementById('toast');

  // Terminal (REPL) Elements
  const terminalWindow = document.getElementById('terminal-window');
  const terminalOutput = document.getElementById('terminal-output');
  const replInput = document.getElementById('repl-input');
  const btnReplDemo = document.getElementById('btn-repl-demo');
  const btnReplClear = document.getElementById('btn-repl-clear');
  const btnReplReset = document.getElementById('btn-repl-reset');

  // Application State
  let Module = null;
  let lastEngineText = '';
  let activeIndex = 0;
  let currentSuggestions = [];
  let loadedWordCount = 0;

  // REPL State
  const replHistory = [];
  let replHistoryIndex = -1;
  let replSessionActive = true;
  let isDemoRunning = false;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }

  // --- C Function Wrappers (Zero Leaks) ---
  function editorInsert(pos, text) {
    return Module.ccall('editor_insert', 'number', ['number', 'string'], [pos, text]);
  }

  function editorDelete(pos, len) {
    Module.ccall('editor_delete', null, ['number', 'number'], [pos, len]);
  }

  function editorUndo() {
    Module.ccall('editor_undo', null, []);
  }

  function editorRedo() {
    Module.ccall('editor_redo', null, []);
  }

  function callGetText() {
    const ptr = Module._editor_get_text();
    const str = Module.UTF8ToString(ptr);
    Module._editor_free_string(ptr);
    return str;
  }

  function callGetPiecesJson() {
    const ptr = Module._editor_get_pieces_json();
    const str = Module.UTF8ToString(ptr);
    Module._editor_free_string(ptr);
    return str;
  }

  function callGetPrefix(cursorPos) {
    const ptr = Module._editor_get_prefix(cursorPos);
    const str = Module.UTF8ToString(ptr);
    Module._editor_free_string(ptr);
    return str;
  }

  function callSuggestJson(prefix, max) {
    const ptr = Module.ccall('trie_suggest_json', 'number', ['string', 'number'], [prefix, max]);
    const str = Module.UTF8ToString(ptr);
    Module._editor_free_string(ptr);
    return str;
  }

  function callLoadWords(wordsText) {
    Module.ccall('trie_load_words', null, ['string'], [wordsText]);
  }

  // --- Synchronize Editor Display with WASM Engine ---
  function syncFromEngine(newCursorPos) {
    const text = callGetText();
    lastEngineText = text;
    editor.value = text;

    if (typeof newCursorPos === 'number') {
      editor.selectionStart = Math.min(newCursorPos, text.length);
      editor.selectionEnd = Math.min(newCursorPos, text.length);
    }

    updateStatusBar();
    updatePieceTableInspector();
    checkAutocomplete();
  }

  // --- Status Bar Update ---
  function updateStatusBar() {
    const text = editor.value;
    const pos = editor.selectionStart;

    const lines = text.substring(0, pos).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    cursorStatus.textContent = `Ln ${line}, Col ${col}`;
    lengthStatus.textContent = `${text.length} chars`;

    const prefix = callGetPrefix(pos);
    activePrefixLabel.textContent = prefix ? prefix : '-';
  }

  // --- Piece Table Inspector Visualizer ---
  function formatPieceText(str) {
    if (!str) return '<span class="empty-txt">&lt;empty&gt;</span>';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<span class="char-nl">&crarr;</span>\n')
      .replace(/ /g, '<span class="char-space">&middot;</span>');
  }

  function updatePieceTableInspector() {
    const jsonStr = callGetPiecesJson();
    let pieces = [];
    try {
      pieces = JSON.parse(jsonStr);
    } catch (e) {
      pieces = [];
    }

    piecesCountBadge.textContent = `${pieces.length} Piece${pieces.length === 1 ? '' : 's'}`;

    if (pieces.length === 0) {
      inspectorContainer.innerHTML = '<div class="empty-state">Piece table is empty. Type in the editor or REPL to create pieces!</div>';
      return;
    }

    let html = '';
    pieces.forEach(p => {
      const isOrig = p.source === 'ORIG';
      const sourceClass = isOrig ? 'piece-orig' : 'piece-add';
      const tagClass = isOrig ? 'tag-orig' : 'tag-add';
      const sourceName = isOrig ? 'ORIGINAL BUF' : 'ADD BUFFER';
      const escaped = formatPieceText(p.text);

      html += `
        <div class="piece-card ${sourceClass}" data-index="${p.index}">
          <div class="piece-meta">
            <div>
              <span class="piece-tag ${tagClass}">Piece #${p.index}</span>
              <span style="margin-left: 6px; font-weight: 600;">${sourceName}</span>
            </div>
            <div class="piece-indices">
              Offset: <strong>${p.offset}</strong> &bull; Len: <strong>${p.length}</strong>
            </div>
          </div>
          <div class="piece-content">${escaped}</div>
        </div>
      `;
    });

    inspectorContainer.innerHTML = html;
  }

  // --- Caret Positioning for Popup Dropdown ---
  function getCaretCoordinates(textarea, position) {
    const textBefore = textarea.value.substring(0, position);
    caretMirror.textContent = textBefore;

    const span = document.createElement('span');
    span.textContent = '\u200b';
    caretMirror.appendChild(span);

    const spanTop = span.offsetTop;
    const spanLeft = span.offsetLeft;

    const top = spanTop - textarea.scrollTop + 30;
    let left = spanLeft - textarea.scrollLeft;

    const maxLeft = Math.max(16, textarea.clientWidth - 330);
    if (left > maxLeft) left = maxLeft;
    if (left < 16) left = 16;

    return { top, left };
  }

  // --- Autocomplete Handling ---
  function checkAutocomplete() {
    const pos = editor.selectionStart;
    const prefix = callGetPrefix(pos);
    activePrefixLabel.textContent = prefix ? prefix : '-';

    if (!prefix || prefix.length < 1) {
      hideAutocomplete();
      return;
    }

    const json = callSuggestJson(prefix, 6);
    let suggestions = [];
    try {
      suggestions = JSON.parse(json);
    } catch (e) {
      suggestions = [];
    }

    if (suggestions.length === 0) {
      hideAutocomplete();
      return;
    }

    currentSuggestions = suggestions;
    activeIndex = 0;
    renderSuggestions(suggestions, prefix);

    const coords = getCaretCoordinates(editor, pos);
    popup.style.top = `${coords.top}px`;
    popup.style.left = `${coords.left}px`;
    popup.hidden = false;
  }

  function hideAutocomplete() {
    popup.hidden = true;
    currentSuggestions = [];
    activeIndex = 0;
  }

  function renderSuggestions(suggestions, prefix) {
    let html = '';
    const lowerPrefix = prefix.toLowerCase();
    suggestions.forEach((word, idx) => {
      const isSelected = idx === activeIndex ? 'active' : '';
      const matchPrefix = word.substring(0, lowerPrefix.length);
      const matchSuffix = word.substring(lowerPrefix.length);

      html += `
        <li class="suggestion-item ${isSelected}" data-index="${idx}">
          <span><span class="match-prefix">${matchPrefix}</span><span class="match-suffix">${matchSuffix}</span></span>
          <span class="item-badge">[${idx + 1}]</span>
        </li>
      `;
    });

    suggestionList.innerHTML = html;

    suggestionList.querySelectorAll('.suggestion-item').forEach(el => {
      const handleSelect = (e) => {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-index'), 10);
        acceptSuggestion(currentSuggestions[idx]);
      };
      el.addEventListener('mousedown', handleSelect);
      el.addEventListener('click', handleSelect);
    });
  }

  function acceptSuggestion(word) {
    if (!word) return;
    const pos = editor.selectionStart;
    const prefix = callGetPrefix(pos);
    if (!prefix) return;

    const prefixStart = pos - prefix.length;
    editorDelete(prefixStart, prefix.length);
    editorInsert(prefixStart, word);
    syncFromEngine(prefixStart + word.length);
    hideAutocomplete();
  }

  // --- Document Editor Event Listeners ---
  editor.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        editorRedo();
      } else {
        editorUndo();
      }
      syncFromEngine(editor.selectionStart);
      return;
    }

    if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      editorRedo();
      syncFromEngine(editor.selectionStart);
      return;
    }

    if (!popup.hidden && currentSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % currentSuggestions.length;
        renderSuggestions(currentSuggestions, callGetPrefix(editor.selectionStart));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
        renderSuggestions(currentSuggestions, callGetPrefix(editor.selectionStart));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptSuggestion(currentSuggestions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
    }
  });

  // Handle all text input via diffing against WASM engine
  editor.addEventListener('input', () => {
    const currentVal = editor.value;
    if (currentVal !== lastEngineText) {
      let start = 0;
      while (start < lastEngineText.length && start < currentVal.length && lastEngineText[start] === currentVal[start]) {
        start++;
      }
      let oldEnd = lastEngineText.length;
      let newEnd = currentVal.length;
      while (oldEnd > start && newEnd > start && lastEngineText[oldEnd - 1] === currentVal[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }
      const deleteCount = oldEnd - start;
      if (deleteCount > 0) {
        editorDelete(start, deleteCount);
      }
      const inserted = currentVal.substring(start, newEnd);
      if (inserted.length > 0) {
        editorInsert(start, inserted);
      }

      const curPos = editor.selectionStart;
      const engineText = callGetText();
      lastEngineText = engineText;
      editor.value = engineText;
      editor.selectionStart = editor.selectionEnd = curPos;

      updatePieceTableInspector();
    }

    updateStatusBar();
    checkAutocomplete();
  });

  editor.addEventListener('keyup', () => {
    updateStatusBar();
    checkAutocomplete();
  });

  editor.addEventListener('click', () => {
    updateStatusBar();
    checkAutocomplete();
  });

  btnUndo.addEventListener('click', () => {
    editorUndo();
    syncFromEngine(editor.selectionStart);
  });

  btnRedo.addEventListener('click', () => {
    editorRedo();
    syncFromEngine(editor.selectionStart);
  });

  btnClear.addEventListener('click', () => {
    Module.ccall('editor_init', null, ['string'], ['']);
    syncFromEngine(0);
    showToast('Editor cleared.');
  });

  // --- Vocabulary Loader (Default words.txt + Custom Upload) ---
  async function loadDefaultVocabulary() {
    try {
      vocabCountBadge.textContent = 'Loading Words...';
      const resp = await fetch('words.txt');
      if (!resp.ok) throw new Error('words.txt not found (HTTP ' + resp.status + ')');
      const text = await resp.text();
      callLoadWords(text);
      const lines = text.split('\n').filter(w => w.trim().length > 0);
      loadedWordCount = lines.length;
      vocabCountBadge.textContent = `${loadedWordCount.toLocaleString()} Words`;
    } catch (err) {
      console.warn('Could not load default words.txt:', err);
      vocabCountBadge.textContent = 'Trie Ready';
    }
  }

  dictUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      callLoadWords(content);
      const added = content.split('\n').filter(w => w.trim().length > 0).length;
      loadedWordCount += added;
      vocabCountBadge.textContent = `${loadedWordCount.toLocaleString()} Words`;
      vocabFileName.textContent = `Custom: ${file.name} (+${added.toLocaleString()} words)`;
      showToast(`Loaded ${added.toLocaleString()} words into Trie.`);
      checkAutocomplete();
    };
    reader.readAsText(file);
  });

  // -------------------------------------------------------------
  // --- Terminal (REPL) Controller (piece_table_repl CLI Mode) ---
  // -------------------------------------------------------------

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function appendTerminalLine(text, className) {
    const div = document.createElement('div');
    div.className = `term-line ${className || ''}`;
    div.textContent = text;
    terminalOutput.appendChild(div);
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  function appendCommandEcho(cmd) {
    const div = document.createElement('div');
    div.className = 'term-line';
    div.innerHTML = `<span class="term-prompt">&gt; </span><span class="term-cmd">${escapeHtml(cmd)}</span>`;
    terminalOutput.appendChild(div);
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  function executeReplCommand(rawLine) {
    if (!replSessionActive) {
      appendTerminalLine("Session ended. Click 'Reset' to start a new session.", "term-err");
      return;
    }

    const line = rawLine.trimEnd();
    appendCommandEcho(line);

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('./') || trimmed.startsWith('#')) {
      return;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'exit') {
      replSessionActive = false;
      replInput.disabled = true;
      appendTerminalLine("Session ended.", "term-out");
      return;
    }

    if (cmd === 'help') {
      appendTerminalLine("Available commands:", "term-out");
      appendTerminalLine("  insert <idx> <text>  Insert text at character index", "term-out");
      appendTerminalLine("  delete <idx> <len>   Delete <len> characters at index", "term-out");
      appendTerminalLine("  print                Display current document text", "term-out");
      appendTerminalLine("  undo                 Revert last edit", "term-out");
      appendTerminalLine("  redo                 Re-apply reverted edit", "term-out");
      appendTerminalLine("  debug                Inspect piece table chain", "term-out");
      appendTerminalLine("  clear                Clear terminal screen", "term-out");
      appendTerminalLine("  reset                Reset piece table state", "term-out");
      appendTerminalLine("  help                 Show this help message", "term-out");
      appendTerminalLine("  exit                 End session", "term-out");
      return;
    }

    if (cmd === 'clear') {
      terminalOutput.innerHTML = '';
      return;
    }

    if (cmd === 'reset') {
      resetRepl();
      appendTerminalLine("Piece table reset.", "term-welcome");
      return;
    }

    if (cmd === 'print') {
      const text = callGetText();
      appendTerminalLine(text, "term-out");
      return;
    }

    if (cmd === 'undo') {
      editorUndo();
      syncFromEngine();
      return;
    }

    if (cmd === 'redo') {
      editorRedo();
      syncFromEngine();
      return;
    }

    if (cmd === 'debug') {
      const jsonStr = callGetPiecesJson();
      let pieces = [];
      try {
        pieces = JSON.parse(jsonStr);
      } catch (e) {
        pieces = [];
      }

      let totalLen = 0;
      pieces.forEach(p => { totalLen += p.length; });

      appendTerminalLine("=== Piece Table Debug ===", "term-out");
      appendTerminalLine(`Total Length: ${totalLen} chars | Total Pieces: ${pieces.length}`, "term-out");

      const n = pieces.length;
      pieces.forEach((p, idx) => {
        const prevStatus = (idx === 0) ? "NULL (Head)" : "OK";
        const nextStatus = (idx === n - 1) ? "NULL (Tail)" : "OK";
        appendTerminalLine(`[Piece ${idx}] SRC: ${p.source} | Offset: ${p.offset} | Len: ${p.length} | Text: "${p.text}" | Prev: ${prevStatus} | Next: ${nextStatus}`, "term-out");
      });
      appendTerminalLine("=========================", "term-out");
      return;
    }

    if (cmd === 'delete') {
      if (parts.length < 3) {
        appendTerminalLine("Usage: delete <idx> <len>", "term-err");
        return;
      }
      const idx = parseInt(parts[1], 10);
      const len = parseInt(parts[2], 10);
      if (isNaN(idx) || isNaN(len) || idx < 0 || len < 0) {
        appendTerminalLine("Usage: delete <idx> <len>", "term-err");
        return;
      }
      editorDelete(idx, len);
      syncFromEngine();
      return;
    }

    if (cmd === 'insert') {
      const insertIdx = line.indexOf('insert');
      const afterInsert = line.slice(insertIdx + 6).trimStart();
      const firstSpace = afterInsert.search(/\s/);
      if (firstSpace === -1) {
        appendTerminalLine("Usage: insert <idx> <text>", "term-err");
        return;
      }
      const idxStr = afterInsert.slice(0, firstSpace);
      const idx = parseInt(idxStr, 10);
      if (isNaN(idx) || idx < 0) {
        appendTerminalLine("Usage: insert <idx> <text>", "term-err");
        return;
      }
      const textToInsert = afterInsert.slice(firstSpace + 1);
      editorInsert(idx, textToInsert);
      syncFromEngine();
      return;
    }

    appendTerminalLine(`Unknown command: '${cmd}'. Type 'help' for available commands.`, "term-err");
  }

  function resetRepl() {
    Module.ccall('editor_init', null, ['string'], ['']);
    replSessionActive = true;
    replInput.disabled = false;
    syncFromEngine(0);
    terminalOutput.innerHTML = '';
  }

  terminalWindow.addEventListener('click', () => {
    if (replSessionActive && !isDemoRunning) {
      replInput.focus();
    }
  });

  replInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = replInput.value;
      if (!val.trim()) return;

      replHistory.push(val);
      replHistoryIndex = replHistory.length;
      replInput.value = '';

      executeReplCommand(val);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (replHistory.length === 0) return;
      if (replHistoryIndex > 0) {
        replHistoryIndex--;
      } else if (replHistoryIndex === -1) {
        replHistoryIndex = replHistory.length - 1;
      }
      replInput.value = replHistory[replHistoryIndex] || '';
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (replHistory.length === 0) return;
      if (replHistoryIndex < replHistory.length - 1) {
        replHistoryIndex++;
        replInput.value = replHistory[replHistoryIndex] || '';
      } else {
        replHistoryIndex = replHistory.length;
        replInput.value = '';
      }
      return;
    }
  });

  btnReplDemo.addEventListener('click', async () => {
    if (isDemoRunning) return;
    isDemoRunning = true;
    btnReplDemo.disabled = true;
    replInput.disabled = true;

    resetRepl();
    appendTerminalLine("Replaying web/commands.txt demo...", "term-welcome");

    try {
      const resp = await fetch('commands.txt');
      if (!resp.ok) throw new Error('commands.txt not found');
      const fileText = await resp.text();
      const lines = fileText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i].trim();
        if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('./')) {
          continue;
        }

        await new Promise(r => setTimeout(r, 400));
        executeReplCommand(rawLine);
      }
      showToast("Demo playback completed!");
    } catch (err) {
      appendTerminalLine(`Demo error: ${err.message}`, "term-err");
    } finally {
      isDemoRunning = false;
      btnReplDemo.disabled = false;
      if (replSessionActive) {
        replInput.disabled = false;
        replInput.focus();
      }
    }
  });

  btnReplClear.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
  });

  btnReplReset.addEventListener('click', () => {
    resetRepl();
    appendTerminalLine("Piece table reset.", "term-welcome");
    showToast("Terminal & Piece Table reset.");
  });

  // --- Boot Sequence ---
  try {
    vocabCountBadge.textContent = 'Loading Engine...';
    Module = await createEditor({
      locateFile: (path) => path
    });
    // Clean starting text with no stray HTML
    Module.ccall('editor_init', null, ['string'], ['Welcome to txtedit!\nType code or text to test the Piece Table engine.\n']);
    
    // Load words BEFORE accepting any input
    await loadDefaultVocabulary();
    
    // Sync initial state
    syncFromEngine(editor.value.length);
  } catch (err) {
    console.error('Failed to load editor.wasm:', err);
    showToast('Failed to load WASM engine. Check console.');
  }
});
