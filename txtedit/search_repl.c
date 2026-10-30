#include "piece_table.h"
#include "trie.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>
#include <unistd.h>
#include <termios.h>

#define MAX_PREFIX_LEN 256
#define MAX_SUGGESTIONS 5
#define PROMPT "Search> "

static struct termios orig_termios;

static void disable_raw_mode(void) {
    tcsetattr(STDIN_FILENO, TCSAFLUSH, &orig_termios);
    printf("\033[?25h\n"); /* Restore cursor and newline */
    fflush(stdout);
}

static void enable_raw_mode(void) {
    if (tcgetattr(STDIN_FILENO, &orig_termios) == -1) {
        perror("tcgetattr");
        exit(EXIT_FAILURE);
    }
    atexit(disable_raw_mode);

    struct termios raw = orig_termios;
    raw.c_lflag &= ~(ECHO | ICANON | IEXTEN | ISIG);
    raw.c_iflag &= ~(IXON | ICRNL | BRKINT | INPCK | ISTRIP);
    raw.c_cflag |= (CS8);
    raw.c_cc[VMIN] = 1;
    raw.c_cc[VTIME] = 0;

    if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &raw) == -1) {
        perror("tcsetattr");
        exit(EXIT_FAILURE);
    }
}

static size_t piece_table_get_length(const PieceTable *pt) {
    if (!pt) return 0;
    size_t len = 0;
    for (const Piece *p = pt->head; p; p = p->next) {
        len += p->length;
    }
    return len;
}

/*
 * Extracts active token prefix ending at cursor directly from piece table
 * without allocating or copying whole document buffer.
 */
static size_t piece_table_extract_active_prefix(PieceTable *pt, size_t cursor,
                                               char *out_buf, size_t max_buf_size) {
    if (!pt || cursor == 0 || max_buf_size <= 1) {
        if (out_buf && max_buf_size > 0) {
            out_buf[0] = '\0';
        }
        return 0;
    }

    size_t offset_in_piece = 0;
    Piece *piece = find_piece_at_index(pt, cursor - 1, &offset_in_piece);
    if (!piece) {
        if (out_buf && max_buf_size > 0) {
            out_buf[0] = '\0';
        }
        return 0;
    }

    char temp[MAX_PREFIX_LEN];
    size_t count = 0;
    Piece *curr = piece;
    long pos = (long)offset_in_piece;

    while (curr && count < sizeof(temp) - 1 && count < max_buf_size - 1) {
        const char *base = (curr->buffer == BUFFER_ORIGINAL)
                           ? pt->original_buf
                           : pt->add_buf.data;
        while (pos >= 0 && count < sizeof(temp) - 1 && count < max_buf_size - 1) {
            char c = base[curr->offset + (size_t)pos];
            if (isspace((unsigned char)c) || ispunct((unsigned char)c)) {
                goto scan_done;
            }
            temp[count++] = c;
            pos--;
        }
        curr = curr->prev;
        if (curr) {
            pos = (long)curr->length - 1;
        }
    }

scan_done:
    for (size_t i = 0; i < count; i++) {
        out_buf[i] = temp[count - 1 - i];
    }
    out_buf[count] = '\0';
    return count;
}

static void seed_trie(TrieNode *root) {
    static const char *words[] = {
        "algorithm", "allocate", "alphabet", "analyzer", "api", "append",
        "apple", "application", "apply", "array", "async", "atomic",
        "binary", "bitmap", "bitset", "block", "buffer", "bytecode",
        "cache", "callback", "capacity", "channel", "chunk", "closure",
        "compiler", "concurrency", "constant", "cursor",
        "database", "debug", "delete", "descriptor", "diff", "dispatch",
        "engine", "entity", "escape", "execute",
        "file", "filter", "flush", "fragment", "free", "function",
        "garbage", "gap", "generic", "git",
        "hash", "header", "heap", "history",
        "index", "init", "inline", "input", "insert", "iterator",
        "kernel", "keystroke",
        "layout", "length", "lexical", "linear", "linked", "list", "lock",
        "malloc", "memory", "metadata", "mutex",
        "navigate", "network", "node", "null",
        "offset", "optimize", "original", "output",
        "parser", "performance", "piece", "pipeline", "pointer", "prefix",
        "queue", "quick",
        "raw", "realloc", "redo", "render", "repl", "root",
        "scan", "search", "slice", "snapshot", "split", "stack", "string", "struct", "suggestion",
        "table", "terminal", "termios", "token", "tree", "trie",
        "undo", "utf8",
        "vector", "virtual",
        "workspace",
        NULL
    };

    for (size_t i = 0; words[i] != NULL; i++) {
        trie_insert(root, words[i]);
    }
}

