#include "piece_table.h"
#include "trie.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <ctype.h>

#define MAX_PREFIX_LEN 256

static size_t extract_prefix(PieceTable *pt, size_t cursor, char *out_buf, size_t max_buf_size) {
    if (!pt || cursor == 0 || max_buf_size <= 1) {
        if (out_buf && max_buf_size > 0) out_buf[0] = '\0';
        return 0;
    }
    size_t offset_in_piece = 0;
    Piece *piece = find_piece_at_index(pt, cursor - 1, &offset_in_piece);
    if (!piece) {
        if (out_buf && max_buf_size > 0) out_buf[0] = '\0';
        return 0;
    }
    char temp[MAX_PREFIX_LEN];
    size_t count = 0;
    Piece *curr = piece;
    long pos = (long)offset_in_piece;
    while (curr && count < sizeof(temp) - 1 && count < max_buf_size - 1) {
        const char *base = (curr->buffer == BUFFER_ORIGINAL) ? pt->original_buf : pt->add_buf.data;
        while (pos >= 0 && count < sizeof(temp) - 1 && count < max_buf_size - 1) {
            char c = base[curr->offset + (size_t)pos];
            if (isspace((unsigned char)c) || ispunct((unsigned char)c)) {
                goto done;
            }
            temp[count++] = c;
            pos--;
        }
        curr = curr->prev;
        if (curr) pos = (long)curr->length - 1;
    }
done:
    for (size_t i = 0; i < count; i++) {
        out_buf[i] = temp[count - 1 - i];
    }
    out_buf[count] = '\0';
    return count;
}

int main(void) {
    PieceTable pt;
    assert(piece_table_init(&pt, "", 0));

    TrieNode *trie = trie_create_node();
    assert(trie);
    assert(trie_insert(trie, "algorithm"));
    assert(trie_insert(trie, "allocate"));
    assert(trie_insert(trie, "apple"));
    assert(trie_insert(trie, "application"));

    /* 1. Simulate typing "app" */
    size_t cursor = 0;
    assert(insert_text(&pt, cursor++, "a"));
    assert(insert_text(&pt, cursor++, "p"));
    assert(insert_text(&pt, cursor++, "p"));

    char prefix[MAX_PREFIX_LEN];
    size_t plen = extract_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(plen == 3);
    assert(strcmp(prefix, "app") == 0);

    TrieSearchResults *res = trie_search_prefix(trie, prefix, 5);
    assert(res != NULL);
    assert(res->count == 2); /* apple, application */
    trie_free_results(res);

    /* 2. Simulate typo: type "x", backspace, undo, redo */
    assert(insert_text(&pt, cursor++, "x"));
    plen = extract_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "appx") == 0);
    res = trie_search_prefix(trie, prefix, 5);
    assert(res->count == 0);
    trie_free_results(res);

    /* Backspace */
    piece_table_delete(&pt, cursor - 1, 1);
    cursor--;
    plen = extract_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "app") == 0);

    /* Undo backspace -> restores 'x' */
    piece_table_undo(&pt);
    cursor++;
    plen = extract_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "appx") == 0);

    /* Redo backspace -> deletes 'x' */
    piece_table_redo(&pt);
    cursor--;
    plen = extract_prefix(&pt, cursor, prefix, sizeof(prefix));
    assert(strcmp(prefix, "app") == 0);

    /* Clean up */
    piece_table_free(&pt);
    trie_free(trie);

    printf("ALL TESTS PASSED WITH ZERO LEAKS.\n");
    return 0;
}
