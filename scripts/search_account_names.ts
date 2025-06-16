import { promises as fs } from 'fs';
import * as path from 'path';

async function searchAccountNames() {
  console.log('🔍 Searching for account names in blockchain data...');
  
  const blocksPath = path.join('witness_node', 'witness_node_data_dir', 'blockchain', 'database', 'block_num_to_block', 'blocks');
  
  // Read first 100MB of blockchain data
  const fileHandle = await fs.open(blocksPath, 'r');
  const bufferSize = 100 * 1024 * 1024; // 100MB
  const buffer = Buffer.alloc(bufferSize);
  
  const result = await fileHandle.read(buffer, 0, bufferSize, 0);
  await fileHandle.close();
  
  console.log(`📊 Read ${result.bytesRead.toLocaleString()} bytes`);
  
  // Search for common account name patterns
  const patterns = [
    'init',
    'admin',
    'user',
    'test',
    'account',
    'committee',
    'witness',
    'null'
  ];
  
  const foundStrings: string[] = [];
  
  // Look for strings that might be account names
  for (let i = 0; i < result.bytesRead - 10; i++) {
    // Look for length-prefixed strings (common in binary formats)
    if (buffer[i] >= 3 && buffer[i] <= 20) { // Reasonable account name length
      const length = buffer[i];
      if (i + 1 + length < result.bytesRead) {
        const str = buffer.toString('utf8', i + 1, i + 1 + length);
        
        // Check if it looks like an account name
        if (/^[a-z][a-z0-9\-\.]*$/.test(str) && str.length >= 3) {
          foundStrings.push(str);
          console.log(`Found potential account: "${str}" at offset ${i.toString(16)}`);
          
          if (foundStrings.length >= 50) break; // Limit output
        }
      }
    }
  }
  
  // Also search for patterns without length prefix
  const text = buffer.toString('utf8');
  for (const pattern of patterns) {
    const regex = new RegExp(`${pattern}[0-9]*`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      console.log(`Pattern "${pattern}" found: ${matches.slice(0, 10).join(', ')}`);
    }
  }
  
  console.log(`📊 Total potential account names found: ${foundStrings.length}`);
  
  // Check if any common account names appear
  const commonNames = ['init0', 'init1', 'committee-account', 'witness-account', 'null-account'];
  for (const name of commonNames) {
    if (buffer.includes(Buffer.from(name))) {
      console.log(`✅ Found known account name: ${name}`);
    }
  }
  
  // Save first 100 potential accounts
  if (foundStrings.length > 0) {
    await fs.writeFile('extracted_data/potential_accounts.json', JSON.stringify(foundStrings.slice(0, 100), null, 2));
    console.log('💾 Saved potential accounts to extracted_data/potential_accounts.json');
  }
}

searchAccountNames().catch(console.error); 