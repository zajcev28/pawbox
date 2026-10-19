-- PawBox: bezpieczeństwo katalogu + bezpieczny reimport karm
-- Uruchom raz w Supabase → SQL Editor, PRZED wdrożeniem kodu z tej gałęzi.
-- Całość w jednej transakcji: jeśli cokolwiek się nie uda, nic się nie zmieni.

begin;

-- 1. Nikt z przeglądarki (klucz anon) nie może już dopisywać produktów.
--    Import idzie wyłącznie przez GitHub Actions z kluczem service_role,
--    który i tak omija RLS.
drop policy if exists "products_insert" on products;

-- 2. Miękkie usuwanie: produkty, których nie ma już w CSV, są wyłączane, a nie kasowane.
alter table products add column if not exists is_active boolean not null default true;
alter table products add column if not exists opis text;
alter table products add column if not exists updated_at timestamptz not null default now();

-- 3. Scalenie duplikatów po nazwie (powstały przy wielokrotnych importach).
--    Zostaje najnowszy rekord; pozycje subskrypcji są przepinane na niego,
--    zanim stare rekordy zostaną usunięte.
with ranked as (
  select id,
         row_number()  over (partition by nazwa order by created_at desc, id) as rn,
         first_value(id) over (partition by nazwa order by created_at desc, id) as keep_id
  from products
)
update subscription_items si
set product_id = r.keep_id
from ranked r
where si.product_id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by nazwa order by created_at desc, id) as rn
  from products
)
delete from products p
using ranked r
where p.id = r.id and r.rn > 1;

-- 4. Nazwa jest kluczem importu (upsert on_conflict=nazwa).
alter table products drop constraint if exists products_nazwa_key;
alter table products add constraint products_nazwa_key unique (nazwa);

-- 5. Usunięcie produktu nie może już po cichu wyzerować karm w zamówieniach.
--    (Wcześniej ON DELETE SET NULL — każdy reimport odpinał karmy od subskrypcji.)
alter table subscription_items drop constraint if exists subscription_items_product_id_fkey;
alter table subscription_items
  add constraint subscription_items_product_id_fkey
  foreign key (product_id) references products(id) on delete restrict;

-- 6. Szybsze zapytania katalogu
create index if not exists products_species_active_idx on products (species, is_active);

commit;

-- Kontrola po migracji (uruchom osobno):
-- select count(*) as produkty, count(*) filter (where is_active) as aktywne from products;
-- select count(*) as pozycje_bez_karmy from subscription_items where product_id is null;
