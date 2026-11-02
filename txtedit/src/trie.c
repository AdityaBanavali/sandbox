#include "trie.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/*
 * ============================================================================
 * Frequency-Ranked Top-K Cached Prefix Trie
 * ============================================================================
 *
 * Algorithm & Complexity:
 * - Structure: 128-ary prefix trie where each node maintains an inline cache
 *   of up to K=5 best completions rooted in its subtree.
 * - Ranking: Primary key is frequency (descending); secondary key is
 *   lexicographical order (ascending).
 * - Caching Invariant: Because word frequencies only increase monotonically
 *   during runtime (via insertion or user acceptance), maintaining the top-K
 *   cache along the insertion/increment path guarantees exact top-K ranking at
 *   every prefix node without ever re-scanning the entire subtree.
 * - Insertion / Increment:
 *     Time:  O(L * K log K) = O(L) where L <= 256 is word length and K = 5.
 *     Space: O(L) new nodes in the worst case.
 * - Prefix Lookup:
 *     Time:  O(L + K) to walk prefix L and copy K cached pointers (replaces O(M) DFS).
 *     Space: O(K) for result allocation.
 * ============================================================================
 */

TrieNode *trie_create_node(void) {
    TrieNode *node = (TrieNode *)calloc(1, sizeof(TrieNode));
    return node;
}

static int compare_cache_entries(const void *a, const void *b) {
    const TrieCachedWord *entry_a = (const TrieCachedWord *)a;
    const TrieCachedWord *entry_b = (const TrieCachedWord *)b;

    /* Frequency descending */
    if (entry_a->frequency > entry_b->frequency) return -1;
    if (entry_a->frequency < entry_b->frequency) return 1;

    /* Alphabetical ascending */
    return strcmp(entry_a->word, entry_b->word);
}

static void trie_node_update_cache(TrieNode *node, const char *word, unsigned int freq) {
    if (!node || !word) return;

    /* If the word is already present in this node's cache, update its frequency */
    for (size_t i = 0; i < node->top_k_count; i++) {
        if (strcmp(node->top_k[i].word, word) == 0) {
            node->top_k[i].frequency = freq;
            qsort(node->top_k, node->top_k_count, sizeof(TrieCachedWord), compare_cache_entries);
            return;
        }
    }

    /* If cache is not yet full, append and sort */
    if (node->top_k_count < TRIE_TOP_K) {
        node->top_k[node->top_k_count].word = word;
        node->top_k[node->top_k_count].frequency = freq;
        node->top_k_count++;
        qsort(node->top_k, node->top_k_count, sizeof(TrieCachedWord), compare_cache_entries);
        return;
    }

    /* Cache is full: test if candidate ranks higher than the current worst (last) entry */
    TrieCachedWord candidate;
    candidate.word = word;
    candidate.frequency = freq;

    if (compare_cache_entries(&candidate, &node->top_k[TRIE_TOP_K - 1]) < 0) {
        node->top_k[TRIE_TOP_K - 1] = candidate;
        qsort(node->top_k, TRIE_TOP_K, sizeof(TrieCachedWord), compare_cache_entries);
    }
}

