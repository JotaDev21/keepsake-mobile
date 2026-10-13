-- Original wishes, notes and drawing rounds. Immutable events, validated writes.
create table if not exists public.couple_activity_events (
  id uuid primary key,
  sequence bigint generated always as identity unique,
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.members(id) on delete cascade,
  entity_id uuid not null,
  kind text not null check (kind in ('wish.create','wish.vote','wish.date','wish.done','wish.memory',
    'note.send','note.open','note.reply','game.start','game.guess','game.reveal')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_couple_sequence on public.couple_activity_events(couple_id, sequence);
create unique index if not exists activity_root on public.couple_activity_events(entity_id)
  where kind in ('wish.create','note.send','game.start');
create unique index if not exists activity_single_action on public.couple_activity_events(entity_id, kind)
  where kind in ('wish.done','wish.memory','game.reveal');
create unique index if not exists activity_open_once on public.couple_activity_events(entity_id, author_id)
  where kind = 'note.open';
alter table public.couple_activity_events enable row level security;
revoke all on public.couple_activity_events from anon, authenticated;
grant select on public.couple_activity_events to authenticated;
create policy "activity couple read" on public.couple_activity_events for select to authenticated
  using (couple_id = public.my_couple_id());

-- Push attempts are optional notifications, never delivery/read receipts.
create table if not exists public.couple_activity_notifications (
  event_id uuid primary key references public.couple_activity_events(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.members(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.couple_activity_notifications enable row level security;
revoke all on public.couple_activity_notifications from anon, authenticated;
grant select,insert,delete on public.couple_activity_notifications to service_role;

create or replace function public.publish_couple_activity(event jsonb)
returns public.couple_activity_events
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cid uuid := public.my_couple_id();
  actor uuid := auth.uid();
  eid uuid := (event->>'entityId')::uuid;
  event_id uuid := (event->>'id')::uuid;
  k text := event->>'kind';
  p jsonb := event->'payload';
  root public.couple_activity_events;
  existing public.couple_activity_events;
  result public.couple_activity_events;
  stroke jsonb;
  point jsonb;
  points integer := 0;
begin
  if actor is null or cid is null or cid <> (event->>'coupleId')::uuid then
    raise exception 'Conecte os dois perfis para compartilhar.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text, 0));
  select * into existing from public.couple_activity_events where id = event_id;
  if found then
    if existing.author_id <> actor or existing.couple_id <> cid or existing.entity_id <> eid
      or existing.kind <> k or existing.payload <> p then
      raise exception 'Identificador já utilizado.' using errcode = '22023';
    end if;
    return existing;
  end if;
  if k is null or k not in ('wish.create','wish.vote','wish.date','wish.done','wish.memory',
    'note.send','note.open','note.reply','game.start','game.guess','game.reveal') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text) > 250000
    or exists (select 1 from jsonb_object_keys(p) field where field not in ('text','drawing','photoPath','date','interested')) then
    raise exception 'Conteúdo inválido.' using errcode = '22023';
  end if;
  if p ? 'text' and (jsonb_typeof(p->'text') <> 'string' or char_length(p->>'text') > 2000) then
    raise exception 'Texto muito longo.' using errcode = '22023';
  end if;
  if p ? 'photoPath' and (jsonb_typeof(p->'photoPath') <> 'string'
    or p->>'photoPath' <> actor::text || '/' || event_id::text || '/photo.jpg') then
    raise exception 'Foto inválida.' using errcode = '22023';
  end if;
  if p ? 'drawing' then
    if jsonb_typeof(p->'drawing') <> 'array' or jsonb_array_length(p->'drawing') not between 1 and 80 then
      raise exception 'Desenho inválido.' using errcode = '22023';
    end if;
    for stroke in select value from jsonb_array_elements(p->'drawing') loop
      if jsonb_typeof(stroke) <> 'array' or jsonb_array_length(stroke) = 0 then
        raise exception 'Traço inválido.' using errcode = '22023';
      end if;
      points := points + jsonb_array_length(stroke);
      for point in select value from jsonb_array_elements(stroke) loop
        if jsonb_typeof(point->'x') is distinct from 'number' or jsonb_typeof(point->'y') is distinct from 'number'
          or (point->>'x')::numeric not between 0 and 1 or (point->>'y')::numeric not between 0 and 1 then
          raise exception 'Ponto inválido.' using errcode = '22023';
        end if;
      end loop;
    end loop;
    if points > 6000 then raise exception 'Desenho muito grande.' using errcode = '22023'; end if;
  end if;
  if (select count(*) from public.couple_activity_events where author_id = actor and created_at > now() - interval '1 day') >= 500 then
    raise exception 'Muitos envios. Tente novamente mais tarde.' using errcode = '54000';
  end if;
  select * into root from public.couple_activity_events where entity_id = eid
    and kind in ('wish.create','note.send','game.start');
  if k in ('wish.create','note.send','game.start') then
    if root.id is not null or eid <> event_id then raise exception 'Criação inválida.' using errcode = '22023'; end if;
    if k = 'wish.create' and (coalesce(btrim(p->>'text'),'') = '' or char_length(p->>'text') > 200 or p - 'text' <> '{}'::jsonb) then
      raise exception 'Escreva um desejo de até 200 caracteres.' using errcode = '22023';
    end if;
    if k = 'note.send' and ((coalesce(btrim(p->>'text'),'') = '' and not p ? 'drawing' and not p ? 'photoPath')
      or p - array['text','drawing','photoPath'] <> '{}'::jsonb) then
      raise exception 'Escreva, desenhe ou escolha uma foto.' using errcode = '22023';
    end if;
    if k = 'game.start' and (not p ? 'drawing' or p - 'drawing' <> '{}'::jsonb) then
      raise exception 'Desenhe antes de enviar.' using errcode = '22023';
    end if;
  else
    if root.id is null or root.couple_id <> cid or split_part(k,'.',1) <> split_part(root.kind,'.',1) then
      raise exception 'Atividade não encontrada.' using errcode = '22023';
    end if;
    if k in ('note.open','game.guess') and root.author_id = actor then
      raise exception 'Essa ação pertence ao outro perfil.' using errcode = '42501';
    end if;
    if k = 'game.reveal' and root.author_id <> actor then
      raise exception 'Só quem desenhou pode revelar.' using errcode = '42501';
    end if;
    if k = 'game.guess' and exists(select 1 from public.couple_activity_events where entity_id=eid and kind='game.reveal') then
      raise exception 'Esta rodada já terminou.' using errcode = '22023';
    end if;
    if k in ('note.reply','game.guess','game.reveal') and (coalesce(btrim(p->>'text'),'')='' or p - 'text' <> '{}'::jsonb
      or (k <> 'note.reply' and char_length(p->>'text') > 100)) then
      raise exception 'Resposta inválida.' using errcode = '22023';
    end if;
    if k = 'wish.vote' and (jsonb_typeof(p->'interested') is distinct from 'boolean' or p - 'interested' <> '{}'::jsonb) then
      raise exception 'Interesse inválido.' using errcode = '22023';
    end if;
    if k = 'wish.date' and (not p ? 'date' or p - 'date' <> '{}'::jsonb
      or (p->'date' <> 'null'::jsonb and (jsonb_typeof(p->'date') <> 'number' or (p->>'date')::numeric not between 0 and 4102444800000))) then
      raise exception 'Data inválida.' using errcode = '22023';
    end if;
    if k in ('wish.done','note.open') and p <> '{}'::jsonb then raise exception 'Ação inválida.' using errcode = '22023'; end if;
    if k = 'wish.memory' and (not exists(select 1 from public.couple_activity_events where entity_id=eid and kind='wish.done')
      or not p ? 'photoPath' or p - array['photoPath','text'] <> '{}'::jsonb) then
      raise exception 'Conclua o desejo e escolha uma foto.' using errcode = '22023';
    end if;
  end if;
  if k in ('wish.done','game.reveal') or k = 'note.open' then
    select * into existing from public.couple_activity_events where entity_id=eid and kind=k
      and (k <> 'note.open' or author_id=actor);
    if found then return existing; end if;
  end if;
  insert into public.couple_activity_events(id,couple_id,author_id,entity_id,kind,payload)
    values(event_id,cid,actor,eid,k,p) returning * into result;
  return result;
end $$;
revoke all on function public.publish_couple_activity(jsonb) from public, anon;
grant execute on function public.publish_couple_activity(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('couple-activity-media','couple-activity-media',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "activity photo own insert" on storage.objects for insert to authenticated
  with check(bucket_id='couple-activity-media' and (storage.foldername(name))[1]=auth.uid()::text and public.my_couple_id() is not null);
create policy "activity photo own update" on storage.objects for update to authenticated
  using(bucket_id='couple-activity-media' and (storage.foldername(name))[1]=auth.uid()::text)
  with check(bucket_id='couple-activity-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "activity photo read" on storage.objects for select to authenticated using(bucket_id='couple-activity-media' and (
  (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.couple_activity_events e
    where e.couple_id=public.my_couple_id() and e.payload->>'photoPath'=name)));
create policy "activity photo own delete" on storage.objects for delete to authenticated
  using(bucket_id='couple-activity-media' and (storage.foldername(name))[1]=auth.uid()::text);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='couple_activity_events') then
    alter publication supabase_realtime add table public.couple_activity_events;
  end if;
end $$;
