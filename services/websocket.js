const WebSocket = require('ws');
const { processMessage, sendAck, sendReadAck } = require('./messages');

function setupWebSocket(server, sessions, connections, users, messageStore) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies.sessionId;
    const session = sessions.get(sessionId);

    if (!session) {
      ws.close(4001, 'Invalid or expired session');
      return;
    }

    const userId = session.userId;
    if (connections.has(userId)) {
      ws.close(4002, 'User already connected');
      return;
    }

    connections.set(userId, ws);
    console.log(`[WS] ${userId} connected`);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'message') {
          const result = await processMessage(message, userId, connections, messageStore);
          if (result.success) {
            ws.send(JSON.stringify({ type: 'sent', messageId: result.messageId }));
            console.log(`[MSG] ${result.messageId} from=${userId} to=${message.to} status=SENT`);
          } else {
            ws.send(JSON.stringify({ type: 'error', error: result.error }));
            if (result.undeliverable) {
              console.log(`[MSG] ${result.messageId} from=${userId} to=${message.to} status=UNDELIVERABLE`);
            }
          }
        } else if (message.type === 'delivered') {
          await sendAck(message, userId, connections, messageStore);
          console.log(`[ACK] ${message.messageId} from=${userId} status=DELIVERED`);
        } else if (message.type === 'read') {
          await sendReadAck(message, userId, connections, messageStore);
          console.log(`[ACK] ${message.messageId} from=${userId} status=READ`);
        }
      } catch (error) {
        console.error('[WS] Message handling error:', error);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      connections.delete(userId);
      console.log(`[WS] ${userId} disconnected`);
    });

    ws.on('error', (error) => {
      console.error(`[WS] ${userId} error:`, error);
      connections.delete(userId);
    });
  });

  function parseCookies(cookieHeader) {
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) cookies[name] = value;
    });
    return cookies;
  }
}

module.exports = { setupWebSocket };