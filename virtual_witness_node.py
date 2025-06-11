import os
import json
import struct
import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class Account:
    id: str
    name: str
    owner_key: str
    active_key: str
    memo_key: str

@dataclass
class Balance:
    account_id: str
    asset_id: str
    amount: float

class VirtualWitnessNode:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.account_db_path = os.path.join(data_dir, "object_database", "1", "2")
        self.balance_db_path = os.path.join(data_dir, "object_database", "2", "5")
        
    def read_account(self, account_name: str) -> Optional[Account]:
        """Read account information from the database."""
        try:
            with open(self.account_db_path, 'rb') as f:
                # Read the database header
                header = f.read(8)
                if not header:
                    return None
                
                # Read account objects
                while True:
                    obj_header = f.read(4)
                    if not obj_header:
                        break
                        
                    obj_size = struct.unpack('<I', obj_header)[0]
                    obj_data = f.read(obj_size)
                    
                    # Parse account object
                    try:
                        account_data = json.loads(obj_data)
                        if account_data.get('name') == account_name:
                            return Account(
                                id=account_data.get('id'),
                                name=account_data.get('name'),
                                owner_key=account_data.get('owner_key'),
                                active_key=account_data.get('active_key'),
                                memo_key=account_data.get('memo_key')
                            )
                    except json.JSONDecodeError:
                        continue
                        
        except Exception as e:
            print(f"Error reading account: {e}")
            return None
            
    def get_account_balances(self, account_id: str) -> List[Balance]:
        """Get all balances for an account."""
        balances = []
        try:
            with open(self.balance_db_path, 'rb') as f:
                # Read the database header
                header = f.read(8)
                if not header:
                    return balances
                
                # Read balance objects
                while True:
                    obj_header = f.read(4)
                    if not obj_header:
                        break
                        
                    obj_size = struct.unpack('<I', obj_header)[0]
                    obj_data = f.read(obj_size)
                    
                    # Parse balance object
                    try:
                        balance_data = json.loads(obj_data)
                        if balance_data.get('account') == account_id:
                            balances.append(Balance(
                                account_id=balance_data.get('account'),
                                asset_id=balance_data.get('asset_type'),
                                amount=float(balance_data.get('balance', 0))
                            ))
                    except json.JSONDecodeError:
                        continue
                        
        except Exception as e:
            print(f"Error reading balances: {e}")
            
        return balances

def main():
    # Initialize the virtual witness node
    data_dir = "witness_node_data_dir"
    node = VirtualWitnessNode(data_dir)
    
    # Test account lookup
    account_name = input("Enter account name to look up: ")
    account = node.read_account(account_name)
    
    if account:
        print(f"\nAccount Information:")
        print(f"ID: {account.id}")
        print(f"Name: {account.name}")
        print(f"Owner Key: {account.owner_key}")
        print(f"Active Key: {account.active_key}")
        print(f"Memo Key: {account.memo_key}")
        
        # Get balances
        balances = node.get_account_balances(account.id)
        if balances:
            print(f"\nBalances:")
            for balance in balances:
                print(f"Asset: {balance.asset_id}")
                print(f"Amount: {balance.amount}")
        else:
            print("\nNo balances found")
    else:
        print(f"Account {account_name} not found")

if __name__ == "__main__":
    main() 