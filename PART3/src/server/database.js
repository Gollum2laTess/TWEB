const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dbDir, 'chat.db'));

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
});

function getUserByName(name) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE name = ?", [name], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createUser(name, passwordHash) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users (name, password_hash) VALUES (?, ?)", [name, passwordHash], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function saveMessage(userId, kind, body) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO messages (user_id, kind, body) VALUES (?, ?, ?)", [userId, kind, body], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getHistory(userId, limit = 50) {
    return new Promise((resolve, reject) => {
        db.all("SELECT kind, body, created_at FROM messages WHERE user_id = ? ORDER BY id ASC LIMIT ?", [userId, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = { getUserByName, createUser, saveMessage, getHistory };
