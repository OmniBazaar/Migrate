import unittest
import os
import sys
from pathlib import Path

# Add src to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

try:
    from virtual_witness_node import VirtualWitnessNode
except ImportError:
    print("Warning: Could not import VirtualWitnessNode (TypeScript module)")
    VirtualWitnessNode = None

class TestVirtualWitnessNodeReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Try to get witness node data directory from environment variable first
        data_dir = os.getenv('WITNESS_NODE_DATA_DIR')
        if not data_dir:
            # Use the default location relative to the test file
            current_dir = Path(__file__).parent.parent.parent
            data_dir = str(current_dir / 'witness_node' / 'witness_node_data_dir')
        
        cls.data_dir = Path(data_dir)
        print(f"Using witness node data directory: {cls.data_dir}")
        
        if not cls.data_dir.exists():
            cls.skipTest(f"Witness node data directory not found: {data_dir}")
            return
        
        # Check for required subdirectories
        blockchain_dir = cls.data_dir / 'blockchain'
        if not blockchain_dir.exists():
            cls.skipTest(f"Blockchain directory not found: {blockchain_dir}")
            return
        
        # Log what we found
        print(f"Found blockchain directory: {blockchain_dir}")
        if (blockchain_dir / 'database').exists():
            print("Found database subdirectory")
        if (blockchain_dir / 'object_database').exists():
            print("Found object_database subdirectory")
        
        # For now, we'll skip the VirtualWitnessNode initialization 
        # since it's a TypeScript module and we're in Python
        cls.node = None

    def test_data_directory_structure(self):
        """Test that the witness node data directory has the expected structure"""
        self.assertTrue(self.data_dir.exists(), "Data directory should exist")
        
        # Check for blockchain directory
        blockchain_dir = self.data_dir / 'blockchain'
        self.assertTrue(blockchain_dir.exists(), "Blockchain directory should exist")
        
        # Check for configuration files
        config_files = ['config.ini', 'config_log.ini']
        for config_file in config_files:
            config_path = self.data_dir / config_file
            if config_path.exists():
                print(f"Found config file: {config_file}")
        
    def test_blockchain_database_exists(self):
        """Test that blockchain database exists"""
        blockchain_dir = self.data_dir / 'blockchain'
        database_dir = blockchain_dir / 'database'
        object_db_dir = blockchain_dir / 'object_database'
        
        # At least one database directory should exist
        self.assertTrue(
            database_dir.exists() or object_db_dir.exists(),
            "At least one database directory should exist"
        )
        
        # Check for database version file
        db_version_file = blockchain_dir / 'db_version'
        if db_version_file.exists():
            with open(db_version_file, 'r') as f:
                version = f.read().strip()
                print(f"Database version: {version}")
                self.assertIsNotNone(version, "Database version should not be empty")

    def test_config_files_readable(self):
        """Test that configuration files are readable"""
        config_files = {
            'config.ini': 'Main configuration',
            'config_log.ini': 'Logging configuration'
        }
        
        for filename, description in config_files.items():
            config_path = self.data_dir / filename
            if config_path.exists():
                try:
                    with open(config_path, 'r') as f:
                        content = f.read()
                        self.assertGreater(len(content), 0, f"{description} file should not be empty")
                        print(f"Successfully read {description} ({len(content)} characters)")
                except Exception as e:
                    self.fail(f"Failed to read {description}: {e}")

    def test_p2p_directory_exists(self):
        """Test that P2P directory exists if present"""
        p2p_dir = self.data_dir / 'p2p'
        if p2p_dir.exists():
            print(f"Found P2P directory: {p2p_dir}")
            # Check if there are any peer files
            peer_files = list(p2p_dir.glob('*'))
            print(f"P2P directory contains {len(peer_files)} files")
        else:
            print("P2P directory not found (this may be normal)")

    def test_real_account_data_extraction(self):
        """Test extracting account data from the real blockchain"""
        # This is a placeholder for when we implement real data extraction
        # For now, we'll just verify that we can access the database files
        
        blockchain_dir = self.data_dir / 'blockchain'
        if not blockchain_dir.exists():
            self.skipTest("Blockchain directory not found")
        
        # Look for database files
        database_files = []
        for db_dir in ['database', 'object_database']:
            db_path = blockchain_dir / db_dir
            if db_path.exists():
                files = list(db_path.rglob('*'))
                database_files.extend([f for f in files if f.is_file()])
        
        print(f"Found {len(database_files)} database files")
        self.assertGreater(len(database_files), 0, "Should find some database files")

if __name__ == '__main__':
    # Set up environment for testing
    if 'WITNESS_NODE_DATA_DIR' not in os.environ:
        # Try to set it to the default location
        test_dir = Path(__file__).parent.parent.parent
        default_data_dir = test_dir / 'witness_node' / 'witness_node_data_dir'
        if default_data_dir.exists():
            os.environ['WITNESS_NODE_DATA_DIR'] = str(default_data_dir)
    
    unittest.main(verbosity=2) 