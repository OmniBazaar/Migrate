import unittest
import os
import json
import tempfile
import shutil
from pathlib import Path
from ..virtual_cli_wallet import VirtualCLIWallet, WalletData
from ..virtual_witness_node import Account, Balance

class TestVirtualCLIWallet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create temporary directory for test data
        cls.test_dir = tempfile.mkdtemp()
        cls.data_dir = Path(cls.test_dir) / "witness_node_data_dir"
        cls.data_dir.mkdir(parents=True)
        
        # Create test account data
        cls._create_test_data()
        
        # Initialize wallet
        cls.wallet = VirtualCLIWallet(str(cls.data_dir))
    
    @classmethod
    def tearDownClass(cls):
        # Clean up temporary directory
        shutil.rmtree(cls.test_dir)
    
    @classmethod
    def _create_test_data(cls):
        """Create test account and balance data"""
        # Create accounts directory
        accounts_dir = cls.data_dir / "accounts"
        accounts_dir.mkdir(parents=True)
        
        # Create test account
        test_account = Account(
            id="1.2.1",
            name="testuser",
            owner_key="TEST_OWNER_KEY",
            active_key="TEST_ACTIVE_KEY",
            memo_key="TEST_MEMO_KEY",
            created=0
        )
        
        # Write account data
        with open(accounts_dir / "testuser.json", "w") as f:
            json.dump(test_account.__dict__, f)
        
        # Create balances directory
        balances_dir = cls.data_dir / "balances"
        balances_dir.mkdir(parents=True)
        
        # Create test balance
        test_balance = Balance(
            id="1.3.1",
            owner="1.2.1",
            asset_id="1.3.0",  # OmniCoin
            amount=1000
        )
        
        # Write balance data
        with open(balances_dir / "1.2.1.json", "w") as f:
            json.dump(test_balance.__dict__, f)
    
    def test_create_wallet(self):
        """Test wallet creation"""
        # Create new wallet
        result = self.wallet.create_wallet("test_password")
        self.assertTrue(result)
        
        # Verify wallet file exists
        self.assertTrue(self.wallet.wallet_file.exists())
        
        # Verify wallet data
        self.assertIsNotNone(self.wallet.wallet_data)
        self.assertEqual(self.wallet.wallet_data.chain_id, "1.3.0")
    
    def test_unlock_valid_credentials(self):
        """Test unlocking with valid credentials"""
        # Create wallet first
        self.wallet.create_wallet("test_password")
        
        # Test unlock with valid credentials
        result = self.wallet.unlock("testuser", "test_password")
        self.assertTrue(result)
    
    def test_unlock_invalid_credentials(self):
        """Test unlocking with invalid credentials"""
        # Create wallet first
        self.wallet.create_wallet("test_password")
        
        # Test unlock with invalid username
        result = self.wallet.unlock("invalid_user", "test_password")
        self.assertFalse(result)
        
        # Test unlock with invalid password
        result = self.wallet.unlock("testuser", "invalid_password")
        self.assertFalse(result)
    
    def test_get_balances(self):
        """Test getting account balances"""
        # Get balances for test account
        balances = self.wallet.get_balances("testuser")
        
        # Verify balances
        self.assertEqual(len(balances), 1)
        self.assertEqual(balances[0].asset_id, "1.3.0")
        self.assertEqual(balances[0].amount, 1000)
    
    def test_verify_migration_eligibility(self):
        """Test migration eligibility verification"""
        # Test with valid credentials and balance
        result = self.wallet.verify_migration_eligibility("testuser", "test_password")
        self.assertTrue(result["eligible"])
        self.assertEqual(result["account_id"], "1.2.1")
        self.assertEqual(result["balance"], 1000)
        self.assertEqual(result["asset_id"], "1.3.0")
        
        # Test with invalid credentials
        result = self.wallet.verify_migration_eligibility("testuser", "invalid_password")
        self.assertFalse(result["eligible"])
        self.assertEqual(result["reason"], "Invalid credentials")
        
        # Test with non-existent account
        result = self.wallet.verify_migration_eligibility("nonexistent", "test_password")
        self.assertFalse(result["eligible"])
        self.assertEqual(result["reason"], "Invalid credentials")

if __name__ == '__main__':
    unittest.main() 