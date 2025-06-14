import unittest
import os
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from ..virtual_witness_node import VirtualWitnessNode, Account, Balance, Asset

class TestVirtualWitnessNode(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for test data
        self.test_dir = tempfile.mkdtemp()
        self.data_dir = Path(self.test_dir) / "witness_node_data_dir"
        self.data_dir.mkdir(parents=True)
        
        # Create test database structure
        self.object_db = self.data_dir / "object_database"
        self.object_db.mkdir(parents=True)
        
        # Create test account data
        self.account_db = self.object_db / "1" / "2"
        self.account_db.parent.mkdir(parents=True)
        
        # Create test balance data
        self.balance_db = self.object_db / "2" / "5"
        self.balance_db.parent.mkdir(parents=True)
        
        # Create test asset data
        self.asset_db = self.object_db / "1" / "3"
        self.asset_db.parent.mkdir(parents=True)
        
        # Create test data
        self._create_test_data()
        
        # Initialize the virtual witness node
        self.node = VirtualWitnessNode(str(self.data_dir))

    def tearDown(self):
        # Clean up temporary directory
        shutil.rmtree(self.test_dir)

    def _create_test_data(self):
        # Create test account
        account_data = {
            "id": "1.2.1",
            "name": "testuser",
            "owner_key": "TEST5K...",
            "active_key": "TEST5K...",
            "memo_key": "TEST5K...",
            "registrar": "1.2.0",
            "referrer": "1.2.0",
            "referrer_rewards_percentage": 0,
            "lifetime_referrer": "1.2.0",
            "lifetime_referrer_fee_percentage": 0,
            "network_fee_percentage": 0,
            "membership_expiration_date": datetime.now().isoformat(),
            "statistics": "2.6.1",
            "whitelisting_accounts": [],
            "blacklisting_accounts": [],
            "whitelisted_accounts": [],
            "blacklisted_accounts": [],
            "options": {},
            "registrar_name": "",
            "referrer_name": "",
            "lifetime_referrer_name": ""
        }
        
        # Create test balance
        balance_data = {
            "account": "1.2.1",
            "asset_type": "1.3.0",
            "balance": "1000.000",
            "owner": "1.2.1",
            "last_claim_date": datetime.now().isoformat()
        }
        
        # Create test asset
        asset_data = {
            "id": "1.3.0",
            "symbol": "TEST",
            "precision": 3,
            "issuer": "1.2.0",
            "options": {},
            "dynamic_asset_data_id": "2.3.0"
        }
        
        # Write test data to files
        with open(self.account_db, 'wb') as f:
            f.write(b'\x00' * 8)  # Header
            account_bytes = json.dumps(account_data).encode()
            f.write(len(account_bytes).to_bytes(4, 'little'))
            f.write(account_bytes)
        
        with open(self.balance_db, 'wb') as f:
            f.write(b'\x00' * 8)  # Header
            balance_bytes = json.dumps(balance_data).encode()
            f.write(len(balance_bytes).to_bytes(4, 'little'))
            f.write(balance_bytes)
        
        with open(self.asset_db, 'wb') as f:
            f.write(b'\x00' * 8)  # Header
            asset_bytes = json.dumps(asset_data).encode()
            f.write(len(asset_bytes).to_bytes(4, 'little'))
            f.write(asset_bytes)

    def test_get_account(self):
        """Test getting account by name"""
        account = self.node.get_account("testuser")
        self.assertIsNotNone(account)
        self.assertEqual(account.id, "1.2.1")
        self.assertEqual(account.name, "testuser")

    def test_get_account_by_id(self):
        """Test getting account by ID"""
        account = self.node.get_account_by_id("1.2.1")
        self.assertIsNotNone(account)
        self.assertEqual(account.name, "testuser")

    def test_get_balances(self):
        """Test getting account balances"""
        balances = self.node.get_balances("1.2.1")
        self.assertEqual(len(balances), 1)
        self.assertEqual(balances[0].amount, 1000.0)
        self.assertEqual(balances[0].asset_id, "1.3.0")

    def test_get_asset(self):
        """Test getting asset information"""
        asset = self.node.get_asset("1.3.0")
        self.assertIsNotNone(asset)
        self.assertEqual(asset.symbol, "TEST")
        self.assertEqual(asset.precision, 3)

    def test_nonexistent_account(self):
        """Test getting nonexistent account"""
        account = self.node.get_account("nonexistent")
        self.assertIsNone(account)

    def test_nonexistent_balances(self):
        """Test getting balances for nonexistent account"""
        balances = self.node.get_balances("1.2.999")
        self.assertEqual(len(balances), 0)

if __name__ == '__main__':
    unittest.main() 