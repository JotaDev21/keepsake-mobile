import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('upgrading an existing version 8 database preserves memories, moods and letters', () => {
  const source = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
  const migrations = new Map([...source.matchAll(/^\s+(\d+): `([\s\S]*?)`,/gm)].map((m) => [Number(m[1]), m[2]]));
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  for (let version = 1; version <= 8; version++) db.exec(migrations.get(version));
  db.exec(`
    insert into person(id,nome,criado_em) values(1,'Evy',123);
    insert into media_item(person_id,tipo,file,criado_em) values(1,'foto','existing-photo.jpg',123);
    insert into mood_entry(person_id,dia,humor,criado_em) values(1,123,'bem',123);
    insert into letter(person_id,titulo,corpo,criado_em) values(1,'Carta guardada','Texto privado',123);
    pragma user_version=8;
    begin;
  `);
  db.exec(migrations.get(9));
  db.exec('PRAGMA user_version=9; COMMIT;');
  assert.equal(db.prepare('SELECT file FROM media_item').get().file, 'existing-photo.jpg');
  assert.equal(db.prepare('SELECT corpo FROM letter').get().corpo, 'Texto privado');
  assert.equal(db.prepare('SELECT humor FROM mood_entry').get().humor, 'bem');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 9);
  const insert = db.prepare('INSERT INTO couple_activity(id,couple_id,owner_id,body,created_at,status) VALUES(?,?,?,?,?,?)');
  insert.run('event','couple-a','user-a','{}',1,'pending');
  insert.run('event','couple-b','user-b','{}',1,'pending');
  assert.equal(db.prepare('SELECT count(*) AS n FROM couple_activity WHERE couple_id=? AND owner_id=?').get('couple-a','user-b').n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM couple_activity WHERE couple_id=? AND owner_id=?').get('couple-a','user-a').n, 1);
  db.close();
});
