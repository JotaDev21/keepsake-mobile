import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const COPY: Record<string, string> = {
  'wish.create': 'Tem um novo desejo para vocês viverem juntos.',
  'note.send': 'Um bilhete do seu amor chegou para fazer companhia.',
  'note.reply': 'Seu amor respondeu ao seu bilhete.',
  'game.start': 'Seu amor desenhou um desafio para você descobrir.',
  'game.guess': 'Tem um palpite esperando pelo seu desenho.',
  'game.reveal': 'Seu amor revelou a resposta da brincadeira.',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('authorization');
  if (!url || !anon || !serviceKey || !authorization) return json({ error: 'unauthorized' }, 401);
  const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await auth.auth.getUser();
  if (authError || !identity.user) return json({ error: 'unauthorized' }, 401);
  let eventId: string;
  try {
    const body = await request.json(); eventId = body.eventId;
    if (typeof eventId !== 'string' || !/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error('invalid');
  } catch { return json({ error: 'invalid event' }, 400); }
  const { data: event, error } = await auth.from('couple_activity_events').select('id,couple_id,author_id,entity_id,kind,created_at').eq('id', eventId).maybeSingle();
  if (error || !event || event.author_id !== identity.user.id) return json({ error: 'event not found' }, 404);
  if (!COPY[event.kind] || Date.now() - new Date(event.created_at).getTime() > 86400000) return json({ notified: false });
  // An atomic unique claim limits retries to one push attempt per saved event.
  const claim = await service.from('couple_activity_notifications').insert({ event_id: event.id, couple_id: event.couple_id, author_id: event.author_id });
  if (claim.error?.code === '23505') return json({ notified: false });
  if (claim.error) return json({ error: 'notification unavailable' }, 503);
  const recent = await service.from('couple_activity_notifications').select('event_id').eq('couple_id', event.couple_id)
    .eq('author_id', event.author_id).neq('event_id', event.id).gte('attempted_at', new Date(Date.now() - 60000).toISOString()).limit(1);
  if (recent.data?.length) return json({ notified: false, quiet: true });
  const { data: partner } = await service.from('members').select('id').eq('couple_id', event.couple_id).neq('id', event.author_id).maybeSingle();
  if (!partner) return json({ notified: false });
  const { data: tokens } = await service.from('push_tokens').select('token').eq('user_id', partner.id);
  if (!tokens?.length) return json({ notified: false });
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000), body: JSON.stringify(tokens.map(({ token }) => ({ to: token, title: 'memory ev',
        body: COPY[event.kind], sound: 'default', priority: 'high', channelId: 'sinais',
        data: { type: 'couple_activity', url: `/atividade/${event.entity_id}` } }))) });
    return json({ notified: response.ok });
  } catch { return json({ notified: false }); }
});
