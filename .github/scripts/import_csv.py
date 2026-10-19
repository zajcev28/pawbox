#!/usr/bin/env python3
"""
GitHub Actions: importuje pliki CSV z folderów cat/ i dog/ do Supabase.

Zasady (od migracji 20261019):
  - UPSERT po kolumnie `nazwa` — istniejące produkty zachowują swoje id,
    więc subskrypcje klientów nadal wskazują na właściwe karmy.
  - Produkty, których nie ma już w CSV, dostają is_active=false (nie są kasowane).
  - Bezpiecznik: jeśli CSV ma mniej niż MIN_RATIO obecnie aktywnych produktów
    (np. scraper się przerwał), wyłączanie jest pomijane. Wymuś: FORCE_DEACTIVATE=1.
  - Jakikolwiek błąd zapisu → nic nie jest wyłączane, a job kończy się błędem.

Lokalny test bez bazy:  python3 .github/scripts/import_csv.py --dry-run
"""

import csv
import os
import re
import sys
from pathlib import Path

BATCH_SIZE = 200
MIN_RATIO = 0.5
FOLDERS = {"cat": "cat", "dog": "dog"}
GRAINS = ["pszenica", "kukurydza", "ryż", "gluten", "owies", "jęczmień", "żyto", "mąka zbożowa"]
PROTEIN_MAP = {
    "chicken": ["kurczak", "drób"],
    "salmon":  ["łosoś"],
    "beef":    ["wołowina"],
    "lamb":    ["jagnięcina", "jagnięce"],
    "pork":    ["wieprzowina"],
    "rabbit":  ["królik"],
    "tuna":    ["tuńczyk"],
    "turkey":  ["indyk"],
}

DRY_RUN = "--dry-run" in sys.argv


# ─── Parsowanie wierszy ───────────────────────────────────────────────────────

def clean(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def parse_price(v):
    m = re.search(r"\d+(?:[.,]\d+)?", str(v or ""))
    return float(m.group(0).replace(",", ".")) if m else None


def detect_species(row: dict, nazwa: str, folder_species: str) -> str:
    n = nazwa.lower()
    if "dla psa i kota" in n:
        return "both"
    declared = (clean(row.get("species")) or "").lower()
    if declared in ("cat", "dog", "both"):
        return declared
    return folder_species


def detect_food_type(row: dict, nazwa: str, wilgotnosc: str) -> str:
    declared = (clean(row.get("food_type")) or "").lower()
    if declared in ("dry", "wet"):
        return declared
    try:
        return "wet" if float(str(wilgotnosc).replace("%", "").replace(",", ".")) > 20 else "dry"
    except ValueError:
        pass
    return "dry" if any(x in nazwa.lower() for x in ("sucha", "suche", "granul")) else "wet"


def analyze_ingredients(sklad: str):
    if not sklad:
        return True, [], None
    s = sklad.lower()
    is_grain_free = not any(g in s for g in GRAINS)
    proteins = [k for k, words in PROTEIN_MAP.items() if any(w in s for w in words)]
    m = re.search(r"(\d+)[,.]?\d*%\s*(mięso|kurczak|łosoś|wołowina|indyk|jagnięcina|królik|wieprzowina)", s)
    return is_grain_free, proteins, int(m.group(1)) if m else None


def row_to_product(row: dict, folder_species: str) -> dict:
    nazwa = (clean(row.get("Nazwa")) or "")[:200]
    sklad = clean(row.get("Skład")) or clean(row.get("Sklad")) or ""
    wilg = clean(row.get("Wilgotność")) or clean(row.get("Wilgotnosc")) or ""
    is_gf, proteins, meat_pct = analyze_ingredients(sklad)
    return {
        "nazwa":         nazwa,
        "cena":          parse_price(row.get("Cena")),
        "bialko":        clean(row.get("Białko")) or clean(row.get("Bialko")),
        "tluszcz":       clean(row.get("Tłuszcz")) or clean(row.get("Tluszcz")),
        "wlokno":        clean(row.get("Włókno")) or clean(row.get("Wlokno")),
        "wilgotnosc":    wilg or None,
        "energia":       clean(row.get("Energia")),
        "sklad":         sklad[:3000] or None,
        "opis":          (clean(row.get("Opis")) or "")[:2000] or None,
        "species":       detect_species(row, nazwa, folder_species),
        "food_type":     detect_food_type(row, nazwa, wilg),
        "is_grain_free": is_gf,
        "proteins":      proteins,
        "meat_percent":  meat_pct,
        "is_active":     True,
    }


def read_folder(folder: str, folder_species: str) -> dict:
    """Zwraca {nazwa: produkt}. Przy powtórzonej nazwie wygrywa ostatni wiersz."""
    products = {}
    for csv_file in sorted(Path(folder).glob("*.csv")):
        with open(csv_file, newline="", encoding="utf-8-sig") as f:
            rows = 0
            for row in csv.DictReader(f):
                p = row_to_product(row, folder_species)
                if p["nazwa"]:
                    products[p["nazwa"]] = p
                    rows += 1
        print(f"  📄 {csv_file.name}: {rows} wierszy")
    return products


# ─── Supabase ─────────────────────────────────────────────────────────────────

class Supabase:
    def __init__(self, url: str, key: str):
        import requests
        self.http = requests.Session()
        self.base = f"{url.rstrip('/')}/rest/v1"
        self.http.headers.update({
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        })

    def upsert(self, batch: list) -> None:
        r = self.http.post(
            f"{self.base}/products",
            params={"on_conflict": "nazwa"},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json=batch,
            timeout=60,
        )
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"upsert HTTP {r.status_code}: {r.text[:300]}")

    def active_products(self, species: list) -> list:
        out, start, step = [], 0, 1000
        while True:
            r = self.http.get(
                f"{self.base}/products",
                params={"select": "id,nazwa", "is_active": "eq.true",
                        "species": f"in.({','.join(species)})", "order": "id"},
                headers={"Range": f"{start}-{start + step - 1}"},
                timeout=60,
            )
            if r.status_code not in (200, 206):
                raise RuntimeError(f"select HTTP {r.status_code}: {r.text[:300]}")
            page = r.json()
            out += page
            if len(page) < step:
                return out
            start += step

    def deactivate(self, ids: list) -> None:
        for i in range(0, len(ids), 100):
            chunk = ids[i:i + 100]
            r = self.http.patch(
                f"{self.base}/products",
                params={"id": f"in.({','.join(chunk)})"},
                headers={"Prefer": "return=minimal"},
                json={"is_active": False},
                timeout=60,
            )
            if r.status_code not in (200, 204):
                raise RuntimeError(f"deactivate HTTP {r.status_code}: {r.text[:300]}")


