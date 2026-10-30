CC ?= clang
CFLAGS ?= -Wall -Wextra -pedantic -std=c99 -O2 -g

OBJS = piece_table.o trie.o search_repl.o
TARGET = search_repl

.PHONY: all clean test_build

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

piece_table.o: piece_table.c piece_table.h
trie.o: trie.c trie.h
search_repl.o: search_repl.c piece_table.h trie.h

test: test_integration.c piece_table.c trie.c
	$(CC) $(CFLAGS) -fsanitize=address,undefined piece_table.c trie.c test_integration.c -o test_runner
	./test_runner
	rm -f test_runner

clean:
	rm -f $(OBJS) $(TARGET) test_runner
