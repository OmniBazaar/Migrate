import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import { ethers } from 'ethers';
import { parse } from 'csv-parse/sync';

const MigrationForm = ({ onSuccess, onError }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Verify old account credentials
      const response = await fetch('/api/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        throw new Error('Invalid credentials');
      }
      
      // 2. Get user's balance from CSV
      const csvResponse = await fetch('/account_balances.csv');
      const csvText = await csvResponse.text();
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true
      });
      
      const userRecord = records.find(r => r.username === username);
      if (!userRecord) {
        throw new Error('No balance found for this account');
      }
      
      setBalance(userRecord.balance);
      
      // 3. Connect wallet
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        
        // 4. Trigger migration
        const migrationResponse = await fetch('/api/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            balance: userRecord.balance,
            walletAddress: await signer.getAddress()
          })
        });
        
        if (!migrationResponse.ok) {
          throw new Error('Migration failed');
        }
        
        onSuccess && onSuccess({
          username,
          balance: userRecord.balance,
          walletAddress: await signer.getAddress()
        });
      } else {
        throw new Error('Please install MetaMask to continue');
      }
    } catch (err) {
      setError(err.message);
      onError && onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Migrate to New OmniCoin
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {balance && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your current balance: {balance} OMN
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          margin="normal"
          required
        />
        
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
          required
        />
        
        <Button
          fullWidth
          variant="contained"
          type="submit"
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Migrate'}
        </Button>
      </Box>
    </Paper>
  );
};

export default MigrationForm; 