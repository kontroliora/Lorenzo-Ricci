Self-hosted fonts (no request to Google Fonts at build or at run time).

Inter-latin-cyrillic.woff2            Inter 4 (SIL OFL 1.1) - https://github.com/google/fonts/tree/main/ofl/inter
                                      variable font, wght 300-600, opsz pinned at 14 (what the Google Fonts CSS API serves by default)
PlayfairDisplay-latin-cyrillic.woff2  Playfair Display (SIL OFL 1.1) - https://github.com/google/fonts/tree/main/ofl/playfairdisplay
                                      variable font, wght 400-700

Both are cut (fonttools: varLib.instancer + pyftsubset) to Basic Latin, Latin-1, Latin Extended A/B (Romanian ă â î ș ț), Cyrillic,
general punctuation, € № ™ arrows, minus and the maths signs the shop uses. If a new character is ever missing, rebuild from the
sources above with the same unicode list - do not switch back to next/font/google (its build-time fetch fails at random).
