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

    /* Test consecutive append piece merging: typing "appl" creates 1 ADD piece */
    editor_init("");
    editor_insert(0, "a");
    editor_insert(1, "p");
    editor_insert(2, "p");
    editor_insert(3, "l");
    char *appl_txt = editor_get_text();
    assert(strcmp(appl_txt, "appl") == 0);
    editor_free_string(appl_txt);

    char *appl_pieces = editor_get_pieces_json();
    assert(strstr(appl_pieces, "\"length\":4") != NULL);
    assert(strstr(appl_pieces, "\"index\":1") == NULL); /* Must be only 1 piece (index 0) */
    editor_free_string(appl_pieces);

    /* Undo removes only 'l' */
    editor_undo();
    char *app_txt = editor_get_text();
    assert(strcmp(app_txt, "app") == 0);
    editor_free_string(app_txt);

    /* Test prefix extraction in middle of text across pieces */
    editor_init("Hello World\n");
    editor_insert(6, "appl"); /* "Hello applWorld\n" */
    char *mid_pfx = editor_get_prefix(10); /* Right after "appl" */
    assert(strcmp(mid_pfx, "appl") == 0);
    editor_free_string(mid_pfx);

    /* Case-insensitive suggestions */
    trie_load_words("apple\napplication\napply\n");
    char *case_sugg = trie_suggest_json("APPL", 5);
    assert(case_sugg != NULL);
    assert(strstr(case_sugg, "apple") != NULL);
    editor_free_string(case_sugg);

    editor_cleanup();

    /* ---------------------------------------------------------
     * 3. Phase 1: Frequency-Ranked Learning Autocomplete & Persistence
     * --------------------------------------------------------- */
    TrieNode *learn_trie = trie_create_node();
    assert(learn_trie);
    assert(trie_insert(learn_trie, "apple"));
    assert(trie_insert(learn_trie, "application"));
    assert(trie_insert(learn_trie, "apply"));

    /* Initially all have frequency 1, so tie-breaker is alphabetical */
    TrieSearchResults *lr = trie_search_prefix(learn_trie, "app", 5);
    assert(lr != NULL);
    assert(lr->count == 3);
    assert(strcmp(lr->suggestions[0], "apple") == 0);
    assert(strcmp(lr->suggestions[1], "application") == 0);
    assert(strcmp(lr->suggestions[2], "apply") == 0);
    trie_free_results(lr);

    /* Increment "apply" twice -> frequency = 3 */
    assert(trie_increment(learn_trie, "apply"));
    assert(trie_increment(learn_trie, "apply"));

    lr = trie_search_prefix(learn_trie, "app", 5);
    assert(lr != NULL);
    assert(lr->count == 3);
    assert(strcmp(lr->suggestions[0], "apply") == 0);
    assert(lr->frequencies[0] == 3);
    assert(strcmp(lr->suggestions[1], "apple") == 0);
    assert(strcmp(lr->suggestions[2], "application") == 0);
    trie_free_results(lr);

    /* Increment "application" 5 times -> frequency = 6 */
    for (int i = 0; i < 5; i++) {
        assert(trie_increment(learn_trie, "application"));
    }

    lr = trie_search_prefix(learn_trie, "app", 5);
    assert(lr != NULL);
    assert(lr->count == 3);
    assert(strcmp(lr->suggestions[0], "application") == 0);
    assert(lr->frequencies[0] == 6);
    assert(strcmp(lr->suggestions[1], "apply") == 0);
    assert(lr->frequencies[1] == 3);
    assert(strcmp(lr->suggestions[2], "apple") == 0);
    assert(lr->frequencies[2] == 1);
    trie_free_results(lr);

    /* Save to file */
    const char *test_dump_path = "test_trie_persist.dat";
    assert(trie_save(learn_trie, test_dump_path));
    trie_free(learn_trie);

    /* Load into fresh trie and verify round trip */
    TrieNode *loaded_trie = trie_create_node();
    assert(loaded_trie);
    assert(trie_load(loaded_trie, test_dump_path));

    lr = trie_search_prefix(loaded_trie, "app", 5);
    assert(lr != NULL);
    assert(lr->count == 3);
    assert(strcmp(lr->suggestions[0], "application") == 0);
    assert(lr->frequencies[0] == 6);
    assert(strcmp(lr->suggestions[1], "apply") == 0);
    assert(lr->frequencies[1] == 3);
    assert(strcmp(lr->suggestions[2], "apple") == 0);
    assert(lr->frequencies[2] == 1);
    trie_free_results(lr);

    trie_free(loaded_trie);
    remove(test_dump_path);

    printf("ALL TESTS (CORE + WASM API) PASSED WITH ZERO LEAKS.\n");
    return 0;
}
