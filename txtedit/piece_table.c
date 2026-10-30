#include "piece_table.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

static Piece *clone_piece_list(const Piece *head, Piece **out_tail) {
    if (!head) {
        if (out_tail) {
            *out_tail = NULL;
        }
        return NULL;
    }

    Piece *new_head = NULL;
    Piece *new_tail = NULL;
    const Piece *curr = head;

    while (curr) {
        Piece *p = (Piece *)malloc(sizeof(Piece));
        if (!p) {
            break;
        }
        p->buffer = curr->buffer;
        p->offset = curr->offset;
        p->length = curr->length;
        p->prev = new_tail;
        p->next = NULL;

        if (new_tail) {
            new_tail->next = p;
        } else {
            new_head = p;
        }
        new_tail = p;
        curr = curr->next;
    }

    if (out_tail) {
        *out_tail = new_tail;
    }
    return new_head;
}

static void free_piece_list(Piece *head) {
    while (head) {
        Piece *next = head->next;
        free(head);
        head = next;
    }
}

static void free_action(Action *act) {
    if (!act) {
        return;
    }
    free_piece_list(act->pieces_before);
    free_piece_list(act->pieces_after);
    free(act);
}

static void record_action(PieceTable *pt, ActionType type, size_t index, size_t length,
                          Piece *before_head, Piece *after_head) {
    /* Discard redo history ahead of current_action */
    Action *discard = pt->current_action ? pt->current_action->next : pt->history_head;
    if (pt->current_action) {
        pt->current_action->next = NULL;
        pt->history_tail = pt->current_action;
    } else {
        pt->history_head = NULL;
        pt->history_tail = NULL;
    }

    while (discard) {
        Action *next = discard->next;
        free_action(discard);
        discard = next;
    }

    Action *act = (Action *)malloc(sizeof(Action));
    if (!act) {
        free_piece_list(before_head);
        free_piece_list(after_head);
        return;
    }

    act->type = type;
    act->index = index;
    act->length = length;
    act->pieces_before = before_head;
    act->pieces_after = after_head;
    act->prev = pt->current_action;
    act->next = NULL;

    if (pt->current_action) {
        pt->current_action->next = act;
    } else {
        pt->history_head = act;
    }
    pt->history_tail = act;
    pt->current_action = act;
}

bool piece_table_init(PieceTable *pt, const char *original_buf, size_t original_len) {
    if (!pt) {
        return false;
    }
    pt->original_buf = original_buf;
    pt->original_len = original_len;
    pt->add_buf.data = NULL;
    pt->add_buf.length = 0;
    pt->add_buf.capacity = 0;
    pt->head = NULL;
    pt->tail = NULL;
    pt->history_head = NULL;
    pt->history_tail = NULL;
    pt->current_action = NULL;

    if (original_buf && original_len > 0) {
        Piece *initial_piece = (Piece *)malloc(sizeof(Piece));
        if (!initial_piece) {
            return false;
        }
        initial_piece->buffer = BUFFER_ORIGINAL;
        initial_piece->offset = 0;
        initial_piece->length = original_len;
        initial_piece->prev = NULL;
        initial_piece->next = NULL;
        pt->head = initial_piece;
        pt->tail = initial_piece;
    }
    return true;
}

Piece *find_piece_at_index(PieceTable *pt, size_t doc_index, size_t *out_offset) {
    if (!pt) {
        return NULL;
    }

    Piece *curr = pt->head;
    size_t accumulated = 0;

    while (curr) {
        if (doc_index < accumulated + curr->length) {
            if (out_offset) {
                *out_offset = doc_index - accumulated;
            }
            return curr;
        }

        accumulated += curr->length;

        if (doc_index == accumulated && curr->next == NULL) {
            if (out_offset) {
                *out_offset = curr->length;
            }
            return curr;
        }

        curr = curr->next;
    }

    return NULL;
}

