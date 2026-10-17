#!/usr/bin/env bash
set -Eeuo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ -n "${1:-}" ]] || { echo "Usage: $0 <pr-number>" >&2; exit 2; }
exec python3 "$root_dir/deploy/manage.py" remove-preview --pr "$1"
