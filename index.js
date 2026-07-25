const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./config/db');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secretKey',
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Proteksi Halaman (Auth Check)
const isAuth = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/login');
};

// ================= AUTH ROUTES =================
app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
            [username, email, hashedPassword]);
        res.redirect('/login');
    } catch (err) {
        res.render('register', { error: 'Username/Email sudah digunakan!' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.render('login', { error: 'User tidak ditemukan!' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.render('login', { error: 'Password salah!' });

        req.session.userId = user.id;
        req.session.username = user.username;
        res.redirect('/dashboard');
    } catch (err) {
        res.render('login', { error: 'Terjadi kesalahan sistem' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ================= TASK MANAGEMENT ROUTES =================
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', isAuth, async (req, res) => {
    const userId = req.session.userId;
    const { search, category, priority } = req.query;

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    let queryParams = [userId];

    if (search) {
        query += ' AND title LIKE ?';
        queryParams.push(`%${search}%`);
    }
    if (category) {
        query += ' AND category = ?';
        queryParams.push(category);
    }
    if (priority) {
        query += ' AND priority = ?';
        queryParams.push(priority);
    }

    query += ' ORDER BY created_at DESC';

    try {
        const [tasks] = await db.query(query, queryParams);
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as finished,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
            FROM tasks WHERE user_id = ?
        `, [userId]);

        res.render('dashboard', {
            username: req.session.username,
            tasks,
            stats: stats[0],
            filters: { search, category, priority }
        });
    } catch (err) {
        res.status(500).send('Error Fetching Data');
    }
});

app.post('/tasks/create', isAuth, async (req, res) => {
    const { title, description, category, priority, deadline } = req.body;
    await db.query(
        'INSERT INTO tasks (user_id, title, description, category, priority, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        [req.session.userId, title, description, category, priority, deadline || null]
    );
    res.redirect('/dashboard');
});

app.post('/tasks/toggle/:id', isAuth, async (req, res) => {
    const taskId = req.params.id;
    await db.query(
        'UPDATE tasks SET status = IF(status = "Pending", "Selesai", "Pending") WHERE id = ? AND user_id = ?',
        [taskId, req.session.userId]
    );
    res.redirect('/dashboard');
});

app.post('/tasks/delete/:id', isAuth, async (req, res) => {
    await db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    res.redirect('/dashboard');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));