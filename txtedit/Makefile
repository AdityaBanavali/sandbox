CC ?= clang
CFLAGS ?= -Wall -Wextra -pedantic -std=c99 -O2 -g

COMMON_OBJS = piece_table.o trie.o
TARGETS = search_repl piece_table_repl

EMCC ?= $(shell which emcc 2>/dev/null || echo "/opt/homebrew/bin/emcc")
WASM_FLAGS = -O2 \
             -s MODULARIZE=1 \
             -s EXPORT_NAME=createEditor \
             -s EXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8 \
             -s ALLOW_MEMORY_GROWTH=1

.PHONY: all clean test wasm

all: $(TARGETS) wasm_api.o

search_repl: search_repl.o $(COMMON_OBJS)
	$(CC) $(CFLAGS) -o $@ $^

piece_table_repl: main.o piece_table.o
	$(CC) $(CFLAGS) -o $@ $^

wasm_api.o: wasm_api.c wasm_api.h piece_table.h trie.h
	$(CC) $(CFLAGS) -c wasm_api.c -o $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

piece_table.o: piece_table.c piece_table.h
trie.o: trie.c trie.h
main.o: main.c piece_table.h
search_repl.o: search_repl.c piece_table.h trie.h

test: test_integration.c $(COMMON_OBJS) wasm_api.o
	$(CC) $(CFLAGS) -fsanitize=address,undefined $(COMMON_OBJS) wasm_api.o test_integration.c -o test_runner
	./test_runner
	rm -f test_runner

wasm: piece_table.c trie.c wasm_api.c
	@mkdir -p web
	$(EMCC) $(WASM_FLAGS) piece_table.c trie.c wasm_api.c -o web/editor.js

clean:
	rm -f *.o $(TARGETS) test_runner web/editor.js web/editor.wasm
