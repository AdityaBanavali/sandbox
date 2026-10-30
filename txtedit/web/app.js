/**
 * txtedit // WebAssembly Piece Table & Trie Autocomplete Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM Elements ---
  const editor = document.getElementById('editor');
  const lineNumbers = document.getElementById('line-numbers');
  const caretMirror = document.getElementById('caret-mirror');
  const popup = document.getElementById('autocomplete-popup');
  const suggestionList = document.getElementById('suggestion-list');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnClear = document.getElementById('btn-clear');
  const btnSampleText = document.getElementById('btn-sample-text');
  const btnEmptySample = document.getElementById('btn-empty-sample');

  // Status Bar Elements
  const cursorStatus = document.getElementById('cursor-status');
  const activePrefixLabel = document.getElementById('active-prefix-label');
  const lengthStatus = document.getElementById('length-status');
  const editorPiecesCount = document.getElementById('editor-pieces-count');

  // Inspector Elements (Hero)
  const piecesCountBadge = document.getElementById('pieces-count-badge');
  const pieceBarTrack = document.getElementById('piece-bar-track');
  const pieceDetailCard = document.getElementById('piece-detail-card');
  const detailTag = document.getElementById('detail-tag');
  const detailSrc = document.getElementById('detail-src');
  const detailOffset = document.getElementById('detail-offset');
  const detailLen = document.getElementById('detail-len');
  const detailPrev = document.getElementById('detail-prev');
  const detailNext = document.getElementById('detail-next');
  const detailText = document.getElementById('detail-text');
  const pieceDataTableBody = document.getElementById('piece-data-table-body');
  const inspectorEmptyState = document.getElementById('inspector-empty-state');
  const statOrigLen = document.getElementById('stat-orig-len');
  const statAddLen = document.getElementById('stat-add-len');
  const inspectorContainer = document.getElementById('inspector-container');

  // Vocabulary Elements
  const vocabCountBadge = document.getElementById('vocab-count-badge');
  const vocabFileName = document.getElementById('vocab-file-name');
  const dictUpload = document.getElementById('dict-upload');
  const vocabPreviewChips = document.getElementById('vocab-preview-chips');
  const vocabLoadedBadge = document.getElementById('vocab-loaded-badge');

  // Terminal (REPL) Elements
  const terminalWindow = document.getElementById('terminal-window');
  const terminalOutput = document.getElementById('terminal-output');
  const replInput = document.getElementById('repl-input');
  const btnReplDemo = document.getElementById('btn-repl-demo');
  const btnReplClear = document.getElementById('btn-repl-clear');
  const btnReplReset = document.getElementById('btn-repl-reset');

  // Layout & Global Controls
  const themeToggle = document.getElementById('theme-toggle');
  const btnHowItWorks = document.getElementById('btn-how-it-works');
  const howItWorksPanel = document.getElementById('how-it-works-panel');
  const toast = document.getElementById('toast');

  // Application State
  let Module = null;
  let lastEngineText = '';
  let activeIndex = 0;
  let currentSuggestions = [];
  let loadedWordCount = 0;
  let prevPiecesSignature = '';
  let selectedPieceIndex = null;

  // REPL State
  const replHistory = [];
  let replHistoryIndex = -1;
  let replSessionActive = true;
  let isDemoRunning = false;

  const SAMPLE_TEXT = 'Welcome to txtedit!\nType code or text to test the Piece Table engine.\n';

  function showToast(msg) {
    if (!toast) return;
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

  // --- Line Numbers Gutter Sync ---
  function updateLineNumbers() {
    if (!lineNumbers || !editor) return;
    const lineCount = (editor.value.match(/\n/g) || []).length + 1;
    let nums = '';
    for (let i = 1; i <= lineCount; i++) {
      nums += i + '\n';
    }
    lineNumbers.textContent = nums;
    lineNumbers.scrollTop = editor.scrollTop;
  }

  editor.addEventListener('scroll', () => {
    if (lineNumbers) {
      lineNumbers.scrollTop = editor.scrollTop;
    }
  });

  // --- Synchronize Editor Display with WASM Engine ---
  function syncFromEngine(newCursorPos) {
    const text = callGetText();
    lastEngineText = text;
    editor.value = text;

    if (typeof newCursorPos === 'number') {
      editor.selectionStart = Math.min(newCursorPos, text.length);
      editor.selectionEnd = Math.min(newCursorPos, text.length);
    }

    updateLineNumbers();
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

  // --- Piece Table Inspector Visualizer (Hero Element) ---
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

    const count = pieces.length;
    piecesCountBadge.textContent = count;
    if (editorPiecesCount) {
      editorPiecesCount.textContent = `${count} piece${count === 1 ? '' : 's'}`;
    }

    // Buffer Stats
    let origLen = 0;
    let addLen = 0;
    pieces.forEach(p => {
      if (p.source === 'ORIG') origLen += p.length;
      else addLen += p.length;
    });
    if (statOrigLen) statOrigLen.textContent = origLen;
    if (statAddLen) statAddLen.textContent = addLen;

    // Signature check to animate on changes
    const currentSignature = pieces.map(p => `${p.index}-${p.source}-${p.offset}-${p.length}`).join('|');
    const hasChanged = currentSignature !== prevPiecesSignature;
    prevPiecesSignature = currentSignature;

    if (count === 0) {
      if (inspectorEmptyState) inspectorEmptyState.hidden = false;
      if (pieceBarTrack) pieceBarTrack.innerHTML = '';
      if (pieceDataTableBody) pieceDataTableBody.innerHTML = '';
      if (pieceDetailCard) pieceDetailCard.hidden = true;
      selectedPieceIndex = null;
      return;
    }

    if (inspectorEmptyState) inspectorEmptyState.hidden = true;

    // Render Horizontal Piece Bar
    if (pieceBarTrack) {
      let barHtml = '';
      const totalLen = Math.max(1, origLen + addLen);

      pieces.forEach((p, idx) => {
        const isOrig = p.source === 'ORIG';
        const blockClass = isOrig ? 'piece-block-orig' : 'piece-block-add';
        const flashClass = hasChanged ? 'piece-flash' : '';
        const activeClass = selectedPieceIndex === idx ? 'active-block' : '';
        const flexGrow = Math.max(1, p.length);
        const escapedText = p.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '↵');

        barHtml += `
          <div class="piece-block ${blockClass} ${flashClass} ${activeClass}" 
               data-index="${idx}" 
               style="flex: ${flexGrow} 1 0%;" 
               title="Piece #${idx} (${p.source}): ${p.length} chars">
            <div class="piece-block-head">
              <span>#${idx}</span>
              <span>${p.source}</span>
            </div>
            <div class="piece-block-text">${escapedText || '&nbsp;'}</div>
          </div>
        `;
      });
      pieceBarTrack.innerHTML = barHtml;

      // Click and hover handlers on piece blocks
      pieceBarTrack.querySelectorAll('.piece-block').forEach(el => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        el.addEventListener('click', () => {
          showPieceDetails(pieces[idx]);
          highlightTableRow(idx);
        });
        el.addEventListener('mouseenter', () => {
          highlightTableRow(idx);
        });
      });
    }

    // Render Exact Data Table
    if (pieceDataTableBody) {
      let tableHtml = '';
      pieces.forEach((p, idx) => {
        const isOrig = p.source === 'ORIG';
        const tagClass = isOrig ? 'tag-orig' : 'tag-add';
        const rowClass = selectedPieceIndex === idx ? 'highlighted' : '';
        const escaped = formatPieceText(p.text);

        tableHtml += `
          <tr class="${rowClass}" data-index="${idx}">
            <td><strong>#${idx}</strong></td>
            <td><span class="${tagClass}">${p.source}</span></td>
            <td>${p.offset}</td>
            <td>${p.length}</td>
            <td class="table-cell-text" title="${p.text.replace(/"/g, '&quot;')}">${escaped}</td>
          </tr>
        `;
      });
      pieceDataTableBody.innerHTML = tableHtml;

      // Table row hover & click handlers
      pieceDataTableBody.querySelectorAll('tr').forEach(row => {
        const idx = parseInt(row.getAttribute('data-index'), 10);
        row.addEventListener('click', () => {
          showPieceDetails(pieces[idx]);
          highlightTableRow(idx);
        });
        row.addEventListener('mouseenter', () => {
          highlightPieceBlock(idx);
        });
        row.addEventListener('mouseleave', () => {
          if (selectedPieceIndex !== idx) {
            unhighlightPieceBlock(idx);
          }
        });
      });
    }

    // If an item was selected, re-display its updated details
    if (selectedPieceIndex !== null && pieces[selectedPieceIndex]) {
      showPieceDetails(pieces[selectedPieceIndex]);
    } else if (pieces.length > 0 && (!pieceDetailCard || pieceDetailCard.hidden)) {
      showPieceDetails(pieces[0]);
    }
  }

  function showPieceDetails(p) {
    if (!pieceDetailCard || !p) return;
    selectedPieceIndex = p.index;
    detailTag.textContent = `Piece #${p.index}`;
    detailSrc.textContent = p.source === 'ORIG' ? 'ORIGINAL BUFFER' : 'ADD BUFFER';
    detailSrc.className = 'detail-src ' + (p.source === 'ORIG' ? 'tag-orig' : 'tag-add');
    detailOffset.textContent = p.offset;
    detailLen.textContent = p.length;
    detailPrev.textContent = p.index === 0 ? 'NULL (Head)' : `#${p.index - 1}`;
    detailNext.textContent = p.index === parseInt(piecesCountBadge.textContent, 10) - 1 ? 'NULL (Tail)' : `#${p.index + 1}`;
    detailText.innerHTML = formatPieceText(p.text);
    pieceDetailCard.hidden = false;

    highlightPieceBlock(p.index);
    highlightTableRow(p.index);
  }

  function highlightPieceBlock(idx) {
    if (!pieceBarTrack) return;
    pieceBarTrack.querySelectorAll('.piece-block').forEach(el => {
      if (parseInt(el.getAttribute('data-index'), 10) === idx) {
        el.classList.add('active-block');
      } else {
        el.classList.remove('active-block');
      }
    });
  }

  function unhighlightPieceBlock(idx) {
    if (!pieceBarTrack) return;
    const el = pieceBarTrack.querySelector(`.piece-block[data-index="${idx}"]`);
    if (el) el.classList.remove('active-block');
  }

  function highlightTableRow(idx) {
    if (!pieceDataTableBody) return;
    pieceDataTableBody.querySelectorAll('tr').forEach(row => {
      if (parseInt(row.getAttribute('data-index'), 10) === idx) {
        row.classList.add('highlighted');
        row.scrollIntoView({ block: 'nearest' });
      } else {
        row.classList.remove('highlighted');
      }
    });
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

    const top = spanTop - textarea.scrollTop + 28;
    let left = spanLeft - textarea.scrollLeft;

    const maxLeft = Math.max(16, textarea.clientWidth - 310);
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
    editor.focus();
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

    updateLineNumbers();
    updateStatusBar();
    checkAutocomplete();
  });

  editor.addEventListener('keyup', () => {
    updateLineNumbers();
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
    showToast('Editor cleared');
  });

  // Sample Text Loaders
  function loadSampleText() {
    Module.ccall('editor_init', null, ['string'], [SAMPLE_TEXT]);
    syncFromEngine(SAMPLE_TEXT.length);
    editor.focus();
    showToast('Sample text loaded');
  }

  if (btnSampleText) btnSampleText.addEventListener('click', loadSampleText);
  if (btnEmptySample) btnEmptySample.addEventListener('click', loadSampleText);

  // Try Autocomplete Chips
  document.querySelectorAll('.try-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prefix = chip.getAttribute('data-prefix');
      if (!prefix) return;

      const pos = editor.selectionStart;
      const currentPrefix = callGetPrefix(pos);
      if (currentPrefix) {
        editorDelete(pos - currentPrefix.length, currentPrefix.length);
      }
      const insertPos = currentPrefix ? pos - currentPrefix.length : pos;
      editorInsert(insertPos, prefix);
      syncFromEngine(insertPos + prefix.length);
      editor.focus();
      checkAutocomplete();
    });
  });

  // --- Vocabulary Trie Loader ---
  async function loadDefaultVocabulary() {
    try {
      vocabCountBadge.textContent = '...';
      const resp = await fetch('words.txt');
      if (!resp.ok) throw new Error('words.txt not found (HTTP ' + resp.status + ')');
      const text = await resp.text();
      callLoadWords(text);
      const lines = text.split('\n').filter(w => w.trim().length > 0);
      loadedWordCount = lines.length;
      vocabCountBadge.textContent = loadedWordCount.toLocaleString();
      if (vocabLoadedBadge) vocabLoadedBadge.textContent = `${loadedWordCount} words`;

      // Render sample preview chips
      if (vocabPreviewChips) {
        const preview = lines.slice(0, 36);
        let chipHtml = '';
        preview.forEach(word => {
          chipHtml += `<span class="preview-chip">${word}</span>`;
        });
        vocabPreviewChips.innerHTML = chipHtml;
      }
    } catch (e) {
      console.warn('Default vocabulary fetch failed:', e);
      vocabCountBadge.textContent = '0 words';
      showToast('Notice: web/words.txt could not be preloaded.');
    }
  }

  dictUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    vocabFileName.textContent = `Uploaded: ${file.name}`;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      callLoadWords(content);
      const count = content.split('\n').filter(w => w.trim().length > 0).length;
      loadedWordCount += count;
      vocabCountBadge.textContent = loadedWordCount.toLocaleString();
      if (vocabLoadedBadge) vocabLoadedBadge.textContent = `${loadedWordCount} words`;
      showToast(`Added ${count} words to Trie.`);
      checkAutocomplete();
    };
    reader.readAsText(file);
  });

  // --- Tabbed Navigation ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function setActiveTab(tabId) {
    tabButtons.forEach(btn => {
      const isMatch = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
      const isMatch = panel.id === `panel-${tabId}`;
      panel.classList.toggle('active', isMatch);
    });

    localStorage.setItem('txtedit_tab', tabId);
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      setActiveTab(tabId);
    });
  });

  const savedTab = localStorage.getItem('txtedit_tab');
  if (savedTab && document.getElementById(`panel-${savedTab}`)) {
    setActiveTab(savedTab);
  }

  // --- Dark/Light Theme Toggle ---
  function initTheme() {
    const savedTheme = localStorage.getItem('txtedit_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('txtedit_theme', next);
    });
  }
  initTheme();

  // --- Collapsible "How It Works" ---
  if (btnHowItWorks && howItWorksPanel) {
    btnHowItWorks.addEventListener('click', () => {
      howItWorksPanel.hidden = !howItWorksPanel.hidden;
    });
  }

  // --- Terminal (REPL) Command Interpreter ---
  function appendTerminalLine(text, className = '') {
    const div = document.createElement('div');
    div.className = `term-line ${className}`;
    div.textContent = text;
    terminalOutput.appendChild(div);
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  function executeReplCommand(rawLine) {
    const line = rawLine.trim();
    if (!line) return;

    appendTerminalLine(`> ${line}`, "term-cmd");

    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'help') {
      appendTerminalLine("Available commands:", "term-welcome");
      appendTerminalLine("  insert <pos> <text>  - Insert text at zero-indexed character position", "term-out");
      appendTerminalLine("  delete <pos> <len>   - Delete len characters starting at pos", "term-out");
      appendTerminalLine("  print                - Print the entire reconstructed document", "term-out");
      appendTerminalLine("  debug                - Inspect all piece descriptors and chain pointers", "term-out");
      appendTerminalLine("  undo                 - Revert the most recent text modification", "term-out");
      appendTerminalLine("  redo                 - Reapply the last reverted edit", "term-out");
      appendTerminalLine("  clear                - Clear the terminal screen buffer", "term-out");
      appendTerminalLine("  reset                - Reset piece table to an empty initial state", "term-out");
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

  // Clickable command chips under terminal
  document.querySelectorAll('.term-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-cmd');
      if (cmd) {
        executeReplCommand(cmd);
        replInput.focus();
      }
    });
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
    showToast("Terminal & Piece Table reset.");
  });

  // --- Boot Sequence ---
  try {
    vocabCountBadge.textContent = '...';
    Module = await createEditor({
      locateFile: (path) => path
    });
    
    // Clean starting text
    Module.ccall('editor_init', null, ['string'], [SAMPLE_TEXT]);
    
    // Load words BEFORE accepting any input
    await loadDefaultVocabulary();
    
    // Sync initial state
    syncFromEngine(SAMPLE_TEXT.length);
  } catch (err) {
    console.error('Failed to load editor.wasm:', err);
    showToast('Failed to load WASM engine. Check console.');
  }
});
