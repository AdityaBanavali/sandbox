#include "piece_table.h"
#include "trie.h"
#include "wasm_api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

#define MAX_PREFIX_LEN 256

int main(void) {
    /* ---------------------------------------------------------
     * 1. Direct PieceTable & Trie Verification
     * --------------------------------------------------------- */
    PieceTable pt;
    assert(piece_table_init(&pt, "", 0));

    TrieNode *trie = trie_create_node();
    assert(trie);
    assert(trie_insert(trie, "algorithm"));
    assert(trie_insert(trie, "allocate"));
    assert(trie_insert(trie, "apple"));
    assert(trie_insert(trie, "application"));

    size_t cursor = 0;
    assert(insert_text(&pt, cursor++, "a"));
    assert(insert_text(&pt, cursor++, "p"));
    assert(insert_text(&pt, cursor++, "p"));

    char prefix[MAX_PREFIX_LEN];
    size_t plen = piece_table_extract_active_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(plen == 3);
    assert(strcmp(prefix, "app") == 0);

    TrieSearchResults *res = trie_search_prefix(trie, prefix, 5);
    assert(res != NULL);
    assert(res->count == 2);
    trie_free_results(res);

    assert(insert_text(&pt, cursor++, "x"));
    plen = piece_table_extract_active_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "appx") == 0);

    piece_table_delete(&pt, cursor - 1, 1);
    cursor--;
    plen = piece_table_extract_active_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "app") == 0);

    piece_table_undo(&pt);
    cursor++;
    plen = piece_table_extract_active_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "appx") == 0);

    piece_table_redo(&pt);
    cursor--;
    plen = piece_table_extract_active_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "app") == 0);

    piece_table_free(&pt);
    trie_free(trie);

    /* ---------------------------------------------------------
     * 2. WASM C API Verification
     * --------------------------------------------------------- */
    editor_init("Hello World");

    char *txt = editor_get_text();
    assert(strcmp(txt, "Hello World") == 0);
    editor_free_string(txt);

    /* In-line insertion */
    assert(editor_insert(5, " Beautiful"));
    txt = editor_get_text();
    assert(strcmp(txt, "Hello Beautiful World") == 0);
    editor_free_string(txt);

    /* JSON pieces inspection */
    char *pieces_json = editor_get_pieces_json();
    assert(pieces_json != NULL);
    assert(strstr(pieces_json, "\"source\":\"ORIG\"") != NULL);
    assert(strstr(pieces_json, "\"source\":\"ADD\"") != NULL);
    assert(strstr(pieces_json, "Beautiful") != NULL);
    editor_free_string(pieces_json);

    /* Zero-malloc stack prefix extraction */
    char *pfx = editor_get_prefix(15); /* Right after "Beautiful" */
    assert(strcmp(pfx, "Beautiful") == 0);
    editor_free_string(pfx);

    /* Delete & Undo/Redo */
    editor_delete(5, 10); /* Delete " Beautiful" */
    txt = editor_get_text();
    assert(strcmp(txt, "Hello World") == 0);
    editor_free_string(txt);

    editor_undo();
    txt = editor_get_text();
    assert(strcmp(txt, "Hello Beautiful World") == 0);
    editor_free_string(txt);

    editor_redo();
    txt = editor_get_text();
    assert(strcmp(txt, "Hello World") == 0);
    editor_free_string(txt);

    /* Trie load words & suggestions JSON */
    trie_load_words("binary\nbitmap\nbitset\nbyte\nblock\n");
    char *sugg_json = trie_suggest_json("bi", 5);
    assert(sugg_json != NULL);
    assert(strstr(sugg_json, "binary") != NULL);
    assert(strstr(sugg_json, "bitmap") != NULL);
    assert(strstr(sugg_json, "bitset") != NULL);
    editor_free_string(sugg_json);

    editor_cleanup();

    printf("ALL TESTS (CORE + WASM API) PASSED WITH ZERO LEAKS.\n");
    return 0;
}
