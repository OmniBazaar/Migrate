import os
import json
import struct
import datetime
from typing import Dict, List, Optional
from virtual_witness_node import VirtualWitnessNode
from auth import AuthManager

def lookup_account_id_by_name(name: str) -> Optional[str]:
    """Look up an account ID by name using the username mapping."""
    # Path to the username mapping database
    mapping_path = 'witness_node/witness_node_data_dir/blockchain/object_database/1/3'
    
    if not os.path.exists(mapping_path):
        print(f"Error: Username mapping database not found at {mapping_path}")
        return None
        
    with open(mapping_path, 'rb') as f:
        data = f.read()
        
        # Skip header
        offset = 8
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                # Username mapping objects have header 0x00000301
                if header == 0x00000301:
                    # Get object size
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    
                    # Extract the object data
                    obj_data = data[offset+8:offset+8+size]
                    
                    # Parse username and account ID
                    try:
                        # Username is a length-prefixed string
                        name_length = struct.unpack('<I', obj_data[0:4])[0]
                        if 0 < name_length < 1000 and 4 + name_length <= len(obj_data):
                            username = obj_data[4:4+name_length].decode('utf-8')
                            
                            if username == name:
                                # Account ID follows the username
                                account_id = struct.unpack('<Q', obj_data[4+name_length:12+name_length])[0]
                                return f'1.2.{account_id}'
                    except (UnicodeDecodeError, struct.error):
                        pass
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    return None

def lookup_account_by_name(name: str) -> Optional[Dict]:
    """Look up an account by name using the database API."""
    # Path to the account database
    account_path = 'witness_node/witness_node_data_dir/blockchain/object_database/1/2'
    name_path = 'witness_node/witness_node_data_dir/blockchain/object_database/1/3'
    
    if not os.path.exists(account_path) or not os.path.exists(name_path):
        print(f"Error: Database files not found")
        return None
    
    # First look up the account ID in the name mapping
    account_id = None
    with open(name_path, 'rb') as f:
        data = f.read()
        
        # Skip header
        offset = 8
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                # Name mapping objects have header 0x00000301
                if header == 0x00000301:
                    # Get object size
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    
                    # Extract the object data
                    obj_data = data[offset+8:offset+8+size]
                    
                    # Parse name
                    name_offset = 10  # Skip object ID (8 bytes) and type (2 bytes)
                    while name_offset < len(obj_data):
                        if name_offset + 4 <= len(obj_data):
                            length = struct.unpack('<I', obj_data[name_offset:name_offset+4])[0]
                            if 0 < length < 1000 and name_offset + 4 + length <= len(obj_data):
                                try:
                                    account_name = obj_data[name_offset+4:name_offset+4+length].decode('utf-8')
                                    if account_name == name:
                                        # Get account ID from the mapping
                                        account_id = struct.unpack('<Q', obj_data[name_offset+4+length:name_offset+4+length+8])[0]
                                        break
                                except UnicodeDecodeError:
                                    pass
                        name_offset += 4
                    
                    if account_id:
                        break
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    if not account_id:
        return None
    
    # Now look up the account object
    with open(account_path, 'rb') as f:
        data = f.read()
        
        # Skip header
        offset = 8
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                # Account objects have header 0x00000201
                if header == 0x00000201:
                    # Get object size
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    
                    # Extract the object data
                    obj_data = data[offset+8:offset+8+size]
                    
                    # Check if this is the account we're looking for
                    if len(obj_data) >= 10:
                        obj_id = struct.unpack('<Q', obj_data[2:10])[0]
                        if obj_id == account_id:
                            return parse_account_object(obj_data)
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    return None

