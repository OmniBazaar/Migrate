import unittest
import os
import json
import tempfile
from datetime import datetime, timedelta
from auth import AuthManager

class TestAuthManager(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test."""
        # Create a temporary file for testing
        self.temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.temp_file.close()
        self.auth = AuthManager(self.temp_file.name)
    
    def tearDown(self):
        """Clean up after each test."""
        # Remove the temporary file
        os.unlink(self.temp_file.name)
    
    def test_register_user(self):
        """Test user registration."""
        # Test successful registration
        self.assertTrue(self.auth.register_user("testuser", "password123"))
        
        # Test duplicate username
        self.assertFalse(self.auth.register_user("testuser", "password456"))
        
        # Verify user was saved
        with open(self.temp_file.name, 'r') as f:
            users = json.load(f)
            self.assertIn("testuser", users)
            self.assertIn("password_hash", users["testuser"])
            self.assertIn("salt", users["testuser"])
            self.assertIn("created_at", users["testuser"])
    
    def test_verify_password(self):
        """Test password verification."""
        # Register a user
        self.auth.register_user("testuser", "password123")
        
        # Test correct password
        self.assertTrue(self.auth.verify_password("testuser", "password123"))
        
        # Test incorrect password
        self.assertFalse(self.auth.verify_password("testuser", "wrongpass"))
        
        # Test non-existent user
        self.assertFalse(self.auth.verify_password("nonexistent", "password123"))
    
    def test_session_management(self):
        """Test session creation and verification."""
        # Create a session
        token = self.auth.create_session("testuser")
        self.assertIsNotNone(token)
        
        # Verify valid session
        username = self.auth.verify_session(token)
        self.assertEqual(username, "testuser")
        
        # Test invalid token
        self.assertIsNone(self.auth.verify_session("invalid_token"))
        
        # Test session invalidation
        self.auth.invalidate_session(token)
        self.assertIsNone(self.auth.verify_session(token))
    
    def test_session_expiry(self):
        """Test session expiration."""
        # Create a session with short duration
        token = self.auth.create_session("testuser", duration=timedelta(seconds=1))
        
        # Session should be valid immediately
        self.assertEqual(self.auth.verify_session(token), "testuser")
        
        # Wait for session to expire
        import time
        time.sleep(2)
        
        # Session should be expired
        self.assertIsNone(self.auth.verify_session(token))

if __name__ == '__main__':
    unittest.main() 