int main(void) {
    PieceTable pt;
    if (!piece_table_init(&pt, "", 0)) {
        fprintf(stderr, "Failed to initialize piece table\n");
        return EXIT_FAILURE;
    }

    TrieNode *trie_root = trie_create_node();
    if (!trie_root) {
        piece_table_free(&pt);
        fprintf(stderr, "Failed to initialize trie\n");
        return EXIT_FAILURE;
    }
    seed_trie(trie_root);

    enable_raw_mode();

    size_t cursor = 0;
    char prefix[MAX_PREFIX_LEN] = {0};

    while (1) {
        size_t doc_len = piece_table_get_length(&pt);
        if (cursor > doc_len) {
            cursor = doc_len;
        }

        /* 1. Extract active prefix ending at cursor directly from piece table */
        size_t prefix_len = piece_table_extract_active_prefix(&pt, cursor, prefix, sizeof(prefix));

        /* 2. Query trie for suggestions */
        TrieSearchResults *results = NULL;
        if (prefix_len > 0) {
            results = trie_search_prefix(trie_root, prefix, MAX_SUGGESTIONS);
        }

        /* 3. Render current buffer and suggestions UI */
        size_t rendered_len = 0;
        char *rendered_doc = piece_table_render(&pt, &rendered_len);

        /* Clear screen down from current position and redraw */
        printf("\r\033[J");
        printf("%s%s\n", PROMPT, rendered_doc ? rendered_doc : "");

        size_t lines_drawn = 1;
        if (results && results->count > 0) {
            printf("Suggestions (%zu):\n", results->count);
            lines_drawn++;
            for (size_t i = 0; i < results->count; i++) {
                printf("  [%zu] %s\n", i + 1, results->suggestions[i]);
                lines_drawn++;
            }
        } else if (prefix_len > 0) {
            printf("(No suggestions for prefix \"%s\")\n", prefix);
            lines_drawn++;
        } else {
            printf("[Ctrl+Z: Undo | Ctrl+Y: Redo | Tab: Autocomplete | Esc/Ctrl+C: Exit]\n");
            lines_drawn++;
        }

        /* Reposition cursor to editing point on the prompt line */
        size_t prompt_len = strlen(PROMPT);
        printf("\033[%zuA\r\033[%zuC", lines_drawn, prompt_len + cursor);
        fflush(stdout);

        if (rendered_doc) {
            free(rendered_doc);
            rendered_doc = NULL;
        }

        /* 4. Read user keystroke */
        char c = 0;
        if (read(STDIN_FILENO, &c, 1) <= 0) {
            if (results) trie_free_results(results);
            break;
        }

        /* Handle Escape and ANSI escape sequences */
        if (c == '\x1b') {
            char seq[3];
            if (read(STDIN_FILENO, &seq[0], 1) == 0) {
                /* Standalone ESC exits */
                if (results) trie_free_results(results);
                break;
            }
            if (read(STDIN_FILENO, &seq[1], 1) == 0) {
                if (results) trie_free_results(results);
                break;
            }

            if (seq[0] == '[') {
                if (seq[1] >= '0' && seq[1] <= '9') {
                    if (read(STDIN_FILENO, &seq[2], 1) == 0) {
                        if (results) trie_free_results(results);
                        break;
                    }
                    if (seq[2] == '~' && seq[1] == '3') {
                        /* Delete key */
                        if (cursor < doc_len) {
                            piece_table_delete(&pt, cursor, 1);
                        }
                    }
                } else {
                    switch (seq[1]) {
                        case 'D': /* Left arrow */
                            if (cursor > 0) cursor--;
                            break;
                        case 'C': /* Right arrow */
                            if (cursor < doc_len) cursor++;
                            break;
                        case 'H': /* Home */
                            cursor = 0;
                            break;
                        case 'F': /* End */
                            cursor = doc_len;
                            break;
                    }
                }
            }
            if (results) trie_free_results(results);
            continue;
        }

        /* Exit on Ctrl+C or Ctrl+D (EOF on empty) */
        if (c == 3 || (c == 4 && doc_len == 0)) {
            if (results) trie_free_results(results);
            break;
        }

        /* Undo on Ctrl+Z (ASCII 26) */
        if (c == 26) {
            piece_table_undo(&pt);
            doc_len = piece_table_get_length(&pt);
            if (cursor > doc_len) {
                cursor = doc_len;
            }
            if (results) trie_free_results(results);
            continue;
        }

        /* Redo on Ctrl+Y (ASCII 25) or Ctrl+R (ASCII 18) */
        if (c == 25 || c == 18) {
            piece_table_redo(&pt);
            doc_len = piece_table_get_length(&pt);
            if (cursor > doc_len) {
                cursor = doc_len;
            }
            if (results) trie_free_results(results);
            continue;
        }

        /* Backspace (127 or 8) */
        if (c == 127 || c == 8) {
            if (cursor > 0) {
                piece_table_delete(&pt, cursor - 1, 1);
                cursor--;
            }
            if (results) trie_free_results(results);
            continue;
        }

        /* Tab Autocomplete */
        if (c == '\t') {
            if (results && results->count > 0 && prefix_len > 0) {
                const char *top = results->suggestions[0];
                size_t word_len = strlen(top);
                /* Replace typed prefix with completion */
                size_t prefix_start = cursor - prefix_len;
                piece_table_delete(&pt, prefix_start, prefix_len);
                insert_text(&pt, prefix_start, top);
                cursor = prefix_start + word_len;
            }
            if (results) trie_free_results(results);
            continue;
        }

        /* Enter key commits line and resets */
        if (c == '\r' || c == '\n') {
            printf("\r\033[J");
            char *completed = piece_table_render(&pt, NULL);
            printf("Committed search query: \"%s\"\n", completed ? completed : "");
            free(completed);

            piece_table_free(&pt);
            piece_table_init(&pt, "", 0);
            cursor = 0;
            if (results) trie_free_results(results);
            continue;
        }

        /* Printable characters */
        if ((unsigned char)c >= 32 && (unsigned char)c <= 126) {
            char insert_buf[2] = { c, '\0' };
            if (insert_text(&pt, cursor, insert_buf)) {
                cursor++;
            }
        }

        if (results) {
            trie_free_results(results);
            results = NULL;
        }
    }

    /* Clear suggestion lines on exit and clean up */
    printf("\r\033[JExiting search REPL.\n");

    trie_free(trie_root);
    piece_table_free(&pt);

    return EXIT_SUCCESS;
}
