Self-hosted fonts (no request to Google Fonts at build or at run time).

Inter-latin-cyrillic.woff2            Inter 4 (SIL OFL 1.1) - https://github.com/google/fonts/tree/main/ofl/inter
                                      variable font, wght 300-600, opsz pinned at 14 (what the Google Fonts CSS API serves by default)
PlayfairDisplay-latin-cyrillic.woff2  Playfair Display (SIL OFL 1.1) - https://github.com/google/fonts/tree/main/ofl/playfairdisplay
                                      variable font, wght 400-700

Both are cut with fonttools (varLib.instancer + pyftsubset). 29.10.2026: cut again to what the shop actually prints, because on
mobile 4G the two files (108 + 89 KB) were the largest thing loading before the product photo (Lighthouse LCP 4.2 -> 3.0 s):
Inter 108 -> 51 KB, Playfair 89 -> 48 KB. Rebuild with exactly this list and these features:

  pyftsubset <font> --flavor=woff2 \
    --unicodes="U+0020-007E,U+00A0-00FF,U+0102-0103,U+015E-015F,U+0162-0163,U+0218-021B,U+0300-0304,U+0400-045F,U+2010-2027,U+2030-203A,U+2044,U+20AC,U+2116,U+2122,U+2190-2193,U+2212,U+2248,U+2264-2265" \
    --layout-features="calt,ccmp,clig,dnom,frac,kern,liga,locl,mark,mkmk,numr,rlig,rvrn,tnum"

= Basic Latin, Latin-1, Romanian (ă â î ș ț, plus the cedilla forms ş ţ people still type), all basic Cyrillic (Bulgarian, Russian,
Ukrainian, Serbian), punctuation, € № ™ arrows, minus and the maths signs the shop uses. tnum stays (tailwind tabular-nums is used);
the stylistic sets/alternates (cv01-13, ss01-08, small caps, old-style figures) are dropped because nothing uses them.
A character outside the list is not lost: the browser draws just that character in the next font of the stack (Arial / Times).
Symbols such as ★ ✓ and emoji were never in these files. Do not switch back to next/font/google (its build-time fetch fails at random).
