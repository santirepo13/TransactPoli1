const fs = require('fs').promises;

async function loadUsers(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.users || [];
  } catch (error) {
    console.error('[AUTH] Failed to load users:', error);
    throw error;
  }
}

module.exports = { loadUsers };