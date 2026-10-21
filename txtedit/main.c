#include "piece_table.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define LINE_BUFFER_SIZE 4096

static void trim_trailing_whitespace(char *str) {
    size_t len = strlen(str);
    while (len > 0 && isspace((unsigned char)str[len - 1])) {
        str[--len] = '\0';
    }
}

int main(void) {
    PieceTable pt;
    if (!piece_table_init(&pt, "", 0)) {
        fprintf(stderr, "Failed to initialize piece table.\n");
        return 1;
    }

    char line[LINE_BUFFER_SIZE];

    while (1) {
        printf("> ");
        fflush(stdout);

        if (!fgets(line, sizeof(line), stdin)) {
            break;
        }

        /* Strip trailing newlines and carriage returns */
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) {
            line[--len] = '\0';
        }

        /* Skip leading whitespace and accidental '>' prompt prefixes */
        char *p = line;
        while (*p && (isspace((unsigned char)*p) || *p == '>')) {
            p++;
        }

        /* Ignore empty lines */
        if (*p == '\0') {
            continue;
        }

        /* Check for exit */
        if (strncmp(p, "exit", 4) == 0) {
            char *rest = p + 4;
            while (*rest && isspace((unsigned char)*rest)) {
                rest++;
            }
            if (*rest == '\0') {
                break;
            }
        }

        /* Check for print */
        if (strncmp(p, "print", 5) == 0) {
            char *rest = p + 5;
            while (*rest && isspace((unsigned char)*rest)) {
                rest++;
            }
            if (*rest == '\0') {
                size_t out_len = 0;
                char *rendered = piece_table_render(&pt, &out_len);
                if (rendered) {
                    printf("%s", rendered);
                    if (out_len == 0 || rendered[out_len - 1] != '\n') {
                        printf("\n");
                    }
                    free(rendered);
                } else {
                    printf("\n");
                }
                fflush(stdout);
                continue;
            }
        }

        /* Check for undo */
        if (strncmp(p, "undo", 4) == 0) {
            char *rest = p + 4;
            while (*rest && isspace((unsigned char)*rest)) {
                rest++;
            }
            if (*rest == '\0') {
                piece_table_undo(&pt);
                continue;
            }
        }

        /* Check for redo */
        if (strncmp(p, "redo", 4) == 0) {
            char *rest = p + 4;
            while (*rest && isspace((unsigned char)*rest)) {
                rest++;
            }
            if (*rest == '\0') {
                piece_table_redo(&pt);
                continue;
            }
        }

        /* Check for debug */
        if (strncmp(p, "debug", 5) == 0) {
            char *rest = p + 5;
            while (*rest && isspace((unsigned char)*rest)) {
                rest++;
            }
            if (*rest == '\0') {
                piece_table_debug(&pt);
                continue;
            }
        }

        /* Check for delete <idx> <len> */
        if (strncmp(p, "delete", 6) == 0 && isspace((unsigned char)p[6])) {
            p += 6;
            while (*p && isspace((unsigned char)*p)) {
                p++;
            }

            char *endptr1 = NULL;
            unsigned long idx = strtoul(p, &endptr1, 10);
            if (p == endptr1) {
                fprintf(stderr, "Usage: delete <idx> <len>\n");
                continue;
            }

            p = endptr1;
            while (*p && isspace((unsigned char)*p)) {
                p++;
            }

            char *endptr2 = NULL;
            unsigned long dlen = strtoul(p, &endptr2, 10);
            if (p == endptr2) {
                fprintf(stderr, "Usage: delete <idx> <len>\n");
                continue;
            }

            piece_table_delete(&pt, (size_t)idx, (size_t)dlen);
            continue;
        }

        /* Check for insert <idx> <text> */
        if (strncmp(p, "insert", 6) == 0 && isspace((unsigned char)p[6])) {
            p += 6;
            while (*p && isspace((unsigned char)*p)) {
                p++;
            }

            char *endptr = NULL;
            unsigned long idx = strtoul(p, &endptr, 10);
            if (p == endptr) {
                fprintf(stderr, "Usage: insert <idx> <text>\n");
                continue;
            }

            p = endptr;
            if (*p && isspace((unsigned char)*p)) {
                p++; /* Skip single separator space; rest of line is captured as text */
            } else if (*p != '\0') {
                fprintf(stderr, "Usage: insert <idx> <text>\n");
                continue;
            }

            if (!insert_text(&pt, (size_t)idx, p)) {
                fprintf(stderr, "Error: failed to insert text at index %lu\n", idx);
            }
            continue;
        }

        /* Unknown command: trim trailing whitespace for clean error display */
        trim_trailing_whitespace(p);
        fprintf(stderr, "Unknown command: '%s'. Available commands: insert <idx> <text>, delete <idx> <len>, undo, redo, print, debug, exit\n", p);
    }

    piece_table_free(&pt);
    return 0;
}
