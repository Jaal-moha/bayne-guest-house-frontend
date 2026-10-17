#!/usr/bin/env bash
set -Eeuo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ -n "${1:-}" ]] || { echo "Usage: $0 <built-image>" >&2; exit 2; }
exec python3 "$root_dir/deploy/manage.py" main --image "$1"
