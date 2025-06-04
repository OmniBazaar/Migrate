import os
import struct
import datetime
import binascii
from typing import Dict, List, Tuple, Optional

def parse_object_id(data: bytes, offset: int) -> Optional[Tuple[int, int, int]]:
    """Parse an object ID from the binary data."""
    if offset + 8 > len(data):
        return None
        
    try:
        space_id = data[offset]
        type_id = data[offset + 1]
        instance_id = struct.unpack('<Q', data[offset + 2:offset + 10])[0]
        return (space_id, type_id, instance_id)
    except:
        return None

def analyze_binary_structure(data: bytes) -> Dict:
    """Analyze the binary structure of a blockchain object."""
    result = {
        'header': None,
        'space_id': None,
        'type_id': None,
        'object_id': None,
        'fields': [],
        'strings': [],
        'pointers': [],
        'common_patterns': {}
    }
    
    # Check for header pattern (first 4 bytes)
    if len(data) >= 4:
        header = struct.unpack('<I', data[:4])[0]
        result['header'] = f'0x{header:08x}'
        
        # Extract space_id and type_id from header
        if header in [0x00000201, 0x00000502]:
            result['space_id'] = (header >> 8) & 0xFF
            result['type_id'] = header & 0xFF
    
    # Parse object ID if present
    if len(data) >= 10:
        obj_id = parse_object_id(data, 4)
        if obj_id:
            result['object_id'] = f'{obj_id[0]}.{obj_id[1]}.{obj_id[2]}'
    
    # Analyze first 1024 bytes in detail
    for i in range(0, min(1024, len(data)), 4):
        if i + 4 <= len(data):
            value = struct.unpack('<I', data[i:i+4])[0]
            
            # Record field
            field = {
                'offset': i,
                'value': f'0x{value:08x}',
                'type': 'unknown'
            }
            
            # Identify field type
            if value == 0:
                field['type'] = 'null'
            elif value == 1:
                field['type'] = 'one'
            elif value < 1000:
                field['type'] = 'length'
            elif value > 0x10000000:  # Likely a pointer
                field['type'] = 'pointer'
                result['pointers'].append(i)
            
            result['fields'].append(field)
    
    # Look for strings (length-prefixed UTF-8)
    i = 0
    while i < len(data):
        if i + 4 <= len(data):
            length = struct.unpack('<I', data[i:i+4])[0]
            if 0 < length < 1000 and i + 4 + length <= len(data):
                try:
                    string = data[i+4:i+4+length].decode('utf-8')
                    if all(32 <= ord(c) <= 126 for c in string):  # Printable ASCII
                        result['strings'].append({
                            'offset': i,
                            'length': length,
                            'value': string
                        })
                except UnicodeDecodeError:
                    pass
        i += 4
    
    # Find common 4-byte patterns
    for i in range(0, len(data) - 3, 4):
        pattern = data[i:i+4]
        pattern_hex = binascii.hexlify(pattern).decode()
        result['common_patterns'][pattern_hex] = result['common_patterns'].get(pattern_hex, 0) + 1
    
    return result

def try_parse_data(data: bytes, offset: int, length: int) -> Optional[Tuple[str, any]]:
    """Try to parse data at the given offset as various types."""
    if offset + length > len(data):
        return None
        
    try:
        if length == 4:
            value = struct.unpack('<I', data[offset:offset+4])[0]
            return ('uint32', value)
        elif length == 8:
            value = struct.unpack('<Q', data[offset:offset+8])[0]
            return ('uint64', value)
        elif length == 4:
            value = struct.unpack('<f', data[offset:offset+4])[0]
            return ('float', value)
    except:
        pass
    return None

def print_objects():
    """Print the first few objects from the blockchain database."""
    # Paths to the object database files
    paths = [
        'witness_node/witness_node_data_dir/blockchain/object_database/2/5',  # Balances
        'witness_node/witness_node_data_dir/blockchain/object_database/1/2',  # Accounts
        'witness_node/witness_node_data_dir/blockchain/object_database/1/3'   # Assets
    ]
    
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'blockchain_objects_{timestamp}.txt'
    
    with open(output_file, 'w') as f:
        for path in paths:
            if os.path.exists(path):
                print(f"Processing {path}...")
                with open(path, 'rb') as db_file:
                    data = db_file.read()
                    
                    f.write(f"\nAnalyzing file: {path}\n")
                    f.write(f"File size: {len(data)} bytes\n")
                    
                    # Analyze the binary structure
                    analysis = analyze_binary_structure(data)
                    
                    # Write header information
                    f.write(f"\nHeader: {analysis['header']}\n")
                    if analysis['space_id'] is not None:
                        f.write(f"Space ID: {analysis['space_id']}\n")
                    if analysis['type_id'] is not None:
                        f.write(f"Type ID: {analysis['type_id']}\n")
                    if analysis['object_id'] is not None:
                        f.write(f"Object ID: {analysis['object_id']}\n")
                    
                    # Write field analysis
                    f.write("\nField Analysis:\n")
                    for field in analysis['fields']:
                        f.write(f"Offset {field['offset']:04x}: {field['value']} ({field['type']})\n")
                    
                    # Write string analysis
                    if analysis['strings']:
                        f.write("\nStrings Found:\n")
                        for string in analysis['strings']:
                            f.write(f"Offset {string['offset']:04x}: {string['value']}\n")
                    
                    # Write pointer analysis
                    if analysis['pointers']:
                        f.write("\nPotential Pointers:\n")
                        for ptr in analysis['pointers']:
                            f.write(f"Offset {ptr:04x}\n")
                    
                    # Write common patterns
                    f.write("\nCommon 4-byte Patterns:\n")
                    for pattern, count in sorted(analysis['common_patterns'].items(), key=lambda x: x[1], reverse=True)[:10]:
                        f.write(f"Pattern {pattern}: {count} occurrences\n")
                    
                    f.write("\n" + "="*80 + "\n")
    
    print(f"Analysis complete. Results saved to {output_file}")

if __name__ == "__main__":
    print_objects() 