static bool append_to_add_buf(AddBuffer *buf, const char *str, size_t len, size_t *out_offset) {
    if (buf->length + len > buf->capacity) {
        size_t new_cap = buf->capacity ? buf->capacity * 2 : 128;
        while (new_cap < buf->length + len) {
            new_cap *= 2;
        }
        char *new_data = (char *)realloc(buf->data, new_cap);
        if (!new_data) {
            return false;
        }
        buf->data = new_data;
        buf->capacity = new_cap;
    }

    *out_offset = buf->length;
    memcpy(buf->data + buf->length, str, len);
    buf->length += len;
    return true;
}

bool insert_text(PieceTable *pt, size_t index, const char *str) {
    if (!pt || !str) {
        return false;
    }

    size_t str_len = strlen(str);
    if (str_len == 0) {
        return true;
    }

    Piece *before_head = clone_piece_list(pt->head, NULL);

    size_t add_offset = 0;
    if (!append_to_add_buf(&pt->add_buf, str, str_len, &add_offset)) {
        free_piece_list(before_head);
        return false;
    }

    Piece *new_piece = (Piece *)malloc(sizeof(Piece));
    if (!new_piece) {
        free_piece_list(before_head);
        return false;
    }
    new_piece->buffer = BUFFER_ADD;
    new_piece->offset = add_offset;
    new_piece->length = str_len;
    new_piece->prev = NULL;
    new_piece->next = NULL;

    /* Empty table */
    if (!pt->head) {
        pt->head = new_piece;
        pt->tail = new_piece;
        Piece *after_head = clone_piece_list(pt->head, NULL);
        record_action(pt, ACTION_INSERT, index, str_len, before_head, after_head);
        return true;
    }

    size_t offset_in_piece = 0;
    Piece *target = find_piece_at_index(pt, index, &offset_in_piece);
    if (!target) {
        free(new_piece);
        free_piece_list(before_head);
        return false;
    }

    /* Check if this insertion is contiguous to an existing ADD piece */
    Piece *prev_piece = NULL;
    if (offset_in_piece == target->length) {
        prev_piece = target;
    } else if (offset_in_piece == 0) {
        prev_piece = target->prev;
    }

    if (prev_piece && prev_piece->buffer == BUFFER_ADD &&
        (prev_piece->offset + prev_piece->length == add_offset)) {
        /* Merge into existing ADD piece */
        free(new_piece);
        prev_piece->length += str_len;
        Piece *after_head = clone_piece_list(pt->head, NULL);
        record_action(pt, ACTION_INSERT, index, str_len, before_head, after_head);
        return true;
    }

    /* Case 1: Inserting at head */
    if (target == pt->head && offset_in_piece == 0) {
        new_piece->next = pt->head;
        pt->head->prev = new_piece;
        pt->head = new_piece;
        Piece *after_head = clone_piece_list(pt->head, NULL);
        record_action(pt, ACTION_INSERT, index, str_len, before_head, after_head);
        return true;
    }

    /* Case 2: Inserting at tail */
    if (target == pt->tail && offset_in_piece == target->length) {
        new_piece->prev = pt->tail;
        pt->tail->next = new_piece;
        pt->tail = new_piece;
        Piece *after_head = clone_piece_list(pt->head, NULL);
        record_action(pt, ACTION_INSERT, index, str_len, before_head, after_head);
        return true;
    }

    /* Boundary between interior pieces */
    if (offset_in_piece == 0) {
        new_piece->prev = target->prev;
        new_piece->next = target;
        if (target->prev) {
            target->prev->next = new_piece;
        } else {
            pt->head = new_piece;
        }
        target->prev = new_piece;
        Piece *after_head = clone_piece_list(pt->head, NULL);
        record_action(pt, ACTION_INSERT, index, str_len, before_head, after_head);
        return true;
    }

    /* Case 3: Splitting an existing piece in the middle */
    Piece *right_piece = (Piece *)malloc(sizeof(Piece));
    if (!right_piece) {
        free(new_piece);
        free_piece_list(before_head);
        return false;
    }

    right_piece->buffer = target->buffer;
    right_piece->offset = target->offset + offset_in_piece;
    right_piece->length = target->length - offset_in_piece;
    right_piece->prev = new_piece;
    right_piece->next = target->next;

    if (target->next) {
        target->next->prev = right_piece;
    } else {
        pt->tail = right_piece;
    }

    target->length = offset_in_piece;
    target->next = new_piece;

    new_piece->prev = target;
    new_piece->next = right_piece;

    Piece *after_head = clone_piece_list(pt->head, NULL);
    record_action(pt, ACTION_INSERT, index, str_len, before_head, after_head);
    return true;
}

