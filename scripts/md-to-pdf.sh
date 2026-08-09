#!/usr/bin/env bash
# Markdown -> styled HTML -> PDF, via pandoc and headless Chrome.
# Uses Chrome's Skia/PDF renderer.
#
#   ./scripts/md-to-pdf.sh path/to/file.md
set -euo pipefail

SRC="${1:?usage: md-to-pdf.sh <file.md>}"
OUT="${SRC%.md}.pdf"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

cat > "$TMP/style.css" <<'CSS'
@page { size: A4; margin: 16mm 15mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font: 10.5pt/1.55 -apple-system, "Helvetica Neue", Arial, sans-serif;
  color: #14181d; max-width: none; margin: 0;
}
/* pandoc's standalone template emits its own title block above the document's real
   H1. We only want the one the markdown actually declares. */
h1.title, header#title-block-header { display: none; }
h1 { font-size: 21pt; letter-spacing: -0.02em; margin: 0 0 .3em; line-height: 1.2; }
h2 {
  font-size: 14pt; letter-spacing: -0.01em; margin: 1.7em 0 .5em;
  padding-bottom: .25em; border-bottom: 1.5px solid #d9dde3;
  break-after: avoid; page-break-after: avoid;
}
h3 { font-size: 11.5pt; margin: 1.3em 0 .4em; break-after: avoid; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
blockquote {
  margin: 1em 0; padding: .55em 1em; border-left: 3px solid #21bd4b;
  background: #f4faf6; color: #2f3742;
}
blockquote p { margin: .2em 0; }
code {
  font: 9pt/1.4 ui-monospace, "SF Mono", Menlo, monospace;
  background: #f1f3f5; padding: .12em .35em; border-radius: 3px;
}
pre {
  background: #14181d; color: #e6edf3; padding: .85em 1em; border-radius: 5px;
  font: 8.5pt/1.5 ui-monospace, "SF Mono", Menlo, monospace;
  overflow-x: auto; break-inside: avoid; page-break-inside: avoid;
}
pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
table {
  border-collapse: collapse; width: 100%; margin: .9em 0; font-size: 9.5pt;
  break-inside: avoid; page-break-inside: avoid;
}
th, td { border: 1px solid #d9dde3; padding: .42em .6em; text-align: left; vertical-align: top; }
th { background: #f1f3f5; font-weight: 600; }
hr { border: none; border-top: 1px solid #d9dde3; margin: 1.8em 0; }
a { color: #12993b; text-decoration: none; }
strong { font-weight: 650; }
ul, ol { padding-left: 1.3em; }
li { margin: .18em 0; }
CSS

pandoc "$SRC" \
  --standalone --from=gfm --to=html5 \
  --metadata title="$(basename "${SRC%.md}")" \
  --css=style.css \
  --output "$TMP/page.html"

cp "$TMP/style.css" "$TMP/style.css.bak" 2>/dev/null || true

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT" "file://$TMP/page.html" 2>/dev/null

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