def parse_account_object(data: bytes) -> Dict:
    """Parse an account object from the binary data."""
    result = {
        'name': None,
        'id': None,
        'owner_key': None,
        'active_key': None,
        'options': {}
    }
    
    # Parse object ID (first 8 bytes)
    if len(data) >= 8:
        space_id = data[0]
        type_id = data[1]
        instance_id = struct.unpack('<Q', data[2:10])[0]
        result['id'] = f'{space_id}.{type_id}.{instance_id}'
    
    # Look for account name
    name_offset = 10
    while name_offset < len(data):
        if name_offset + 4 <= len(data):
            length = struct.unpack('<I', data[name_offset:name_offset+4])[0]
            if 0 < length < 1000 and name_offset + 4 + length <= len(data):
                try:
                    result['name'] = data[name_offset+4:name_offset+4+length].decode('utf-8')
                    break
                except UnicodeDecodeError:
                    pass
        name_offset += 4
    
    return result

def get_account_balances(account_id: str) -> List[Dict]:
    """Get all balances for an account."""
    # Path to the balance database
    balance_path = 'witness_node/witness_node_data_dir/blockchain/object_database/2/5'
    
    if not os.path.exists(balance_path):
        print(f"Error: Balance database file not found at {balance_path}")
        return []
    
    balances = []
    
    with open(balance_path, 'rb') as f:
        data = f.read()
        
        # Skip header
        offset = 8
        
        while offset < len(data):
            if offset + 4 <= len(data):
                header = struct.unpack('<I', data[offset:offset+4])[0]
                
                # Balance objects have header 0x00000502
                if header == 0x00000502:
                    # Get object size
                    size = struct.unpack('<I', data[offset+4:offset+8])[0]
                    
                    # Extract the object data
                    obj_data = data[offset+8:offset+8+size]
                    balance = parse_balance_object(obj_data)
                    
                    if balance and balance['owner_id'] == account_id:
                        balances.append(balance)
                    
                    offset += 8 + size
                else:
                    offset += 4
            else:
                break
    
    return balances

def parse_balance_object(data: bytes) -> Optional[Dict]:
    """Parse a balance object from the binary data."""
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
            'object_id': f'{space_id}.{type_id}.{instance_id}',
            'owner_id': f'1.2.{owner_id}',
            'asset_id': f'1.3.{asset_id}',
            'balance': balance
        }
    except:
        return None

def main():
    """Main function to look up accounts and balances."""
    # Initialize virtual witness node and auth manager
    node = VirtualWitnessNode()
    auth = AuthManager()
    
    # Login
    while True:
        print("\n1. Login")
        print("2. Register")
        print("3. Exit")
        choice = input("Choose an option (1-3): ")
        
        if choice == "1":
            username = input("Username: ")
            password = input("Password: ")
            
            if auth.verify_password(username, password):
                print("Login successful!")
                break
            else:
                print("Invalid username or password")
        
        elif choice == "2":
            username = input("Username: ")
            password = input("Password: ")
            
            if auth.register_user(username, password):
                print("Registration successful! Please login.")
            else:
                print("Username already exists")
        
        elif choice == "3":
            return
        
        else:
            print("Invalid choice")
    
    # Main menu
    while True:
        print("\n1. Look up account by name")
        print("2. Look up account by ID")
        print("3. Logout")
        choice = input("Choose an option (1-3): ")
        
        if choice == "1":
            account_name = input("Enter account name: ")
            
            # Look up the account
            account = node.get_account_by_name(account_name)
            if not account:
                print(f"Account '{account_name}' not found")
                continue
            
            print(f"\nAccount Information:")
            print(f"Name: {account['name']}")
            print(f"ID: {account['id']}")
            
            # Get account balances
            balances = node.get_account_balances(account['id'])
            
            print("\nBalances:")
            for balance in balances:
                print(f"Asset {balance['asset_id']}: {balance['balance']}")
        
        elif choice == "2":
            account_id = input("Enter account ID: ")
            
            # Look up the account
            account = node.get_account_by_id(account_id)
            if not account:
                print(f"Account '{account_id}' not found")
                continue
            
            print(f"\nAccount Information:")
            print(f"Name: {account['name']}")
            print(f"ID: {account['id']}")
            
            # Get account balances
            balances = node.get_account_balances(account['id'])
            
            print("\nBalances:")
            for balance in balances:
                print(f"Asset {balance['asset_id']}: {balance['balance']}")
        
        elif choice == "3":
            return
        
        else:
            print("Invalid choice")

if __name__ == "__main__":
    main() 