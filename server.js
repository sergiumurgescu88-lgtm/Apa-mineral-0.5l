
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// === DATABASE INITIALIZATION ===
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database.');
});

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        company VARCHAR(255),
        role VARCHAR(50) DEFAULT 'engineer',
        profile_picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Login Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Admins Table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
    )`);

    // Insert Default Admin (sergiu / Nuamparola123@)
    db.run(`INSERT OR IGNORE INTO admins (username, password_hash) VALUES ('sergiu', 'Nuamparola123@')`);
});

// === AUTHENTICATION ROUTES ===

// Google Auth Callback (Simulat pentru demo - intr-un mediu real ar folosi google-auth-library)
app.post('/api/auth/google', (req, res) => {
    const { token, profile } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get('User-Agent');

    // Căutăm sau creăm utilizatorul
    db.get("SELECT * FROM users WHERE email = ?", [profile.email], (err, user) => {
        if (err) return res.status(500).json({ success: false });

        if (!user) {
            // Creare cont nou (Sign Up flow)
            db.run(`INSERT INTO users (google_id, email, name, profile_picture) VALUES (?, ?, ?, ?)`,
                [profile.sub, profile.email, profile.name, profile.picture],
                function(err) {
                    if (err) return res.status(500).json({ success: false });
                    const newUserId = this.lastID;
                    logLogin(newUserId, ip, ua);
                    res.json({ success: true, user: { id: newUserId, ...profile, role: 'engineer' } });
                }
            );
        } else {
            // Autentificare cont existent (Sign In flow)
            logLogin(user.id, ip, ua);
            res.json({ success: true, user: { ...user, avatar: user.profile_picture } });
        }
    });
});

// Admin Login
app.post('/api/auth/admin', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM admins WHERE username = ? AND password_hash = ?", [username, password], (err, admin) => {
        if (err || !admin) {
            return res.status(401).json({ success: false, message: 'Credențiale invalide' });
        }
        res.json({ 
            success: true, 
            user: { 
                id: 'admin', 
                name: 'Sergiu Admin', 
                email: 'admin@helios.ai', 
                role: 'admin', 
                avatar: 'https://ui-avatars.com/api/?name=Sergiu+Admin&background=0ea5e9&color=fff' 
            } 
        });
    });
});

function logLogin(userId, ip, ua) {
    db.run(`INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)`, [userId, ip, ua]);
}

// === ADMIN DASHBOARD API ===

app.get('/api/admin/stats', (req, res) => {
    db.get("SELECT COUNT(*) as total FROM users", [], (err, rowUsers) => {
        db.get("SELECT COUNT(*) as total FROM login_logs", [], (err, rowLogs) => {
            res.json({
                totalUsers: rowUsers.total,
                totalLogins: rowLogs.total,
                recentLogins: 12 // Exemplu simulat pentru "astăzi"
            });
        });
    });
});

app.get('/api/admin/users', (req, res) => {
    db.all("SELECT * FROM users ORDER BY created_at DESC", [], (err, rows) => {
        res.json({ users: rows });
    });
});

app.get('/api/admin/logs', (req, res) => {
    const query = `
        SELECT l.*, u.name as user_name, u.email 
        FROM login_logs l 
        JOIN users u ON l.user_id = u.id 
        ORDER BY l.login_time DESC 
        LIMIT 100
    `;
    db.all(query, [], (err, rows) => {
        res.json({ logs: rows });
    });
});

app.delete('/api/admin/users/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Helios Core & SQLite Hub running on http://localhost:${PORT}`);
});
