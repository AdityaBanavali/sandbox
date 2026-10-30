#include "wasm_api.h"
#include "piece_table.h"
#include "trie.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

static PieceTable g_pt;
static TrieNode *g_trie = NULL;
static char *g_orig_buf = NULL;
static bool g_initialized = false;

/* --- Simple Dynamic String Builder for JSON --- */
typedef struct {
    char *data;
    size_t len;
    size_t cap;
} StringBuilder;

static void sb_init(StringBuilder *sb, size_t initial_cap) {
    sb->cap = initial_cap ? initial_cap : 64;
    sb->data = (char *)malloc(sb->cap);
    sb->len = 0;
    if (sb->data) {
        sb->data[0] = '\0';
    }
}

static void sb_ensure(StringBuilder *sb, size_t extra) {
    if (sb->len + extra + 1 > sb->cap) {
        while (sb->len + extra + 1 > sb->cap) {
            sb->cap *= 2;
        }
        char *new_data = (char *)realloc(sb->data, sb->cap);
        if (new_data) {
            sb->data = new_data;
        }
    }
}

static void sb_append_char(StringBuilder *sb, char c) {
    sb_ensure(sb, 1);
    sb->data[sb->len++] = c;
    sb->data[sb->len] = '\0';
}

static void sb_append_str(StringBuilder *sb, const char *str) {
    if (!str) return;
    size_t slen = strlen(str);
    sb_ensure(sb, slen);
    memcpy(sb->data + sb->len, str, slen);
    sb->len += slen;
    sb->data[sb->len] = '\0';
}

static void sb_append_json_str(StringBuilder *sb, const char *raw, size_t raw_len) {
    sb_append_char(sb, '"');
    for (size_t i = 0; i < raw_len; i++) {
        unsigned char c = (unsigned char)raw[i];
        switch (c) {
            case '"':  sb_append_str(sb, "\\\""); break;
            case '\\': sb_append_str(sb, "\\\\"); break;
            case '\b': sb_append_str(sb, "\\b");  break;
            case '\f': sb_append_str(sb, "\\f");  break;
            case '\n': sb_append_str(sb, "\\n");  break;
            case '\r': sb_append_str(sb, "\\r");  break;
            case '\t': sb_append_str(sb, "\\t");  break;
            default:
                if (c < 32) {
                    char hex[8];
                    snprintf(hex, sizeof(hex), "\\u%04x", c);
                    sb_append_str(sb, hex);
                } else {
                    sb_append_char(sb, (char)c);
                }
                break;
        }
    }
    sb_append_char(sb, '"');
}

/* --- Public WASM API Implementation --- */

EMSCRIPTEN_KEEPALIVE
void editor_cleanup(void) {
    if (!g_initialized) {
        return;
    }
    piece_table_free(&g_pt);
    if (g_orig_buf) {
        free(g_orig_buf);
        g_orig_buf = NULL;
    }
    if (g_trie) {
        trie_free(g_trie);
        g_trie = NULL;
    }
    g_initialized = false;
}

EMSCRIPTEN_KEEPALIVE
void editor_init(const char *initial_text) {
    editor_cleanup();

    if (initial_text && initial_text[0] != '\0') {
        g_orig_buf = strdup(initial_text);
        piece_table_init(&g_pt, g_orig_buf, strlen(g_orig_buf));
    } else {
        g_orig_buf = NULL;
        piece_table_init(&g_pt, "", 0);
    }

    g_trie = trie_create_node();
    g_initialized = true;
}

EMSCRIPTEN_KEEPALIVE
bool editor_insert(int pos, const char *text) {
    if (!g_initialized || !text || pos < 0) {
        return false;
    }
    return insert_text(&g_pt, (size_t)pos, text);
}

EMSCRIPTEN_KEEPALIVE
void editor_delete(int pos, int len) {
    if (!g_initialized || pos < 0 || len <= 0) {
        return;
    }
    piece_table_delete(&g_pt, (size_t)pos, (size_t)len);
}

