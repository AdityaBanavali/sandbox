#ifndef TRIE_H
#define TRIE_H

#include <stddef.h>
#include <stdbool.h>

#define TRIE_ALPHABET_SIZE 128

typedef struct TrieNode {
    struct TrieNode *children[TRIE_ALPHABET_SIZE];
    bool is_end_of_word;
} TrieNode;

typedef struct {
    char **suggestions;
    size_t count;
    size_t capacity;
} TrieSearchResults;

TrieNode *trie_create_node(void);
bool trie_insert(TrieNode *root, const char *word);
TrieSearchResults *trie_search_prefix(TrieNode *root, const char *prefix, size_t max_results);
void trie_free_results(TrieSearchResults *results);
void trie_free(TrieNode *root);

#endif /* TRIE_H */
