import unittest
import json
import tempfile
import os
from api_server import app
from auth import AuthManager

class TestAPI(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test."""
        # Create a temporary file for testing
        self.temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.temp_file.close()
        
        # Configure app for testing
        app.config['TESTING'] = True
        app.config['AUTH_MANAGER'] = AuthManager(self.temp_file.name)
        self.client = app.test_client()
        
        # Register a test user
        self.test_user = {
            'username': 'testuser',
            'password': 'password123'
        }
        app.config['AUTH_MANAGER'].register_user(
            self.test_user['username'],
            self.test_user['password']
        )
        
        # Login and get token
        response = self.client.post(
            '/api/auth/login',
            json=self.test_user
        )
        self.token = json.loads(response.data)['token']
    
    def tearDown(self):
        """Clean up after each test."""
        os.unlink(self.temp_file.name)
    
    def test_register(self):
        """Test user registration endpoint."""
        # Test successful registration
        response = self.client.post(
            '/api/auth/register',
            json={
                'username': 'newuser',
                'password': 'password123'
            }
        )
        self.assertEqual(response.status_code, 201)
        
        # Test duplicate username
        response = self.client.post(
            '/api/auth/register',
            json=self.test_user
        )
        self.assertEqual(response.status_code, 409)
    
    def test_login(self):
        """Test login endpoint."""
        # Test successful login
        response = self.client.post(
            '/api/auth/login',
            json=self.test_user
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('token', json.loads(response.data))
        
        # Test invalid credentials
        response = self.client.post(
            '/api/auth/login',
            json={
                'username': 'testuser',
                'password': 'wrongpass'
            }
        )
        self.assertEqual(response.status_code, 401)
    
    def test_logout(self):
        """Test logout endpoint."""
        # Test successful logout
        response = self.client.post(
            '/api/auth/logout',
            headers={'Authorization': f'Bearer {self.token}'}
        )
        self.assertEqual(response.status_code, 200)
        
        # Test logout with invalid token
        response = self.client.post(
            '/api/auth/logout',
            headers={'Authorization': 'Bearer invalid_token'}
        )
        self.assertEqual(response.status_code, 401)
    
    def test_protected_endpoints(self):
        """Test protected endpoints."""
        # Test without token
        response = self.client.get('/api/account/testuser')
        self.assertEqual(response.status_code, 401)
        
        # Test with valid token
        response = self.client.get(
            '/api/account/testuser',
            headers={'Authorization': f'Bearer {self.token}'}
        )
        self.assertEqual(response.status_code, 404)  # Account doesn't exist
        
        # Test with invalid token
        response = self.client.get(
            '/api/account/testuser',
            headers={'Authorization': 'Bearer invalid_token'}
        )
        self.assertEqual(response.status_code, 401)

if __name__ == '__main__':
    unittest.main() 