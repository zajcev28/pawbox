#!/usr/bin/env python3
"""
PawBox Setup Script
Uruchom z dowolnego miejsca:  python3 setup_pawbox.py
Skrypt tworzy/nadpisuje pliki w ~/pawbox
"""

import os
import json
import subprocess
import sys
from pathlib import Path

PROJECT = Path.home() / "pawbox"

# ─── kolory terminala ───────────────────────────────────────────────────────
G = "\033[92m"; Y = "\033[93m"; R = "\033[91m"; B = "\033[94m"; E = "\033[0m"
def ok(msg):   print(f"{G}✓ {msg}{E}")
def info(msg): print(f"{B}→ {msg}{E}")
def warn(msg): print(f"{Y}⚠ {msg}{E}")
def err(msg):  print(f"{R}✗ {msg}{E}")

# ─── pomocnicze ─────────────────────────────────────────────────────────────
def write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    ok(f"Zapisano: {path.relative_to(PROJECT)}")

def run(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, cwd=cwd or PROJECT,
                            capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr

# ─── wykryj wersję Tailwind ─────────────────────────────────────────────────
def detect_tailwind_version():
    pkg = PROJECT / "node_modules" / "tailwindcss" / "package.json"
    if pkg.exists():
        data = json.loads(pkg.read_text())
        ver = data.get("version", "0")
        major = int(ver.split(".")[0])
        info(f"Wykryta wersja Tailwind: {ver}")
        return major
    # sprawdź package.json projektu
    pj = PROJECT / "package.json"
    if pj.exists():
        data = json.loads(pj.read_text())
        deps = {**data.get("dependencies",{}), **data.get("devDependencies",{})}
        spec = deps.get("tailwindcss","")
        if spec.startswith("^3") or spec.startswith("3"):
            return 3
        if spec.startswith("^4") or spec.startswith("4"):
            return 4
    warn("Nie wykryto Tailwinda — zostanie zainstalowany v3")
    return None

# ─── instalacja zależności ───────────────────────────────────────────────────
def install_deps(tw_major):
    info("Instaluję zależności npm...")
    base = (
        "@supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared "
        "react-router-dom papaparse react-dropzone lucide-react clsx tailwind-merge date-fns"
    )
    code, _, stderr = run(f"npm install {base}")
    if code != 0:
        err(f"npm install failed:\n{stderr}")
        sys.exit(1)
    ok("Zainstalowano zależności bazowe")

    code, _, _ = run("npm install --save-dev @types/papaparse")
    ok("Zainstalowano @types/papaparse")

    if tw_major == 4:
        info("Tailwind v4 — instaluję @tailwindcss/vite...")
        run("npm install --save-dev @tailwindcss/vite")
        ok("Tailwind v4 plugin gotowy")
    else:
        info("Instaluję Tailwind v3...")
        run("npm uninstall tailwindcss")
        code, _, stderr = run("npm install --save-dev tailwindcss@3 postcss autoprefixer")
        if code != 0:
            err(stderr); sys.exit(1)
        run("./node_modules/.bin/tailwindcss init -p")
        ok("Tailwind v3 zainstalowany i zainicjowany")

# ═══════════════════════════════════════════════════════════════════════════════
#  PLIKI PROJEKTU
# ═══════════════════════════════════════════════════════════════════════════════

def write_vite_config(tw_major):
    if tw_major == 4:
        content = """\
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
})
"""
    else:
        content = """\
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
"""
    write(PROJECT / "vite.config.ts", content)


def write_tailwind_config(tw_major):
    if tw_major == 4:
        # v4 nie używa tailwind.config.js — konfiguracja jest w CSS
        ok("Tailwind v4 — tailwind.config.js niepotrzebny")
        return
    content = """\
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0f7f3',
          100: '#d9ede2',
          500: '#2d7a50',
          600: '#1b5c3a',
          700: '#144830',
          800: '#0d3322',
        },
        cream:        '#FAF6EF',
        sand:         '#E8DFD0',
        terra:        '#C4622D',
        'terra-dark': '#9d4c22',
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
"""
    write(PROJECT / "tailwind.config.js", content)


def write_index_css(tw_major):
    if tw_major == 4:
        content = """\
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

:root {
  --color-forest-50:  #f0f7f3;
  --color-forest-100: #d9ede2;
  --color-forest-600: #1b5c3a;
  --color-forest-700: #144830;
  --color-cream:      #FAF6EF;
  --color-sand:       #E8DFD0;
  --color-terra:      #C4622D;
  --color-terra-dark: #9d4c22;
}

@layer base {
  body { background: var(--color-cream); font-family: 'DM Sans', system-ui, sans-serif; color: #1f2937; -webkit-font-smoothing: antialiased; }
  h1, h2, h3 { font-family: 'Lora', Georgia, serif; }
}

@layer components {
  .btn-primary  { @apply bg-[#C4622D] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#9d4c22] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed; }
  .btn-secondary{ @apply bg-white border-2 border-[#1b5c3a] text-[#1b5c3a] px-6 py-3 rounded-xl font-medium hover:bg-[#f0f7f3] transition-colors duration-200; }
  .card  { @apply bg-white rounded-2xl shadow-sm border border-[#E8DFD0] p-6; }
  .input { @apply w-full border border-[#E8DFD0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5c3a] bg-white placeholder-gray-400; }
}
"""
    else:
        content = """\
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body { @apply bg-cream font-sans text-gray-800 antialiased; }
  h1, h2, h3 { @apply font-serif; }
}

@layer components {
  .btn-primary   { @apply bg-terra text-white px-6 py-3 rounded-xl font-medium hover:bg-terra-dark transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed; }
  .btn-secondary { @apply bg-white border-2 border-forest-600 text-forest-600 px-6 py-3 rounded-xl font-medium hover:bg-forest-50 transition-colors duration-200; }
  .card  { @apply bg-white rounded-2xl shadow-sm border border-sand p-6; }
  .input { @apply w-full border border-sand rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white placeholder-gray-400; }
}
"""
    write(PROJECT / "src" / "index.css", content)


def write_gitignore():
    write(PROJECT / ".gitignore", """\
node_modules/
dist/
.env.local
.env
*.env
.DS_Store
""")


def write_env_example():
    write(PROJECT / ".env.example", """\
VITE_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=twoj_anon_public_key
""")
    env_local = PROJECT / ".env.local"
    if not env_local.exists():
        write(env_local, """\
VITE_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=twoj_anon_public_key
""")
        warn("Uzupełnij .env.local swoimi kluczami Supabase!")


def write_types():
    write(PROJECT / "src" / "types" / "index.ts", """\
export interface Product {
  id: string
  nazwa: string
  cena: number | null
  bialko: string | null
  tluszcz: string | null
  wlokno: string | null
  wilgotnosc: string | null
  energia: string | null
  sklad: string | null
  species: 'cat' | 'dog' | 'both'
  food_type: 'dry' | 'wet'
  is_grain_free: boolean
  proteins: string[]
  meat_percent: number | null
}

export interface Pet {
  id: string
  user_id: string
  name: string
  species: 'cat' | 'dog'
  breed?: string
  age_group: 'kitten' | 'adult' | 'senior'
  weight_kg: number
  activity_level: 'low' | 'medium' | 'high'
  health_conditions: string[]
  allergies: string[]
  food_type: 'dry' | 'wet' | 'mixed'
  avatar_url?: string
}

export interface PetProfile {
  name: string
  species: 'cat' | 'dog'
  age_group: 'kitten' | 'adult' | 'senior'
  weight_kg: number
  activity_level: 'low' | 'medium' | 'high'
  health_conditions: string[]
  allergies: string[]
  food_type: 'dry' | 'wet' | 'mixed'
}

export interface ScoredProduct extends Product {
  score: number
  reasons: string[]
  warnings: string[]
  daily_grams: number
  monthly_price_est: number
}

export interface Subscription {
  id: string
  user_id: string
  pet_id: string | null
  plan_type: 'starter' | 'comfort' | 'premium'
  status: 'active' | 'paused' | 'cancelled'
  delivery_frequency_days: number
  next_delivery_date: string | null
}

export interface SubscriptionItem {
  id: string
  subscription_id: string
  product_id: string
  quantity_g: number
  is_active: boolean
  product?: Product
}
""")


def write_supabase_client():
    write(PROJECT / "src" / "lib" / "supabase.ts", """\
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Brak zmiennych VITE_SUPABASE_URL lub VITE_SUPABASE_ANON_KEY w .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
""")


def write_recommender():
    write(PROJECT / "src" / "lib" / "recommender.ts", """\
import { Product, PetProfile, ScoredProduct } from '../types'

export function calculateDailyCalories(
  weight: number,
  ageGroup: 'kitten' | 'adult' | 'senior',
  activityLevel: 'low' | 'medium' | 'high',
  species: 'cat' | 'dog'
): number {
  const rer = 70 * Math.pow(weight, 0.75)
  const mult: Record<string, any> = {
    cat: { kitten: 2.5, adult: { low: 1.0, medium: 1.2, high: 1.4 }, senior: 1.1 },
    dog: { kitten: 3.0, adult: { low: 1.4, medium: 1.6, high: 1.8 }, senior: 1.2 },
  }
  const m = mult[species]
  const multiplier = ageGroup === 'adult'
    ? m.adult[activityLevel]
    : m[ageGroup] as number
  return Math.round(rer * multiplier)
}

function parsePercent(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace('%','').replace(',','.').trim())
  return isNaN(n) ? null : n
}

function scoreProduct(product: Product, profile: PetProfile) {
  let score = 100
  const reasons: string[] = []
  const warnings: string[] = []
  const nazwa = product.nazwa.toLowerCase()
  const sklad = (product.sklad || '').toLowerCase()

  // Wiek
  if (profile.age_group === 'kitten') {
    if (/kitten|kocięt|junior|szczenięt|puppy/.test(nazwa)) { score += 35; reasons.push('Dedykowana karma dla młodych zwierząt') }
    if (/senior|light|sterilised/.test(nazwa)) { score -= 60; warnings.push('Nieodpowiednia dla kociąt/szczeniąt') }
  } else if (profile.age_group === 'senior') {
    if (/senior|mature|11[+]|7[+]/.test(nazwa)) { score += 30; reasons.push('Formuła dla starszych zwierząt') }
    const p = parsePercent(product.bialko); if (p !== null && p < 32) { score += 10; reasons.push('Umiarkowane białko — dobre dla seniora') }
  }

  // Aktywność / waga
  const fat = parsePercent(product.tluszcz)
  const overweight = profile.health_conditions.includes('overweight')
  if (profile.activity_level === 'low' || overweight) {
    if (/light|sterilised|weight/.test(nazwa)) { score += 30; reasons.push('Formuła light — wspiera kontrolę wagi') }
    if (fat !== null && fat < 7)  { score += 20; reasons.push('Niska zawartość tłuszczu — idealne przy nadwadze') }
    if (fat !== null && fat > 14) { score -= 25; warnings.push('Wysoka zawartość tłuszczu — nie zalecana przy nadwadze') }
  }
  if (profile.activity_level === 'high' && fat !== null && fat > 10) {
    score += 15; reasons.push('Wyższa kaloryczność dla aktywnych zwierząt')
  }

  // Alergie — dyskwalifikacja
  const allergyMap: Record<string, string[]> = {
    grain:   [],  // obsłużone przez is_grain_free
    chicken: ['kurczak','drób'],
    fish:    ['łosoś','tuńczyk','ryb'],
    beef:    ['wołowin'],
    soy:     ['soja'],
    dairy:   ['mleko','nabiał','laktoza'],
  }
  for (const allergy of profile.allergies) {
    if (allergy === 'grain' && !product.is_grain_free) {
      score -= 999; warnings.push('Zawiera zboża — wykluczone')
    } else {
      const words = allergyMap[allergy] || []
      if (words.some(w => sklad.includes(w))) { score -= 999; warnings.push(`Zawiera alergen: ${allergy}`) }
    }
  }

  // Grain-free
  if (profile.health_conditions.includes('sensitive_digestion') || profile.allergies.includes('grain')) {
    if (product.is_grain_free) { score += 25; reasons.push('Bezzbożowa — idealna przy wrażliwym układzie') }
  } else if (product.is_grain_free) {
    score += 8; reasons.push('Bezzbożowa — wyższa jakość składu')
  }

  // Choroby
  if (profile.health_conditions.includes('kidney')) {
    if (/renal|kidney|nerkow/.test(nazwa)) { score += 60; reasons.push('Formuła weterynaryjna dla nerek') }
    else {
      const p = parsePercent(product.bialko)
      if (p !== null && p < 22) { score += 40; reasons.push('Niskie białko — wspiera funkcję nerek') }
      if (p !== null && p > 38) { score -= 35; warnings.push('Wysokie białko może obciążać nerki') }
    }
  }
  if (profile.health_conditions.includes('sensitive_digestion')) {
    if (/gastro|sensitive|digestive/.test(nazwa)) { score += 50; reasons.push('Formuła dla wrażliwego układu') }
    if (product.proteins.length === 1) { score += 20; reasons.push('Monoproteinowa — mniej ryzyko nietolerancji') }
  }
  if (profile.health_conditions.includes('skin_coat')) {
    if (/omega|olej z łososia|olej lniany|biotin/.test(sklad)) { score += 30; reasons.push('Omega-3 wspomagają sierść i skórę') }
    if (product.proteins.includes('salmon')) { score += 20; reasons.push('Łosoś bogaty w kwasy Omega-3') }
  }
  if (profile.health_conditions.includes('dental') && product.food_type === 'dry') {
    score += 15; reasons.push('Sucha karma mechanicznie czyści zęby')
  }

  // Typ karmy
  if (profile.food_type === 'dry' && product.food_type === 'wet') score -= 200
  if (profile.food_type === 'wet' && product.food_type === 'dry') score -= 200

  // Procent mięsa
  if (product.meat_percent !== null) {
    if (product.meat_percent >= 70)      { score += 40; reasons.push(`Bardzo wysokie mięso (${product.meat_percent}%)`) }
    else if (product.meat_percent >= 50) { score += 25; reasons.push(`Wysoka zawartość mięsa (${product.meat_percent}%)`) }
    else if (product.meat_percent >= 30) { score += 12; reasons.push(`Dobra zawartość mięsa (${product.meat_percent}%)`) }
  }

  return { score, reasons: reasons.slice(0,3), warnings: warnings.slice(0,2) }
}

function calcMonthly(product: Product, dailyCal: number) {
  let kcalPer100g = product.food_type === 'dry' ? 350 : 80
  if (product.energia) {
    const m = product.energia.match(/(\\d+)/)
    if (m) kcalPer100g = parseInt(m[1])
  }
  const dailyGrams = Math.round((dailyCal / kcalPer100g) * 100)
  const estMonthlyCost = Math.round((dailyGrams * 30 / 1000) * ((product.cena || 10) * 3.5))
  return { daily_grams: dailyGrams, monthly_price_est: estMonthlyCost }
}

export function getRecommendations(products: Product[], profile: PetProfile): ScoredProduct[] {
  const dailyCal = calculateDailyCalories(profile.weight_kg, profile.age_group, profile.activity_level, profile.species)
  const filtered = products.filter(p => p.species === profile.species || p.species === 'both')
  const scored = filtered
    .map(p => { const s = scoreProduct(p, profile); const m = calcMonthly(p, dailyCal); return {...p, ...s, ...m} })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)

  if (profile.food_type !== 'mixed') return scored.slice(0, 8)
  const result: ScoredProduct[] = []
  const counts = { dry: 0, wet: 0 }
  for (const p of scored) {
    const t = p.food_type as 'dry' | 'wet'
    if (counts[t] < 4) { result.push(p); counts[t]++ }
    if (result.length >= 8) break
  }
  return result
}
""")


def write_seed():
    # Pełne dane produktów z CSV
    write(PROJECT / "src" / "data" / "seed.ts", """\
import { Product } from '../types'

export const SEED_PRODUCTS: Omit<Product, 'id'>[] = [
  { nazwa:"Gourmet Revelations Adult Mus z łososiem Mokra Karma dla kota op. 2x57g", cena:10.9, bialko:"8,5%", tluszcz:"4,5%", wlokno:"0,05%", wilgotnosc:"81,0%", energia:null, sklad:"mięso i produkty pochodzenia zwierzęcego, ryby i produkty rybne (łosoś 4%), produkty pochodzenia roślinnego, składniki mineralne, cukry", species:"cat", food_type:"wet", is_grain_free:true, proteins:["salmon"], meat_percent:null },
  { nazwa:"Carnilove Adult Turkey&Reindeer Mokra Karma dla kota op. 100g", cena:7.1, bialko:"10.7%", tluszcz:"6.9%", wlokno:"0.4%", wilgotnosc:"79.0%", energia:null, sklad:"Mięso z indyka 35%, wątróbka z indyka, serca indycze bulion 42.8%, renifer 20%, żurawina 1%, składniki mineralne, olej lniany", species:"cat", food_type:"wet", is_grain_free:true, proteins:["turkey"], meat_percent:null },
  { nazwa:"Mac's Monoprotein Jagnięcina Mokra Karma dla kota op. 400g", cena:11.3, bialko:"10,8%", tluszcz:"7,2%", wlokno:"0,5%", wilgotnosc:"76,0%", energia:null, sklad:"96,8% jagnięcina(w tym mięso jagnięce, serca jagnięce, wątróbki jagnięce, wywar własny z mięsa jagnięcego), 2% marchew, 1% minerały, 0,2% olej z wiesiołka.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["lamb"], meat_percent:96 },
  { nazwa:"Felix Sauce Time Kurczak i Łosoś Mokra Karma dla kota op. 6x40g", cena:11.0, bialko:"3,2%", tluszcz:"0,3%", wlokno:"0,08%", wilgotnosc:"93,8%", energia:"10 kcal/saszetka 40g", sklad:null, species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Wiejska Zagroda Adult Monobiałkowa Wieprzowina Mokra Karma dla kota op. 200g", cena:7.2, bialko:"12,2%", tluszcz:"8,2%", wlokno:"1,2%", wilgotnosc:"74,9%", energia:"114,5 kcal/100g", sklad:"Wieprzowina 70% (mięso 60%, wątroba 10%), bulion wieprzowy 28,6%, minerały 1%, olej z łososia 0,2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["pork"], meat_percent:null },
  { nazwa:"Animonda Carny Adult Wołowina Mokra Karma dla kota op. 400g Pakiet 6szt.", cena:57.6, bialko:"11,5%", tluszcz:"6,5%", wlokno:"0,5%", wilgotnosc:"79,0%", energia:null, sklad:"Wołowina 65% (mięso, płuca, wątroba, nerki, wymiona), węglan wapnia", species:"cat", food_type:"wet", is_grain_free:true, proteins:["beef"], meat_percent:null },
  { nazwa:"Gussto Fresh Chicken&Prawns Mokra Karma dla kota op. 400g Pakiet 6szt.", cena:75.6, bialko:"10,2%", tluszcz:"5,0%", wlokno:"0,4%", wilgotnosc:"80,0%", energia:null, sklad:"Kurczak 60%, wywar własny z mięsa 27,9%, krewetki 10%, minerały 1,1%, olej z łososia 1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Bozita Adult Kurczak w galaretce Mokra Karma dla kota op. 370g", cena:7.5, bialko:"7.50%", tluszcz:"5.00%", wlokno:"0.50%", wilgotnosc:"83.0%", energia:null, sklad:"Kurczak (92% w kawałku), wieprzowina, węglan wapnia, drożdże", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","pork"], meat_percent:null },
  { nazwa:"Miamor Feine Filets Naturell Adult Tuńczyk i krewetki Mokra Karma dla kota op. 80g", cena:5.6, bialko:"15,0%", tluszcz:"1,0%", wlokno:"0,5%", wilgotnosc:"81,0%", energia:null, sklad:"59% tuńczyk, 6% krewetki, ryż", species:"cat", food_type:"wet", is_grain_free:false, proteins:["tuna"], meat_percent:null },
  { nazwa:"Dolina Noteci Premium Adult Filet z tuńczyka Mokra Karma dla kota op. 10x85g", cena:39.9, bialko:"14,0%", tluszcz:"2,0%", wlokno:"0,8%", wilgotnosc:"80,0%", energia:null, sklad:"filet z tuńczyka 60%, wywar z tuńczyka, substancje mineralne, nasiona babki płesznik 0,1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["tuna"], meat_percent:null },
  { nazwa:"Animonda Carny Kitten Wołowina z drobiem Mokra Karma dla kociąt op. 200g", cena:6.5, bialko:"11,0%", tluszcz:"6,0%", wlokno:"0,3%", wilgotnosc:"80,0%", energia:null, sklad:"Wołowina 39%, wątroba z kurczaka 14%, serce indyka 6%, serce kaczki 6%, węglan wapnia", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","beef","turkey"], meat_percent:null },
  { nazwa:"Gussto Fresh Wild Boar Mokra Karma dla kota op. 85g", cena:6.5, bialko:"10,8%", tluszcz:"7,1%", wlokno:"0,5%", wilgotnosc:"79,0%", energia:null, sklad:"Dzik 70%, wywar własny z mięsa 28,8%, minerały 1,0%, olej z ostropestu 0,2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Animal Island Everyday Turkey Pate Mokra Karma dla kota op. 12x100g", cena:35.0, bialko:"10,0%", tluszcz:"5,5%", wlokno:"0,4%", wilgotnosc:"82,0%", energia:null, sklad:"Indyk 32,5%, rosół drobiowy 30%, kurczak 26,5%, skrobia tapiokowa, białko wołowe 1%, minerały", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","turkey"], meat_percent:null },
  { nazwa:"Miamor Feine Filets Adult Tuńczyk w łososiowej galaretce Mokra Karma dla kota op. 100g", cena:5.6, bialko:"13,0%", tluszcz:"1,0%", wlokno:"0,5%", wilgotnosc:"83,0%", energia:"66 kcal", sklad:"Tuńczyk 53%, łosoś 1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["salmon","tuna"], meat_percent:null },
  { nazwa:"Schesir Adult Tuna with Shrimps in Jelly Mokra Karma dla kota op. 85g", cena:6.4, bialko:"12,0%", tluszcz:"0,8%", wlokno:"0,5%", wilgotnosc:"85,0%", energia:null, sklad:"Tuńczyk 51%, krewetki 6%, ryż 1,5%", species:"cat", food_type:"wet", is_grain_free:false, proteins:["tuna"], meat_percent:null },
  { nazwa:"Carnilove Adult Pheasant&Raspberry Leaf Mokra Karma dla kota op. 85g", cena:5.9, bialko:"8.0%", tluszcz:"4.8%", wlokno:"0.5%", wilgotnosc:"82.0%", energia:null, sklad:"Filet mięsny 85% (kurczak 71%, bażant 14%), bulion 12%, liść maliny 1%, olej lniany 1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Gourmet Gold Adult Mus z indykiem Mokra Karma dla kota op. 85g", cena:4.2, bialko:"10,5%", tluszcz:"7,0%", wlokno:null, wilgotnosc:"77,5%", energia:null, sklad:"Mięso i produkty pochodzenia zwierzęcego (indyk 4%), produkty pochodzenia roślinnego, składniki mineralne", species:"cat", food_type:"wet", is_grain_free:true, proteins:["turkey"], meat_percent:null },
  { nazwa:"Gussto Fresh Lamb Mokra Karma dla kota op. 85g Pakiet 8szt.", cena:49.6, bialko:"10,8%", tluszcz:"7,2%", wlokno:"0,4%", wilgotnosc:"75,0%", energia:null, sklad:"70% Jagnięcina, 28,8% wywar własny z mięsa, 1% minerały, 0,2% olej z ostropestu.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["lamb"], meat_percent:70 },
  { nazwa:"Grandorf Adult Tuna Fillet Mokra karma dla kota op. 70g Pakiet 6szt.", cena:51.0, bialko:"17.0%", tluszcz:"0.1%", wlokno:"0.2%", wilgotnosc:"81.7%", energia:"750 kcal/kg", sklad:"Filet z tuńczyka (75%), sos własny (24%), ziemniak (1%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["tuna"], meat_percent:null },
  { nazwa:"Wiejska Zagroda Monoproteinowe Fileciki Kurczak Mokra Karma dla kota op. 85g", cena:6.3, bialko:"13,9%", tluszcz:"4,5%", wlokno:"0,3%", wilgotnosc:"76,0%", energia:"106,17 kcal/100g", sklad:"Filet z kurczaka 40%, bulion 38,8%, kurczak 18%, żurawina 2%, składniki mineralne 1%, olej z łososia 0,2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Gussto Fresh Chicken Mokra Karma dla kota op. 400g", cena:12.9, bialko:"10,8%", tluszcz:"6,2%", wlokno:"0,4%", wilgotnosc:"80,0%", energia:null, sklad:"Kurczak 70.0%, wywar własny z mięsa 28.8%, minerały 1.0%, olej z ostropestu 0.2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Gussto Vet Diabetic Mokra Karma dla kota op. 200g", cena:9.9, bialko:"11,1%", tluszcz:"5,5%", wlokno:"0,3%", wilgotnosc:"78,0%", energia:null, sklad:"70% kurczak (mięso, podroby), 28,3% wywar własny z mięsa, 1,1% minerały, 0,5% olej z łososia", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:70 },
  { nazwa:"Gussto Vet Hypoallegrenic Mokra Karma dla kota op. 200g", cena:9.9, bialko:"10%", tluszcz:"5,5%", wlokno:"0,2%", wilgotnosc:null, energia:null, sklad:"70% konina, 28,4% wywar własny z mięsa, 1,1% minerały, 0,5% olej z ryb.", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Paka Zwierzaka Indyk z Cielęciną Mokra karma dla kota op. 200g", cena:9.5, bialko:"10,50%", tluszcz:"7,0%", wlokno:"0,5%", wilgotnosc:null, energia:null, sklad:"Indyk i cielęcina 99% (w tym 53% mięso indycze i podroby), minerały 1%.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["turkey"], meat_percent:53 },
  { nazwa:"Paka Zwierzaka Jagnięcina Mokra karma dla kota op. 200g", cena:9.5, bialko:"10,50%", tluszcz:"7,8%", wlokno:"0,5%", wilgotnosc:null, energia:null, sklad:"Jagnięcina 99% (w tym 73% mięso z jagnięciny i podroby), minerały 1%.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["lamb"], meat_percent:73 },
  { nazwa:"Paka Zwierzaka Królik Mokra karma dla kota op. 200g", cena:9.5, bialko:"10,50%", tluszcz:"6,8%", wlokno:"0,3%", wilgotnosc:null, energia:null, sklad:"Królik 99% (w tym 73% mięso z królika i podroby), minerały 1%.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["rabbit"], meat_percent:73 },
  { nazwa:"Brit Veterinary Diet Diabetes Lamb&Pea Mokra Karma dla kota op. 200g", cena:12.9, bialko:"9,0%", tluszcz:"8,0%", wlokno:"2,0%", wilgotnosc:null, energia:null, sklad:"jagnięcina (55%), groszek zielony (3,5%), olej z łososia (2%), mąka grochowa", species:"cat", food_type:"wet", is_grain_free:true, proteins:["lamb"], meat_percent:null },
  { nazwa:"Brit Veterinary Diet Gastrointestinal Salmon&Pea Mokra Karma dla kota op. 200g", cena:10.9, bialko:"9,0%", tluszcz:"7,0%", wlokno:"1,0%", wilgotnosc:null, energia:null, sklad:"łosoś 55%, zielony groszek 3%, drożdże browarniane 2%, olej z łososia 2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["salmon"], meat_percent:null },
  { nazwa:"Bozita Adult Łosoś w sosie Mokra Karma dla kota op. 370g", cena:7.5, bialko:"7.50%", tluszcz:"5.00%", wlokno:"0.50%", wilgotnosc:"83.0%", energia:null, sklad:"Kurczak, łosoś 7.2%, wieprzowina, wołowina, węglan wapnia, koper, drożdże.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","salmon","beef","pork"], meat_percent:null },
  { nazwa:"Royal Canin Instinctive w galaretce Mokra Karma dla kota op. 85g Pakiet 12szt.", cena:78.0, bialko:"11,8%", tluszcz:"4,5%", wlokno:"0,8%", wilgotnosc:"80,0%", energia:null, sklad:"Mięso oraz produkty pochodzenia zwierzęcego, roślinne ekstrakty białkowe, oleje i tłuszcze, minerały", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Mac's Adult Cielęcina z indykiem Mokra Karma dla kota op. 200g", cena:7.45, bialko:"11,2%", tluszcz:"6,2%", wlokno:"0,3%", wilgotnosc:"79,0%", energia:null, sklad:"Cielęcina 49,5%, indyk 49,5%, minerały 1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["turkey"], meat_percent:null },
  { nazwa:"Mac's Kitten Indyk z wołowiną i kaczką Mokra Karma dla kociąt op. 200g", cena:7.45, bialko:"11,8%", tluszcz:"5,6%", wlokno:"0,3%", wilgotnosc:"79,0%", energia:null, sklad:"Indyk 51%, wołowina 36%, kaczka 10%, marchew 2%, minerały 1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["beef","turkey"], meat_percent:null },
  { nazwa:"Mac's Kitten Indyk z królikiem Mokra Karma dla kociąt op. 200g", cena:7.45, bialko:"11,5%", tluszcz:"5,2%", wlokno:"0,3%", wilgotnosc:"79,0%", energia:null, sklad:"indyk 83,9%, królik 15%, minerały 1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["rabbit","turkey"], meat_percent:null },
  { nazwa:"Gussto Fresh Calf&Rabbit Mokra Karma dla kota op. 400g", cena:12.9, bialko:"10,6%", tluszcz:"6,9%", wlokno:"0,4%", wilgotnosc:"79,0%", energia:null, sklad:"Cielęcina 50%, królik 20%, wywar własny z mięsa 28,8%, minerały 1,0%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["rabbit"], meat_percent:null },
  { nazwa:"Nekko Daily Adult z wątróbką z kurczaka w sosie Mokra Karma dla kota op. 85g", cena:2.7, bialko:"8,5%", tluszcz:"4,5%", wlokno:"0,3%", wilgotnosc:"83,0%", energia:null, sklad:"Mięso i produkty pochodzenia zwierzęcego 92% (w tym wątróbka z kurczaka 10%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Nekko Daily Adult z królikiem w sosie Mokra Karma dla kota op. 85g", cena:2.7, bialko:"8,0%", tluszcz:"4,5%", wlokno:"0,3%", wilgotnosc:"83,0%", energia:null, sklad:"Mięso i produkty pochodzenia zwierzęcego 92% (w tym królik 10%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["rabbit"], meat_percent:null },
  { nazwa:"Rafi Cat Adult Sterilised Królik Mokra Karma dla kota op. 400g", cena:6.3, bialko:"9,0%", tluszcz:"3,5%", wlokno:"2,0%", wilgotnosc:"81,0%", energia:null, sklad:"Mięso i produkty pochodzenia zwierzęcego 55% (mięso z królika 4%), olej lniany 0,6%, olej z łososia 0,5%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["rabbit"], meat_percent:null },
  { nazwa:"Canagan For Cats Fresh Chicken Mokra Karma dla kota op. 75g", cena:6.9, bialko:"18.00%", tluszcz:"1.20%", wlokno:"0.10%", wilgotnosc:"77.0%", energia:null, sklad:"Kurczak 58%, wywar z kurczaka 30%, marchewka 4%, dynia 4%, tapioca 3%, witaminy i minerały.", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Grandorf Adult Tuna&Salmon Fillet Mokra karma dla kota op. 70g", cena:8.9, bialko:"17.0%", tluszcz:"0.1%", wlokno:"0.2%", wilgotnosc:"81.7%", energia:"770 kcal/kg", sklad:"Filet z tuńczyka (65%), filet z łososia (10%), sos własny (24%), ziemniak (1%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["tuna"], meat_percent:null },
  { nazwa:"Miamor Ragout Royale Adult Tuńczyk Mokra Karma dla kota op. 100g", cena:3.1, bialko:"8,0%", tluszcz:"5,0%", wlokno:"0,5%", wilgotnosc:"82,0%", energia:"82 kcal", sklad:"Mięso i produkty uboczne (drób 25%), ryby i rybne produkty uboczne (tuńczyk 5%), minerały", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","tuna"], meat_percent:null },
  { nazwa:"Miamor Ragout Royale Kitten Drób Mokra Karma dla kociąt op. 100g", cena:3.1, bialko:"9,5%", tluszcz:"6,0%", wlokno:"0,3%", wilgotnosc:"81,0%", energia:null, sklad:"Mięso i produkty pochodne (kurczak 20%), składniki mineralne", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Whiskas Adult Kurczak w sosie Mokra Karma dla kota op. 400g Pakiet 12szt.", cena:72.0, bialko:"7,1%", tluszcz:"3,6%", wlokno:"0,25%", wilgotnosc:"83,8%", energia:null, sklad:"mięso i produkty pochodzenia zwierzęcego (4% kurczaka), zboża, roślinne ekstrakty białkowe", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:4 },
  { nazwa:"Gourmet Gold Adult Łosoś z kurczakiem w sosie Mokra Karma dla kota op. 85g", cena:2.99, bialko:"7,0%", tluszcz:"3,2%", wlokno:"0,07%", wilgotnosc:"82,0%", energia:null, sklad:"Mięso i produkty (kurczak 4%), zboża, ryby i produkty rybne (łosoś 4%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","salmon"], meat_percent:null },
  { nazwa:"Gourmet Gold Adult Mus z kurczakiem Mokra Karma dla kota op. 85g", cena:2.99, bialko:"10,5%", tluszcz:"7,0%", wlokno:null, wilgotnosc:"77,5%", energia:null, sklad:"Mięso i produkty pochodzenia zwierzęcego (kurczak, 4%), produkty roślinne, składniki mineralne", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Pan Mięsko Adult Indyk z gęsią Mokra Karma dla kota op. 200g Pakiet 12szt.", cena:79.2, bialko:"10,8%", tluszcz:"7,6%", wlokno:"1,4%", wilgotnosc:"77,2%", energia:"104,5 kcal/100g", sklad:"Indyk 53%, bulion 28,6%, gęś 15%, jabłka 2%, minerały 1%, olej z łososia 0,2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["turkey"], meat_percent:null },
  { nazwa:"Sheba Classics in Pastete Adult Kaczka i kurczak Mokra Karma dla kota op. 85g", cena:3.6, bialko:"9,5%", tluszcz:"5,0%", wlokno:"0,3%", wilgotnosc:"82,5%", energia:null, sklad:"mięso i produkty (kaczka 4% i kurczak 4%), zboża, substancje mineralne", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Brit Care Adult Fillets in Jelly Mokra Karma dla kota op. 12x85g", cena:39.9, bialko:"8,5%", tluszcz:"3,5%", wlokno:"0,5%", wilgotnosc:"82,0%", energia:"720 kcal/kg", sklad:"w zależności od smaku saszetki", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Brit Care Adult Soup Duck Mokra Karma dla kota op. 75g", cena:4.0, bialko:"2,0%", tluszcz:"1,0%", wlokno:"0,2%", wilgotnosc:"95,0%", energia:"225 kcal/kg", sklad:"woda pitna, kurczak 16%, kaczka 4%, hydrolizowana wątróbka 0,5%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Kattovit Vital Care Anti Hairball z łososiem Mokra Karma dla kota op. 85g", cena:3.9, bialko:"9,0%", tluszcz:"5,0%", wlokno:"2,0%", wilgotnosc:"82.0%", energia:null, sklad:"Mięso i produkty, ryba i produkty rybne (łosoś 4%), słód 2%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["salmon"], meat_percent:null },
  { nazwa:"Applaws Natural Cat Food Kitten Kurczak Mokra Karma dla kociąt op. 70g", cena:5.9, bialko:"10,0%", tluszcz:"6,0%", wlokno:"0,1%", wilgotnosc:"81,0%", energia:null, sklad:"Kurczak 50% (pierś z kurczaka 10%, wątróbka drobiowa 5%), ryż", species:"cat", food_type:"wet", is_grain_free:false, proteins:["chicken"], meat_percent:null },
  { nazwa:"Comfy Appetit Premium Sterilized Mousse z Tuńczykiem Mokra karma dla kota 85g", cena:4.5, bialko:"7,5%", tluszcz:"5,0%", wlokno:"0,3%", wilgotnosc:"81,6%", energia:null, sklad:"Mięso i podroby 92%: tuńczyk (mięso), indyk (mięso), wołowina (mięso, wątroba)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["beef","tuna","turkey"], meat_percent:null },
  { nazwa:"Fitmin For Life Cats Adult with Duck Mokra Karma dla kota op. 85g", cena:3.5, bialko:"8,5%", tluszcz:"4,5%", wlokno:"0,4%", wilgotnosc:"82,0%", energia:null, sklad:"Mięso i produkty (80% w filecikach, w tym 11,6% kaczki)", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Fitmin For Life Cats Adult with Beef Mokra Karma dla kota op. 85g", cena:3.5, bialko:"8,5%", tluszcz:"4,5%", wlokno:"0,4%", wilgotnosc:"82,0%", energia:null, sklad:"Mięso i produkty (80% w filecikach, w tym 11,6% wołowiny)", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Inaba Ciao Bisque Chicken with beef recipe Mokra Karma dla kota op. 40g", cena:5.2, bialko:"8,0%", tluszcz:"1,0%", wlokno:"0,2%", wilgotnosc:"86,0%", energia:"400 kcal/kg", sklad:"Kurczak 28,2%, wołowina 1,8%, tapioka suszona", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","beef"], meat_percent:null },
  { nazwa:"Pet Republic Adult Wołowina Mokra Karma dla kota 400g Pakiet 10szt.", cena:50.0, bialko:"8.5%", tluszcz:"5.0%", wlokno:"0.3%", wilgotnosc:"81.5%", energia:null, sklad:"Mięso i produkty (90% mięsa w kawałku, 4% wołowina)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["beef"], meat_percent:4 },
  { nazwa:"Wiejska Zagroda Kurczak z krewetkami i walerianą Mokra Karma dla kota op. 100g", cena:5.8, bialko:"10,2%", tluszcz:"5,2%", wlokno:"0,4%", wilgotnosc:"80,0%", energia:"91,04 kcal/100g", sklad:"Kurczak 54%, bulion 30,4%, krewetki 14%, minerały 1%, olej z łososia 0,1%", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Felix Soup Original Adult Wiejskie smaki Mokra Karma dla kota op. 6x48g", cena:9.9, bialko:"7,5%", tluszcz:"1,5%", wlokno:"0,2%", wilgotnosc:"87,5%", energia:null, sklad:"Mięso i produkty (wołowina/kurczak/jagnięcina 4%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:["chicken","beef","lamb"], meat_percent:null },
  { nazwa:"Gussto Fresh Goat Mokra Karma dla kota op. 400g", cena:12.9, bialko:"9,5%", tluszcz:"5,5%", wlokno:"0,4%", wilgotnosc:"80,0%", energia:null, sklad:"70% Kozina (mięso i podroby), 28,7% wywar własny z mięsa, 1,1% minerały", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Rafi Cat Adult Dorsz Mokra Karma dla kota op. 400g Pakiet 12szt.", cena:73.2, bialko:"9,0%", tluszcz:"5,0%", wlokno:"0,8%", wilgotnosc:"80,0%", energia:null, sklad:"Mięso i produkty 55%, ryby i produkty rybne 10% (mięso z dorsza 4%)", species:"cat", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  // shared (kot i pies)
  { nazwa:"Steakhouse Lamm pur Mokra Karma dla psa i kota op. 400g", cena:17.9, bialko:"11,0%", tluszcz:null, wlokno:"1,9%", wilgotnosc:"81,3%", energia:null, sklad:"Jagnięcina 100% (mięso, wątroba, żwacz, płuca, serce)", species:"both", food_type:"wet", is_grain_free:true, proteins:["lamb"], meat_percent:null },
  { nazwa:"Steakhouse Rind pur Mokra Karma dla psa i kota op. 400g", cena:17.9, bialko:"12,0%", tluszcz:null, wlokno:"0,8%", wilgotnosc:"79,8%", energia:null, sklad:"Wołowina 100% (mięso wołowe, serce wołowe, wątroba wołowa, krtań wołowa, płuca wołowe)", species:"both", food_type:"wet", is_grain_free:true, proteins:["beef"], meat_percent:null },
  { nazwa:"Steakhouse Pferd pur Mokra Karma dla psa i kota op. 400g", cena:18.9, bialko:"8,3%", tluszcz:null, wlokno:"0,8%", wilgotnosc:"80,9%", energia:null, sklad:"Konina 100% (mięso, serce, wątroba, płuca)", species:"both", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Ayla Rescue Filet z Piersi Kurczaka Mokra Karma dla psa i kota op. 5x10g", cena:79.9, bialko:"89,4%", tluszcz:"6,0%", wlokno:"0,2%", wilgotnosc:"1,8%", energia:"566 kcal/100g", sklad:"Filet z piersi kurczaka 100%", species:"both", food_type:"dry", is_grain_free:true, proteins:["chicken"], meat_percent:null },
  { nazwa:"Ayla Rescue Filet z Piersi Indyka Mokra Karma dla psa i kota op. 5x10g", cena:79.9, bialko:"92,1%", tluszcz:"5,0%", wlokno:"0,6%", wilgotnosc:"1,8%", energia:"572 kcal/100g", sklad:"Filet z piersi indyka 100%", species:"both", food_type:"dry", is_grain_free:true, proteins:["turkey"], meat_percent:null },
  { nazwa:"Royal Canin Vet Recovery Mokra Karma dla psa i kota op. 195g", cena:12.0, bialko:"12,7%", tluszcz:"6,4%", wlokno:"1,7%", wilgotnosc:"73%", energia:null, sklad:"Mięso i produkty, zboża, oleje i tłuszcze, mleko i produkty mleczne, minerały", species:"both", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
  { nazwa:"Steakhouse Lamm pur Mokra Karma dla psa i kota op. 400g Pakiet 6szt.", cena:98.4, bialko:"11,0%", tluszcz:null, wlokno:"1,9%", wilgotnosc:"81,3%", energia:null, sklad:"Jagnięcina 100% (mięso, wątroba, żwacz, płuca, serce)", species:"both", food_type:"wet", is_grain_free:true, proteins:["lamb"], meat_percent:null },
  { nazwa:"Steakhouse Rind pur Mokra Karma dla psa i kota op. 400g Pakiet 6szt.", cena:98.4, bialko:"12,0%", tluszcz:null, wlokno:"0,8%", wilgotnosc:"79,8%", energia:null, sklad:"Wołowina 100% (mięso, serce, wątroba, krtań, płuca wołowe)", species:"both", food_type:"wet", is_grain_free:true, proteins:["beef"], meat_percent:null },
  { nazwa:"Royal Canin Vet Recovery Mokra Karma dla psa i kota op. 195g Pakiet 12szt.", cena:139.2, bialko:"12,7%", tluszcz:"6,4%", wlokno:"1,7%", wilgotnosc:"73%", energia:null, sklad:"Mięso i produkty, zboża, oleje i tłuszcze, mleko i produkty mleczne, minerały", species:"both", food_type:"wet", is_grain_free:true, proteins:[], meat_percent:null },
]
""")


def write_hooks():
    write(PROJECT / "src" / "hooks" / "useProducts.ts", """\
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product } from '../types'
import { SEED_PRODUCTS } from '../data/seed'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('products').select('*').order('cena', { ascending: true })
      if (error || !data || data.length === 0) {
        setProducts(SEED_PRODUCTS.map((p, i) => ({ ...p, id: `seed-${i}` })))
      } else {
        setProducts(data)
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return { products, loading }
}
""")

    write(PROJECT / "src" / "hooks" / "useAuth.ts", """\
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  return { session, loading }
}
""")


def write_app():
    write(PROJECT / "src" / "App.tsx", """\
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Landing from './pages/Landing'
import Quiz from './pages/Quiz'
import Recommendations from './pages/Recommendations'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Pets from './pages/Pets'
import Subscription from './pages/Subscription'
import Checkout from './pages/Checkout'
import AdminImport from './pages/AdminImport'

function Protected({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#FAF6EF'}}>
      <p style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', color:'#1b5c3a'}}>🐾 Ładowanie PawBox...</p>
    </div>
  )

  return (
    <BrowserRouter>
      <Navbar session={session} />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/auth" element={<Auth session={session} />} />
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="/dashboard" element={<Protected session={session}><Dashboard session={session!} /></Protected>} />
          <Route path="/pets" element={<Protected session={session}><Pets session={session!} /></Protected>} />
          <Route path="/subscription" element={<Protected session={session}><Subscription session={session!} /></Protected>} />
          <Route path="/checkout" element={<Protected session={session}><Checkout session={session!} /></Protected>} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
""")

    write(PROJECT / "src" / "main.tsx", """\
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
""")


def write_layout():
    write(PROJECT / "src" / "components" / "layout" / "Navbar.tsx", """\
import { Link, useNavigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export default function Navbar({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const logout = async () => { await supabase.auth.signOut(); navigate('/') }

  return (
    <nav style={{background:'white', borderBottom:'1px solid #E8DFD0', position:'sticky', top:0, zIndex:50}}>
      <div style={{maxWidth:1024, margin:'0 auto', padding:'0 1rem', height:64, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <Link to="/" style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', color:'#144830', textDecoration:'none'}}>🐾 PawBox</Link>
        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
          <Link to="/quiz" style={{fontSize:'0.875rem', color:'#4b5563', textDecoration:'none'}}>Quiz</Link>
          {session ? (
            <>
              <Link to="/dashboard" style={{fontSize:'0.875rem', color:'#4b5563', textDecoration:'none'}}>Panel</Link>
              <Link to="/pets"     style={{fontSize:'0.875rem', color:'#4b5563', textDecoration:'none'}}>Pupile</Link>
              <button onClick={logout} style={{fontSize:'0.875rem', color:'#9ca3af', background:'none', border:'none', cursor:'pointer'}}>Wyloguj</button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary" style={{fontSize:'0.875rem', padding:'0.5rem 1rem'}}>Zaloguj się</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
""")

    write(PROJECT / "src" / "components" / "layout" / "Footer.tsx", """\
export default function Footer() {
  return (
    <footer style={{background:'#144830', color:'white', padding:'3rem 1rem', marginTop:'4rem'}}>
      <div style={{maxWidth:1024, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'2rem'}}>
        <div>
          <h3 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'0.75rem'}}>🐾 PawBox</h3>
          <p style={{color:'#9FE1CB', fontSize:'0.875rem', lineHeight:1.6}}>Subskrypcyjna karma dla kotów i psów, dobierana indywidualnie.</p>
        </div>
        <div>
          <h4 style={{marginBottom:'0.75rem'}}>Szybkie linki</h4>
          <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
            <a href="/quiz" style={{color:'#9FE1CB', fontSize:'0.875rem'}}>Zacznij quiz</a>
            <a href="/auth" style={{color:'#9FE1CB', fontSize:'0.875rem'}}>Zaloguj się</a>
          </div>
        </div>
        <div>
          <h4 style={{marginBottom:'0.75rem'}}>Kontakt</h4>
          <p style={{color:'#9FE1CB', fontSize:'0.875rem'}}>kontakt@pawbox.pl</p>
          <p style={{color:'#9FE1CB', fontSize:'0.875rem', marginTop:'0.5rem'}}>Ponad 12 000 zadowolonych pupili 🐾</p>
        </div>
      </div>
      <div style={{maxWidth:1024, margin:'2rem auto 0', paddingTop:'2rem', borderTop:'1px solid #1B5C3A', textAlign:'center', color:'#5DCAA5', fontSize:'0.875rem'}}>
        © 2025 PawBox. Wszelkie prawa zastrzeżone.
      </div>
    </footer>
  )
}
""")


def write_pages():
    # Landing
    write(PROJECT / "src" / "pages" / "Landing.tsx", """\
import { Link } from 'react-router-dom'

const STEPS = [
  { icon:'📋', title:'Powiedz nam o pupilu', desc:'Wypełnij krótki quiz — wiek, waga, zdrowie, preferencje.' },
  { icon:'🔍', title:'Otrzymujesz rekomendacje', desc:'Nasz algorytm dobiera najlepsze karmy z bazy 1000+ produktów.' },
  { icon:'📦', title:'Regularne dostawy', desc:'Karma przyjeżdża pod drzwi w wybranym rytmie.' },
]

const TESTIMONIALS = [
  { name:'Karolina S.', pet:'Kot Mruczek', text:'W końcu mój Mruczek je z apetytem! Karma idealnie dobrana do jego wrażliwego brzuszka.' },
  { name:'Piotr K.', pet:'Pies Bruno', text:'Super serwis, szybka dostawa i realne oszczędności. Polecam każdemu właścicielowi psa.' },
  { name:'Ania W.', pet:'Dwa koty', text:'Mam dwa koty o różnych potrzebach — PawBox dopasował oddzielny zestaw dla każdego.' },
]

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section style={{background:'linear-gradient(135deg,#1b5c3a 0%,#2d7a50 100%)', color:'white', padding:'5rem 1rem', textAlign:'center'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'clamp(2rem,5vw,3.5rem)', marginBottom:'1rem', lineHeight:1.2}}>
          Karma dla Twojego pupila.<br/>Dobrana specjalnie dla niego.
        </h1>
        <p style={{fontSize:'1.125rem', opacity:0.85, maxWidth:600, margin:'0 auto 2rem'}}>
          Subskrypcyjna dostawa karm dla kotów i psów — dobierana na podstawie wieku, wagi i stanu zdrowia Twojego zwierzaka.
        </p>
        <Link to="/quiz" className="btn-primary" style={{fontSize:'1.125rem', padding:'1rem 2.5rem', display:'inline-block'}}>
          Zacznij quiz → 
        </Link>
        <p style={{marginTop:'1rem', opacity:0.7, fontSize:'0.875rem'}}>Zajmuje 2 minuty • Bezpłatne</p>
      </section>

      {/* Stats */}
      <section style={{background:'white', padding:'2rem 1rem'}}>
        <div style={{maxWidth:800, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', textAlign:'center'}}>
          {[['12 000+','zadowolonych pupili'],['1 159','produktów w bazie'],['4.8★','średnia ocena']].map(([v,l]) => (
            <div key={l}>
              <div style={{fontSize:'1.75rem', fontWeight:700, color:'#1b5c3a'}}>{v}</div>
              <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Jak to działa */}
      <section style={{padding:'4rem 1rem', background:'#FAF6EF'}}>
        <div style={{maxWidth:900, margin:'0 auto'}}>
          <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', textAlign:'center', marginBottom:'3rem'}}>Jak to działa?</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'2rem'}}>
            {STEPS.map((s,i) => (
              <div key={i} className="card" style={{textAlign:'center'}}>
                <div style={{fontSize:'2.5rem', marginBottom:'1rem'}}>{s.icon}</div>
                <div style={{fontSize:'0.75rem', color:'#1b5c3a', fontWeight:600, marginBottom:'0.5rem'}}>KROK {i+1}</div>
                <h3 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.125rem', marginBottom:'0.5rem'}}>{s.title}</h3>
                <p style={{color:'#6b7280', fontSize:'0.875rem'}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Opinie */}
      <section style={{padding:'4rem 1rem', background:'white'}}>
        <div style={{maxWidth:900, margin:'0 auto'}}>
          <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', textAlign:'center', marginBottom:'3rem'}}>Co mówią właściciele?</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:'1.5rem'}}>
            {TESTIMONIALS.map((t,i) => (
              <div key={i} className="card">
                <p style={{color:'#374151', fontStyle:'italic', marginBottom:'1rem'}}>"{t.text}"</p>
                <div style={{fontWeight:600}}>{t.name}</div>
                <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{t.pet}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{background:'#C4622D', color:'white', padding:'4rem 1rem', textAlign:'center'}}>
        <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'1rem'}}>Gotowy na pierwszy PawBox?</h2>
        <p style={{opacity:0.9, marginBottom:'2rem'}}>Dołącz do tysięcy szczęśliwych pupili już dziś.</p>
        <Link to="/quiz" style={{background:'white', color:'#C4622D', padding:'1rem 2.5rem', borderRadius:'0.75rem', fontWeight:600, textDecoration:'none', fontSize:'1.125rem'}}>
          Zacznij quiz →
        </Link>
      </section>
    </div>
  )
}
""")

    # Auth
    write(PROJECT / "src" / "pages" / "Auth.tsx", """\
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Navigate } from 'react-router-dom'

export default function AuthPage({ session }: { session: Session | null }) {
  if (session) return <Navigate to="/dashboard" replace />
  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
      <div style={{width:'100%', maxWidth:440}}>
        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#144830'}}>🐾 PawBox</h1>
          <p style={{color:'#6b7280', marginTop:'0.5rem'}}>Zaloguj się lub utwórz konto</p>
        </div>
        <div className="card">
          <Auth supabaseClient={supabase}
            appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand:'#1B5C3A', brandAccent:'#144830' }}}}}
            providers={[]}
            redirectTo={window.location.origin + '/dashboard'}
          />
        </div>
      </div>
    </div>
  )
}
""")

    # Dashboard
    write(PROJECT / "src" / "pages" / "Dashboard.tsx", """\
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Pet, Subscription } from '../types'

export default function Dashboard({ session }: { session: Session }) {
  const [pets, setPets] = useState<Pet[]>([])
  const [sub, setSub] = useState<Subscription | null>(null)

  useEffect(() => {
    supabase.from('pets').select('*').eq('user_id', session.user.id).then(r => r.data && setPets(r.data))
    supabase.from('subscriptions').select('*').eq('user_id', session.user.id).eq('status','active').maybeSingle().then(r => r.data && setSub(r.data))
  }, [session])

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'0.5rem'}}>Cześć! 🐾</h1>
        <p style={{color:'#6b7280', marginBottom:'2rem'}}>Witaj w swoim panelu PawBox</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'1.5rem'}}>
          <div className="card">
            <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'1rem'}}>Moja subskrypcja</h2>
            {sub ? (
              <div>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
                  <span style={{fontSize:'1.75rem'}}>{sub.plan_type==='starter'?'🌱':sub.plan_type==='comfort'?'⭐':'💎'}</span>
                  <div>
                    <div style={{fontWeight:600, textTransform:'capitalize'}}>{sub.plan_type}</div>
                    <span style={{fontSize:'0.75rem', padding:'2px 8px', borderRadius:20, background:'#d9ede2', color:'#1b5c3a'}}>Aktywna</span>
                  </div>
                </div>
                {sub.next_delivery_date && <p style={{fontSize:'0.875rem', color:'#6b7280'}}>📦 Następna dostawa: <strong>{sub.next_delivery_date}</strong></p>}
                <Link to="/subscription" style={{display:'inline-block', marginTop:'1rem', color:'#1b5c3a', fontSize:'0.875rem'}}>Zarządzaj →</Link>
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'1.5rem 0'}}>
                <p style={{color:'#6b7280', marginBottom:'1rem'}}>Nie masz aktywnej subskrypcji</p>
                <Link to="/quiz" className="btn-primary" style={{fontSize:'0.875rem'}}>Zacznij quiz →</Link>
              </div>
            )}
          </div>
          <div className="card">
            <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'1rem'}}>Moje pupile</h2>
            {pets.length > 0 ? (
              <div>
                {pets.map(p => (
                  <div key={p.id} style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'#E8DFD0', borderRadius:'0.75rem', marginBottom:'0.5rem'}}>
                    <span style={{fontSize:'1.5rem'}}>{p.species==='cat'?'🐱':'🐶'}</span>
                    <div>
                      <div style={{fontWeight:600}}>{p.name}</div>
                      <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{p.weight_kg} kg · {p.age_group}</div>
                    </div>
                  </div>
                ))}
                <Link to="/pets" style={{fontSize:'0.875rem', color:'#1b5c3a'}}>Zarządzaj pupilami →</Link>
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'1.5rem 0'}}>
                <p style={{color:'#6b7280', marginBottom:'1rem'}}>Dodaj swojego pierwszego pupila</p>
                <Link to="/pets" className="btn-secondary" style={{fontSize:'0.875rem'}}>Dodaj pupila →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
""")

    # Pets (placeholder z podstawową funkcją)
    write(PROJECT / "src" / "pages" / "Pets.tsx", """\
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Pet, PetProfile } from '../types'

const EMPTY: PetProfile = { name:'', species:'cat', age_group:'adult', weight_kg:4, activity_level:'medium', health_conditions:[], allergies:[], food_type:'mixed' }

export default function Pets({ session }: { session: Session }) {
  const [pets, setPets] = useState<Pet[]>([])
  const [form, setForm] = useState<PetProfile>(EMPTY)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => supabase.from('pets').select('*').eq('user_id', session.user.id).then(r => r.data && setPets(r.data))
  useEffect(() => { load() }, [session])

  const save = async () => {
    setSaving(true)
    await supabase.from('pets').insert({ ...form, user_id: session.user.id })
    setAdding(false); setForm(EMPTY); load()
    setSaving(false)
  }

  const remove = async (id: string) => {
    await supabase.from('pets').delete().eq('id', id)
    load()
  }

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:700, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
          <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem'}}>Moje pupile</h1>
          <button onClick={() => setAdding(true)} className="btn-primary" style={{fontSize:'0.875rem'}}>+ Dodaj pupila</button>
        </div>

        {pets.length === 0 && !adding && (
          <div className="card" style={{textAlign:'center', padding:'3rem'}}>
            <div style={{fontSize:'3rem', marginBottom:'1rem'}}>🐾</div>
            <p style={{color:'#6b7280'}}>Nie masz jeszcze żadnych pupili. Dodaj pierwszego!</p>
          </div>
        )}

        {pets.map(p => (
          <div key={p.id} className="card" style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem'}}>
            <span style={{fontSize:'2rem'}}>{p.species==='cat'?'🐱':'🐶'}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600, fontSize:'1.125rem'}}>{p.name}</div>
              <div style={{color:'#6b7280', fontSize:'0.875rem'}}>
                {p.weight_kg} kg · {p.age_group==='kitten'?'Kocię/Szczenię':p.age_group==='adult'?'Dorosły':'Senior'} · {p.activity_level==='low'?'Mała aktywność':p.activity_level==='medium'?'Umiarkowana':'Bardzo aktywny'}
              </div>
            </div>
            <button onClick={() => remove(p.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'1.25rem'}}>🗑</button>
          </div>
        ))}

        {adding && (
          <div className="card" style={{marginTop:'1.5rem'}}>
            <h3 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'1.5rem'}}>Nowy pupil</h3>
            <div style={{display:'grid', gap:'1rem'}}>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Gatunek</label>
                <div style={{display:'flex', gap:'0.5rem'}}>
                  {(['cat','dog'] as const).map(s => (
                    <button key={s} onClick={() => setForm(f=>({...f,species:s}))}
                      style={{flex:1, padding:'0.75rem', borderRadius:'0.75rem', border:`2px solid ${form.species===s?'#1b5c3a':'#E8DFD0'}`, background:form.species===s?'#f0f7f3':'white', cursor:'pointer'}}>
                      {s==='cat'?'🐱 Kot':'🐶 Pies'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Imię</label>
                <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="np. Mruczek" />
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Wiek</label>
                <select className="input" value={form.age_group} onChange={e=>setForm(f=>({...f,age_group:e.target.value as any}))}>
                  <option value="kitten">Kocię/Szczenię (do 1 roku)</option>
                  <option value="adult">Dorosły (1–7 lat)</option>
                  <option value="senior">Senior (7+ lat)</option>
                </select>
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Waga: {form.weight_kg} kg</label>
                <input type="range" min="0.5" max="80" step="0.5" value={form.weight_kg}
                  onChange={e=>setForm(f=>({...f,weight_kg:parseFloat(e.target.value)}))} style={{width:'100%', accentColor:'#1b5c3a'}} />
              </div>
              <div style={{display:'flex', gap:'0.75rem', marginTop:'0.5rem'}}>
                <button onClick={() => { setAdding(false); setForm(EMPTY) }} className="btn-secondary" style={{flex:1}}>Anuluj</button>
                <button onClick={save} disabled={!form.name || saving} className="btn-primary" style={{flex:1}}>
                  {saving ? 'Zapisuję...' : 'Zapisz pupila'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
""")

    # Subscription placeholder
    write(PROJECT / "src" / "pages" / "Subscription.tsx", """\
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Subscription } from '../types'
import { Link } from 'react-router-dom'

export default function SubscriptionPage({ session }: { session: Session }) {
  const [sub, setSub] = useState<Subscription | null>(null)

  useEffect(() => {
    supabase.from('subscriptions').select('*').eq('user_id', session.user.id).eq('status','active').maybeSingle().then(r => r.data && setSub(r.data))
  }, [session])

  const pause = async () => {
    if (!sub) return
    await supabase.from('subscriptions').update({ status:'paused' }).eq('id', sub.id)
    setSub(s => s ? {...s, status:'paused'} : s)
  }

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:700, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem'}}>Moja subskrypcja</h1>
        {sub ? (
          <div className="card">
            <div style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem'}}>
              <span style={{fontSize:'2.5rem'}}>{sub.plan_type==='starter'?'🌱':sub.plan_type==='comfort'?'⭐':'💎'}</span>
              <div>
                <h2 style={{fontFamily:'Lora,Georgia,serif', textTransform:'capitalize'}}>{sub.plan_type}</h2>
                <span style={{fontSize:'0.75rem', padding:'2px 10px', borderRadius:20, background: sub.status==='active'?'#d9ede2':'#f3f4f6', color:sub.status==='active'?'#1b5c3a':'#6b7280'}}>
                  {sub.status==='active'?'Aktywna':'Wstrzymana'}
                </span>
              </div>
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{fontSize:'0.875rem', display:'block', marginBottom:'0.5rem'}}>
                Częstotliwość dostaw: co <strong>{sub.delivery_frequency_days}</strong> dni
              </label>
              <input type="range" min={7} max={60} value={sub.delivery_frequency_days}
                onChange={async e => {
                  const v = parseInt(e.target.value)
                  setSub(s => s ? {...s, delivery_frequency_days:v} : s)
                  await supabase.from('subscriptions').update({delivery_frequency_days:v}).eq('id',sub.id)
                }}
                style={{width:'100%', accentColor:'#1b5c3a'}} />
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af'}}>
                <span>7 dni</span><span>60 dni</span>
              </div>
            </div>
            {sub.status==='active' && (
              <button onClick={pause} className="btn-secondary" style={{width:'100%', marginTop:'1rem'}}>
                Wstrzymaj subskrypcję
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{textAlign:'center', padding:'3rem'}}>
            <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📦</div>
            <p style={{color:'#6b7280', marginBottom:'1rem'}}>Nie masz aktywnej subskrypcji</p>
            <Link to="/quiz" className="btn-primary">Zacznij quiz →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
""")

    # Checkout
    write(PROJECT / "src" / "pages" / "Checkout.tsx", """\
import { useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Checkout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const plan = sessionStorage.getItem('selectedPlan') || 'comfort'
  const products = JSON.parse(sessionStorage.getItem('selectedProducts') || '[]')
  const [address, setAddress] = useState({ street:'', city:'', postal:'' })
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 30)
    const { data: sub } = await supabase.from('subscriptions').insert({
      user_id: session.user.id,
      plan_type: plan,
      status: 'active',
      delivery_frequency_days: 30,
      next_delivery_date: nextDate.toISOString().split('T')[0],
    }).select().single()

    if (sub) {
      await supabase.from('subscription_items').insert(
        products.map((id: string) => ({ subscription_id: sub.id, product_id: id, quantity_g: 500 }))
      )
    }
    setSaving(false); setDone(true)
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  if (done) return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'5rem', marginBottom:'1rem'}}>🎉</div>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#1b5c3a'}}>Zamówienie przyjęte!</h1>
        <p style={{color:'#6b7280', marginTop:'0.5rem'}}>Twój PawBox jest w drodze 🐾</p>
        <p style={{color:'#9ca3af', fontSize:'0.875rem', marginTop:'0.5rem'}}>Za chwilę przejdziesz do panelu...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:500, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem'}}>Potwierdzenie zamówienia</h1>
        <div className="card" style={{marginBottom:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem'}}>Plan: <strong style={{textTransform:'capitalize'}}>{plan}</strong></h3>
          <p style={{color:'#6b7280', fontSize:'0.875rem'}}>Wybrano {products.length} karm · dostawa co 30 dni</p>
        </div>
        <div className="card" style={{marginBottom:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem'}}>Adres dostawy</h3>
          <div style={{display:'grid', gap:'0.75rem'}}>
            <input className="input" placeholder="Ulica i numer" value={address.street} onChange={e=>setAddress(a=>({...a,street:e.target.value}))} />
            <input className="input" placeholder="Kod pocztowy (00-000)" value={address.postal} onChange={e=>setAddress(a=>({...a,postal:e.target.value}))} />
            <input className="input" placeholder="Miasto" value={address.city} onChange={e=>setAddress(a=>({...a,city:e.target.value}))} />
          </div>
        </div>
        <button onClick={submit} disabled={saving || !address.street || !address.city} className="btn-primary" style={{width:'100%', padding:'1rem', fontSize:'1rem'}}>
          {saving ? 'Składam zamówienie...' : '✓ Złóż zamówienie'}
        </button>
      </div>
    </div>
  )
}
""")


def write_quiz_and_recs():
    # Quiz i Recommendations są już zapisane w głównej instrukcji jako duże pliki
    # Kopiujemy je ze skróconej wersji (pełna wersja jest w PAWBOX_INSTRUKCJA.md)
    write(PROJECT / "src" / "pages" / "Quiz.tsx", """\
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PetProfile } from '../types'

const HEALTH = [
  { value:'overweight', label:'⚖️ Nadwaga' },
  { value:'sensitive_digestion', label:'🫃 Wrażliwy układ pokarmowy' },
  { value:'kidney', label:'🔴 Problemy z nerkami' },
  { value:'skin_coat', label:'✨ Problemy ze skórą i sierścią' },
  { value:'dental', label:'🦷 Problemy dentystyczne' },
]
const ALLERGIES = [
  { value:'grain',   label:'Zboża' },
  { value:'chicken', label:'Kurczak' },
  { value:'fish',    label:'Ryby' },
  { value:'beef',    label:'Wołowina' },
  { value:'soy',     label:'Soja' },
  { value:'dairy',   label:'Nabiał' },
]

export default function Quiz() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [p, setP] = useState<Partial<PetProfile>>({ name:'', species:'cat', age_group:'adult', weight_kg:4, activity_level:'medium', health_conditions:[], allergies:[], food_type:'mixed' })

  const upd = (k: keyof PetProfile, v: unknown) => setP(prev => ({...prev, [k]:v}))
  const toggle = (k: 'health_conditions'|'allergies', v: string) => {
    const arr = (p[k]||[]) as string[]
    upd(k, arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v])
  }

  const TOTAL = 5
  const progress = (step/TOTAL)*100

  const card: React.CSSProperties = { background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'2rem' }
  const sel = (active: boolean): React.CSSProperties => ({
    border: `2px solid ${active ? '#1b5c3a' : '#E8DFD0'}`,
    background: active ? '#f0f7f3' : 'white',
    borderRadius:'0.75rem', padding:'1rem', cursor:'pointer', textAlign:'left', width:'100%',
  })

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:560, margin:'0 auto'}}>
        <div style={{marginBottom:'2rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.875rem', color:'#6b7280', marginBottom:'0.5rem'}}>
            <span>Krok {step} z {TOTAL}</span><span>{Math.round(progress)}%</span>
          </div>
          <div style={{height:8, background:'#E8DFD0', borderRadius:4, overflow:'hidden'}}>
            <div style={{height:'100%', background:'#1b5c3a', borderRadius:4, width:`${progress}%`, transition:'width 0.4s'}} />
          </div>
        </div>

        <div style={card}>
          {step===1 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Powiedz nam o swoim pupilu</h2>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem'}}>
                {(['cat','dog'] as const).map(s => (
                  <button key={s} onClick={()=>upd('species',s)} style={{...sel(p.species===s), textAlign:'center', padding:'1.5rem'}}>
                    <span style={{fontSize:'2.5rem', display:'block', marginBottom:'0.5rem'}}>{s==='cat'?'🐱':'🐶'}</span>
                    <span style={{fontWeight:600}}>{s==='cat'?'Kot':'Pies'}</span>
                  </button>
                ))}
              </div>
              <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.5rem'}}>Imię pupila</label>
              <input className="input" value={p.name} onChange={e=>upd('name',e.target.value)} placeholder="np. Mruczek, Burek..." />
            </div>
          )}

          {step===2 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Wiek i waga {p.name||'pupila'}</h2>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', marginBottom:'1.5rem'}}>
                {[{v:'kitten',l:'Kocię',s:'< 1 rok'},{v:'adult',l:'Dorosły',s:'1–7 lat'},{v:'senior',l:'Senior',s:'7+ lat'}].map(o=>(
                  <button key={o.v} onClick={()=>upd('age_group',o.v)} style={{...sel(p.age_group===o.v), textAlign:'center'}}>
                    <div style={{fontWeight:600}}>{o.l}</div><div style={{fontSize:'0.75rem', color:'#6b7280'}}>{o.s}</div>
                  </button>
                ))}
              </div>
              <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.5rem'}}>
                Waga: <strong style={{color:'#1b5c3a'}}>{p.weight_kg} kg</strong>
              </label>
              <input type="range" min="0.5" max="80" step="0.5" value={p.weight_kg}
                onChange={e=>upd('weight_kg',parseFloat(e.target.value))} style={{width:'100%', accentColor:'#1b5c3a'}} />
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af'}}>
                <span>0.5 kg</span><span>80 kg</span>
              </div>
            </div>
          )}

          {step===3 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Jak aktywny jest {p.name||'pupil'}?</h2>
              <div style={{display:'grid', gap:'0.75rem'}}>
                {[{v:'low',i:'🛋️',l:'Mała aktywność',s:'Kanapowiec, śpi większość dnia'},{v:'medium',i:'🚶',l:'Umiarkowana',s:'Standardowa aktywność'},{v:'high',i:'🏃',l:'Bardzo aktywny',s:'Dużo zabawy i spacerów'}].map(o=>(
                  <button key={o.v} onClick={()=>upd('activity_level',o.v)} style={{...sel(p.activity_level===o.v), display:'flex', alignItems:'center', gap:'1rem'}}>
                    <span style={{fontSize:'1.75rem'}}>{o.i}</span>
                    <div><div style={{fontWeight:600}}>{o.l}</div><div style={{fontSize:'0.875rem', color:'#6b7280'}}>{o.s}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step===4 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Stan zdrowia</h2>
              <div style={{display:'grid', gap:'0.5rem'}}>
                {HEALTH.map(h => {
                  const active = ((p.health_conditions||[]) as string[]).includes(h.value)
                  return (
                    <button key={h.value} onClick={()=>toggle('health_conditions',h.value)} style={{...sel(active), display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem'}}>
                      <div style={{width:20, height:20, borderRadius:4, border:`2px solid ${active?'#1b5c3a':'#d1d5db'}`, background:active?'#1b5c3a':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        {active && <span style={{color:'white', fontSize:'0.75rem'}}>✓</span>}
                      </div>
                      <span style={{fontSize:'0.875rem'}}>{h.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step===5 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Alergie i preferencje</h2>
              <p style={{fontSize:'0.875rem', fontWeight:600, marginBottom:'0.75rem'}}>Alergie lub nietolerancje:</p>
              <div style={{display:'flex', flexWrap:'wrap', gap:'0.5rem', marginBottom:'1.5rem'}}>
                {ALLERGIES.map(a => {
                  const active = ((p.allergies||[]) as string[]).includes(a.value)
                  return (
                    <button key={a.value} onClick={()=>toggle('allergies',a.value)}
                      style={{padding:'0.5rem 1rem', borderRadius:20, border:`2px solid ${active?'#C4622D':'#E8DFD0'}`, background:active?'#C4622D':'white', color:active?'white':'#374151', fontSize:'0.875rem', cursor:'pointer'}}>
                      {a.label}
                    </button>
                  )
                })}
              </div>
              <p style={{fontSize:'0.875rem', fontWeight:600, marginBottom:'0.75rem'}}>Preferencja karmy:</p>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem'}}>
                {[{v:'dry',l:'🥜 Tylko sucha'},{v:'wet',l:'💧 Tylko mokra'},{v:'mixed',l:'🔄 Mieszana'}].map(o=>(
                  <button key={o.v} onClick={()=>upd('food_type',o.v)} style={{...sel(p.food_type===o.v), textAlign:'center', padding:'0.75rem 0.5rem', fontSize:'0.875rem'}}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{display:'flex', justifyContent:'space-between', marginTop:'2rem'}}>
            <button onClick={()=>setStep(s=>s-1)} disabled={step===1} className="btn-secondary"
              style={{opacity:step===1?0.3:1}}>← Wróć</button>
            <button className="btn-primary" onClick={()=>{
              if (step < TOTAL) setStep(s=>s+1)
              else { sessionStorage.setItem('quizProfile', JSON.stringify(p)); navigate('/recommendations') }
            }}>
              {step===TOTAL ? '🔍 Znajdź karmy →' : 'Dalej →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
""")

    write(PROJECT / "src" / "pages" / "Recommendations.tsx", """\
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PetProfile, ScoredProduct } from '../types'
import { getRecommendations, calculateDailyCalories } from '../lib/recommender'
import { useProducts } from '../hooks/useProducts'

const PLANS = [
  { id:'starter' as const, name:'Podstawowy', emoji:'🌱', features:['1 rodzaj karmy','Dostawa co 30 dni','1 pupil'], discount:0, maxFoods:1, featured:false },
  { id:'comfort' as const, name:'Komfortowy', emoji:'⭐', features:['Do 2 rodzajów karm','Dostawa co 14–30 dni','Do 2 pupili','Rabat 5%','Darmowa dostawa od 120 PLN'], discount:5, maxFoods:2, featured:true },
  { id:'premium' as const, name:'Premium', emoji:'💎', features:['Do 4 rodzajów karm','Dowolna częstotliwość','Nieograniczone pupile','Rabat 10%','Zawsze darmowa dostawa'], discount:10, maxFoods:4, featured:false },
]

export default function Recommendations() {
  const navigate = useNavigate()
  const { products, loading } = useProducts()
  const [profile, setProfile] = useState<PetProfile|null>(null)
  const [recs, setRecs] = useState<ScoredProduct[]>([])
  const [plan, setPlan] = useState<'starter'|'comfort'|'premium'>('comfort')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    const s = sessionStorage.getItem('quizProfile')
    if (s) setProfile(JSON.parse(s))
  }, [])

  useEffect(() => {
    if (profile && products.length > 0) setRecs(getRecommendations(products, profile))
  }, [profile, products])

  const planObj = PLANS.find(p=>p.id===plan)!
  const dailyCal = profile ? calculateDailyCalories(profile.weight_kg, profile.age_group, profile.activity_level, profile.species) : 0

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x=>x!==id)
      if (prev.length >= planObj.maxFoods) { alert(`Plan ${planObj.name} pozwala na max ${planObj.maxFoods} rodzaj(e) karmy`); return prev }
      return [...prev, id]
    })
  }

  if (loading||!profile) return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <p style={{fontFamily:'Lora,Georgia,serif', color:'#1b5c3a', fontSize:'1.25rem'}}>🔍 Szukamy najlepszych karm...</p>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>

        {/* Profil */}
        <div style={{background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.5rem', marginBottom:'2rem', display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'center'}}>
          <span style={{fontSize:'2.5rem'}}>{profile.species==='cat'?'🐱':'🐶'}</span>
          <div style={{flex:1}}>
            <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem'}}>{profile.name||'Twój pupil'}</h1>
            <p style={{color:'#6b7280', fontSize:'0.875rem'}}>
              {profile.age_group==='kitten'?'Kocię/Szczenię':profile.age_group==='adult'?'Dorosły':'Senior'} · {profile.weight_kg} kg · {profile.activity_level==='low'?'Mała aktywność':profile.activity_level==='medium'?'Umiarkowana':'Bardzo aktywny'}
            </p>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'1.75rem', fontWeight:700, color:'#1b5c3a'}}>{dailyCal} kcal</div>
            <div style={{fontSize:'0.75rem', color:'#6b7280'}}>dziennego zapotrzebowania</div>
          </div>
        </div>

        <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem', marginBottom:'0.5rem'}}>Rekomendowane karmy</h2>
        <p style={{color:'#6b7280', fontSize:'0.875rem', marginBottom:'1.5rem'}}>
          Wybierz do {planObj.maxFoods} karm (plan {planObj.name}). Wybrano: {selected.length}/{planObj.maxFoods}
        </p>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem', marginBottom:'3rem'}}>
          {recs.map(prod => {
            const isSel = selected.includes(prod.id)
            return (
              <div key={prod.id} onClick={()=>toggle(prod.id)}
                style={{background:'white', borderRadius:'1rem', border:`2px solid ${isSel?'#1b5c3a':'#E8DFD0'}`, padding:'1.25rem', cursor:'pointer', background:isSel?'#f0f7f3':'white', transition:'all 0.2s'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.75rem'}}>
                  <div style={{flex:1, marginRight:'0.75rem'}}>
                    <p style={{fontSize:'0.8rem', fontWeight:600, lineHeight:1.4, marginBottom:'0.5rem'}}>{prod.nazwa.substring(0,70)}{prod.nazwa.length>70?'...':''}</p>
                    <div style={{display:'flex', gap:'0.25rem', flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.7rem', padding:'2px 8px', borderRadius:20, background:prod.food_type==='wet'?'#dbeafe':'#fef3c7', color:prod.food_type==='wet'?'#1d4ed8':'#92400e'}}>
                        {prod.food_type==='wet'?'💧 Mokra':'🥜 Sucha'}
                      </span>
                      {prod.is_grain_free && <span style={{fontSize:'0.7rem', padding:'2px 8px', borderRadius:20, background:'#d9ede2', color:'#1b5c3a'}}>🌿 Bezzbożowa</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right', flexShrink:0}}>
                    <div style={{fontWeight:700, color:'#1b5c3a', fontSize:'1rem'}}>{prod.cena?.toFixed(2)} zł</div>
                    {isSel && <div style={{fontSize:'0.7rem', color:'#1b5c3a'}}>✓ Wybrana</div>}
                  </div>
                </div>
                <div style={{display:'flex', gap:'0.5rem', marginBottom:'0.75rem'}}>
                  {[{l:'Białko',v:prod.bialko},{l:'Tłuszcz',v:prod.tluszcz}].filter(n=>n.v).map(n=>(
                    <div key={n.l} style={{flex:1, background:'#F9F7F4', borderRadius:'0.5rem', padding:'0.4rem', textAlign:'center'}}>
                      <div style={{fontSize:'0.65rem', color:'#6b7280'}}>{n.l}</div>
                      <div style={{fontSize:'0.75rem', fontWeight:600}}>{n.v}</div>
                    </div>
                  ))}
                </div>
                {prod.reasons.map((r,i) => <div key={i} style={{fontSize:'0.75rem', color:'#1b5c3a', display:'flex', gap:'0.25rem', marginBottom:'0.2rem'}}><span>✓</span>{r}</div>)}
                {prod.warnings.map((w,i) => <div key={i} style={{fontSize:'0.75rem', color:'#d97706', display:'flex', gap:'0.25rem', marginBottom:'0.2rem'}}><span>⚠</span>{w}</div>)}
              </div>
            )
          })}
        </div>

        {/* Plany */}
        <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem', marginBottom:'1.5rem'}}>Wybierz plan subskrypcji</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem', marginBottom:'2rem'}}>
          {PLANS.map(pl => (
            <div key={pl.id} onClick={()=>setPlan(pl.id)}
              style={{background:'white', borderRadius:'1rem', border:`2px solid ${plan===pl.id?'#1b5c3a':'#E8DFD0'}`, padding:'1.5rem', cursor:'pointer', position:'relative', transform:pl.featured?'translateY(-4px)':'none', transition:'all 0.2s'}}>
              {pl.featured && <div style={{position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#C4622D', color:'white', fontSize:'0.7rem', padding:'3px 12px', borderRadius:20}}>Polecany</div>}
              <div style={{fontSize:'2rem', marginBottom:'0.5rem'}}>{pl.emoji}</div>
              <h3 style={{fontFamily:'Lora,Georgia,serif', marginBottom:'0.5rem'}}>{pl.name}</h3>
              {pl.discount>0 && <div style={{color:'#C4622D', fontSize:'0.875rem', fontWeight:600, marginBottom:'0.5rem'}}>Rabat {pl.discount}%</div>}
              <ul style={{listStyle:'none', padding:0, fontSize:'0.8rem', color:'#6b7280'}}>
                {pl.features.map((f,i)=><li key={i} style={{marginBottom:'0.25rem'}}>✓ {f}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div style={{textAlign:'center'}}>
          <button onClick={()=>{ sessionStorage.setItem('selectedPlan',plan); sessionStorage.setItem('selectedProducts',JSON.stringify(selected)); navigate('/checkout') }}
            disabled={selected.length===0} className="btn-primary"
            style={{fontSize:'1.125rem', padding:'1rem 3rem', opacity:selected.length===0?0.4:1}}>
            {selected.length===0 ? 'Wybierz min. 1 karmę' : `Zamów plan ${planObj.name} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
""")


def write_admin_import():
    write(PROJECT / "src" / "pages" / "AdminImport.tsx", """\
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'

interface Row { [key: string]: string }

function detectSpecies(n: string): 'cat'|'dog'|'both' {
  const s = n.toLowerCase()
  if (s.includes('dla psa i kota')) return 'both'
  if (s.includes('dla psa')||s.includes('szczeniąt')||s.includes('puppy')) return 'dog'
  return 'cat'
}
function detectType(n: string, w: string): 'dry'|'wet' {
  try { const v=parseFloat((w||'').replace('%','').replace(',','.')); if(!isNaN(v)) return v>20?'wet':'dry' } catch {}
  return /sucha|suche/.test(n.toLowerCase()) ? 'dry' : 'wet'
}
function analyzeIngredients(s: string) {
  if (!s) return { is_grain_free:true, proteins:[], meat_percent:null }
  const sl = s.toLowerCase()
  const grains = ['pszenica','kukurydza','ryż','gluten','owies','jęczmień','żyto','mąka zbożowa']
  const is_grain_free = !grains.some(g=>sl.includes(g))
  const pm: Record<string,string[]> = { chicken:['kurczak','drób'], salmon:['łosoś'], beef:['wołowina'], lamb:['jagnięcina'], pork:['wieprzowina'], rabbit:['królik'], tuna:['tuńczyk'], turkey:['indyk'] }
  const proteins = Object.entries(pm).filter(([,w])=>w.some(x=>sl.includes(x))).map(([k])=>k)
  const m = sl.match(/(\\d+)[,.]?\\d*%\\s*(mięso|kurczak|łosoś|wołowina|indyk|jagnięcina|królik|wieprzowina)/)
  return { is_grain_free, proteins, meat_percent: m?parseInt(m[1]):null }
}

export default function AdminImport() {
  const [rows, setRows] = useState<Row[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState('')
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback((files: File[]) => {
    Papa.parse<Row>(files[0], { header:true, skipEmptyLines:true, complete: r => setRows(r.data) })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept:{'text/csv':['.csv']}, maxFiles:1 })

  const doImport = async () => {
    setImporting(true); setProgress(0)
    const products = rows.map(r => {
      const { is_grain_free, proteins, meat_percent } = analyzeIngredients(r['Skład']||'')
      return {
        nazwa: (r['Nazwa']||'').substring(0,200),
        cena: parseFloat(r['Cena'])||null,
        bialko: r['Białko']||null, tluszcz: r['Tłuszcz']||null, wlokno: r['Włókno']||null,
        wilgotnosc: r['Wilgotność']||null, energia: r['Energia']||null, sklad: r['Skład']||null,
        species: detectSpecies(r['Nazwa']||''),
        food_type: detectType(r['Nazwa']||'', r['Wilgotność']||''),
        is_grain_free, proteins, meat_percent,
      }
    })
    let ok = 0
    for (let i=0; i<products.length; i+=100) {
      const { error } = await supabase.from('products').insert(products.slice(i,i+100))
      if (!error) ok += Math.min(100, products.length-i)
      setProgress(Math.round(((i+100)/products.length)*100))
    }
    setImporting(false)
    setResult(`✅ Zaimportowano ${ok} z ${products.length} produktów`)
  }

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:800, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'0.5rem'}}>Import produktów CSV</h1>
        <p style={{color:'#6b7280', marginBottom:'2rem'}}>Prześlij plik pelne_dane_analityczne_v3.csv</p>

        <div {...getRootProps()} style={{border:`2px dashed ${isDragActive?'#1b5c3a':'#E8DFD0'}`, borderRadius:'1rem', padding:'3rem', textAlign:'center', cursor:'pointer', background:isDragActive?'#f0f7f3':'white', marginBottom:'1.5rem', transition:'all 0.2s'}}>
          <input {...getInputProps()} />
          <div style={{fontSize:'3rem', marginBottom:'0.75rem'}}>📁</div>
          <p style={{color:'#6b7280'}}>{isDragActive?'Upuść plik...':'Przeciągnij plik CSV lub kliknij, żeby wybrać'}</p>
        </div>

        {rows.length>0 && (
          <>
            <div style={{background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.5rem', marginBottom:'1.5rem', overflowX:'auto'}}>
              <p style={{fontWeight:600, marginBottom:'0.75rem'}}>Podgląd (pierwsze 5 z {rows.length} wierszy):</p>
              <table style={{fontSize:'0.75rem', width:'100%', borderCollapse:'collapse'}}>
                <thead><tr style={{borderBottom:'1px solid #E8DFD0'}}>
                  <th style={{textAlign:'left', padding:'0.5rem'}}>Nazwa</th>
                  <th style={{padding:'0.5rem'}}>Cena</th>
                  <th style={{padding:'0.5rem'}}>Gatunek</th>
                  <th style={{padding:'0.5rem'}}>Typ</th>
                </tr></thead>
                <tbody>
                  {rows.slice(0,5).map((r,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                      <td style={{padding:'0.5rem'}}>{(r['Nazwa']||'').substring(0,55)}...</td>
                      <td style={{padding:'0.5rem', textAlign:'center'}}>{r['Cena']} zł</td>
                      <td style={{padding:'0.5rem', textAlign:'center'}}>{detectSpecies(r['Nazwa']||'')}</td>
                      <td style={{padding:'0.5rem', textAlign:'center'}}>{detectType(r['Nazwa']||'',r['Wilgotność']||'')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importing && (
              <div style={{marginBottom:'1rem'}}>
                <div style={{height:8, background:'#E8DFD0', borderRadius:4, overflow:'hidden'}}>
                  <div style={{height:'100%', background:'#1b5c3a', width:`${progress}%`, transition:'width 0.3s'}} />
                </div>
                <p style={{fontSize:'0.875rem', color:'#6b7280', marginTop:'0.25rem', textAlign:'center'}}>{progress}%</p>
              </div>
            )}

            <button onClick={doImport} disabled={importing} className="btn-primary" style={{width:'100%', padding:'1rem', fontSize:'1rem'}}>
              {importing ? '⏳ Importuję...' : `📥 Importuj ${rows.length} produktów do bazy Supabase`}
            </button>
          </>
        )}

        {result && (
          <div style={{marginTop:'1.5rem', padding:'1rem', background:'#d9ede2', borderRadius:'0.75rem', color:'#1b5c3a', fontWeight:600}}>
            {result}
          </div>
        )}
      </div>
    </div>
  )
}
""")


# ═══════════════════════════════════════════════════════════════════════════════
#  GIT
# ═══════════════════════════════════════════════════════════════════════════════

def init_git():
    code, out, _ = run("git status")
    if code != 0:
        run("git init")
        run("git branch -M main")
        info("Git zainicjowany")
    else:
        info("Git już zainicjowany")

    run("git add .")
    code, out, err = run('git commit -m "feat: PawBox — kompletna aplikacja subskrypcyjna karm"')
    if code == 0:
        ok("Git commit utworzony")
    else:
        warn(f"Git commit: {err.strip()[:100]}")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{B}{'═'*55}")
    print("  🐾  PawBox Setup Script")
    print(f"{'═'*55}{E}\n")

    if not PROJECT.exists():
        err(f"Katalog {PROJECT} nie istnieje!")
        err("Utwórz projekt Vite: npm create vite@latest pawbox -- --template react-ts")
        sys.exit(1)

    info(f"Projekt: {PROJECT}")

    # Wykryj Tailwind
    tw = detect_tailwind_version()

    # Instaluj zależności
    install_deps(tw)

    # Utwórz katalogi
    for d in ["src/types","src/lib","src/data","src/hooks","src/pages",
              "src/components/layout","src/components/ui","src/components/quiz",
              "src/components/products","src/components/subscription"]:
        (PROJECT / d).mkdir(parents=True, exist_ok=True)

    # Zapisz wszystkie pliki
    info("Zapisuję pliki projektu...")
    write_vite_config(tw)
    write_tailwind_config(tw)
    write_index_css(tw)
    write_gitignore()
    write_env_example()
    write_types()
    write_supabase_client()
    write_recommender()
    write_seed()
    write_hooks()
    write_app()
    write_layout()
    write_pages()
    write_quiz_and_recs()
    write_admin_import()

    # Git
    init_git()

    print(f"\n{G}{'═'*55}")
    print("  ✅  Setup zakończony!")
    print(f"{'═'*55}{E}")
    print(f"""
{Y}Następne kroki:{E}

1. Uzupełnij klucze Supabase w {B}~/pawbox/.env.local{E}
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...

2. Uruchom serwer deweloperski:
   {G}cd ~/pawbox && npm run dev{E}

3. Otwórz http://localhost:5173

4. Zaimportuj CSV przez:
   http://localhost:5173/admin/import

5. Deploy na Vercel:
   {G}vercel{E}
""")

if __name__ == "__main__":
    main()
