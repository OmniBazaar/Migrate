import os
import csv
from virtual_witness_node import VirtualWitnessNode

def scan_balances():
    """Scan account balances using the virtual witness node and save to CSV."""
    # Initialize virtual witness node
    node = VirtualWitnessNode()
    
    # Get all accounts and their balances
    accounts = []
    for account_id in node._account_cache:
        account = node.get_account_by_id(account_id)
        if account:
            balances = node.get_account_balances(account_id)
            if balances:
                for balance in balances:
                    accounts.append({
                        'username': account['name'],
                        'balance': balance['balance']
                    })
    
    # Save to CSV
    with open('account_balances.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['username', 'balance'])
        writer.writeheader()
        writer.writerows(accounts)
    
    print(f"Scanned {len(accounts)} account balances and saved to account_balances.csv")

if __name__ == "__main__":
    scan_balances() 