#!/bin/bash
JSON_DIR=/home/z/my-project/tmp/logos/json
mkdir -p "$JSON_DIR"
search() {
  local slug="$1"; local query="$2"
  if [ -s "$JSON_DIR/$slug.json" ]; then echo "skip $slug"; return; fi
  z-ai image-search -q "$query" --count 4 --gl us --no-rank -o "$JSON_DIR/$slug.json" >/dev/null 2>&1
  echo "done $slug"
}
export -f search
export JSON_DIR
LIST=$(cat <<'EOT'
fa-cup|FA Cup England official logo
copa-del-rey|Copa del Rey official trophy logo
coppa-italia|Coppa Italia official trophy logo
dfb-pokal|DFB Pokal official trophy logo
coupe-de-france|Coupe de France football official logo
EOT
)
echo "$LIST" | xargs -P 5 -I{} bash -c 'IFS="|" read -r slug query <<< "{}"; search "$slug" "$query"'
echo CUPS_DONE
