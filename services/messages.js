const crypto = require('crypto');
const WebSocket = require('ws');

function initializeMessages(messageStore, maxLength) {
  messageStore.maxLength = maxLength;
  messageStore.messages = new Map();
  messageStore.pendingAcks = new Map();
}

async function processMessage(message, fromUserId, connections, messageStore) {
  const { to, content } = message;

  if (!to || !content || typeof content !== 'string') {
    return { success: false, error: 'Invalid message format' };
  }

  if (content.length > messageStore.maxLength) {
    return { success: false, error: 'Message too long' };
  }

  if (!connections.has(to)) {
    return { success: false, error: 'Recipient offline', undeliverable: true };
  }

  const messageId = `MSG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const messageData = {
    id: messageId,
    from: fromUserId,
    to,
    content,
    timestamp: Date.now(),
    status: 'SENT',
    deliveredAt: null,
    readAt: null
  };

  messageStore.messages.set(messageId, messageData);
  messageStore.pendingAcks.set(messageId, { delivered: false, read: false });

  const recipientWs = connections.get(to);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: 'message',
      messageId,
      from: fromUserId,
      content,
      timestamp: messageData.timestamp
    }));
  }

  return { success: true, messageId, content };
}

async function sendAck(ackMessage, fromUserId, connections, messageStore) {
  const { messageId } = ackMessage;
  const message = messageStore.messages.get(messageId);

  if (!message) return;
  if (message.to !== fromUserId) return;

  const pending = messageStore.pendingAcks.get(messageId);
  if (!pending || pending.delivered) return;

  pending.delivered = true;
  message.status = 'DELIVERED';
  message.deliveredAt = Date.now();

  const senderWs = connections.get(message.from);
  if (senderWs && senderWs.readyState === WebSocket.OPEN) {
    senderWs.send(JSON.stringify({ type: 'delivered', messageId }));
  }
}

async function sendReadAck(ackMessage, fromUserId, connections, messageStore) {
  const { messageId } = ackMessage;
  const message = messageStore.messages.get(messageId);

  if (!message) return;
  if (message.to !== fromUserId) return;

  const pending = messageStore.pendingAcks.get(messageId);
  if (!pending || !pending.delivered || pending.read) return;

  pending.read = true;
  message.status = 'READ';
  message.readAt = Date.now();

  const senderWs = connections.get(message.from);
  if (senderWs && senderWs.readyState === WebSocket.OPEN) {
    senderWs.send(JSON.stringify({ type: 'read', messageId }));
  }
}

module.exports = { initializeMessages, processMessage, sendAck, sendReadAck };