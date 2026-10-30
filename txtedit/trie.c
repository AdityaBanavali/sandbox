#include "trie.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_WORD_LEN 256

TrieNode *trie_create_node(void) {
    TrieNode *node = (TrieNode *)calloc(1, sizeof(TrieNode));
    return node;
}

bool trie_insert(TrieNode *root, const char *word) {
    if (!root || !word) {
        return false;
    }

    TrieNode *curr = root;
    for (size_t i = 0; word[i] != '\0'; i++) {
        unsigned char c = (unsigned char)word[i];
        if (c >= TRIE_ALPHABET_SIZE) {
            continue;
        }
        if (!curr->children[c]) {
            curr->children[c] = trie_create_node();
            if (!curr->children[c]) {
                return false;
            }
        }
        curr = curr->children[c];
    }
    curr->is_end_of_word = true;
    return true;
}

static void collect_suggestions(TrieNode *node, char *buffer, size_t depth,
                                TrieSearchResults *res, size_t max_results) {
    if (!node || res->count >= max_results) {
        return;
    }

    if (node->is_end_of_word) {
        buffer[depth] = '\0';
        char *str = strdup(buffer);
        if (str) {
            if (res->count == res->capacity) {
                size_t new_cap = res->capacity ? res->capacity * 2 : 8;
                char **new_sugg = (char **)realloc(res->suggestions, new_cap * sizeof(char *));
                if (new_sugg) {
                    res->suggestions = new_sugg;
                    res->capacity = new_cap;
                }
            }
            if (res->count < res->capacity) {
                res->suggestions[res->count++] = str;
            } else {
                free(str);
            }
        }
    }

    for (int i = 0; i < TRIE_ALPHABET_SIZE && res->count < max_results; i++) {
        if (node->children[i]) {
            if (depth + 1 < MAX_WORD_LEN) {
                buffer[depth] = (char)i;
                collect_suggestions(node->children[i], buffer, depth + 1, res, max_results);
            }
        }
    }
}

TrieSearchResults *trie_search_prefix(TrieNode *root, const char *prefix, size_t max_results) {
    if (!root || !prefix || max_results == 0) {
        return NULL;
    }

    TrieSearchResults *res = (TrieSearchResults *)malloc(sizeof(TrieSearchResults));
    if (!res) {
        return NULL;
    }
    res->suggestions = NULL;
    res->count = 0;
    res->capacity = 0;

    TrieNode *curr = root;
    size_t prefix_len = strlen(prefix);

    for (size_t i = 0; i < prefix_len; i++) {
        unsigned char c = (unsigned char)prefix[i];
        if (c >= TRIE_ALPHABET_SIZE || !curr->children[c]) {
            return res;
        }
        curr = curr->children[c];
    }

    char buffer[MAX_WORD_LEN];
    if (prefix_len < MAX_WORD_LEN) {
        memcpy(buffer, prefix, prefix_len);
        collect_suggestions(curr, buffer, prefix_len, res, max_results);
    }

    return res;
}

void trie_free_results(TrieSearchResults *results) {
    if (!results) {
        return;
    }
    for (size_t i = 0; i < results->count; i++) {
        free(results->suggestions[i]);
    }
    free(results->suggestions);
    free(results);
}

void trie_free(TrieNode *root) {
    if (!root) {
        return;
    }
    for (int i = 0; i < TRIE_ALPHABET_SIZE; i++) {
        if (root->children[i]) {
            trie_free(root->children[i]);
        }
    }
    free(root);
}