EMSCRIPTEN_KEEPALIVE
void editor_undo(void) {
    if (g_initialized) {
        piece_table_undo(&g_pt);
    }
}

EMSCRIPTEN_KEEPALIVE
void editor_redo(void) {
    if (g_initialized) {
        piece_table_redo(&g_pt);
    }
}

EMSCRIPTEN_KEEPALIVE
char *editor_get_text(void) {
    if (!g_initialized) {
        return strdup("");
    }
    size_t out_len = 0;
    char *rendered = piece_table_render(&g_pt, &out_len);
    return rendered ? rendered : strdup("");
}

EMSCRIPTEN_KEEPALIVE
char *editor_get_pieces_json(void) {
    if (!g_initialized) {
        return strdup("[]");
    }

    StringBuilder sb;
    sb_init(&sb, 256);
    sb_append_char(&sb, '[');

    const Piece *curr = g_pt.head;
    int idx = 0;

    while (curr) {
        if (idx > 0) {
            sb_append_char(&sb, ',');
        }

        const char *src_name = (curr->buffer == BUFFER_ORIGINAL) ? "ORIG" : "ADD";
        const char *src_buf = (curr->buffer == BUFFER_ORIGINAL)
                              ? g_pt.original_buf
                              : g_pt.add_buf.data;

        char num_buf[128];
        snprintf(num_buf, sizeof(num_buf),
                 "{\"index\":%d,\"source\":\"%s\",\"offset\":%zu,\"length\":%zu,\"text\":",
                 idx, src_name, curr->offset, curr->length);
        sb_append_str(&sb, num_buf);

        if (src_buf) {
            sb_append_json_str(&sb, src_buf + curr->offset, curr->length);
        } else {
            sb_append_str(&sb, "\"\"");
        }

        sb_append_char(&sb, '}');

        curr = curr->next;
        idx++;
    }

    sb_append_char(&sb, ']');
    return sb.data;
}

EMSCRIPTEN_KEEPALIVE
char *editor_get_prefix(int cursor_pos) {
    if (!g_initialized || cursor_pos <= 0) {
        return strdup("");
    }
    char prefix_buf[256];
    piece_table_extract_active_prefix(&g_pt, (size_t)cursor_pos, prefix_buf, sizeof(prefix_buf));
    return strdup(prefix_buf);
}

EMSCRIPTEN_KEEPALIVE
void trie_load_words(const char *newline_separated_words) {
    if (!g_initialized || !g_trie || !newline_separated_words) {
        return;
    }

    const char *p = newline_separated_words;
    char word[256];
    size_t idx = 0;

    while (*p) {
        if (*p == '\n' || *p == '\r') {
            if (idx > 0) {
                word[idx] = '\0';
                trie_insert(g_trie, word);
                idx = 0;
            }
        } else if (!isspace((unsigned char)*p)) {
            if (idx + 1 < sizeof(word)) {
                word[idx++] = *p;
            }
        }
        p++;
    }
    if (idx > 0) {
        word[idx] = '\0';
        trie_insert(g_trie, word);
    }
}

EMSCRIPTEN_KEEPALIVE
char *trie_suggest_json(const char *prefix, int max) {
    if (!g_initialized || !g_trie || !prefix || max <= 0) {
        return strdup("[]");
    }

    TrieSearchResults *res = trie_search_prefix(g_trie, prefix, (size_t)max);
    if (!res || res->count == 0) {
        if (res) trie_free_results(res);
        return strdup("[]");
    }

    StringBuilder sb;
    sb_init(&sb, 256);
    sb_append_char(&sb, '[');

    for (size_t i = 0; i < res->count; i++) {
        if (i > 0) {
            sb_append_char(&sb, ',');
        }
        sb_append_json_str(&sb, res->suggestions[i], strlen(res->suggestions[i]));
    }
    sb_append_char(&sb, ']');

    trie_free_results(res);
    return sb.data;
}

EMSCRIPTEN_KEEPALIVE
void editor_free_string(char *p) {
    free(p);
}
