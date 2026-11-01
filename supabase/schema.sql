-- ============================================================================
--  MenteExperta · TTC Corporation
--  Schema para Supabase (Postgres)
--
--  COMO USAR
--  1. Supabase -> SQL Editor -> New query
--  2. Cola este ficheiro inteiro e clica em RUN
--  3. Depois: Storage -> confirma que o bucket "ebooks" foi criado (privado)
--
--  É idempotente: pode ser executado mais de uma vez sem duplicar nada.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Produtos (ebooks) — preço editável no painel /admin
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          text primary key,
  name        text        not null,
  tagline     text,
  price       numeric(12, 2) not null check (price >= 0),
  features    jsonb       not null default '[]'::jsonb,
  premium     boolean     not null default false,
  pdf_path    text,
  pdf_name    text,
  active      boolean     not null default true,
  sort_order  integer     not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Pedidos — PIX (InfiniGate) e e-Mola (Moçambique, revisão manual)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  product_id           text        not null references public.products (id),
  amount               numeric(12, 2) not null,
  currency             text        not null,               -- 'MT' | 'BRL'
  method               text        not null,               -- 'emola' | 'pix'
  country              text,                              -- 'MZ', 'BR', ...

  -- pending          -> cobrança PIX criada, à espera do pagamento
  -- awaiting_review  -> cliente MZ enviou comprovativo, à espera da equipa
  -- paid             -> pagamento confirmado
  -- delivered        -> PDF entregue
  -- cancelled / expired
  status               text        not null default 'pending',

  customer_name        text,
  customer_email       text,
  customer_contact     text,                              -- WhatsApp ou e-mail para entrega
  document             text,                              -- CPF do pagador (PIX)

  -- e-Mola (Moçambique)
  emola_number         text,                              -- número de onde transferiu
  emola_target         text,                              -- número de destino (empresa/pessoal)
  confirmation_message text,                              -- mensagem/comprovativo da transferência

  -- PIX (InfiniGate)
  payment_provider     text,                              -- 'infinigate'
  payment_reference    text unique,                       -- id devolvido pela InfiniGate
  pix_qrcode           text,                              -- copia-e-cola
  pix_qrcode_image     text,                              -- data:image/png;base64,...

  paid_at              timestamptz,
  delivered_at         timestamptz,
  admin_note           text,
  metadata             jsonb       not null default '{}'::jsonb
);

create index if not exists orders_status_idx      on public.orders (status);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);
create index if not exists orders_method_idx      on public.orders (method);

-- ---------------------------------------------------------------------------
-- 2b. Carteiras móveis (Moçambique) — número editável em /admin > Pagamentos
--     id: 'emola' | 'mpesa'
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id          text primary key,
  label       text        not null,
  number      text        not null,
  holder      text        not null default '',
  note        text        not null default '',
  active      boolean     not null default true,
  sort_order  integer     not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Visitas ao site
-- ---------------------------------------------------------------------------
create table if not exists public.site_visits (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  path        text,
  country     text,
  referrer    text,
  user_agent  text,
  ip_hash     text,
  session_id  text
);

create index if not exists site_visits_created_at_idx on public.site_visits (created_at desc);
create index if not exists site_visits_session_idx    on public.site_visits (session_id);

-- ---------------------------------------------------------------------------
-- 3b. Mensagens do chat de apoio (widget TTC Corporation)
--     Cada visitante tem um thread identificado pelo session_id do chat.
--     author: 'visitor' | 'assistant' (IA) | 'admin' (equipa) | 'system'
--     kind:   'message' | 'human_request'
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  session_id  text        not null,
  author      text        not null default 'visitor',
  kind        text        not null default 'message',
  content     text        not null,
  admin_name  text,
  country     text,
  page        text,
  metadata    jsonb       not null default '{}'::jsonb
);

create index if not exists support_messages_session_idx
  on public.support_messages (session_id, created_at);
create index if not exists support_messages_created_idx
  on public.support_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists payment_methods_touch_updated_at on public.payment_methods;
create trigger payment_methods_touch_updated_at
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
--    Todo o acesso é feito pelo servidor com a service_role key, que ignora
--    o RLS. Nenhuma política pública é criada de propósito.
-- ---------------------------------------------------------------------------
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.site_visits enable row level security;
alter table public.support_messages enable row level security;
alter table public.payment_methods enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Storage: bucket privado para os PDFs dos ebooks
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Produtos iniciais (edição Beta e Premium)
-- ---------------------------------------------------------------------------
insert into public.products (id, name, tagline, price, features, premium, sort_order)
values
  (
    'beta',
    'Beta',
    'O primeiro passo',
    19.90,
    '["Ebook digital","Como Fazer 100K Antes de 2027","Versão Beta"]'::jsonb,
    false,
    1
  ),
  (
    'premium',
    'Premium',
    'Vá além do essencial',
    399.89,
    '["Ebook digital","Estratégias mais avançadas","Conteúdo focado em acelerar a execução"]'::jsonb,
    true,
    2
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7b. Carteiras móveis iniciais (editáveis em /admin > Pagamentos)
-- ---------------------------------------------------------------------------
insert into public.payment_methods (id, label, number, holder, note, sort_order)
values
  (
    'emola',
    'e-Mola',
    '8738373838',
    'MenteExperta',
    'Transferência e-Mola para a conta MenteExperta.',
    1
  ),
  (
    'mpesa',
    'M-Pesa',
    '8783838929',
    'Experience Beta',
    'Transferência M-Pesa para a conta MenteExperta.',
    2
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Verificação rápida
-- ---------------------------------------------------------------------------
-- select * from public.products order by sort_order;
-- select * from public.payment_methods order by sort_order;
-- select status, count(*) from public.orders group by status;
-- select count(*) from public.site_visits;
-- select session_id, count(*) from public.support_messages group by session_id;
