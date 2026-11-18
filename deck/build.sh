#!/usr/bin/env bash
# Rebuild the solution deck: fills the official template, then exports a PDF with the Outfit font embedded.
# Edit URL / TEAM / CAPABILITY at the top of build_deck.py first. Needs python3 and LibreOffice (soffice).
set -euo pipefail
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -q python-pptx lxml pillow; }
mkdir -p out lo_profile/user/fonts
cp fonts/*.ttf lo_profile/user/fonts/
.venv/bin/python build_deck.py template.pptx out/Zord-Wiqaya-Solution-Deck.pptx assets
PROFILE_URI=$(python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).resolve().as_uri())' lo_profile)
soffice "-env:UserInstallation=$PROFILE_URI" --headless --convert-to pdf --outdir out out/Zord-Wiqaya-Solution-Deck.pptx
ls -la out
