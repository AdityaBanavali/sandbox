#!/usr/bin/env bash
set -e

echo "=== 1. Building Project ==="
make clean
make

echo ""
echo "=== 2. Running Memory & Integration Tests (AddressSanitizer) ==="
make test

echo ""
echo "=== 3. Running Batch Command Test ==="
clang -Wall -Wextra -O2 main.c piece_table.c -o piece_table_repl
./piece_table_repl < commands.txt > output.txt
echo "Batch output generated in output.txt:"
cat output.txt

echo ""
echo "=== 4. Launching Interactive Real-Time Search REPL ==="
echo "Run './search_repl' in an interactive terminal to use real-time autocomplete."
