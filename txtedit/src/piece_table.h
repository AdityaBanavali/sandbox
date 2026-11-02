#ifndef PIECE_TABLE_H
#define PIECE_TABLE_H

#include <stddef.h>
#include <stdbool.h>

typedef enum {
    BUFFER_ORIGINAL,
    BUFFER_ADD
} BufferType;

typedef struct Piece {
    BufferType buffer;
    size_t offset;
    size_t length;
    struct Piece *prev;
    struct Piece *next;
} Piece;

typedef struct {
    char *data;
    size_t length;
    size_t capacity;
} AddBuffer;

typedef enum {
    ACTION_INSERT,
    ACTION_DELETE
} ActionType;

typedef struct Action {
    ActionType type;
    size_t index;
    size_t length;
    Piece *pieces_before;
    Piece *pieces_after;
    struct Action *prev;
    struct Action *next;
} Action;

typedef struct {
    const char *original_buf;
    size_t original_len;
    AddBuffer add_buf;
    Piece *head;
    Piece *tail;
    Action *history_head;
    Action *history_tail;
    Action *current_action;
} PieceTable;

bool piece_table_init(PieceTable *pt, const char *original_buf, size_t original_len);
Piece *find_piece_at_index(PieceTable *pt, size_t doc_index, size_t *out_offset);
bool insert_text(PieceTable *pt, size_t index, const char *str);
void piece_table_delete(PieceTable *pt, size_t index, size_t length);
void piece_table_undo(PieceTable *pt);
void piece_table_redo(PieceTable *pt);
void piece_table_debug(const PieceTable *pt);
char *piece_table_render(const PieceTable *pt, size_t *out_len);
size_t piece_table_extract_active_prefix(const PieceTable *pt, size_t cursor, char *out_buf, size_t max_buf_size);
void piece_table_free(PieceTable *pt);

#endif /* PIECE_TABLE_H */
