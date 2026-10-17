#!/usr/bin/env bash
set -Eeuo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ -n "${1:-}" && -n "${2:-}" ]] || { echo "Usage: $0 <pr-number> <built-image>" >&2; exit 2; }
exec python3 "$root_dir/deploy/manage.py" preview --pr "$1" --image "$2"
