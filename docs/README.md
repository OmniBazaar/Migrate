# OmniCoin Migration Module

This module handles the migration of users and data from the legacy OmniCoin blockchain to the new OmniBazaar platform.

## Directory Structure

```plaintext
Migrate/
├── witness_node/           # Legacy blockchain data
├── src/                    # Source code
│   ├── virtual_witness_node/  # Virtual node implementation
│   ├── virtual_cli_wallet/    # CLI wallet implementation
│   └── web_interface/         # Web interface components
├── tests/                  # Test suites
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── config/                # Configuration files
├── docs/                  # Documentation
└── scripts/              # Utility scripts
```

## Components

### Virtual Witness Node

- Handles blockchain data validation
- Manages transaction processing
- Provides API endpoints for migration

### Virtual CLI Wallet

- Manages user credentials
- Handles transaction signing
- Provides command-line interface for migration

### Web Interface

- User-friendly migration interface
- Progress tracking
- Status reporting

## Setup

Install dependencies:

```bash
npm install
```

Configure the migration:

```bash
cp config/config.example.json config/config.json
# Edit config.json with your settings
```

Run the migration:

```bash
npm run migrate
```

## Development

- Follow TypeScript best practices
- Write tests for all new features
- Update documentation as needed
- Keep the TODO.md file current

## Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration
```

## Documentation

- `DOCUMENTATION.md`: Detailed technical documentation
- `TODO.md`: Current development tasks and priorities
