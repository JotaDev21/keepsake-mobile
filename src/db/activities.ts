import { getDb } from '@/db';
import type { ActivityEvent } from '@/lib/activities-model';

export const activityRepo = {
  async remove(userId: string, id: string): Promise<void> {
    await (await getDb()).runAsync('DELETE FROM couple_activity WHERE id = ? AND owner_id = ?', id, userId);
  },
  async list(coupleId: string, userId: string): Promise<ActivityEvent[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ body: string; status: ActivityEvent['status']; error: string | null }>(
      'SELECT body, status, error FROM couple_activity WHERE couple_id = ? AND owner_id = ? ORDER BY created_at, rowid', coupleId, userId);
    return rows.map((row) => ({ ...JSON.parse(row.body), status: row.status, error: row.error ?? undefined }));
  },
  async save(userId: string, event: ActivityEvent): Promise<void> {
    const db = await getDb();
    await db.runAsync(`INSERT INTO couple_activity (id, couple_id, owner_id, body, created_at, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id, owner_id) DO UPDATE SET body=excluded.body,
      status=excluded.status, error=excluded.error`, event.id, event.coupleId, userId, JSON.stringify(event), event.createdAt, event.status, event.error ?? null);
  },
  async getDraft<T>(key: string): Promise<T | null> {
    const row = await (await getDb()).getFirstAsync<{ body: string }>('SELECT body FROM activity_draft WHERE key = ?', key);
    return row ? JSON.parse(row.body) as T : null;
  },
  async setDraft(key: string, value: unknown): Promise<void> {
    await (await getDb()).runAsync('INSERT INTO activity_draft (key, body) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET body=excluded.body', key, JSON.stringify(value));
  },
  async removeDraft(key: string): Promise<void> {
    await (await getDb()).runAsync('DELETE FROM activity_draft WHERE key = ?', key);
  },
};
