# OmniCoin Migration Utility

This repository contains tools for migrating users from the old OmniCoin to the new OmniCoin smart contract.

## Blockchain Scanner

The `scan_balances.py` script scans the old OmniCoin blockchain and extracts account balances for users with non-zero balances.

### Prerequisites

- Python 3.6 or higher
- The old OmniCoin blockchain data directory

### Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

1. Make sure the blockchain data directory is in the correct location:

```bash
witness_node/witness_node_data_dir/blockchain/
```

### Usage

Run the script:

```bash
python scan_balances.py
```

The script will:

1. Scan the blockchain for all account balances
2. Filter for accounts with non-zero balances
3. Create a CSV file named `account_balances.csv` with the following columns:
   - username: The account's username
   - account_id: The account's unique identifier
   - balance: The account's balance
   - asset_type: The type of asset (e.g., OMN)

## Web Migration App (Coming Soon)

A web application will be created to:

1. Allow users to enter their old OmniCoin credentials
2. Connect their web wallet
3. Receive their new OmniCoin balance

More details about the web app will be added as development progresses.
