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

  // Application State
  let Module = null;
  let lastEngineText = '';
  let activeIndex = 0;
  let currentSuggestions = [];
  let loadedWordCount = 0;

  // Show Toast Helper
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }

  // Initialize WASM Module
  try {
    vocabCountBadge.textContent = 'Loading Engine...';
    Module = await createEditor({
      locateFile: (path) => path
    });
    Module.ccall('editor_init', null, ['string'], ['Welcome to txtedit!\nType code or text to test the Piece Table engine.\n']);
  } catch (err) {
    console.error('Failed to load editor.wasm:', err);
    showToast('Failed to load WASM engine. Check console.');
    return;
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

    // Line and Column
    const lines = text.substring(0, pos).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    cursorStatus.textContent = `Ln ${line}, Col ${col}`;
    lengthStatus.textContent = `${text.length} chars`;
  }

  // --- Piece Table Inspector Visualizer ---
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
      inspectorContainer.innerHTML = '<div class="empty-state">Piece table is empty. Type to create pieces!</div>';
      return;
    }

    let html = '';
    pieces.forEach(p => {
      const isOrig = p.source === 'ORIG';
      const sourceClass = isOrig ? 'piece-orig' : 'piece-add';
      const tagClass = isOrig ? 'tag-orig' : 'tag-add';
      const sourceName = isOrig ? 'ORIGINAL BUF' : 'ADD BUFFER';

      // Escape HTML and visualize spaces and newlines
      const escaped = p.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<span style="color:#ef4444">&crarr;</span>\n')
        .replace(/ /g, '<span style="opacity:0.4">&middot;</span>');

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
          <div class="piece-content">${escaped || '<em style="color:var(--text-subtle)">&lt;empty&gt;</em>'}</div>
        </div>
      `;
    });

    inspectorContainer.innerHTML = html;
  }

  // --- Caret Positioning for Popup Dropdown ---
  function getCaretCoordinates(textarea, position) {
    const text = textarea.value.substring(0, position);
    caretMirror.textContent = text;

    const span = document.createElement('span');
    span.textContent = '|';
    caretMirror.appendChild(span);

    const spanOffsetTop = span.offsetTop;
    const spanOffsetLeft = span.offsetLeft;
    caretMirror.removeChild(span);

    // Coordinate relative to textarea scroll
    const top = spanOffsetTop - textarea.scrollTop + 32;
    let left = spanOffsetLeft - textarea.scrollLeft + 16;

    // Keep dropdown inside container bounds
    const maxLeft = textarea.clientWidth - 330;
    if (left > maxLeft) left = Math.max(16, maxLeft);

    return { top, left };
  }

  // --- Autocomplete Handling ---
  function checkAutocomplete() {
    const pos = editor.selectionStart;
    const prefix = callGetPrefix(pos);
    activePrefixLabel.textContent = prefix || '-';

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
    suggestions.forEach((word, idx) => {
      const isSelected = idx === activeIndex ? 'active' : '';
      const matchPrefix = word.substring(0, prefix.length);
      const matchSuffix = word.substring(prefix.length);

      html += `
        <li class="suggestion-item ${isSelected}" data-index="${idx}">
          <span><span class="match-prefix">${matchPrefix}</span><span class="match-suffix">${matchSuffix}</span></span>
          <span class="item-badge">[${idx + 1}]</span>
        </li>
      `;
    });

    suggestionList.innerHTML = html;

    // Click handler for suggestion items
    suggestionList.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-index'), 10);
        acceptSuggestion(currentSuggestions[idx]);
      });
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

  // --- Keyboard Shortcuts & Input Interception ---
  editor.addEventListener('keydown', (e) => {
    // 1. Undo / Redo Shortcuts
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

    // 2. Autocomplete Navigation
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

  // --- BeforeInput Event: Every typing keystroke routes to WASM ---
  editor.addEventListener('beforeinput', (e) => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const hasSelection = end > start;

    if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
      e.preventDefault();
      if (hasSelection) {
        editorDelete(start, end - start);
      }
      if (e.data) {
        editorInsert(start, e.data);
        syncFromEngine(start + e.data.length);
      }
    } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
      e.preventDefault();
      if (hasSelection) {
        editorDelete(start, end - start);
      }
      editorInsert(start, '\n');
      syncFromEngine(start + 1);
    } else if (e.inputType === 'deleteContentBackward') {
      e.preventDefault();
      if (hasSelection) {
        editorDelete(start, end - start);
        syncFromEngine(start);
      } else if (start > 0) {
        editorDelete(start - 1, 1);
        syncFromEngine(start - 1);
      }
    } else if (e.inputType === 'deleteContentForward') {
      e.preventDefault();
      if (hasSelection) {
        editorDelete(start, end - start);
        syncFromEngine(start);
      } else {
        editorDelete(start, 1);
        syncFromEngine(start);
      }
    }
  });

  // Paste Event
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    if (end > start) {
      editorDelete(start, end - start);
    }
    editorInsert(start, text);
    syncFromEngine(start + text.length);
  });

  // Caret / Selection Navigation
  editor.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      updateStatusBar();
      checkAutocomplete();
    }
  });

  editor.addEventListener('click', () => {
    updateStatusBar();
    checkAutocomplete();
  });

  // --- Toolbar Button Actions ---
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
      if (!resp.ok) throw new Error('words.txt not found');
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

  // Initialize
  await loadDefaultVocabulary();
  syncFromEngine(editor.value.length);
});
