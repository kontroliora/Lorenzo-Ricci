#!/usr/bin/env python3
"""
Run this script periodically to refresh the Instagram photos:
  python3 scripts/refresh-instagram.py

If Instagram is rate-limiting (429), wait a few hours and try again.
"""
import urllib.request, json, os, time, sys

BASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "instagram")
os.makedirs(BASE, exist_ok=True)

print("Fetching @ricciwatches latest 8 posts...")

req = urllib.request.Request(
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=ricciwatches",
    headers={
        "x-ig-app-id": "936619743392459",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://www.instagram.com/ricciwatches/",
    }
)

try:
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read())
except urllib.error.HTTPError as e:
    if e.code == 429:
        print("Rate limited (429). Wait a few hours and try again.")
    else:
        print(f"HTTP error: {e}")
    sys.exit(1)

edges = data["data"]["user"]["edge_owner_to_timeline_media"]["edges"]
ok = 0
for i, e in enumerate(edges[:8], 1):
    node = e["node"]
    url = node.get("display_url") or node.get("thumbnail_src")
    dest = os.path.join(BASE, f"ig{i}.jpg")
    try:
        r2 = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(r2, timeout=20) as resp:
            raw = resp.read()
        with open(dest, "wb") as f:
            f.write(raw)
        print(f"  ig{i}.jpg → {os.path.getsize(dest)//1024}KB  (shortcode: {node.get('shortcode', '')})")
        ok += 1
        time.sleep(0.3)
    except Exception as ex:
        print(f"  ig{i}: FAIL — {ex}")

print(f"\nDone: {ok}/8 photos updated in public/instagram/")
