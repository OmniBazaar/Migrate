#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing Migration Module with Real Blockchain Data${NC}"

# Set the witness node data directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WITNESS_DATA_DIR="$PROJECT_DIR/witness_node/witness_node_data_dir"

echo "Project directory: $PROJECT_DIR"
echo "Witness data directory: $WITNESS_DATA_DIR"

# Check if witness node data directory exists
if [ ! -d "$WITNESS_DATA_DIR" ]; then
    echo -e "${RED}Error: Witness node data directory not found at $WITNESS_DATA_DIR${NC}"
    echo "Please ensure the witness node data is available."
    exit 1
fi

# Set environment variables
export WITNESS_NODE_DATA_DIR="$WITNESS_DATA_DIR"
export TEST_USERNAME="${TEST_USERNAME:-testuser}"

echo -e "${GREEN}Environment set up successfully${NC}"
echo "WITNESS_NODE_DATA_DIR: $WITNESS_NODE_DATA_DIR"
echo "TEST_USERNAME: $TEST_USERNAME"

# Run the Python tests with real data
echo -e "${YELLOW}Running Python tests with real blockchain data...${NC}"
cd "$PROJECT_DIR"

# Test the real blockchain data structure
python -m pytest tests/integration/test_virtual_witness_node_real.py -v

# If Python tests pass, try the TypeScript tests
echo -e "${YELLOW}Running TypeScript integration tests...${NC}"

# First, make sure we have the test data files
if [ ! -f "data/accounts.json" ]; then
    echo -e "${YELLOW}Creating test data files...${NC}"
    mkdir -p data
fi

# Run the TypeScript tests
npm run test:integration

echo -e "${GREEN}All real data tests completed successfully!${NC}" 