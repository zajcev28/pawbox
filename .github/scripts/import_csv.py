#!/usr/bin/env python3
"""
GitHub Actions: importuje pliki CSV z folderów cat/ i dog/ do Supabase.
Używa service_role key — działa z pominięciem RLS.
"""

import os
import csv
import json
import re
import requests
from pathlib import Path

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # service_role, nie anon!

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",  # upsert po nazwie
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def clean(v):
    if v is None: return None
    v = str(v).strip()
    return v if v else None

def parse_price(v):
    if not v: return None
    try:
        return float(re.search(r"[\d.,]+", v.replace(",", "."))[0])
    except:
        return None

def detect_species(nazwa: str, folder: str) -> str:
    n = nazwa.lower()
    if folder == "dog": return "dog"
    if folder == "cat": return "cat"
    if "dla psa i kota" in n: return "both"
    if "dla psa" in n or "szczeniąt" in n or "puppy" in n: return "dog"
    return "cat"

def detect_food_type(nazwa: str, wilgotnosc: str) -> str:
    try:
        w = float(str(wilgotnosc).replace("%","").replace(",","."))
        return "wet" if w > 20 else "dry"
    except:
        pass
    n = nazwa.lower()
    return "dry" if any(x in n for x in ["sucha","suche","granul"]) else "wet"

def analyze_ingredients(sklad: str):
    if not sklad:
        return True, [], None
    s = sklad.lower()
    grains = ["pszenica","kukurydza","ryż","gluten","owies","jęczmień","żyto","mąka zbożowa"]
    is_grain_free = not any(g in s for g in grains)
    protein_map = {
        "chicken": ["kurczak","drób"],
        "salmon":  ["łosoś"],
        "beef":    ["wołowina"],
        "lamb":    ["jagnięcina","jagnięce"],
        "pork":    ["wieprzowina"],
        "rabbit":  ["królik"],
        "tuna":    ["tuńczyk"],
        "turkey":  ["indyk"],
    }
    proteins = [k for k, words in protein_map.items() if any(w in s for w in words)]
    m = re.search(r"(\d+)[,.]?\d*%\s*(mięso|kurczak|łosoś|wołowina|indyk|jagnięcina|królik|wieprzowina)", s)
    meat_percent = int(m.group(1)) if m else None
    return is_grain_free, proteins, meat_percent

def row_to_product(row: dict, folder: str) -> dict:
    nazwa = clean(row.get("Nazwa","")) or ""
    sklad = clean(row.get("Skład","")) or clean(row.get("Sklad","")) or ""
    wilg  = clean(row.get("Wilgotność","")) or clean(row.get("Wilgotnosc","")) or ""
    is_gf, proteins, meat_pct = analyze_ingredients(sklad)

    return {
        "nazwa":        nazwa[:200],
        "cena":         parse_price(row.get("Cena","")),
        "bialko":       clean(row.get("Białko",""))  or clean(row.get("Bialko","")),
        "tluszcz":      clean(row.get("Tłuszcz","")) or clean(row.get("Tluszcz","")),
        "wlokno":       clean(row.get("Włókno",""))  or clean(row.get("Wlokno","")),
        "wilgotnosc":   clean(wilg),
        "energia":      clean(row.get("Energia","")),
        "sklad":        sklad[:3000] if sklad else None,
        "opis":         (clean(row.get("Opis","")) or "")[:2000] or None,
        "species":      detect_species(nazwa, folder),
        "food_type":    detect_food_type(nazwa, wilg),
        "is_grain_free": is_gf,
        "proteins":     proteins,
        "meat_percent": meat_pct,
    }

# ─── Supabase upsert ──────────────────────────────────────────────────────────

def upsert_batch(products: list[dict]) -> tuple[int, int]:
    """Wstaw lub zaktualizuj partię produktów. Zwraca (ok, errors)."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/products",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"},
        json=products,
        timeout=30,
    )
    if r.status_code in (200, 201):
        return len(products), 0
    else:
        print(f"  ⚠ Błąd {r.status_code}: {r.text[:200]}")
        return 0, len(products)

def delete_by_species(species: str):
    """Usuń stare produkty danego gatunku przed reimportem."""
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/products?species=eq.{species}",
        headers=HEADERS,
        timeout=15,
    )
    print(f"  🗑  Usunięto stare produkty species={species}: HTTP {r.status_code}")

# ─── Główna logika ────────────────────────────────────────────────────────────

def process_folder(folder: str) -> int:
    path = Path(folder)
    csv_files = list(path.glob("*.csv"))
    if not csv_files:
        print(f"  Brak plików CSV w /{folder}")
        return 0

    all_products = []
    for csv_file in csv_files:
        print(f"  📄 Przetwarzam: {csv_file.name}")
        try:
            with open(csv_file, newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    p = row_to_product(row, folder)
                    if p["nazwa"]:
                        all_products.append(p)
        except Exception as e:
            print(f"  ✗ Błąd odczytu {csv_file.name}: {e}")

    if not all_products:
        return 0

    print(f"  Znaleziono {len(all_products)} produktów — importuję...")

    # Usuń stare dane tego gatunku
    species_in_folder = "cat" if folder == "cat" else "dog"
    delete_by_species(species_in_folder)
    if folder == "cat":
        delete_by_species("both")  # produkty shared też odśwież

    # Wstawiaj partiami po 200
    total_ok = 0
    total_err = 0
    for i in range(0, len(all_products), 200):
        batch = all_products[i:i+200]
        ok, err = upsert_batch(batch)
        total_ok += ok
        total_err += err
        print(f"  Batch {i//200 + 1}: {ok} OK, {err} błędów")

    return total_ok


def main():
    print("=" * 55)
    print("  🐾  PawBox — Import CSV → Supabase")
    print("=" * 55)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("✗ Brak SUPABASE_URL lub SUPABASE_SERVICE_KEY w secrets!")
        exit(1)

    # Sprawdź jakie foldery mają zmienione pliki (przez git diff)
    changed = os.environ.get("CHANGED_FILES", "")
    folders_to_process = set()

    if "cat/" in changed or not changed:
        folders_to_process.add("cat")
    if "dog/" in changed or not changed:
        folders_to_process.add("dog")

    # Fallback: przetwórz wszystko
    if not folders_to_process:
        folders_to_process = {"cat", "dog"}

    total = 0
    for folder in sorted(folders_to_process):
        if Path(folder).exists():
            print(f"\n📂 Folder: /{folder}")
            n = process_folder(folder)
            total += n
            print(f"  ✅ Zaimportowano: {n} produktów")
        else:
            print(f"\n📂 /{folder} — folder nie istnieje, pomijam")

    print(f"\n{'='*55}")
    print(f"  GOTOWE: {total} produktów zaimportowanych do Supabase")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
