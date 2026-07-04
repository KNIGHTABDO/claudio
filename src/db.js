const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../state.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const ready = (async () => {
  await run(`CREATE TABLE IF NOT EXISTS plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_name TEXT,
    artist TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_name TEXT,
    artist TEXT,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS station_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    queue TEXT,
    current_index INTEGER,
    position REAL,
    status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  const cols = await all(`PRAGMA table_info(messages)`);
  if (!cols.some(c => c.name === 'payload')) {
    await run(`ALTER TABLE messages ADD COLUMN payload TEXT`);
  }
})();

module.exports = {
  db,
  ready,
  savePlay: (song, artist) => run('INSERT INTO plays (song_name, artist) VALUES (?, ?)', [song, artist]),
  saveMessage: (role, content, payload = null) =>
    run('INSERT INTO messages (role, content, payload) VALUES (?, ?, ?)', [role, content, payload ? JSON.stringify(payload) : null]),
  saveLike: (song, artist) => run('INSERT INTO likes (song_name, artist) VALUES (?, ?)', [song, artist]),
  getLikes: (limit = 50) => all('SELECT * FROM likes ORDER BY liked_at DESC LIMIT ?', [limit]),
  getRecentPlays: (limit = 10) => all('SELECT * FROM plays ORDER BY played_at DESC LIMIT ?', [limit]),
  getRecentMessages: async (limit = 10) => {
    const rows = await all('SELECT * FROM messages ORDER BY id DESC LIMIT ?', [limit]);
    return rows.reverse().map(r => {
      let payload = null;
      if (r.payload) {
        try { payload = JSON.parse(r.payload); } catch {}
      }
      return { ...r, payload };
    });
  },
  getStats: async () => {
    const plays = await get('SELECT COUNT(*) AS n FROM plays');
    const likes = await get('SELECT COUNT(*) AS n FROM likes');
    const artists = await get('SELECT COUNT(DISTINCT artist) AS n FROM plays');
    return { plays: plays.n, likes: likes.n, artists: artists.n };
  },
  clearMessages: () => run('DELETE FROM messages'),
  clearTasteMemory: async () => {
    await run('DELETE FROM messages');
    await run('DELETE FROM plays');
    await run('DELETE FROM likes');
  },
  saveStationState: (queue, currentIndex, position, status) =>
    run(
      `INSERT INTO station_state (id, queue, current_index, position, status, updated_at)
       VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET queue=excluded.queue, current_index=excluded.current_index,
       position=excluded.position, status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
      [JSON.stringify(queue), currentIndex, position, status]
    ),
  loadStationState: async () => {
    const row = await get('SELECT * FROM station_state WHERE id = 1');
    if (!row) return null;
    let queue = [];
    try { queue = JSON.parse(row.queue) || []; } catch {}
    return { queue, currentIndex: row.current_index, position: row.position, status: row.status };
  }
};
