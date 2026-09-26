create function auth.session_profile(p_token_hash text)
returns table(id uuid,display_name text,email text,role public.user_role,active boolean)
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select p.id,p.display_name,p.email,p.role,p.active
  from auth.sessions s join public.profiles p on p.id=s.user_id
  where s.token_hash=p_token_hash and s.expires_at>now()
$$;
revoke all on function auth.session_profile(text) from public;
grant execute on function auth.session_profile(text) to waaat_app;

create function public.create_local_user(p_email text,p_password_hash text,p_display_name text)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare new_id uuid;
begin
  perform pg_advisory_xact_lock(88001);
  perform public.require_admin();
  if p_email is null or length(p_email) not between 3 and 254
    or p_password_hash is null or p_password_hash not like 'scrypt$%'
    or p_display_name is null or length(trim(p_display_name)) not between 1 and 100 then
    raise exception 'Invalid user details' using errcode='22023';
  end if;
  insert into auth.users(email,password_hash,raw_user_meta_data)
  values(lower(trim(p_email)),p_password_hash,jsonb_build_object('display_name',trim(p_display_name)))
  returning id into new_id;
  perform public.manage_user(new_id,'STAFF',true,p_display_name);
  return new_id;
end $$;
revoke all on function public.create_local_user(text,text,text) from public;
grant execute on function public.create_local_user(text,text,text) to authenticated;
