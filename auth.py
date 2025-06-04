import os
import json
import hashlib
import secrets
from typing import Optional, Dict
from datetime import datetime, timedelta

class AuthManager:
    def __init__(self, users_file: str = "users.json"):
        """Initialize the authentication manager.
        
        Args:
            users_file: Path to the users database file
        """
        self.users_file = users_file
        self.users = self._load_users()
        self.sessions = {}  # token -> (username, expiry)
        
    def _load_users(self) -> Dict:
        """Load users from the database file."""
        if os.path.exists(self.users_file):
            try:
                with open(self.users_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _save_users(self):
        """Save users to the database file."""
        with open(self.users_file, 'w') as f:
            json.dump(self.users, f, indent=2)
    
    def _hash_password(self, password: str, salt: Optional[str] = None) -> tuple[str, str]:
        """Hash a password with a salt.
        
        Args:
            password: Password to hash
            salt: Optional salt to use (generates new one if None)
            
        Returns:
            Tuple of (hashed_password, salt)
        """
        if salt is None:
            salt = secrets.token_hex(16)
        
        # Use PBKDF2 with SHA-256
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000  # Number of iterations
        )
        
        return key.hex(), salt
    
    def register_user(self, username: str, password: str) -> bool:
        """Register a new user.
        
        Args:
            username: Username to register
            password: Password to use
            
        Returns:
            True if registration successful, False if username already exists
        """
        if username in self.users:
            return False
        
        hashed_password, salt = self._hash_password(password)
        self.users[username] = {
            'password_hash': hashed_password,
            'salt': salt,
            'created_at': datetime.utcnow().isoformat()
        }
        
        self._save_users()
        return True
    
    def verify_password(self, username: str, password: str) -> bool:
        """Verify a user's password.
        
        Args:
            username: Username to verify
            password: Password to verify
            
        Returns:
            True if password is correct, False otherwise
        """
        if username not in self.users:
            return False
        
        user = self.users[username]
        hashed_password, _ = self._hash_password(password, user['salt'])
        
        return hashed_password == user['password_hash']
    
    def create_session(self, username: str, duration: timedelta = timedelta(hours=24)) -> str:
        """Create a new session for a user.
        
        Args:
            username: Username to create session for
            duration: How long the session should last
            
        Returns:
            Session token
        """
        token = secrets.token_hex(32)
        expiry = datetime.utcnow() + duration
        
        self.sessions[token] = (username, expiry)
        return token
    
    def verify_session(self, token: str) -> Optional[str]:
        """Verify a session token.
        
        Args:
            token: Session token to verify
            
        Returns:
            Username if token is valid, None otherwise
        """
        if token not in self.sessions:
            return None
        
        username, expiry = self.sessions[token]
        if datetime.utcnow() > expiry:
            del self.sessions[token]
            return None
        
        return username
    
    def invalidate_session(self, token: str):
        """Invalidate a session token.
        
        Args:
            token: Session token to invalidate
        """
        if token in self.sessions:
            del self.sessions[token] 