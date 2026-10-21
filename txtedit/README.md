# 📝 txtedit // Piece Table Text Editor Engine

A high-performance, lightweight text editor core and interactive REPL implemented in pure C (C99/C11) using the **Piece Table** data structure.

[![C: C99 / C11](https://img.shields.io/badge/C-C99%20%2F%20C11-00599C?style=flat-square&logo=c&logoColor=white)](https://en.wikipedia.org/wiki/C_(programming_language))
[![Data Structure: Piece Table](https://img.shields.io/badge/Data%20Structure-Piece%20Table-00f0ff?style=flat-square)](#-piece-table-architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66?style=flat-square)](../LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Standard%20C%20Lib-9d4edd?style=flat-square)](#-building--running)

---

## 📖 Overview

The **Piece Table** is the standard data structure used by professional text editors (including Visual Studio Code and AbiWord) for efficient text representation, instant undo/redo, and minimal memory copying.

Instead of storing an entire document as a continuous array of characters (which requires $O(N)$ reallocations and copies on every keystroke) or a gap buffer (which struggles with large multi-cursor or non-local edits), a piece table maintains:
1. **Original Buffer (`const char *`)**: Read-only, immutable snapshot of the original file content.
2. **Add Buffer (`char *`)**: Append-only dynamic buffer where all newly inserted text is appended.
3. **Piece Chain (Doubly-Linked List)**: A sequence of lightweight piece descriptors (`Piece`), each pointing into either the original or add buffer with an offset and length.

---

## ⚡ Key Features

- **Immutable Original & Append-Only Add Buffers**: Original file memory is never mutated. Added text is strictly appended to the add buffer in $O(1)$ amortized time.
- **Surgical Piece Splitting**: Insertions and deletions split and rewire piece descriptors without shifting large blocks of text.
- **Full Linear Undo & Redo**: Every edit operation creates a snapshot action containing before/after piece descriptor sequences, enabling instant non-destructive undo and redo.
- **Contiguous Document Rendering**: Efficiently materializes the current piece chain into a single null-terminated string (`piece_table_render`).
- **Interactive CLI / REPL**: Built-in interactive command shell with robust input trimming, error handling, and piece table structure inspection (`debug`).
- **Zero External Dependencies**: Pure standard C (libc only: `stdio.h`, `stdlib.h`, `string.h`, `stdbool.h`, `ctype.h`).
- **Memory Safe**: Strict lifecycle management (`piece_table_init`, `piece_table_free`) with clean allocation tracking and zero leaks.

---

## 🏛️ Piece Table Architecture

```
                    ┌───────────────────────────┐
                    │  Original Buffer (Const)  │  "Hello World"
                    └─────────────┬─────────────┘
                                  │ (offset 0, len 5)
                                  ▼
Document:   ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
"Hello      │   Piece [0]       │───>│   Piece [1]       │───>│   Piece [2]       │
Beautiful   │ SRC: Original     │    │ SRC: Add Buffer   │    │ SRC: Original     │
 World"     │ off: 0, len: 5    │<───│ off: 0, len: 10   │<───│ off: 5, len: 6    │
            └───────────────────┘    └───────────────────┘    └───────────────────┘
                                       ▲
                                       │ (offset 0, len 10)
                    ┌──────────────────┴────────┐
                    │  Add Buffer (Append Only) │  "Beautiful "
                    └───────────────────────────┘
```

---

## 🛠️ Building & Running

### Requirements
- Any C99/C11 compliant compiler (`clang`, `gcc`, `msvc`)
- POSIX-compatible terminal (macOS, Linux, WSL)

### Compilation
```bash
# Using Clang
clang -Wall -Wextra -O2 main.c piece_table.c -o piece_table_repl

# Using GCC
gcc -Wall -Wextra -O2 main.c piece_table.c -o piece_table_repl
```

### Launch Interactive REPL
```bash
./piece_table_repl
```

---

## 💻 REPL Commands

| Command | Syntax | Description | Example |
| :--- | :--- | :--- | :--- |
| **`insert`** | `insert <index> <text>` | Inserts text at the given document character index | `insert 0 Hello World` |
| **`delete`** | `delete <index> <length>` | Deletes `<length>` characters starting at `<index>` | `delete 5 6` |
| **`undo`** | `undo` | Reverts the most recent insertion or deletion | `undo` |
| **`redo`** | `redo` | Re-applies the most recently reverted action | `redo` |
| **`print`** | `print` | Renders and displays the complete document text | `print` |
| **`debug`** | `debug` | Dumps the piece descriptor chain, offsets, and buffer sources | `debug` |
| **`exit`** | `exit` | Frees all allocated memory and exits the REPL | `exit` |

### Sample REPL Session
```bash
> insert 0 Hello World
> print
Hello World
> insert 5 Beautiful 
> print
HelloBeautiful  World
> undo
> print
Hello World
> redo
> print
HelloBeautiful  World
> debug
=== Piece Table Debug ===
Total Length: 21 chars | Total Pieces: 3
[Piece 0] SRC: ADD | Offset: 0 | Len: 5 | Text: "Hello" | Prev: NULL (Head) | Next: OK
[Piece 1] SRC: ADD | Offset: 11 | Len: 10 | Text: "Beautiful " | Prev: OK | Next: OK
[Piece 2] SRC: ADD | Offset: 5 | Len: 6 | Text: " World" | Prev: OK | Next: NULL (Tail)
=========================
> exit
```

---

## 🔌 C API Reference

The piece table engine is self-contained and easily embeddable into any C/C++ project:

```c
#include "piece_table.h"

// 1. Initialize with an optional initial text buffer
PieceTable pt;
piece_table_init(&pt, "Initial text\n", 13);

// 2. Insert text at character index
insert_text(&pt, 7, "awesome ");

// 3. Delete characters: delete(index, length)
piece_table_delete(&pt, 0, 8);

// 4. Undo and Redo
piece_table_undo(&pt);
piece_table_redo(&pt);

// 5. Render document to contiguous string
size_t doc_len = 0;
char *rendered = piece_table_render(&pt, &doc_len);
printf("%s", rendered);
free(rendered);

// 6. Free all piece descriptors, add buffer, and history stack
piece_table_free(&pt);
```

---

## 📄 License

Licensed under the [MIT License](../LICENSE).
