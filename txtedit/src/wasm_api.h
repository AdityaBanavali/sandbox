#ifndef WASM_API_H
#define WASM_API_H

#include <stdbool.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#ifndef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE
#endif
#endif

#ifdef __cplusplus
extern "C" {
#endif

EMSCRIPTEN_KEEPALIVE
void editor_init(const char *initial_text);

EMSCRIPTEN_KEEPALIVE
bool editor_insert(int pos, const char *text);

EMSCRIPTEN_KEEPALIVE
void editor_delete(int pos, int len);

EMSCRIPTEN_KEEPALIVE
void editor_undo(void);

EMSCRIPTEN_KEEPALIVE
void editor_redo(void);

EMSCRIPTEN_KEEPALIVE
char *editor_get_text(void);

EMSCRIPTEN_KEEPALIVE
char *editor_get_pieces_json(void);

EMSCRIPTEN_KEEPALIVE
char *editor_get_prefix(int cursor_pos);

EMSCRIPTEN_KEEPALIVE
void trie_load_words(const char *newline_separated_words);

EMSCRIPTEN_KEEPALIVE
char *trie_suggest_json(const char *prefix, int max);

EMSCRIPTEN_KEEPALIVE
void editor_free_string(char *p);

EMSCRIPTEN_KEEPALIVE
void editor_cleanup(void);

#ifdef __cplusplus
}
#endif

#endif /* WASM_API_H */
