#!/usr/bin/env bash
# Claude Peryl Desktop Launcher Script for CachyOS / Arch Linux
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -f "$DIR/.venv/bin/python3" ]; then
    exec "$DIR/.venv/bin/python3" "$DIR/main.py" "$@"
else
    exec python3 "$DIR/main.py" "$@"
fi
