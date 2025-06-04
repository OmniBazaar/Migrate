// API endpoints for the migration process
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export const verifyCredentials = async (username, password) => {
  const response = await fetch(`${API_BASE_URL}/api/verify-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  return response.json();
};

export const migrateBalance = async (username, balance, walletAddress) => {
  const response = await fetch(`${API_BASE_URL}/api/migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      balance,
      walletAddress,
    }),
  });

  if (!response.ok) {
    throw new Error('Migration failed');
  }

  return response.json();
};

export const getMigrationStatus = async (username) => {
  const response = await fetch(`${API_BASE_URL}/api/migration-status/${username}`);

  if (!response.ok) {
    throw new Error('Failed to get migration status');
  }

  return response.json();
}; 