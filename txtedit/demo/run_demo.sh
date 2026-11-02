#!/usr/bin/env bash
set -e

# Resolve repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/Makefile" ]; then
    REPO_ROOT="$SCRIPT_DIR"
else
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
cd "$REPO_ROOT"

echo "=== 1. Building Project ==="
make clean
make

echo ""
echo "=== 2. Running Memory & Integration Tests (AddressSanitizer) ==="
make test

echo ""
echo "=== 3. Running Batch Command Test ==="
./build/piece_table_repl < demo/commands.txt > demo/output.txt
echo "Batch output generated in demo/output.txt:"
cat demo/output.txt

echo ""
echo "=== 4. Launching Interactive Real-Time Search REPL ==="
echo "Run './build/search_repl' in an interactive terminal to use real-time autocomplete."
