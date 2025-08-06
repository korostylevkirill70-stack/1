#!/usr/bin/env python3
"""
TGStat Parser Backend API Testing
Tests all API endpoints for the TGStat parser application
"""

import requests
import sys
import time
import json
from datetime import datetime

class TGStatAPITester:
    def __init__(self, base_url="https://9912f129-f255-4c9a-a4b8-c108c33ed2fc.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.current_task_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'N/A')}"
            return self.log_test("API Root Endpoint", success, details)
        except Exception as e:
            return self.log_test("API Root Endpoint", False, f"Error: {str(e)}")

    def test_start_parsing(self, category="crypto", content_types=["channels"], max_pages=2):
        """Test start parsing endpoint"""
        try:
            payload = {
                "category": category,
                "content_types": content_types,
                "max_pages": max_pages
            }
            
            response = requests.post(
                f"{self.api_url}/start-parsing", 
                json=payload,
                timeout=15
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                self.current_task_id = data.get('task_id')
                details += f", Task ID: {self.current_task_id[:8] if self.current_task_id else 'None'}"
                details += f", Status: {data.get('status', 'N/A')}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            return self.log_test("Start Parsing", success, details)
            
        except Exception as e:
            return self.log_test("Start Parsing", False, f"Error: {str(e)}")

    def test_parsing_status(self, task_id=None):
        """Test parsing status endpoint"""
        if not task_id:
            task_id = self.current_task_id
            
        if not task_id:
            return self.log_test("Parsing Status", False, "No task ID available")
            
        try:
            response = requests.get(f"{self.api_url}/parsing-status/{task_id}", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Task Status: {data.get('status', 'N/A')}"
                details += f", Progress: {data.get('progress', 0)}"
                details += f", Results Count: {data.get('results_count', 0)}"
                
                # Store status for later use
                self.last_status = data
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            return self.log_test("Parsing Status", success, details)
            
        except Exception as e:
            return self.log_test("Parsing Status", False, f"Error: {str(e)}")

    def wait_for_completion(self, task_id=None, max_wait=60):
        """Wait for parsing task to complete"""
        if not task_id:
            task_id = self.current_task_id
            
        if not task_id:
            print("❌ No task ID available for waiting")
            return False
            
        print(f"⏳ Waiting for task {task_id[:8]} to complete (max {max_wait}s)...")
        
        start_time = time.time()
        while time.time() - start_time < max_wait:
            try:
                response = requests.get(f"{self.api_url}/parsing-status/{task_id}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status', 'unknown')
                    progress = data.get('progress', 0)
                    
                    print(f"   Status: {status}, Progress: {progress}")
                    
                    if status == "completed":
                        print("✅ Task completed successfully!")
                        return True
                    elif status == "failed":
                        error_msg = data.get('error_message', 'Unknown error')
                        print(f"❌ Task failed: {error_msg}")
                        return False
                        
                time.sleep(3)  # Wait 3 seconds between checks
                
            except Exception as e:
                print(f"   Error checking status: {str(e)}")
                time.sleep(3)
                
        print(f"⏰ Timeout waiting for task completion after {max_wait}s")
        return False

    def test_parsing_results(self, task_id=None):
        """Test parsing results endpoint"""
        if not task_id:
            task_id = self.current_task_id
            
        if not task_id:
            return self.log_test("Parsing Results", False, "No task ID available")
            
        try:
            response = requests.get(f"{self.api_url}/parsing-results/{task_id}", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                results = data.get('results', [])
                details += f", Results Count: {len(results)}"
                details += f", Category: {data.get('category', 'N/A')}"
                details += f", Content Types: {data.get('content_types', [])}"
                
                # Validate result format
                if results:
                    first_result = results[0]
                    required_fields = ['name', 'link', 'subscribers']
                    has_required = all(field in first_result for field in required_fields)
                    details += f", Has Required Fields: {has_required}"
                    
                    # Check if links are realistic
                    valid_links = sum(1 for r in results if 't.me' in r.get('link', ''))
                    details += f", Valid t.me Links: {valid_links}/{len(results)}"
                    
                self.last_results = data
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            return self.log_test("Parsing Results", success, details)
            
        except Exception as e:
            return self.log_test("Parsing Results", False, f"Error: {str(e)}")

    def test_export_results(self, task_id=None):
        """Test export results endpoint"""
        if not task_id:
            task_id = self.current_task_id
            
        if not task_id:
            return self.log_test("Export Results", False, "No task ID available")
            
        try:
            response = requests.get(f"{self.api_url}/export-results/{task_id}", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                details += f", Content-Type: {content_type}"
                details += f", Size: {content_length} bytes"
                
                # Check if it's a text file
                if 'text' in content_type:
                    content = response.text
                    lines = content.split('\n')
                    details += f", Lines: {len(lines)}"
                    
                    # Validate export format: "1. название \ ссылка \ количество подписчиков"
                    if lines:
                        first_line = lines[0].strip()
                        has_correct_format = '\\' in first_line and first_line.startswith('1.')
                        details += f", Correct Format: {has_correct_format}"
                        
                        if has_correct_format:
                            parts = first_line.split('\\')
                            details += f", Parts: {len(parts)}"
                            
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            return self.log_test("Export Results", success, details)
            
        except Exception as e:
            return self.log_test("Export Results", False, f"Error: {str(e)}")

    def test_invalid_endpoints(self):
        """Test invalid endpoints return proper errors"""
        tests = [
            ("Invalid Task ID Status", f"{self.api_url}/parsing-status/invalid-id", 404),
            ("Invalid Task ID Results", f"{self.api_url}/parsing-results/invalid-id", 404),
            ("Invalid Task ID Export", f"{self.api_url}/export-results/invalid-id", 404),
        ]
        
        all_passed = True
        for test_name, url, expected_status in tests:
            try:
                response = requests.get(url, timeout=10)
                success = response.status_code == expected_status
                details = f"Expected: {expected_status}, Got: {response.status_code}"
                
                if not self.log_test(test_name, success, details):
                    all_passed = False
                    
            except Exception as e:
                self.log_test(test_name, False, f"Error: {str(e)}")
                all_passed = False
                
        return all_passed

    def test_parsing_with_different_params(self):
        """Test parsing with different parameters"""
        test_cases = [
            ("Crypto Channels", {"category": "crypto", "content_types": ["channels"], "max_pages": 1}),
            ("Tech Chats", {"category": "tech", "content_types": ["chats"], "max_pages": 1}),
            ("Business Both", {"category": "business", "content_types": ["channels", "chats"], "max_pages": 1}),
        ]
        
        all_passed = True
        for test_name, params in test_cases:
            try:
                response = requests.post(f"{self.api_url}/start-parsing", json=params, timeout=15)
                success = response.status_code == 200
                details = f"Status: {response.status_code}, Params: {params}"
                
                if success:
                    data = response.json()
                    task_id = data.get('task_id')
                    details += f", Task ID: {task_id[:8] if task_id else 'None'}"
                
                if not self.log_test(f"Start Parsing - {test_name}", success, details):
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"Start Parsing - {test_name}", False, f"Error: {str(e)}")
                all_passed = False
                
        return all_passed

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting TGStat Parser API Comprehensive Testing")
        print("=" * 60)
        
        # Basic API tests
        print("\n📋 Basic API Tests:")
        self.test_api_root()
        
        # Parsing workflow tests
        print("\n🔄 Parsing Workflow Tests:")
        if self.test_start_parsing():
            # Wait a bit for task to start
            time.sleep(2)
            
            # Check status
            self.test_parsing_status()
            
            # Wait for completion
            if self.wait_for_completion():
                # Test results and export
                self.test_parsing_results()
                self.test_export_results()
            else:
                print("⚠️ Skipping results tests due to parsing timeout/failure")
        
        # Error handling tests
        print("\n❌ Error Handling Tests:")
        self.test_invalid_endpoints()
        
        # Parameter variation tests
        print("\n🔧 Parameter Variation Tests:")
        self.test_parsing_with_different_params()
        
        # Final results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend API is working correctly.")
            return 0
        else:
            print(f"⚠️ {self.tests_run - self.tests_passed} tests failed. Check the issues above.")
            return 1

def main():
    """Main test execution"""
    tester = TGStatAPITester()
    return tester.run_comprehensive_test()

if __name__ == "__main__":
    sys.exit(main())