void piece_table_delete(PieceTable *pt, size_t index, size_t length) {
    if (!pt || length == 0 || !pt->head) {
        return;
    }

    size_t doc_len = 0;
    for (const Piece *p = pt->head; p; p = p->next) {
        doc_len += p->length;
    }

    if (index >= doc_len) {
        return;
    }

    if (index + length > doc_len) {
        length = doc_len - index;
    }

    Piece *before_head = clone_piece_list(pt->head, NULL);

    size_t del_start = index;
    size_t del_end = index + length;
    size_t accumulated = 0;
    Piece *curr = pt->head;

    while (curr && accumulated < del_end) {
        size_t curr_start = accumulated;
        size_t curr_len = curr->length;
        size_t curr_end = curr_start + curr_len;

        if (curr_end <= del_start) {
            accumulated += curr_len;
            curr = curr->next;
            continue;
        }

        /* 1. Entire piece is within deletion range */
        if (del_start <= curr_start && curr_end <= del_end) {
            Piece *to_del = curr;
            curr = curr->next;
            if (to_del->prev) {
                to_del->prev->next = to_del->next;
            } else {
                pt->head = to_del->next;
            }
            if (to_del->next) {
                to_del->next->prev = to_del->prev;
            } else {
                pt->tail = to_del->prev;
            }
            free(to_del);
            accumulated = curr_end;
            continue;
        }

        /* 2. Deletion is strictly within the middle of this piece -> split */
        if (del_start > curr_start && del_end < curr_end) {
            size_t left_len = del_start - curr_start;
            size_t cut_len = del_end - del_start;

            Piece *right = (Piece *)malloc(sizeof(Piece));
            if (!right) {
                break;
            }
            right->buffer = curr->buffer;
            right->offset = curr->offset + left_len + cut_len;
            right->length = curr_len - left_len - cut_len;
            right->prev = curr;
            right->next = curr->next;

            if (curr->next) {
                curr->next->prev = right;
            } else {
                pt->tail = right;
            }
            curr->next = right;
            curr->length = left_len;
            break;
        }

        /* 3. Head of piece is kept, tail of piece is deleted */
        if (del_start > curr_start && curr_end <= del_end) {
            curr->length = del_start - curr_start;
            accumulated = curr_end;
            curr = curr->next;
            continue;
        }

        /* 4. Head of piece is deleted, tail of piece is kept */
        if (del_start <= curr_start && del_end < curr_end) {
            size_t cut_len = del_end - curr_start;
            curr->offset += cut_len;
            curr->length -= cut_len;
            break;
        }

        accumulated += curr_len;
        curr = curr->next;
    }

    Piece *after_head = clone_piece_list(pt->head, NULL);
    record_action(pt, ACTION_DELETE, index, length, before_head, after_head);
}

void piece_table_undo(PieceTable *pt) {
    if (!pt || !pt->current_action) {
        return;
    }

    Action *act = pt->current_action;
    free_piece_list(pt->head);
    pt->head = clone_piece_list(act->pieces_before, &pt->tail);
    pt->current_action = act->prev;
}

void piece_table_redo(PieceTable *pt) {
    if (!pt) {
        return;
    }

    Action *to_redo = pt->current_action ? pt->current_action->next : pt->history_head;
    if (!to_redo) {
        return;
    }

    free_piece_list(pt->head);
    pt->head = clone_piece_list(to_redo->pieces_after, &pt->tail);
    pt->current_action = to_redo;
}

