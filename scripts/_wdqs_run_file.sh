#!/bin/bash
# Ad-hoc helper for the W-1 Wikidata coverage audit. POSTs a query read from a file
# (avoids URL length limits for large VALUES clauses). Run from repo root.
# Usage: bash scripts/_wdqs_run_file.sh <output-basename> <query-file>
set -euo pipefail
NAME="$1"
QFILE="$2"
UA='mnews-wikidata-audit/1.0 (kaina.k.07@gmail.com; readonly one-off coverage audit)'
curl -s -X POST 'https://query.wikidata.org/sparql' \
  --data-urlencode "query@${QFILE}" \
  -H 'Accept: application/sparql-results+json' \
  -A "${UA}" \
  -o "out/wdqs-cache/${NAME}.json" \
  -w "  [${NAME}] HTTP_STATUS:%{http_code}\n"
