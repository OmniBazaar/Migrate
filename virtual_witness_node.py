import os
import json
import struct
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

class ObjectType(Enum):
    ACCOUNT = 2
    ACCOUNT_NAME = 3
    BALANCE = 5

@dataclass
class ObjectHeader:
    space_id: int
    type_id: int
    instance_id: int

    @property
    def object_id(self) -> str:
        return f"{self.space_id}.{self.type_id}.{self.instance_id}"

class VirtualWitnessNode:
    def __init__(self, data_dir: str = "witness_node/witness_node_data_dir"):
        """Initialize the virtual witness node.
        
        Args:
            data_dir: Path to the witness node data directory
        """
        self.data_dir = data_dir
        self.object_database_dir = os.path.join(data_dir, "blockchain", "object_database")
        
        # Cache for frequently accessed objects
        self._account_cache = {}
        self._name_cache = {}
        self._balance_cache = {}
        
        print(f"Initializing virtual witness node with data directory: {self.data_dir}")
        print(f"Object database directory: {self.object_database_dir}")
        
        # Initialize caches
        self._init_caches()
    
    def _init_caches(self):
        """Initialize the object caches."""
        # Load account name mappings
        name_path = os.path.join(self.object_database_dir, "1", "3")
        print(f"Loading name mappings from: {name_path}")
        if os.path.exists(name_path):
            with open(name_path, 'rb') as f:
                data = f.read()
                print(f"Loaded {len(data)} bytes of name mapping data")
                self._load_name_mappings(data)
                print(f"Loaded {len(self._name_cache)} name mappings")
        else:
            print("Name mappings file not found")
        
        # Load accounts
        account_path = os.path.join(self.object_database_dir, "1", "2")
        print(f"Loading accounts from: {account_path}")
        if os.path.exists(account_path):
            with open(account_path, 'rb') as f:
                data = f.read()
                print(f"Loaded {len(data)} bytes of account data")
                self._load_accounts(data)
                print(f"Loaded {len(self._account_cache)} accounts")
        else:
            print("Accounts file not found")
        
        # Load balances
        balance_path = os.path.join(self.object_database_dir, "2", "5")
        print(f"Loading balances from: {balance_path}")
        if os.path.exists(balance_path):
            with open(balance_path, 'rb') as f:
                data = f.read()
                print(f"Loaded {len(data)} bytes of balance data")
                self._load_balances(data)
                print(f"Loaded {len(self._balance_cache)} balance entries")
        else:
            print("Balances file not found")
    
    def _load_name_mappings(self, data: bytes):
        """Load account name mappings from binary data."""
        offset = 8  # Skip header
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                if header == 0x00000301:  # Name mapping objects
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    obj_data = data[offset+8:offset+8+size]
                    
                    # Parse name and account ID
                    name_offset = 10
                    while name_offset < len(obj_data):
                        if name_offset + 4 <= len(obj_data):
                            length = struct.unpack('<I', obj_data[name_offset:name_offset+4])[0]
                            if 0 < length < 1000 and name_offset + 4 + length <= len(obj_data):
                                try:
                                    name = obj_data[name_offset+4:name_offset+4+length].decode('utf-8')
                                    account_id = struct.unpack('<Q', obj_data[name_offset+4+length:name_offset+4+length+8])[0]
                                    self._name_cache[name] = f"1.2.{account_id}"
                                    break
                                except UnicodeDecodeError:
                                    pass
                        name_offset += 4
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    def _load_accounts(self, data: bytes):
        """Load account objects from binary data."""
        offset = 8  # Skip header
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                if header == 0x00000201:  # Account objects
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    obj_data = data[offset+8:offset+8+size]
                    
                    # Parse account object
                    account = self._parse_account_object(obj_data)
                    if account:
                        self._account_cache[account['id']] = account
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    def _load_balances(self, data: bytes):
        """Load balance objects from binary data."""
        offset = 8  # Skip header
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                if header == 0x00000502:  # Balance objects
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    obj_data = data[offset+8:offset+8+size]
                    
                    # Parse balance object
                    balance = self._parse_balance_object(obj_data)
                    if balance:
                        owner_id = balance['owner_id']
                        if owner_id not in self._balance_cache:
                            self._balance_cache[owner_id] = []
                        self._balance_cache[owner_id].append(balance)
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    def _parse_account_object(self, data: bytes) -> Optional[Dict]:
        """Parse an account object from binary data."""
        if len(data) < 10:
            return None
            
        try:
            # Parse object ID
            space_id = data[0]
            type_id = data[1]
            instance_id = struct.unpack('<Q', data[2:10])[0]
            obj_id = f"{space_id}.{type_id}.{instance_id}"
            
            # Parse account name
            name = None
            name_offset = 10
            while name_offset < len(data):
                if name_offset + 4 <= len(data):
                    length = struct.unpack('<I', data[name_offset:name_offset+4])[0]
                    if 0 < length < 1000 and name_offset + 4 + length <= len(data):
                        try:
                            name = data[name_offset+4:name_offset+4+length].decode('utf-8')
                            break
                        except UnicodeDecodeError:
                            pass
                name_offset += 4
            
            return {
                'id': obj_id,
                'name': name
            }
        except:
            return None
    
    def _parse_balance_object(self, data: bytes) -> Optional[Dict]:
        """Parse a balance object from binary data."""
        if len(data) < 34:  # Minimum size for a balance object
            return None
            
        try:
            # Parse object ID
            space_id = data[0]
            type_id = data[1]
            instance_id = struct.unpack('<Q', data[2:10])[0]
            
            # Parse balance fields
            owner_id = struct.unpack('<Q', data[10:18])[0]
            asset_id = struct.unpack('<Q', data[18:26])[0]
            balance = struct.unpack('<Q', data[26:34])[0]
            
            return {
                'object_id': f"{space_id}.{type_id}.{instance_id}",
                'owner_id': f"1.2.{owner_id}",
                'asset_id': f"1.3.{asset_id}",
                'balance': balance
            }
        except:
            return None
    
    def get_account_by_name(self, name: str) -> Optional[Dict]:
        """Get an account by name.
        
        Args:
            name: Account name to look up
            
        Returns:
            Account object if found, None otherwise
        """
        # Check cache first
        if name in self._name_cache:
            account_id = self._name_cache[name]
            if account_id in self._account_cache:
                return self._account_cache[account_id]
        
        return None
    
    def get_account_balances(self, account_id: str) -> List[Dict]:
        """Get all balances for an account.
        
        Args:
            account_id: Account ID to look up balances for
            
        Returns:
            List of balance objects
        """
        return self._balance_cache.get(account_id, [])
    
    def get_account_by_id(self, account_id: str) -> Optional[Dict]:
        """Get an account by ID.
        
        Args:
            account_id: Account ID to look up
            
        Returns:
            Account object if found, None otherwise
        """
        return self._account_cache.get(account_id) 