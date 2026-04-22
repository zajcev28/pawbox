# Struktura folderów karm

## Jak dodać nowe karmy

### Koty
Wrzuć plik CSV do folderu `/cat/`:
```
cat/
  karmy_suche.csv
  karmy_mokre.csv
  karmy_weterynaryjne.csv
```

### Psy
Wrzuć plik CSV do folderu `/dog/`:
```
dog/
  karmy_suche_psy.csv
  karmy_mokre_psy.csv
```

## Co się dzieje po push na GitHub

1. GitHub Actions wykrywa zmianę w `/cat/*.csv` lub `/dog/*.csv`
2. Uruchamia skrypt `import_csv.py`
3. Skrypt czyści stare dane danego gatunku w Supabase
4. Importuje nowe produkty partiami po 200
5. Wynik widoczny w zakładce Actions na GitHub

## Format CSV

Wymagane kolumny:
```
Nazwa, Cena, Białko, Tłuszcz, Włókno, Wilgotność, Energia, Skład, Opis
```

Opcjonalne (ale warto mieć):
```
Popiół, Wapń, Fosfor, Węglowodany
```

## Konfiguracja sekretów GitHub

W repozytorium → Settings → Secrets → Actions:

| Secret | Wartość |
|--------|---------|
| `SUPABASE_URL` | https://xxx.supabase.co |
| `SUPABASE_SERVICE_KEY` | eyJ... (service_role key, NIE anon!) |

> ⚠️ Używaj `service_role` key — tylko w GitHub Secrets, nigdy w kodzie frontendowym!
