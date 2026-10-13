import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const { PGlite } = await import(process.env.ACTIVITY_PGLITE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const a = randomUUID(), b = randomUUID(), c = randomUUID();
const couple = randomUUID(), otherCouple = randomUUID();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth, storage to authenticated;
  create table public.couples(id uuid primary key);
  create table public.members(id uuid primary key, couple_id uuid references public.couples(id));
  create function public.my_couple_id() returns uuid language sql security definer stable as $$ select couple_id from public.members where id=auth.uid() $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid, bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
  create publication supabase_realtime;
  insert into public.couples values('${couple}'),('${otherCouple}');
  insert into public.members values('${a}','${couple}'),('${b}','${couple}'),('${c}','${otherCouple}');
`);
await db.exec(await readFile(new URL('../supabase/migrations/202610130001_couple_activities.sql', import.meta.url), 'utf8'));
async function asUser(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub='${uid}';`);
    return tx.query(sql, params);
  });
}
const publish = (uid, kind, payload, entityId, id = randomUUID(), cid = couple) => asUser(uid,
  'select (public.publish_couple_activity($1::jsonb)).*', [JSON.stringify({ id, coupleId: cid, entityId: entityId ?? id, kind, payload })]);

test('validated writes are idempotent and isolated between couples', async () => {
  const id = randomUUID();
  const first = await publish(a, 'wish.create', { text: 'Ver o mar' }, id, id);
  const second = await publish(a, 'wish.create', { text: 'Ver o mar' }, id, id);
  assert.equal(first.rows[0].sequence, second.rows[0].sequence);
  await assert.rejects(publish(b, 'wish.create', { text: 'Ver o mar' }, id, id));
  await assert.rejects(publish(c, 'wish.vote', { interested: true }, id));
  await assert.rejects(publish(c, 'wish.create', { text: 'Outro desejo' }, undefined, randomUUID(), couple));
  assert.equal((await asUser(c, 'select * from public.couple_activity_events')).rows.length, 0);
  assert.equal((await asUser(b, 'select * from public.couple_activity_events')).rows.length, 1);
  await assert.rejects(asUser(a, 'insert into public.couple_activity_events(id) values($1)', [randomUUID()]));
});
test('drawing round secrets cannot be submitted with the drawing and only its author reveals', async () => {
  const drawing = [[{ x: 0, y: 0 }, { x: 1, y: 1 }]];
  await assert.rejects(publish(a, 'game.start', { drawing, text: 'secret' }));
  await assert.rejects(publish(a, 'game.start', { drawing: [[{}]] }));
  await assert.rejects(publish(a, 'game.start', { drawing: [[{ x: -1, y: 0 }]] }));
  const round = randomUUID();
  await publish(a, 'game.start', { drawing }, round, round);
  await assert.rejects(publish(a, 'game.guess', { text: 'own guess' }, round));
  await publish(b, 'game.guess', { text: 'Girassol' }, round);
  await assert.rejects(publish(b, 'game.reveal', { text: 'secret' }, round));
  await publish(a, 'game.reveal', { text: 'Girassol' }, round);
  await assert.rejects(publish(b, 'game.guess', { text: 'Too late' }, round));
});
test('wish completion is idempotent across two actors and invalid votes are rejected', async () => {
  const wish = randomUUID();
  await publish(a, 'wish.create', { text: 'Um café juntos' }, wish, wish);
  await assert.rejects(publish(b, 'wish.vote', {}, wish));
  await assert.rejects(publish(b, 'wish.date', { date: 'tomorrow' }, wish));
  await publish(b, 'wish.vote', { interested: true }, wish);
  await publish(a, 'wish.date', { date: null }, wish);
  const one = await publish(a, 'wish.done', {}, wish);
  const two = await publish(b, 'wish.done', {}, wish);
  assert.equal(one.rows[0].id, two.rows[0].id);
});
test('notes validate content, media ownership and explicit recipient receipts', async () => {
  await assert.rejects(publish(a, 'note.send', {}));
  await assert.rejects(publish(a, 'note.send', { text: 'x'.repeat(2001) }));
  await assert.rejects(publish(a, 'note.send', { photoPath: `${b}/${randomUUID()}/photo.jpg` }));
  const note = randomUUID();
  await publish(a, 'note.send', { text: 'Bom dia' }, note, note);
  await assert.rejects(publish(a, 'note.open', {}, note));
  await publish(b, 'note.open', {}, note);
  await publish(b, 'note.reply', { text: 'Pra você também' }, note);
  await asUser(a, 'insert into storage.objects values($1,$2,$3)', [randomUUID(), 'couple-activity-media', `${a}/${randomUUID()}/photo.jpg`]);
  await assert.rejects(asUser(b, 'insert into storage.objects values($1,$2,$3)', [randomUUID(), 'couple-activity-media', `${a}/${randomUUID()}/photo.jpg`]));
  assert.equal((await asUser(c, 'select * from storage.objects')).rows.length, 0);
});
test.after(async () => { await db.close(); });
