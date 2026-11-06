let ws = null;
let currentUser = null;
let messageIdCounter = 0;
const unreadMessageIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  const userSpan = document.getElementById('currentUser');
  const connStatus = document.getElementById('connectionStatus');
  const peerStatus = document.getElementById('peerStatus');
  const logoutBtn = document.getElementById('logoutBtn');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const messagesDiv = document.getElementById('messages');

  try {
    const response = await fetch('/api/session', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok || !data.userId) {
      window.location.href = '/index.html';
      return;
    }
    currentUser = data;
    userSpan.textContent = `Logged in as: ${data.username} (${data.userId})`;
    connectWebSocket();
  } catch (error) {
    window.location.href = '/index.html';
  }

  logoutBtn.addEventListener('click', async () => {
    if (ws) ws.close();
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/index.html';
  });

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      connStatus.textContent = 'Connected';
      connStatus.className = 'status connected';
      peerStatus.textContent = 'Peer: Online';
      peerStatus.className = 'status online';
      messageInput.disabled = false;
      sendBtn.disabled = false;
      messageInput.focus();
    };

    ws.onclose = () => {
      connStatus.textContent = 'Disconnected';
      connStatus.className = 'status disconnected';
      peerStatus.textContent = 'Peer: Offline';
      peerStatus.className = 'status offline';
      messageInput.disabled = true;
      sendBtn.disabled = true;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };
  }

  function handleServerMessage(data) {
    const messagesDiv = document.getElementById('messages');

    if (data.type === 'message') {
      appendMessage(data.content, 'received', data.messageId);
      unreadMessageIds.add(data.messageId);
      ws.send(JSON.stringify({ type: 'delivered', messageId: data.messageId }));
    } else if (data.type === 'sent') {
      appendMessage(data.content, 'sent', data.messageId);
    } else if (data.type === 'delivered') {
      updateMessageStatus(data.messageId, 'delivered');
    } else if (data.type === 'read') {
      updateMessageStatus(data.messageId, 'read');
    } else if (data.type === 'error') {
      console.error('Server error:', data.error);
      alert('Error: ' + data.error);
    }
  }

  function appendMessage(content, direction, messageId) {
    const messagesDiv = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${direction}`;
    div.dataset.messageId = messageId;
    const statusClass = direction === 'sent' ? 'sent' : '';
    let html = `
      ${content}
      <div class="meta">
        <span class="status-tag ${statusClass}">${direction === 'sent' ? 'SENT' : 'RECEIVED'}</span>
    `;
    html += `</div>`;
    div.innerHTML = html;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function updateMessageStatus(messageId, status) {
    const msgDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (!msgDiv) return;
    const statusTag = msgDiv.querySelector('.status-tag');
    if (statusTag) {
      statusTag.textContent = status.toUpperCase();
      statusTag.className = `status-tag ${status}`;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'message', to: currentUser.userId === 'computer1' ? 'computer2' : 'computer1', content }));
    messageInput.value = '';
  }

  window.addEventListener('beforeunload', () => {
    if (ws) ws.close();
  });

  function markUnreadMessagesAsRead() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    for (const messageId of unreadMessageIds) {
      ws.send(JSON.stringify({ type: 'read', messageId }));
    }

    unreadMessageIds.clear();
  }

  window.addEventListener('click', markUnreadMessagesAsRead);
});