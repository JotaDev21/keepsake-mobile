/**
 * SQLite schema + migrations. Bump SCHEMA_VERSION and add a numbered entry to
 * MIGRATIONS for every change; migrations run in order from the DB's current
 * user_version. Never edit a past migration — add a new one.
 */
export const SCHEMA_VERSION = 9;

export const MIGRATIONS: Record<number, string> = {
  9: `
    CREATE TABLE IF NOT EXISTS couple_activity (
      id TEXT NOT NULL,
      couple_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      PRIMARY KEY (id, owner_id)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_scope ON couple_activity(couple_id, owner_id, created_at);
    CREATE TABLE IF NOT EXISTS activity_draft (key TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);
  `,
  1: `
    CREATE TABLE IF NOT EXISTS person (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      apelido TEXT,
      bio TEXT,
      como_se_conheceram TEXT,
      cover_file TEXT,
      avatar_file TEXT,
      accent TEXT NOT NULL DEFAULT '#E2A86B',
      criado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      chave TEXT NOT NULL,
      valor TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS important_date (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      data INTEGER NOT NULL,
      recorrente INTEGER NOT NULL DEFAULT 0,
      tipo TEXT NOT NULL DEFAULT 'outro'
    );

    CREATE TABLE IF NOT EXISTS media_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      file TEXT NOT NULL,
      thumb_file TEXT,
      legenda TEXT,
      data_memoria INTEGER,
      local TEXT,
      criado_em INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fact_person ON fact(person_id, ordem);
    CREATE INDEX IF NOT EXISTS idx_date_person ON important_date(person_id);
    CREATE INDEX IF NOT EXISTS idx_media_person ON media_item(person_id, criado_em);
  `,

  2: `
    CREATE TABLE IF NOT EXISTS mood_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      dia INTEGER NOT NULL,
      humor TEXT NOT NULL,
      intensidade INTEGER NOT NULL DEFAULT 3,
      nota TEXT,
      tags TEXT,
      criado_em INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_person_dia ON mood_entry(person_id, dia);
  `,

  3: `
    CREATE TABLE IF NOT EXISTS letter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      corpo TEXT NOT NULL,
      abrir_em INTEGER,
      aberta INTEGER NOT NULL DEFAULT 0,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_letter_person ON letter(person_id, criado_em);
  `,

  4: `
    -- "Aparecer": one row per day the app was opened / cared for. Feeds the garden.
    CREATE TABLE IF NOT EXISTS day_visit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      dia INTEGER NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_person_dia ON day_visit(person_id, dia);

    -- Reasons to love her — a deck to shuffle through.
    CREATE TABLE IF NOT EXISTS reason (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reason_person ON reason(person_id, criado_em);

    -- Daily gratitude — small things worth keeping.
    CREATE TABLE IF NOT EXISTS gratitude (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      dia INTEGER NOT NULL,
      texto TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gratitude_person ON gratitude(person_id, dia, criado_em);
  `,

  5: `
    -- Letters gain a direction (written here vs received from the partner) and a
    -- link to their mirrored row on the server, so capsules travel between the
    -- two devices. "lida" marks a sent letter the partner already opened.
    ALTER TABLE letter ADD COLUMN direcao TEXT NOT NULL DEFAULT 'minha';
    ALTER TABLE letter ADD COLUMN remote_id TEXT;
    ALTER TABLE letter ADD COLUMN lida INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_letter_remote ON letter(remote_id) WHERE remote_id IS NOT NULL;
  `,

  6: `
    -- Water: one row per day with the total ml drunk. Mirrored to the couple,
    -- so each side sees the other's glass filling up during the day.
    CREATE TABLE IF NOT EXISTS water_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      dia INTEGER NOT NULL,
      ml INTEGER NOT NULL DEFAULT 0,
      criado_em INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_water_person_dia ON water_day(person_id, dia);
  `,

  7: `
    -- Pergunta do dia: the day's question and THIS side's answer. The partner's
    -- answer lives on the server and is only shown after both have answered.
    CREATE TABLE IF NOT EXISTS question_answer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
      dia INTEGER NOT NULL,
      pergunta TEXT NOT NULL,
      resposta TEXT,
      criado_em INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_person_dia ON question_answer(person_id, dia);
  `,
  8: `
    -- Media stays private unless the person explicitly shares that item.
    ALTER TABLE media_item ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE media_item ADD COLUMN remote_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_remote
      ON media_item(remote_id) WHERE remote_id IS NOT NULL;
  `,
};
