-- Apply after the supplied reference schema. All application writes are audited.
alter table public.profiles add column active boolean not null default true;
alter table public.profiles add column email text not null default '';
alter table public.products alter column price_paise drop not null;
alter table public.products add column seed_key text unique;
alter table public.products add column source_notes text not null default '';
alter table public.products add constraint product_billable check (not active or (price_paise is not null and not needs_confirmation));
alter table public.products add constraint product_price_limit check (price_paise <= 1000000000);
alter table public.products add constraint product_name_valid check (length(trim(name)) between 1 and 160);
alter table public.products add constraint product_unit_valid check (length(trim(unit_label)) between 1 and 40);
alter table public.categories add constraint category_name_valid check (length(trim(name)) between 1 and 100);
create unique index products_active_name on public.products(category_id, lower(trim(name))) where active;
alter table public.bills add column request_payload jsonb not null;
alter table public.bills add column business_name_snapshot text not null;
alter table public.bills add column receipt_footer_snapshot text not null;
alter table public.bill_items add column unit_label_snapshot text not null;
alter table public.bill_items add constraint quantity_limit check (quantity <= 999);
create unique index bill_items_product on public.bill_items(bill_id, product_id);
create index bills_operator_date on public.bills(created_by, created_at desc);

create table public.settings (
  id boolean primary key default true check (id),
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  receipt_footer text not null check (length(trim(receipt_footer)) between 1 and 200),
  updated_at timestamptz not null default now()
);
insert into public.settings(id, display_name, receipt_footer)
values (true, 'WAAAT THE EVENTS', 'PLEASE DRINK RESPONSIBLY');

create function public.app_role() returns public.user_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create function public.require_operator() returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.profiles where id = auth.uid() and active for share;
  if not found then raise exception 'Authentication required or account inactive' using errcode = '42501'; end if;
  return auth.uid();
end $$;
create function public.require_admin() returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_operator();
  if public.app_role() is distinct from 'ADMIN'::public.user_role then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Metadata can supply a name, never a role or active status. Activation is explicit.
  insert into public.profiles(id, display_name, email, role, active)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Operator'), 100), coalesce(new.email, ''), 'STAFF', false);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_auth_user();
-- Existing Supabase Auth accounts also start inactive until explicitly provisioned.
insert into public.profiles(id,display_name,email,role,active)
select id,left(coalesce(nullif(trim(raw_user_meta_data->>'display_name'),''),split_part(email,'@',1),'Operator'),100),coalesce(email,''),'STAFF',false
from auth.users on conflict(id) do nothing;

create function public.audit_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid();
begin
  new.updated_at := now();
  if actor is null then return new; end if; -- trusted SQL migration/bootstrap only
  perform public.require_admin();
  if tg_table_name = 'products' then
    if tg_op = 'INSERT' then
      insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values(actor, 'PRODUCT_CREATED', 'product', new.id, to_jsonb(new));
    else
      if old.price_paise is distinct from new.price_paise then
        insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
        values(actor, 'PRODUCT_PRICE_CHANGED', 'product', new.id,
          jsonb_build_object('old_price',old.price_paise::text,'new_price',new.price_paise::text));
      end if;
      if old.active is distinct from new.active then
        insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
        values(actor, case when new.active then 'PRODUCT_ACTIVATED' else 'PRODUCT_DEACTIVATED' end, 'product', new.id, '{}');
      end if;
      insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values(actor, 'PRODUCT_UPDATED', 'product', new.id, jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)));
    end if;
  elsif tg_table_name = 'categories' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values(actor, 'CATEGORY_' || case when tg_op='INSERT' then 'CREATED' else 'UPDATED' end, 'category', new.id, to_jsonb(new));
  elsif tg_table_name = 'settings' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values(actor, 'SETTINGS_UPDATED', 'settings', '00000000-0000-0000-0000-000000000001', to_jsonb(new));
  end if;
  return new;
end $$;
create trigger products_audit before insert or update on public.products for each row execute function public.audit_change();
create trigger categories_audit before insert or update on public.categories for each row execute function public.audit_change();
create trigger settings_audit before update on public.settings for each row execute function public.audit_change();

create function public.protect_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'bills' and tg_op = 'UPDATE' then
    perform public.require_admin();
    if old.status = 'COMPLETED' and new.status = 'VOID'
      and length(trim(new.void_reason)) between 1 and 500
      and new.voided_by = auth.uid() and new.voided_at is not null
      and (to_jsonb(old) - array['status','void_reason','voided_by','voided_at']) =
          (to_jsonb(new) - array['status','void_reason','voided_by','voided_at']) then
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(auth.uid(),'BILL_VOIDED','bill',new.id,jsonb_build_object('reason',new.void_reason,'billNumber',new.bill_number));
      return new;
    end if;
  end if;
  raise exception 'Historical records are immutable' using errcode = '42501';
end $$;
create trigger bills_immutable before update or delete on public.bills for each row execute function public.protect_history();
create trigger bill_items_immutable before update or delete on public.bill_items for each row execute function public.protect_history();
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function public.protect_history();

