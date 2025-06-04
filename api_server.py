from flask import Flask, jsonify, request, session
from functools import wraps
from virtual_witness_node import VirtualWitnessNode
from auth import AuthManager
import os

app = Flask(__name__)
app.secret_key = os.urandom(32)  # For session management
node = VirtualWitnessNode()
auth = AuthManager()

def login_required(f):
    """Decorator to require login for protected endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        
        token = auth_header.split(' ')[1]
        username = auth.verify_session(token)
        if not username:
            return jsonify({'error': 'Invalid or expired session'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    if auth.register_user(data['username'], data['password']):
        return jsonify({'message': 'Registration successful'}), 201
    else:
        return jsonify({'error': 'Username already exists'}), 409

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login a user."""
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    if auth.verify_password(data['username'], data['password']):
        token = auth.create_session(data['username'])
        return jsonify({
            'message': 'Login successful',
            'token': token
        })
    else:
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    """Logout a user."""
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1]
    auth.invalidate_session(token)
    return jsonify({'message': 'Logout successful'})

@app.route('/api/account/<name>', methods=['GET'])
@login_required
def get_account(name):
    """Get account information by name."""
    account = node.get_account_by_name(name)
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    return jsonify(account)

@app.route('/api/account/<name>/balances', methods=['GET'])
@login_required
def get_account_balances(name):
    """Get account balances by name."""
    account = node.get_account_by_name(name)
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    balances = node.get_account_balances(account['id'])
    return jsonify(balances)

@app.route('/api/account/id/<account_id>', methods=['GET'])
@login_required
def get_account_by_id(account_id):
    """Get account information by ID."""
    account = node.get_account_by_id(account_id)
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    return jsonify(account)

@app.route('/api/account/id/<account_id>/balances', methods=['GET'])
@login_required
def get_account_balances_by_id(account_id):
    """Get account balances by ID."""
    account = node.get_account_by_id(account_id)
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    balances = node.get_account_balances(account_id)
    return jsonify(balances)

@app.route('/api/verify-credentials', methods=['POST'])
def verify_credentials():
    """Verify user credentials without creating a session."""
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    if auth.verify_password(data['username'], data['password']):
        return jsonify({'message': 'Credentials verified successfully'}), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 