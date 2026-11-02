CC ?= clang
CFLAGS ?= -Wall -Wextra -pedantic -std=c99 -O2 -g -Isrc

SRC_DIR = src
CLI_DIR = cli
BUILD_DIR = build

COMMON_OBJS = $(BUILD_DIR)/piece_table.o $(BUILD_DIR)/trie.o
TARGETS = $(BUILD_DIR)/search_repl $(BUILD_DIR)/piece_table_repl

EMCC ?= $(shell which emcc 2>/dev/null || echo "/opt/homebrew/bin/emcc")
WASM_FLAGS = -O2 \
             -s MODULARIZE=1 \
             -s EXPORT_NAME=createEditor \
             -s EXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8 \
             -s ALLOW_MEMORY_GROWTH=1

.PHONY: all clean test wasm demo search_repl piece_table_repl

all: $(TARGETS) $(BUILD_DIR)/wasm_api.o

search_repl: $(BUILD_DIR)/search_repl
piece_table_repl: $(BUILD_DIR)/piece_table_repl

$(BUILD_DIR):
	@mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/search_repl: $(BUILD_DIR)/search_repl.o $(COMMON_OBJS) | $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $^

$(BUILD_DIR)/piece_table_repl: $(BUILD_DIR)/main.o $(BUILD_DIR)/piece_table.o | $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $^

$(BUILD_DIR)/piece_table.o: $(SRC_DIR)/piece_table.c $(SRC_DIR)/piece_table.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/trie.o: $(SRC_DIR)/trie.c $(SRC_DIR)/trie.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/wasm_api.o: $(SRC_DIR)/wasm_api.c $(SRC_DIR)/wasm_api.h $(SRC_DIR)/piece_table.h $(SRC_DIR)/trie.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/main.o: $(CLI_DIR)/main.c $(SRC_DIR)/piece_table.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/search_repl.o: $(CLI_DIR)/search_repl.c $(SRC_DIR)/piece_table.h $(SRC_DIR)/trie.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

test: $(COMMON_OBJS) $(BUILD_DIR)/wasm_api.o $(CLI_DIR)/test_integration.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -fsanitize=address,undefined $(COMMON_OBJS) $(BUILD_DIR)/wasm_api.o $(CLI_DIR)/test_integration.c -o $(BUILD_DIR)/test_runner
	./$(BUILD_DIR)/test_runner
	rm -f $(BUILD_DIR)/test_runner

wasm: $(SRC_DIR)/piece_table.c $(SRC_DIR)/trie.c $(SRC_DIR)/wasm_api.c
	@mkdir -p web
	$(EMCC) $(WASM_FLAGS) -I$(SRC_DIR) $^ -o web/editor.js

demo: $(BUILD_DIR)/piece_table_repl
	./demo/run_demo.sh

clean:
	rm -rf $(BUILD_DIR) test_runner web/editor.js web/editor.wasm