static bool trie_upsert(TrieNode *root, const char *word, unsigned int freq_delta, unsigned int set_freq) {
    if (!root || !word) return false;

    char normalized[MAX_WORD_LEN];
    size_t nlen = 0;
    for (size_t i = 0; word[i] != '\0' && nlen + 1 < MAX_WORD_LEN; i++) {
        unsigned char c = (unsigned char)tolower((unsigned char)word[i]);
        if (c < TRIE_ALPHABET_SIZE) {
            normalized[nlen++] = (char)c;
        }
    }
    normalized[nlen] = '\0';
    if (nlen == 0) return false;

    TrieNode *path[MAX_WORD_LEN + 1];
    size_t path_len = 0;

    TrieNode *curr = root;
    path[path_len++] = curr;

    for (size_t i = 0; i < nlen; i++) {
        unsigned char c = (unsigned char)normalized[i];
        if (!curr->children[c]) {
            curr->children[c] = trie_create_node();
            if (!curr->children[c]) {
                return false;
            }
        }
        curr = curr->children[c];
        path[path_len++] = curr;
    }

    curr->is_end_of_word = true;
    if (!curr->word) {
        curr->word = (char *)malloc(nlen + 1);
        if (!curr->word) return false;
        memcpy(curr->word, normalized, nlen + 1);
    }

    if (set_freq > 0) {
        curr->frequency = set_freq;
    } else if (freq_delta > 0) {
        if (curr->frequency == 0) {
            curr->frequency = freq_delta;
        } else {
            curr->frequency += freq_delta;
        }
    } else {
        if (curr->frequency == 0) {
            curr->frequency = 1;
        }
    }

    /* Propagate frequency and rank updates to top-K caches on all ancestor nodes */
    for (size_t i = 0; i < path_len; i++) {
        trie_node_update_cache(path[i], curr->word, curr->frequency);
    }

    return true;
}

bool trie_insert(TrieNode *root, const char *word) {
    return trie_upsert(root, word, 0, 0);
}

bool trie_increment(TrieNode *root, const char *word) {
    return trie_upsert(root, word, 1, 0);
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
    res->frequencies = NULL;
    res->count = 0;
    res->capacity = 0;

    TrieNode *curr = root;
    size_t prefix_len = strlen(prefix);

    for (size_t i = 0; i < prefix_len; i++) {
        unsigned char c = (unsigned char)tolower((unsigned char)prefix[i]);
        if (c >= TRIE_ALPHABET_SIZE || !curr->children[c]) {
            return res;
        }
        curr = curr->children[c];
    }

    /* O(K) lookup directly from cached top-K completions */
    size_t n = curr->top_k_count;
    if (n > max_results) {
        n = max_results;
    }

    if (n > 0) {
        res->suggestions = (char **)malloc(n * sizeof(char *));
        res->frequencies = (unsigned int *)malloc(n * sizeof(unsigned int));
        if (!res->suggestions || !res->frequencies) {
            free(res->suggestions);
            free(res->frequencies);
            res->suggestions = NULL;
            res->frequencies = NULL;
            return res;
        }

        for (size_t i = 0; i < n; i++) {
            size_t wlen = strlen(curr->top_k[i].word);
            res->suggestions[i] = (char *)malloc(wlen + 1);
            if (res->suggestions[i]) {
                memcpy(res->suggestions[i], curr->top_k[i].word, wlen + 1);
            }
            res->frequencies[i] = curr->top_k[i].frequency;
        }
        res->count = n;
        res->capacity = n;
    }

    return res;
}

static void trie_save_dfs(const TrieNode *node, FILE *fp) {
    if (!node) return;
    if (node->is_end_of_word && node->word) {
        fprintf(fp, "%s %u\n", node->word, node->frequency);
    }
    for (int i = 0; i < TRIE_ALPHABET_SIZE; i++) {
        if (node->children[i]) {
            trie_save_dfs(node->children[i], fp);
        }
    }
}

bool trie_save(const TrieNode *root, const char *path) {
    if (!root || !path) return false;
    FILE *fp = fopen(path, "w");
    if (!fp) return false;
    trie_save_dfs(root, fp);
    fclose(fp);
    return true;
}

bool trie_load(TrieNode *root, const char *path) {
    if (!root || !path) return false;
    FILE *fp = fopen(path, "r");
    if (!fp) return false;

    char word[MAX_WORD_LEN];
    unsigned int freq = 0;
    while (fscanf(fp, "%255s %u", word, &freq) == 2) {
        trie_upsert(root, word, 0, freq);
    }

    fclose(fp);
    return true;
}

void trie_free_results(TrieSearchResults *results) {
    if (!results) {
        return;
    }
    if (results->suggestions) {
        for (size_t i = 0; i < results->count; i++) {
            free(results->suggestions[i]);
        }
        free(results->suggestions);
    }
    if (results->frequencies) {
        free(results->frequencies);
    }
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
    if (root->word) {
        free(root->word);
    }
    free(root);
}
