-- PawBox: jeden box na użytkownika, karmy przypisane do konkretnego pupila.
-- Uruchom raz w Supabase → SQL Editor, PRZED wdrożeniem kodu z gałęzi feat/multi-pet-box.

begin;

-- 1. Każda pozycja boxa wie, dla którego pupila jest
alter table subscription_items add column if not exists pet_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'subscription_items'::regclass and contype = 'f'
      and conname = 'subscription_items_pet_id_fkey'
  ) then
    alter table subscription_items
      add constraint subscription_items_pet_id_fkey
      foreign key (pet_id) references pets(id) on delete set null;
  end if;
end $$;

create index if not exists subscription_items_sub_pet_idx on subscription_items (subscription_id, pet_id);

-- 2. Stare pozycje bez pupila dostają pupila swojej subskrypcji
update subscription_items si
set pet_id = s.pet_id
from subscriptions s
where si.subscription_id = s.id and si.pet_id is null and s.pet_id is not null;

-- 3. Scalenie wielu niezakończonych subskrypcji jednego użytkownika w jedną (najnowszą).
--    Pozycje ze starszych są przenoszone, starsze dostają status 'cancelled'.
with ranked as (
  select id, user_id,
         row_number()    over (partition by user_id order by created_at desc, id) as rn,
         first_value(id) over (partition by user_id order by created_at desc, id) as keep_id
  from subscriptions
  where status <> 'cancelled'
)
update subscription_items si
set subscription_id = r.keep_id
from ranked r
where si.subscription_id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc, id) as rn
  from subscriptions
  where status <> 'cancelled'
)
update subscriptions s
set status = 'cancelled'
from ranked r
where s.id = r.id and r.rn > 1;

-- 4. Po scaleniu ta sama karma dla tego samego pupila mogła pojawić się dwa razy — zostaw jedną
with dups as (
  select id, row_number() over (
    partition by subscription_id, product_id, pet_id order by id
  ) as rn
  from subscription_items
)
delete from subscription_items si using dups d where si.id = d.id and d.rn > 1;

-- 5. Od teraz najwyżej jeden aktywny lub wstrzymany box na użytkownika
create unique index if not exists subscriptions_one_open_per_user
  on subscriptions (user_id) where status <> 'cancelled';

-- 6. RLS: użytkownik widzi i zmienia tylko swój box i jego pozycje
--    (pupil w pozycji też musi należeć do niego)
alter table subscriptions      enable row level security;
alter table subscription_items enable row level security;

drop policy if exists pawbox_subs_own on subscriptions;
create policy pawbox_subs_own on subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists pawbox_items_own on subscription_items;
create policy pawbox_items_own on subscription_items
  for all to authenticated
  using (exists (select 1 from subscriptions s where s.id = subscription_id and s.user_id = auth.uid()))
  with check (
    exists (select 1 from subscriptions s where s.id = subscription_id and s.user_id = auth.uid())
    and (pet_id is null or exists (select 1 from pets p where p.id = pet_id and p.user_id = auth.uid()))
  );

commit;

-- Kontrola (uruchom osobno):
-- select count(*) as pozycje_bez_pupila from subscription_items where pet_id is null;
-- select user_id, count(*) from subscriptions where status <> 'cancelled' group by user_id having count(*) > 1;
