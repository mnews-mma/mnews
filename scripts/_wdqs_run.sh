#!/bin/bash
# Ad-hoc helper for the W-1 Wikidata coverage audit. Run from repo root.
# Usage: bash scripts/_wdqs_run.sh <output-basename> <sparql-query>
set -euo pipefail
NAME="$1"
QUERY="$2"
UA='mnews-wikidata-audit/1.0 (kaina.k.07@gmail.com; readonly one-off coverage audit)'
curl -s -G 'https://query.wikidata.org/sparql' \
  --data-urlencode "query=${QUERY}" \
  -H 'Accept: application/sparql-results+json' \
  -A "${UA}" \
  -o "out/wdqs-cache/${NAME}.json" \
  -w "  [${NAME}] HTTP_STATUS:%{http_code}\n"
