const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../state.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Play history
  db.run(`CREATE TABLE IF NOT EXISTS plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_name TEXT,
    artist TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Chat messages
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // User Tastes (Likes)
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_name TEXT,
    artist TEXT,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = {
  db,
  savePlay: (song, artist) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO plays (song_name, artist) VALUES (?, ?)', [song, artist], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },
  saveMessage: (role, content) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO messages (role, content) VALUES (?, ?)', [role, content], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },
  saveLike: (song, artist) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO likes (song_name, artist) VALUES (?, ?)', [song, artist], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },
  getRecentPlays: (limit = 10) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM plays ORDER BY played_at DESC LIMIT ?', [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};