create function public.bill_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
select jsonb_build_object(
  'id',b.id,'billNumber',b.bill_number,'status',b.status,'paymentMethod',b.payment_method,
  'subtotalPaise',b.subtotal_paise::text,'totalPaise',b.total_paise::text,'createdAt',b.created_at,
  'createdBy',b.created_by,'operatorName',p.display_name,'voidReason',b.void_reason,'voidedAt',b.voided_at,
  'businessName',b.business_name_snapshot,'receiptFooter',b.receipt_footer_snapshot,
  'items',coalesce((select jsonb_agg(jsonb_build_object('productId',i.product_id,'productName',i.product_name_snapshot,
    'unitLabel',i.unit_label_snapshot,'unitPricePaise',i.unit_price_paise::text,'quantity',i.quantity,
    'lineTotalPaise',i.line_total_paise::text) order by i.product_name_snapshot, i.product_id)
    from public.bill_items i where i.bill_id=b.id),'[]'::jsonb))
from public.bills b join public.profiles p on p.id=b.created_by where b.id=p_id
  and public.app_role() is not null and (b.created_by=auth.uid() or public.app_role()='ADMIN')
$$;

create function public.create_bill(p_idempotency_key uuid, p_payment_method text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid; request jsonb; existing public.bills; item record; product public.products;
  total bigint := 0; line_items jsonb := '[]'; seq bigint; bill_id uuid := gen_random_uuid(); branding public.settings;
begin
  actor := public.require_operator();
  if p_idempotency_key is null or p_payment_method is null or p_payment_method not in ('CASH','UPI','CARD')
    or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid bill request' using errcode='22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'A bill requires 1 to 200 distinct products' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'object'
    or not (x ? 'productId' and x ? 'quantity') or jsonb_typeof(x->'quantity')<>'number'
    or (x->>'quantity') !~ '^[0-9]{1,3}$') then
    raise exception 'Invalid item or quantity' using errcode='22023';
  end if;
  select jsonb_build_object('paymentMethod',p_payment_method,'items',jsonb_agg(
    jsonb_build_object('productId',(x->>'productId')::uuid,'quantity',(x->>'quantity')::integer)
    order by (x->>'productId')::uuid)) into request from jsonb_array_elements(p_items) x;
  if (select count(distinct x->>'productId') from jsonb_array_elements(request->'items') x) <> jsonb_array_length(p_items) then
    raise exception 'Duplicate product IDs are not allowed' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into existing from public.bills where idempotency_key=p_idempotency_key;
  if found then
    if existing.created_by <> actor or existing.request_payload <> request then
      raise exception 'Idempotency key already used for another request' using errcode='23505';
    end if;
    return public.bill_json(existing.id);
  end if;
  -- Lock categories first, then products in stable order; admin edits cannot race a sale.
  perform c.id from public.categories c where c.id in
    (select p.category_id from public.products p join jsonb_array_elements(request->'items') x on p.id=(x->>'productId')::uuid)
    order by c.id for share;
  for item in select (x->>'productId')::uuid id,(x->>'quantity')::integer quantity from jsonb_array_elements(request->'items') x loop
    if item.quantity not between 1 and 999 then raise exception 'Invalid quantity' using errcode='22023'; end if;
    select * into product from public.products where id=item.id for share;
    if not found then raise exception 'Product does not exist' using errcode='22023'; end if;
    perform 1 from public.categories where id=product.category_id and active for share;
    if not found or not product.active or product.needs_confirmation or product.price_paise is null then
      raise exception 'Product is unavailable: %',product.name using errcode='22023';
    end if;
    total := total + product.price_paise * item.quantity;
    line_items := line_items || jsonb_build_object('id',product.id,'name',product.name,'unit',product.unit_label,'price',product.price_paise,'quantity',item.quantity);
  end loop;
  select * into strict branding from public.settings where id=true;
  seq := nextval('public.bill_sequence');
  insert into public.bills(id,bill_sequence_no,bill_number,payment_method,subtotal_paise,total_paise,created_by,idempotency_key,request_payload,business_name_snapshot,receipt_footer_snapshot)
  values(bill_id,seq,'WAAAT-'||lpad(seq::text,greatest(4,length(seq::text)),'0'),p_payment_method::public.payment_method,total,total,actor,p_idempotency_key,request,branding.display_name,branding.receipt_footer);
  insert into public.bill_items(bill_id,product_id,product_name_snapshot,unit_label_snapshot,unit_price_paise,quantity,line_total_paise)
  select bill_id,(x->>'id')::uuid,x->>'name',x->>'unit',(x->>'price')::bigint,(x->>'quantity')::integer,(x->>'price')::bigint*(x->>'quantity')::integer from jsonb_array_elements(line_items) x;
  return public.bill_json(bill_id);
end $$;

