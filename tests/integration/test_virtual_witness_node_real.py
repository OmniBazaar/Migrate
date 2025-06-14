import unittest
import os
from pathlib import Path
from ..virtual_witness_node import VirtualWitnessNode

class TestVirtualWitnessNodeReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Get witness node data directory from environment variable
        data_dir = os.getenv('WITNESS_NODE_DATA_DIR')
        if not data_dir:
            raise ValueError("WITNESS_NODE_DATA_DIR environment variable not set")
        
        cls.data_dir = Path(data_dir)
        if not cls.data_dir.exists():
            raise ValueError(f"Witness node data directory not found: {data_dir}")
        
        # Initialize the virtual witness node
        cls.node = VirtualWitnessNode(str(cls.data_dir))

    def test_real_account(self):
        """Test getting a real account by name"""
        # Replace with actual username
        username = os.getenv('TEST_USERNAME')
        if not username:
            self.skipTest("TEST_USERNAME environment variable not set")
        
        account = self.node.get_account(username)
        self.assertIsNotNone(account)
        self.assertEqual(account.name, username)

    def test_real_balances(self):
        """Test getting real account balances"""
        # Replace with actual username
        username = os.getenv('TEST_USERNAME')
        if not username:
            self.skipTest("TEST_USERNAME environment variable not set")
        
        account = self.node.get_account(username)
        self.assertIsNotNone(account)
        
        balances = self.node.get_balances(account.id)
        self.assertGreater(len(balances), 0, "Account should have at least one balance")
        
        # Check for OmniCoin balance
        omnicoin_balance = next((b for b in balances if b.asset_id == "1.3.0"), None)
        self.assertIsNotNone(omnicoin_balance, "Account should have OmniCoin balance")
        self.assertGreater(omnicoin_balance.amount, 0, "OmniCoin balance should be greater than 0")

if __name__ == '__main__':
    unittest.main() 