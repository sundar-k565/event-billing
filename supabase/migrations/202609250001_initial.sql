-- WAAAT POS V1 reference schema.
-- Codex should adapt this to the project's migration conventions.

create extension if not exists pgcrypto;

create type user_role as enum ('ADMIN', 'STAFF');
create type bill_status as enum ('COMPLETED', 'VOID');
create type payment_method as enum ('CASH', 'UPI', 'CARD');
create type category_group as enum ('ALCOHOL', 'FOOD', 'BEVERAGE');

create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null,
    role user_role not null default 'STAFF',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    group_type category_group not null,
    sort_order integer not null default 0 check (sort_order >= 0),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (name, group_type)
);

create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null references categories(id),
    name text not null,
    price_paise bigint not null check (price_paise >= 0),
    unit_label text not null,
    active boolean not null default true,
    needs_confirmation boolean not null default false,
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_products_category_active
    on products(category_id, active, sort_order);

create sequence if not exists bill_sequence start 1;

create table if not exists bills (
    id uuid primary key default gen_random_uuid(),
    bill_sequence_no bigint not null unique default nextval('bill_sequence'),
    bill_number text not null unique,
    status bill_status not null default 'COMPLETED',
    payment_method payment_method not null,
    subtotal_paise bigint not null check (subtotal_paise >= 0),
    total_paise bigint not null check (total_paise >= 0),
    created_by uuid not null references profiles(id),
    idempotency_key uuid not null unique,
    void_reason text,
    voided_by uuid references profiles(id),
    voided_at timestamptz,
    created_at timestamptz not null default now(),
    check (total_paise = subtotal_paise),
    check (
        (status = 'COMPLETED' and void_reason is null and voided_by is null and voided_at is null)
        or
        (status = 'VOID' and void_reason is not null and voided_by is not null and voided_at is not null)
    )
);

create index if not exists idx_bills_created_at on bills(created_at desc);
create index if not exists idx_bills_status on bills(status);
create index if not exists idx_bills_payment_method on bills(payment_method);

create table if not exists bill_items (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references bills(id) on delete restrict,
    product_id uuid not null references products(id),
    product_name_snapshot text not null,
    unit_price_paise bigint not null check (unit_price_paise >= 0),
    quantity integer not null check (quantity > 0),
    line_total_paise bigint not null check (line_total_paise >= 0),
    check (line_total_paise = unit_price_paise * quantity)
);

create index if not exists idx_bill_items_bill_id on bill_items(bill_id);

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references profiles(id),
    action text not null,
    entity_type text not null,
    entity_id uuid not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