# ─── Główna logika ────────────────────────────────────────────────────────────

def process_folder(db, folder: str, folder_species: str) -> bool:
    products = read_folder(folder, folder_species)
    if not products:
        print("  Brak plików CSV lub wierszy — pomijam (nic nie wyłączam)")
        return True

    items = list(products.values())
    species_seen = sorted({p["species"] for p in items})
    print(f"  {len(items)} unikalnych produktów, gatunki: {', '.join(species_seen)}")

    if DRY_RUN:
        sample = items[0]
        print(f"  [dry-run] przykład: {sample['nazwa'][:60]} | {sample['species']} | "
              f"{sample['food_type']} | {sample['cena']} zł | bezzbożowa={sample['is_grain_free']}")
        return True

    # 1. Upsert — przy błędzie przerywamy, zanim cokolwiek zostanie wyłączone
    for i in range(0, len(items), BATCH_SIZE):
        db.upsert(items[i:i + BATCH_SIZE])
        print(f"  ✓ upsert {min(i + BATCH_SIZE, len(items))}/{len(items)}")

    # 2. Wyłącz produkty tych gatunków, których nie ma w CSV
    active = db.active_products(species_seen)
    missing = [p["id"] for p in active if p["nazwa"] not in products]
    if not missing:
        print("  Nic do wyłączenia")
        return True

    remaining = len(active) - len(missing)
    if remaining < len(active) * MIN_RATIO and os.environ.get("FORCE_DEACTIVATE") != "1":
        print(f"  ⚠ Bezpiecznik: CSV pokrywa tylko {remaining}/{len(active)} aktywnych produktów. "
              f"Pomijam wyłączanie {len(missing)} pozycji (ustaw FORCE_DEACTIVATE=1, żeby wymusić).")
        return True

    db.deactivate(missing)
    print(f"  ⏸  Wyłączono {len(missing)} produktów, których nie ma już w CSV")
    return True


def main() -> int:
    print("=" * 55)
    print("  🐾  PawBox — Import CSV → Supabase" + ("  [DRY RUN]" if DRY_RUN else ""))
    print("=" * 55)

    db = None
    if not DRY_RUN:
        url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            print("✗ Brak SUPABASE_URL lub SUPABASE_SERVICE_KEY w secrets")
            return 1
        db = Supabase(url, key)

    failed = False
    for folder, species in FOLDERS.items():
        print(f"\n📂 /{folder}")
        if not Path(folder).is_dir():
            print("  folder nie istnieje — pomijam")
            continue
        try:
            process_folder(db, folder, species)
        except Exception as e:  # noqa: BLE001 — chcemy zalogować i oznaczyć job jako nieudany
            print(f"  ✗ {e}")
            failed = True

    print("\n" + ("✗ Import zakończony z błędami" if failed else "✅ Import zakończony"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
