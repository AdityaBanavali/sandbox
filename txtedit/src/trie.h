#ifndef TRIE_H
#define TRIE_H

#include <stddef.h>
#include <stdbool.h>

#define TRIE_ALPHABET_SIZE 128
#define TRIE_TOP_K 5
#define MAX_WORD_LEN 256

typedef struct {
    const char *word;
    unsigned int frequency;
} TrieCachedWord;

typedef struct TrieNode {
    struct TrieNode *children[TRIE_ALPHABET_SIZE];
    bool is_end_of_word;
    unsigned int frequency;
    char *word; /* Owned string allocated at the terminal node */
    TrieCachedWord top_k[TRIE_TOP_K];
    size_t top_k_count;
} TrieNode;

typedef struct {
    char **suggestions;
    unsigned int *frequencies;
    size_t count;
    size_t capacity;
} TrieSearchResults;

TrieNode *trie_create_node(void);
bool trie_insert(TrieNode *root, const char *word);
bool trie_increment(TrieNode *root, const char *word);
TrieSearchResults *trie_search_prefix(TrieNode *root, const char *prefix, size_t max_results);
bool trie_save(const TrieNode *root, const char *path);
bool trie_load(TrieNode *root, const char *path);
void trie_free_results(TrieSearchResults *results);
void trie_free(TrieNode *root);

#endif /* TRIE_H */