void piece_table_debug(const PieceTable *pt) {
    if (!pt) {
        printf("PieceTable is NULL\n");
        return;
    }

    size_t total_len = 0;
    size_t piece_count = 0;
    for (const Piece *p = pt->head; p; p = p->next) {
        total_len += p->length;
        piece_count++;
    }

    printf("=== Piece Table Debug ===\n");
    printf("Total Length: %zu chars | Total Pieces: %zu\n", total_len, piece_count);

    const Piece *curr = pt->head;
    const Piece *expected_prev = NULL;
    size_t idx = 0;

    while (curr) {
        const char *src_name = (curr->buffer == BUFFER_ORIGINAL) ? "ORIGINAL" : "ADD";
        const char *src_buf = (curr->buffer == BUFFER_ORIGINAL)
                                ? pt->original_buf
                                : pt->add_buf.data;

        bool prev_ok = (curr->prev == expected_prev);
        bool next_ok = (curr->next == NULL) ? (curr == pt->tail) : (curr->next->prev == curr);

        const char *prev_status = prev_ok ? (curr->prev ? "OK" : "NULL (Head)") : "INVALID";
        const char *next_status = next_ok ? (curr->next ? "OK" : "NULL (Tail)") : "INVALID";

        printf("[Piece %zu] SRC: %s | Offset: %zu | Len: %zu | Text: \"%.*s\" | Prev: %s | Next: %s\n",
               idx,
               src_name,
               curr->offset,
               curr->length,
               (int)curr->length,
               (src_buf ? src_buf + curr->offset : ""),
               prev_status,
               next_status);

        expected_prev = curr;
        curr = curr->next;
        idx++;
    }
    printf("=========================\n");
}

char *piece_table_render(const PieceTable *pt, size_t *out_len) {
    if (!pt) {
        return NULL;
    }

    size_t total_len = 0;
    const Piece *p = pt->head;
    while (p) {
        total_len += p->length;
        p = p->next;
    }

    char *result = (char *)malloc(total_len + 1);
    if (!result) {
        return NULL;
    }

    size_t current_pos = 0;
    p = pt->head;
    while (p) {
        const char *src = (p->buffer == BUFFER_ORIGINAL)
                            ? pt->original_buf + p->offset
                            : pt->add_buf.data + p->offset;
        memcpy(result + current_pos, src, p->length);
        current_pos += p->length;
        p = p->next;
    }
    result[total_len] = '\0';

    if (out_len) {
        *out_len = total_len;
    }
    return result;
}

void piece_table_free(PieceTable *pt) {
    if (!pt) {
        return;
    }

    free_piece_list(pt->head);
    pt->head = NULL;
    pt->tail = NULL;

    Action *act = pt->history_head;
    while (act) {
        Action *next = act->next;
        free_action(act);
        act = next;
    }
    pt->history_head = NULL;
    pt->history_tail = NULL;
    pt->current_action = NULL;

    free(pt->add_buf.data);
    pt->add_buf.data = NULL;
    pt->add_buf.length = 0;
    pt->add_buf.capacity = 0;
}

size_t piece_table_extract_active_prefix(const PieceTable *pt, size_t cursor,
                                         char *out_buf, size_t max_buf_size) {
    if (!pt || cursor == 0 || max_buf_size <= 1) {
        if (out_buf && max_buf_size > 0) {
            out_buf[0] = '\0';
        }
        return 0;
    }

    size_t offset_in_piece = 0;
    Piece *piece = find_piece_at_index((PieceTable *)pt, cursor - 1, &offset_in_piece);
    if (!piece) {
        if (out_buf && max_buf_size > 0) {
            out_buf[0] = '\0';
        }
        return 0;
    }

    char temp[256];
    size_t count = 0;
    Piece *curr = piece;
    long pos = (long)offset_in_piece;
    if (pos >= (long)curr->length) {
        pos = (long)curr->length - 1;
    }

    while (curr && count < sizeof(temp) - 1 && count < max_buf_size - 1) {
        const char *base = (curr->buffer == BUFFER_ORIGINAL)
                           ? pt->original_buf
                           : pt->add_buf.data;
        while (pos >= 0 && count < sizeof(temp) - 1 && count < max_buf_size - 1) {
            char c = base[curr->offset + (size_t)pos];
            if (!isalnum((unsigned char)c)) {
                goto scan_done;
            }
            temp[count++] = c;
            pos--;
        }
        curr = curr->prev;
        if (curr) {
            pos = (long)curr->length - 1;
        }
    }

scan_done:
    for (size_t i = 0; i < count; i++) {
        out_buf[i] = temp[count - 1 - i];
    }
    out_buf[count] = '\0';
    return count;
}
