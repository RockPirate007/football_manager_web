#!/bin/bash
# Поиск логотипов клубов и турниров через z-ai image-search (параллельно)
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

# slug|запрос
LIST=$(cat <<'EOF'
manchester-city|Manchester City FC official club crest logo
arsenal|Arsenal FC official club crest logo
liverpool|Liverpool FC official club crest logo
chelsea|Chelsea FC official club crest logo
manchester-united|Manchester United FC official club crest logo
tottenham|Tottenham Hotspur official club crest logo
newcastle|Newcastle United official club crest logo
aston-villa|Aston Villa FC official club crest logo
brighton|Brighton and Hove Albion official club crest logo
west-ham|West Ham United official club crest logo
real-madrid|Real Madrid CF official club crest logo
barcelona|FC Barcelona official club crest logo
atletico-madrid|Atletico de Madrid official club crest logo
athletic-bilbao|Athletic Club Bilbao official crest logo
real-sociedad|Real Sociedad official club crest logo
villarreal|Villarreal CF official club crest logo
betis|Real Betis Balompie official club crest logo
girona|Girona FC official club crest logo
sevilla|Sevilla FC official club crest logo
valencia|Valencia CF official club crest logo
inter|Inter Milan FC official club crest logo
milan|AC Milan official club crest logo
juventus|Juventus FC official club crest logo
napoli|SSC Napoli official club crest logo
atalanta|Atalanta BC official club crest logo
roma|AS Roma official club crest logo
lazio|SS Lazio official club crest logo
fiorentina|ACF Fiorentina official club crest logo
bologna|Bologna FC official club crest logo
torino|Torino FC official club crest logo
bayern-munich|FC Bayern Munich official club crest logo
bayer-leverkusen|Bayer 04 Leverkusen official club crest logo
borussia-dortmund|Borussia Dortmund official club crest logo
rb-leipzig|RB Leipzig official club crest logo
stuttgart|VfB Stuttgart official club crest logo
eintracht-frankfurt|Eintracht Frankfurt official club crest logo
wolfsburg|VfL Wolfsburg official club crest logo
freiburg|SC Freiburg official club crest logo
gladbach|Borussia Monchengladbach official club crest logo
hoffenheim|TSG Hoffenheim official club crest logo
psg|Paris Saint-Germain FC official club crest logo
monaco|AS Monaco FC official club crest logo
marseille|Olympique de Marseille official club crest logo
lille|LOSC Lille official club crest logo
lyon|Olympique Lyonnais official club crest logo
nice|OGC Nice official club crest logo
lens|RC Lens official club crest logo
rennes|Stade Rennais FC official club crest logo
brest|Stade Brestois 29 official club crest logo
strasbourg|RC Strasbourg Alsace official club crest logo
premier-league|English Premier League official logo
la-liga|LaLiga Spanish league official logo
serie-a|Serie A Italy league official logo
bundesliga|Bundesliga Germany league official logo
ligue-1|Ligue 1 France league official logo
ucl|UEFA Champions League official starball logo
EOF
)

echo "$LIST" | xargs -P 6 -I{} bash -c 'IFS="|" read -r slug query <<< "{}"; search "$slug" "$query"'
echo ALL_SEARCH_DONE