create function public.void_bill(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Void reason is required (max 500 characters)' using errcode='22023'; end if;
  update public.bills set status='VOID',void_reason=trim(p_reason),voided_by=auth.uid(),voided_at=now() where id=p_id and status='COMPLETED';
  if not found then raise exception 'Bill not found or already void' using errcode='22023'; end if;
  return public.bill_json(p_id);
end $$;

create function public.manage_user(p_id uuid, p_role public.user_role, p_active boolean, p_display_name text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare previous public.profiles;
begin
  -- Serialize all role changes before locking any profile (including the caller).
  perform pg_advisory_xact_lock(88001);
  perform public.require_admin();
  if p_role is null or p_active is null or p_display_name is null or length(trim(p_display_name)) not between 1 and 100 then raise exception 'Invalid user details' using errcode='22023'; end if;
  select * into previous from public.profiles where id=p_id for update;
  if not found then raise exception 'User not found' using errcode='22023'; end if;
  if previous.role='ADMIN' and previous.active and (p_role<>'ADMIN' or not p_active)
    and not exists(select 1 from public.profiles where role='ADMIN' and active and id<>p_id) then
    raise exception 'Keep at least one active administrator' using errcode='22023';
  end if;
  update public.profiles set role=p_role,active=p_active,display_name=trim(p_display_name),updated_at=now() where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'USER_ROLE_CHANGED','profile',p_id,jsonb_build_object('oldRole',previous.role,'newRole',p_role,'oldActive',previous.active,'newActive',p_active));
end $$;

create function public.daily_report(p_date date) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if public.app_role() is distinct from 'ADMIN'::public.user_role then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_date is null then raise exception 'Date required' using errcode='22023'; end if;
  with day_bills as (
    select * from public.bills where created_at >= (p_date::timestamp at time zone 'Asia/Kolkata')
    and created_at < ((p_date+1)::timestamp at time zone 'Asia/Kolkata')
  ), top_items as (
    select i.product_id, (array_agg(i.product_name_snapshot order by b.created_at desc,b.id))[1] product_name_snapshot, sum(i.quantity) qty, sum(i.line_total_paise) sales
    from public.bill_items i join day_bills b on b.id=i.bill_id where b.status='COMPLETED'
    group by i.product_id order by qty desc,product_name_snapshot limit 20
  ) select jsonb_build_object('date',p_date,'completedBills',count(*) filter(where status='COMPLETED'),
    'completedSalesPaise',coalesce(sum(total_paise) filter(where status='COMPLETED'),0)::text,
    'paymentBreakdown',jsonb_build_object(
      'CASH',coalesce(sum(total_paise) filter(where status='COMPLETED' and payment_method='CASH'),0)::text,
      'UPI',coalesce(sum(total_paise) filter(where status='COMPLETED' and payment_method='UPI'),0)::text,
      'CARD',coalesce(sum(total_paise) filter(where status='COMPLETED' and payment_method='CARD'),0)::text),
    'voidCount',count(*) filter(where status='VOID'),
    'voidedAmountPaise',coalesce(sum(total_paise) filter(where status='VOID'),0)::text,
    'topItems',coalesce((select jsonb_agg(jsonb_build_object('productName',product_name_snapshot,'quantity',qty,'salesPaise',sales::text) order by qty desc,product_name_snapshot) from top_items),'[]'::jsonb))
  into result from day_bills;
  return result;
end $$;

-- RLS is enforced even when endpoints are bypassed and the public API is called directly.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or public.app_role()='ADMIN');
create policy categories_read on public.categories for select to authenticated using (public.app_role()='ADMIN' or (public.app_role()='STAFF' and active));
create policy products_read on public.products for select to authenticated using (public.app_role()='ADMIN' or (public.app_role()='STAFF' and active and not needs_confirmation and exists(select 1 from public.categories c where c.id=category_id and c.active)));
create policy bills_read on public.bills for select to authenticated using (public.app_role()='ADMIN' or (public.app_role()='STAFF' and created_by=auth.uid()));
create policy items_read on public.bill_items for select to authenticated using (exists(select 1 from public.bills b where b.id=bill_id));
create policy audit_read on public.audit_logs for select to authenticated using (public.app_role()='ADMIN');
create policy settings_read on public.settings for select to authenticated using (public.app_role() is not null);
create policy categories_insert on public.categories for insert to authenticated with check(public.app_role()='ADMIN');
create policy categories_update on public.categories for update to authenticated using(public.app_role()='ADMIN') with check(public.app_role()='ADMIN');
create policy products_insert on public.products for insert to authenticated with check(public.app_role()='ADMIN');
create policy products_update on public.products for update to authenticated using(public.app_role()='ADMIN') with check(public.app_role()='ADMIN');
create policy settings_update on public.settings for update to authenticated using(public.app_role()='ADMIN') with check(public.app_role()='ADMIN');

revoke all on public.profiles,public.categories,public.products,public.bills,public.bill_items,public.audit_logs,public.settings from anon,authenticated;
grant select on public.profiles,public.categories,public.products,public.bills,public.bill_items,public.audit_logs,public.settings to authenticated;
grant insert,update on public.categories,public.products to authenticated;
grant update on public.settings to authenticated;
revoke all on sequence public.bill_sequence from public,anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.app_role(),public.bill_json(uuid),public.create_bill(uuid,text,jsonb),public.void_bill(uuid,text),public.daily_report(date),public.manage_user(uuid,public.user_role,boolean,text) to authenticated;
