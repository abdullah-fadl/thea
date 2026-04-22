#!/usr/bin/env python3
"""
Hospital Operations Platform Backend API Testing
Tests authentication, admin users, equipment, and OPD census endpoints
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = "https://healthpro-18.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class HospitalAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.admin_user = None
        
    def log_test(self, test_name, success, message="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if message:
            print(f"   {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
    def test_init_database(self):
        """Test database initialization to create admin user"""
        print("=== Testing Database Initialization ===")
        try:
            response = self.session.post(f"{API_BASE}/init")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Database Initialization", True, 
                            f"Admin user created/exists: {data.get('message', 'Success')}")
                return True
            else:
                self.log_test("Database Initialization", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Database Initialization", False, f"Exception: {str(e)}")
            return False
    
    def test_login_correct_credentials(self):
        """Test login with correct admin credentials"""
        print("=== Testing Authentication - Correct Credentials ===")
        try:
            login_data = {
                "email": "admin@hospital.com",
                "password": "admin123"
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'user' in data:
                    self.admin_user = data['user']
                    # The session should automatically handle cookies
                    # Check if auth-token cookie was set
                    auth_cookie = self.session.cookies.get('auth-token')
                    if auth_cookie:
                        self.auth_token = auth_cookie
                        print(f"   Auth token received and stored")
                    
                    self.log_test("Login with Correct Credentials", True, 
                                f"User: {data['user']['email']}, Role: {data['user']['role']}")
                    return True
                else:
                    self.log_test("Login with Correct Credentials", False, 
                                "Missing success flag or user data", data)
                    return False
            else:
                self.log_test("Login with Correct Credentials", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login with Correct Credentials", False, f"Exception: {str(e)}")
            return False
    
    def test_login_incorrect_credentials(self):
        """Test login with incorrect credentials"""
        print("=== Testing Authentication - Incorrect Credentials ===")
        try:
            login_data = {
                "email": "admin@hospital.com",
                "password": "wrongpassword"
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_test("Login with Incorrect Credentials", True, 
                                f"Correctly rejected: {data['error']}")
                    return True
                else:
                    self.log_test("Login with Incorrect Credentials", False, 
                                "Expected error message not found", data)
                    return False
            else:
                self.log_test("Login with Incorrect Credentials", False, 
                            f"Expected 401, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login with Incorrect Credentials", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_me_endpoint(self):
        """Test /api/auth/me endpoint to get current user"""
        print("=== Testing Auth Me Endpoint ===")
        try:
            # The session should already have the auth cookie from login
            response = self.session.get(f"{API_BASE}/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                if 'user' in data:
                    user = data['user']
                    self.log_test("Auth Me Endpoint", True, 
                                f"User: {user.get('email')}, Role: {user.get('role')}")
                    return True
                else:
                    self.log_test("Auth Me Endpoint", False, 
                                "User data not found in response", data)
                    return False
            else:
                self.log_test("Auth Me Endpoint", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Auth Me Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_logout_functionality(self):
        """Test logout functionality"""
        print("=== Testing Logout Functionality ===")
        try:
            response = self.session.post(f"{API_BASE}/auth/logout")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    # Check if Set-Cookie header clears the token
                    if 'Set-Cookie' in response.headers:
                        cookie_header = response.headers['Set-Cookie']
                        if 'auth-token=' in cookie_header and 'Max-Age=0' in cookie_header:
                            self.log_test("Logout Functionality", True, 
                                        "Successfully logged out and cleared cookie")
                            return True
                    
                    self.log_test("Logout Functionality", True, "Logout successful")
                    return True
                else:
                    self.log_test("Logout Functionality", False, 
                                "Success flag not found", data)
                    return False
            else:
                self.log_test("Logout Functionality", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Logout Functionality", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_users_list(self):
        """Test GET /api/admin/users - list all users"""
        print("=== Testing Admin Users List ===")
        try:
            # Re-login to get fresh token
            if not self.test_login_correct_credentials():
                self.log_test("Admin Users List", False, "Failed to re-authenticate")
                return False
            
            response = self.session.get(f"{API_BASE}/admin/users")
            
            if response.status_code == 200:
                data = response.json()
                if 'users' in data and isinstance(data['users'], list):
                    users_count = len(data['users'])
                    self.log_test("Admin Users List", True, 
                                f"Retrieved {users_count} users")
                    return True
                else:
                    self.log_test("Admin Users List", False, 
                                "Users array not found in response", data)
                    return False
            elif response.status_code == 403:
                self.log_test("Admin Users List", False, 
                            "Access forbidden - check admin role", response.text)
                return False
            else:
                self.log_test("Admin Users List", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Users List", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_create_user(self):
        """Test POST /api/admin/users - create a new user with role 'staff'"""
        print("=== Testing Admin Create User ===")
        try:
            new_user_data = {
                "email": f"staff.user.{datetime.now().strftime('%Y%m%d%H%M%S')}@hospital.com",
                "password": "staffpass123",
                "firstName": "Staff",
                "lastName": "User",
                "role": "staff",
                "department": "General"
            }
            
            response = self.session.post(f"{API_BASE}/admin/users", json=new_user_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'user' in data:
                    user = data['user']
                    self.log_test("Admin Create User", True, 
                                f"Created user: {user.get('email')}, Role: {user.get('role')}")
                    return True
                else:
                    self.log_test("Admin Create User", False, 
                                "Success flag or user data not found", data)
                    return False
            elif response.status_code == 403:
                self.log_test("Admin Create User", False, 
                            "Access forbidden - check admin role", response.text)
                return False
            else:
                self.log_test("Admin Create User", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Create User", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_auth_required(self):
        """Test that admin endpoints require authentication"""
        print("=== Testing Admin Endpoints Authentication Required ===")
        try:
            # Clear cookies to test without auth
            self.session.cookies.clear()
            
            response = self.session.get(f"{API_BASE}/admin/users")
            
            if response.status_code == 401:
                self.log_test("Admin Auth Required", True, 
                            "Correctly rejected unauthenticated request")
                return True
            else:
                self.log_test("Admin Auth Required", False, 
                            f"Expected 401, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Auth Required", False, f"Exception: {str(e)}")
            return False
    
    def test_equipment_list(self):
        """Test GET /api/equipment - list all equipment"""
        print("=== Testing Equipment List ===")
        try:
            # Re-login to get fresh token
            if not self.test_login_correct_credentials():
                self.log_test("Equipment List", False, "Failed to re-authenticate")
                return False
            
            response = self.session.get(f"{API_BASE}/equipment")
            
            if response.status_code == 200:
                data = response.json()
                if 'equipment' in data and isinstance(data['equipment'], list):
                    equipment_count = len(data['equipment'])
                    self.log_test("Equipment List", True, 
                                f"Retrieved {equipment_count} equipment items")
                    return True
                else:
                    self.log_test("Equipment List", False, 
                                "Equipment array not found in response", data)
                    return False
            else:
                self.log_test("Equipment List", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Equipment List", False, f"Exception: {str(e)}")
            return False
    
    def test_equipment_create(self):
        """Test POST /api/equipment - create new equipment item"""
        print("=== Testing Equipment Create ===")
        try:
            equipment_data = {
                "name": f"Test Equipment {datetime.now().strftime('%Y%m%d%H%M%S')}",
                "code": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "type": "Medical Device",
                "manufacturer": "Test Manufacturer",
                "model": "Test Model",
                "serialNumber": f"SN{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "status": "active",
                "location": "Test Ward",
                "department": "General"
            }
            
            response = self.session.post(f"{API_BASE}/equipment", json=equipment_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'equipment' in data:
                    equipment = data['equipment']
                    self.log_test("Equipment Create", True, 
                                f"Created equipment: {equipment.get('name')}, Code: {equipment.get('code')}")
                    return True
                else:
                    self.log_test("Equipment Create", False, 
                                "Success flag or equipment data not found", data)
                    return False
            elif response.status_code == 403:
                self.log_test("Equipment Create", False, 
                            "Access forbidden - check user role", response.text)
                return False
            else:
                self.log_test("Equipment Create", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Equipment Create", False, f"Exception: {str(e)}")
            return False
    
    def test_equipment_auth_required(self):
        """Test that equipment endpoints require authentication"""
        print("=== Testing Equipment Authentication Required ===")
        try:
            # Clear cookies to test without auth
            self.session.cookies.clear()
            
            response = self.session.get(f"{API_BASE}/equipment")
            
            if response.status_code == 401:
                self.log_test("Equipment Auth Required", True, 
                            "Correctly rejected unauthenticated request")
                return True
            else:
                self.log_test("Equipment Auth Required", False, 
                            f"Expected 401, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Equipment Auth Required", False, f"Exception: {str(e)}")
            return False
    
    def test_opd_census(self):
        """Test GET /api/opd/census?date=2025-06-15 - fetch census data"""
        print("=== Testing OPD Census ===")
        try:
            # Re-login to get fresh token
            if not self.test_login_correct_credentials():
                self.log_test("OPD Census", False, "Failed to re-authenticate")
                return False
            
            test_date = "2025-06-15"
            response = self.session.get(f"{API_BASE}/opd/census?date={test_date}")
            
            if response.status_code == 200:
                data = response.json()
                if 'records' in data and isinstance(data['records'], list):
                    records_count = len(data['records'])
                    self.log_test("OPD Census", True, 
                                f"Retrieved {records_count} census records for {test_date}")
                    return True
                else:
                    self.log_test("OPD Census", False, 
                                "Records array not found in response", data)
                    return False
            else:
                self.log_test("OPD Census", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("OPD Census", False, f"Exception: {str(e)}")
            return False
    
    def test_opd_census_missing_date(self):
        """Test OPD census endpoint without date parameter"""
        print("=== Testing OPD Census Missing Date Parameter ===")
        try:
            response = self.session.get(f"{API_BASE}/opd/census")
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'Date parameter is required' in data['error']:
                    self.log_test("OPD Census Missing Date", True, 
                                "Correctly rejected request without date parameter")
                    return True
                else:
                    self.log_test("OPD Census Missing Date", False, 
                                "Expected date parameter error message", data)
                    return False
            else:
                self.log_test("OPD Census Missing Date", False, 
                            f"Expected 400, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("OPD Census Missing Date", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🏥 Hospital Operations Platform Backend API Testing")
        print("=" * 60)
        
        test_results = []
        
        # Database initialization
        test_results.append(self.test_init_database())
        
        # Authentication tests
        test_results.append(self.test_login_correct_credentials())
        test_results.append(self.test_login_incorrect_credentials())
        test_results.append(self.test_auth_me_endpoint())
        test_results.append(self.test_logout_functionality())
        
        # Admin user tests
        test_results.append(self.test_admin_users_list())
        test_results.append(self.test_admin_create_user())
        test_results.append(self.test_admin_auth_required())
        
        # Equipment tests
        test_results.append(self.test_equipment_list())
        test_results.append(self.test_equipment_create())
        test_results.append(self.test_equipment_auth_required())
        
        # OPD census tests
        test_results.append(self.test_opd_census())
        test_results.append(self.test_opd_census_missing_date())
        
        # Summary
        passed = sum(test_results)
        total = len(test_results)
        
        print("=" * 60)
        print(f"🏥 TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ All backend API tests PASSED!")
        else:
            print(f"❌ {total - passed} tests FAILED")
        
        return passed == total

if __name__ == "__main__":
    tester = HospitalAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)