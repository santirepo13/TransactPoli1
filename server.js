const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cookieParser = require('cookie-parser');
const { loadUsers } = require('./services/auth');
const { setupWebSocket } = require('./services/websocket');
const { initializeMessages } = require('./services/messages');

const app = express();
const server = http.createServer(app);

const HOST = '0.0.0.0';
const PORT = 3001;
const USERS_FILE = './users.json';
const MESSAGE_MAX_LENGTH = 500;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let users = [];
let sessions = new Map();
let messageStore = {};
let connections = new Map();

async function start() {
  try {
    users = await loadUsers(USERS_FILE);
    initializeMessages(messageStore, MESSAGE_MAX_LENGTH);
    setupWebSocket(server, sessions, connections, users, messageStore);

    app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;
      const user = users.find(u => u.username === username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const crypto = require('crypto');
      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions.set(sessionId, { userId: user.id, username: user.username });
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 3600000
      });
      res.json({ success: true, username: user.username, userId: user.id });
    });

    app.get('/api/session', (req, res) => {
      const sessionId = req.cookies?.sessionId;
      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'No valid session' });
      }
      res.json({ userId: session.userId, username: session.username });
    });

    app.post('/api/logout', (req, res) => {
      const sessionId = req.cookies?.sessionId;
      if (sessionId && sessions.has(sessionId)) {
        sessions.delete(sessionId);
      }
      res.clearCookie('sessionId', { path: '/' });
      res.json({ success: true });
    });

    server.listen(PORT, HOST, () => {
      console.log(`[SERVER] Listening on ${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('[SERVER] Startup failed:', error);
    process.exit(1);
  }
}

start();