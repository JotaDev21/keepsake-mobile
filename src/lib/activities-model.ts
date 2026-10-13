/** Original couple interactions. Secrets and drafts never enter these shared payloads. */
export type ActivityKind = 'wish.create' | 'wish.vote' | 'wish.date' | 'wish.done' | 'wish.memory'
  | 'note.send' | 'note.open' | 'note.reply' | 'game.start' | 'game.guess' | 'game.reveal';
export type Point = { x: number; y: number };
export type Drawing = Point[][];
export interface ActivityPayload {
  text?: string;
  drawing?: Drawing;
  photoPath?: string;
  localFile?: string;
  date?: number | null;
  interested?: boolean;
}
export interface ActivityEvent {
  id: string;
  coupleId: string;
  authorId: string;
  entityId: string;
  kind: ActivityKind;
  payload: ActivityPayload;
  createdAt: number;
  sequence: number;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}
export interface Activity {
  id: string;
  type: 'wish' | 'note' | 'game';
  authorId: string;
  createdAt: number;
  payload: ActivityPayload;
  interested: string[];
  date: number | null;
  done: boolean;
  doneAt: number | null;
  memory: ActivityPayload | null;
  openedBy: string[];
  replies: ActivityEvent[];
  answer: string | null;
  pending: boolean;
  failed: boolean;
}

export function projectActivities(events: ActivityEvent[]): Activity[] {
  // Parents are projected before their children, even when local pending rows
  // and server pages arrive in a different order. UUIDs make retries harmless.
  const unique = [...new Map(events.map((event) => [event.id, event])).values()];
  const ordered = unique.sort((a, b) => {
    if (a.sequence && b.sequence) return a.sequence - b.sequence;
    if (a.sequence !== b.sequence) return a.sequence ? -1 : 1;
    return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
  });
  const activities = new Map<string, Activity>();
  for (const event of ordered) {
    if (!['wish.create', 'note.send', 'game.start'].includes(event.kind)) continue;
    if (activities.has(event.entityId)) continue;
    activities.set(event.entityId, {
      id: event.entityId, type: event.kind.split('.')[0] as Activity['type'],
      authorId: event.authorId, createdAt: event.createdAt, payload: event.payload,
      interested: [], date: null, done: false, doneAt: null, memory: null, openedBy: [], replies: [],
      answer: null, pending: event.status === 'pending', failed: event.status === 'failed',
    });
  }
  for (const event of ordered) {
    const item = activities.get(event.entityId);
    if (!item) continue;
    item.pending ||= event.status === 'pending';
    item.failed ||= event.status === 'failed';
    if (event.kind === 'wish.vote') {
      item.interested = item.interested.filter((id) => id !== event.authorId);
      if (event.payload.interested) item.interested.push(event.authorId);
    }
    if (event.kind === 'wish.date') item.date = event.payload.date ?? null;
    if (event.kind === 'wish.done') { item.done = true; item.doneAt = event.createdAt; }
    if (event.kind === 'wish.memory') item.memory = event.payload;
    if (event.kind === 'note.open' && !item.openedBy.includes(event.authorId)) item.openedBy.push(event.authorId);
    if (event.kind === 'note.reply' || event.kind === 'game.guess') item.replies.push(event);
    if (event.kind === 'game.reveal' && event.authorId === item.authorId) item.answer = event.payload.text ?? null;
  }
  return [...activities.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function validateDrawing(value: unknown): value is Drawing {
  return Array.isArray(value) && value.length > 0 && value.length <= 80
    && value.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 6001), 0) <= 6000
    && value.every((stroke) => Array.isArray(stroke) && stroke.length > 0 && stroke.every((p) =>
      p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
}
