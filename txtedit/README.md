# 📝 txtedit // Piece Table Text Engine & Prefix Search Trie

A high-performance text editing engine and real-time autocomplete search REPL implemented in pure C (C99/C11), coupling an append-only **Piece Table** text core with a prefix **Trie**.

[![C: C99 / C11](https://img.shields.io/badge/C-C99%20%2F%20C11-00599C?style=flat-square&logo=c&logoColor=white)](https://en.wikipedia.org/wiki/C_(programming_language))
[![Data Structures](https://img.shields.io/badge/Data%20Structures-Piece%20Table%20%2B%20Trie-00f0ff?style=flat-square)](#-architecture)
[![Sanitizer: ASan + UBSan Clean](https://img.shields.io/badge/Memory-Zero%20Leaks%20(ASan)-00ff66?style=flat-square)](#-testing--memory-verification)
[![License: MIT](https://img.shields.io/badge/License-MIT-9d4edd?style=flat-square)](LICENSE)

---

## 🌐 Live Demo

- **Live Deployment URL**: `https://<your-vercel-deployment>.vercel.app` *(placeholder)*
- **Rebuild WebAssembly**:
  ```bash
  make wasm
  ```
- **Redeploy to Vercel**:
  ```bash
  vercel --prod web
  ```
  *(or push the repository to deploy automatically with root directory set to `web`)*

---

## 🏛️ Architecture

```
                                  Terminal Keystroke
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │       Interactive POSIX Raw REPL      │
                     │ (term: non-canonical, unbuffered I/O) │
                     └───────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│        PieceTable Engine        │             │        Prefix Search Trie       │
│                                 │             │                                 │
│ Original Buf: [const char *]    │             │  trie_search_prefix()           │
│ Add Buf:      [char *] (append) │             │  DFS traversal for matching     │
│ Pieces:       Doubly-linked     │             │  vocabulary suggestions         │
│ History:      Undo/Redo actions │             │                                 │
└────────────────┬────────────────┘             └────────────────▲────────────────┘
                 │                                               │
                 │ 1. Active Token Prefix                        │ 2. Prefix Query
                 │    (Extracted backwards across piece nodes    │
                 │     into stack buffer: 0 heap allocations)   │
                 └───────────────────────────────────────────────┘
```

---

## ⚡ Key Features

- **Zero-Reallocation Prefix Extraction**: Traverses piece boundaries backwards from the cursor to isolate the active typing prefix into a small stack buffer with zero heap allocations.
- **Append-Only Buffer Semantics**: User keystrokes append to the add buffer in $O(1)$ amortized time. Existing piece descriptors are split and linked without large array reallocations.
- **Real-Time Autocomplete Suggestions**: Keystrokes query the Trie in real time to display up to $K$ ranked completions below the search bar.
- **In-Line Terminal Cursor Navigation**: ANSI escape controls provide left/right navigation, delete, and backspace while keeping the terminal cursor pinned to the exact document character index.
- **Non-Destructive Undo / Redo**: Snapshot-based piece chain delta records enable undo (Ctrl+Z) and redo (Ctrl+Y / Ctrl+R) for keystroke corrections.
- **Zero Memory Leaks**: Validated with Clang AddressSanitizer (`-fsanitize=address,undefined`) and zero external dependencies (pure libc).

---

## 📁 Repository Structure

```
.
├── piece_table.h       # Piece Table struct declarations and API (zero terminal dependencies)
├── piece_table.c       # Piece splitting, buffer append, rendering, undo/redo
├── trie.h              # 128-ary ASCII Trie interface and result definitions
├── trie.c              # Trie node allocation, insertion, prefix DFS search
├── wasm_api.h          # Headless / WebAssembly C API declarations (EMSCRIPTEN_KEEPALIVE)
├── wasm_api.c          # Global editor instance, JSON serialisation, Trie word loader
├── search_repl.c       # Raw terminal interactive search REPL loop (CLI)
├── test_integration.c  # Headless automated integration test suite (Core + WASM API)
├── main.c              # Command-line batch REPL (CLI)
├── commands.txt        # Scripted batch command input file
├── output.txt          # Batch command output capture
├── run_demo.sh         # Turnkey build, test, and execution script
└── Makefile            # Multi-target build system (CLI, tests, WASM)
```

---

## 🛠️ Building & Running

### Requirements
- C99/C11 compliant compiler (`clang` or `gcc`)
- POSIX terminal (`termios.h`, `unistd.h`)

### Targets

```bash
# Compile interactive search REPL (optimized -O2)
make

# Run automated ASan integration test (zero memory leaks check)
make test

# Clean build artifacts
make clean
```

### Launch Interactive REPL

```bash
./search_repl
```

---

## ⌨️ Interactive REPL Controls

| Keystroke | Action | Engine Handling |
| :--- | :--- | :--- |
| **`Printable Keys`** | Insert character at cursor | `insert_text(&pt, cursor, ch)` (splits piece at cursor) |
| **`Backspace`** | Delete character before cursor | `piece_table_delete(&pt, cursor - 1, 1)` |
| **`Delete`** | Delete character at cursor | `piece_table_delete(&pt, cursor, 1)` |
| **`Left / Right`** | Move cursor in-line | Bounds clamped `[0, doc_len]` |
| **`Home / End`** | Jump to start / end | Cursor index set to `0` or `doc_len` |
| **`Tab`** | Autocomplete prefix | Replaces active prefix with top Trie suggestion |
| **`Ctrl + Z`** | Undo | `piece_table_undo(&pt)` |
| **`Ctrl + Y` / `Ctrl + R`** | Redo | `piece_table_redo(&pt)` |
| **`Enter`** | Commit query | Renders query string and resets input buffer |
| **`Esc` / `Ctrl + C`** | Exit | Frees all structures and restores terminal attributes |

---

## 📊 Complexity Analysis

| Operation | Gap Buffer / Continuous Array | Piece Table + Trie (This Engine) |
| :--- | :--- | :--- |
| **Keystroke Append (Tail)** | $O(1)^*$ (occasional $O(N)$ realloc) | $O(1)$ amortized (append-only buffer) |
| **In-Line Insertion (Mid)** | $O(N)$ (shifts array elements) | $O(P)$ piece traversal + $O(1)$ node split |
| **Deletion** | $O(N)$ (shifts array elements) | $O(P)$ piece traversal + $O(1)$ node split |
| **Prefix Extraction** | $O(K)$ | $O(K)$ backward piece scan (0 allocations) |
| **Trie Query** | $O(K + \Sigma \cdot M)$ | $O(K + \Sigma \cdot M)$ ($K$: prefix len, $M$: match count) |
| **Undo / Redo** | $O(N)$ full snapshot copy | $O(1)$ descriptor pointer swap |

*(where $N$ = document length, $P$ = piece count, $K$ = prefix length)*

---

## 🔌 API Reference

### Piece Table API (`piece_table.h`)

```c
#include "piece_table.h"

PieceTable pt;
piece_table_init(&pt, "", 0);

// Insert text at character index
insert_text(&pt, 0, "apple");

// Delete characters: (index, length)
piece_table_delete(&pt, 4, 1);

// Revert and re-apply
piece_table_undo(&pt);
piece_table_redo(&pt);

// Render document to contiguous string
size_t len = 0;
char *str = piece_table_render(&pt, &len);
free(str);

// Teardown
piece_table_free(&pt);
```

### Trie API (`trie.h`)

```c
#include "trie.h"

TrieNode *root = trie_create_node();

// Insert vocabulary
trie_insert(root, "algorithm");
trie_insert(root, "allocate");

// Query prefix completions
TrieSearchResults *res = trie_search_prefix(root, "al", 5);
for (size_t i = 0; i < res->count; i++) {
    printf("Suggestion: %s\n", res->suggestions[i]);
}

// Teardown
trie_free_results(res);
trie_free(root);
```

---

## 🧪 Testing & Memory Verification

The test suite validates prefix extraction, in-line piece splits, undo/redo state restoration, and Trie suggestions under AddressSanitizer and UndefinedBehaviorSanitizer:

```bash
make test
```

Expected output:
```text
cc -Wall -Wextra -pedantic -std=c99 -O2 -g -fsanitize=address,undefined piece_table.c trie.c test_integration.c -o test_runner
./test_runner
ALL TESTS PASSED WITH ZERO LEAKS.
rm -f test_runner
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE).
