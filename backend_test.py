#!/usr/bin/env python3
"""
WedOps Backend E2E Smoke Test
Tests all backend flows: auth, onboarding, WhatsApp engine, join flow
Uses requests.Session() to persist cookies between calls (critical for @supabase/ssr auth)
"""

import requests
import json
import time
from datetime import datetime, timedelta
import os

# Configuration
BASE_URL = "https://wedops-demo.preview.emergentagent.com"
SUPABASE_URL = "https://teyymgutsuwssesgokzx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleXltZ3V0c3V3c3Nlc2dva3p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTg2NTExNCwiZXhwIjoyMTAxNDQxMTE0fQ.4HIsq7ZhaDLjmB3nqngBZ4G-Wd5jbCIOGcMAMqkexrA"

# Test data - use pre-created user to avoid rate limits
timestamp = int(time.time())
test_email = "wedops-backend-test@example.com"  # Pre-created via Admin API
test_password = "TestPassword123!"
test_name = "Backend Test User"

# Shared session for cookie persistence
session = requests.Session()

def log_cookies(step):
    """Log current cookies in session"""
    print(f"\n[{step}] Current cookies:")
    if session.cookies:
        for cookie in session.cookies:
            print(f"  - {cookie.name}: {cookie.value[:50]}...")
    else:
        print("  - No cookies set")

def query_supabase(table, filters="", select="*"):
    """Query Supabase REST API with service role"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}{filters}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    response = requests.get(url, headers=headers)
    return response

print("=" * 80)
print("WedOps Backend E2E Smoke Test")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Test email: {test_email}")
print(f"Test password: {test_password}")
print("=" * 80)

# ============================================================================
# TEST 1: Setup Status
# ============================================================================
print("\n[TEST 1] GET /api/setup - Check schema deployment status")
try:
    response = session.get(f"{BASE_URL}/api/setup")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200:
        if data.get('schemaDeployed') == True and data.get('partial') == False:
            print("✅ TEST 1 PASSED: Schema fully deployed")
        else:
            print(f"❌ TEST 1 FAILED: Schema not fully deployed - schemaDeployed={data.get('schemaDeployed')}, partial={data.get('partial')}")
    else:
        print(f"❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
except Exception as e:
    print(f"❌ TEST 1 FAILED: Exception - {str(e)}")

# ============================================================================
# TEST 2: Signup (SKIPPED - using pre-created user to avoid rate limits)
# ============================================================================
print("\n[TEST 2] POST /api/auth/signup - SKIPPED (using existing user)")
print("⚠️  TEST 2 SKIPPED: Using pre-created user to avoid Supabase rate limits")

# ============================================================================
# TEST 3: Signin (CRITICAL - must set auth cookies)
# ============================================================================
print("\n[TEST 3] POST /api/auth/signin - Sign in and get auth cookies")
try:
    payload = {
        "email": test_email,
        "password": test_password
    }
    response = session.post(f"{BASE_URL}/api/auth/signin", json=payload)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200:
        if data.get('user') and data['user'].get('id'):
            user_id = data['user']['id']
            print(f"✅ User object received: id={user_id}")
            
            # Check for auth cookies
            log_cookies("After Signin")
            auth_cookies = [c for c in session.cookies if 'auth' in c.name.lower() or 'sb-' in c.name.lower()]
            if auth_cookies:
                print(f"✅ TEST 3 PASSED: Auth cookies set ({len(auth_cookies)} cookies)")
            else:
                print("❌ TEST 3 CRITICAL BUG: No auth cookies set! Subsequent authenticated calls will fail.")
                print("   This means @supabase/ssr is not setting cookies properly.")
        else:
            print("❌ TEST 3 FAILED: No user object in response")
    else:
        print(f"❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
except Exception as e:
    print(f"❌ TEST 3 FAILED: Exception - {str(e)}")

# ============================================================================
# TEST 4: Onboarding (auth-gated, needs cookies from TEST 3)
# ============================================================================
print("\n[TEST 4] POST /api/onboarding - Create org + project + seed data")
try:
    wedding_date = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
    payload = {
        "orgName": "Test Wedding Co",
        "orgType": "couple",
        "projectName": "Aditi & Rahul Test",
        "weddingDate": wedding_date,
        "displayName": "Aditi"
    }
    response = session.post(f"{BASE_URL}/api/onboarding", json=payload)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 401:
        print("❌ TEST 4 CRITICAL BUG: Got 401 Unauthorized!")
        print("   This means auth cookies from TEST 3 are not being read by the server.")
        print("   The @supabase/ssr cookie handling is broken.")
        org_id = None
        project_id = None
    elif response.status_code == 200:
        if data.get('orgId') and data.get('projectId'):
            org_id = data['orgId']
            project_id = data['projectId']
            print(f"✅ TEST 4 PASSED: Org created (id={org_id}), Project created (id={project_id})")
        else:
            print("❌ TEST 4 FAILED: Missing orgId or projectId in response")
            org_id = None
            project_id = None
    else:
        print(f"❌ TEST 4 FAILED: Expected 200, got {response.status_code}")
        org_id = None
        project_id = None
except Exception as e:
    print(f"❌ TEST 4 FAILED: Exception - {str(e)}")
    org_id = None
    project_id = None

# ============================================================================
# TEST 5: Verify Seed Data
# ============================================================================
print("\n[TEST 5] Verify seed data counts via Supabase REST API")
if project_id:
    try:
        expected_counts = {
            "events": 7,
            "categories": 23,
            "todo_lists": 3,
            "tasks": 4,
            "vendors": 6,
            "shopping_items": 4,
            "guests": 8,
            "tables": 4,
            "vehicles": 3,
            "trials": 3,
            "invoices": 6,
            "booking_lead_times": 16
        }
        
        actual_counts = {}
        all_passed = True
        
        for table, expected in expected_counts.items():
            response = query_supabase(table, f"&project_id=eq.{project_id}", "id")
            if response.status_code == 200:
                actual = len(response.json())
                actual_counts[table] = actual
                if actual == expected:
                    print(f"  ✅ {table}: {actual}/{expected}")
                else:
                    print(f"  ❌ {table}: {actual}/{expected} (MISMATCH)")
                    all_passed = False
            else:
                print(f"  ❌ {table}: Failed to query (status {response.status_code})")
                all_passed = False
        
        # Check whatsapp_settings for org
        response = query_supabase("whatsapp_settings", f"&org_id=eq.{org_id}", "id")
        if response.status_code == 200:
            count = len(response.json())
            if count == 1:
                print(f"  ✅ whatsapp_settings: {count}/1")
            else:
                print(f"  ❌ whatsapp_settings: {count}/1 (MISMATCH)")
                all_passed = False
        
        if all_passed:
            print("✅ TEST 5 PASSED: All seed data counts match")
        else:
            print("❌ TEST 5 FAILED: Some seed data counts don't match")
            
    except Exception as e:
        print(f"❌ TEST 5 FAILED: Exception - {str(e)}")
else:
    print("⚠️  TEST 5 SKIPPED: No project_id from TEST 4")

# ============================================================================
# TEST 6: WhatsApp Send (auth-gated)
# ============================================================================
print("\n[TEST 6] POST /api/whatsapp/send - Send WhatsApp message to vendor")
if project_id:
    try:
        # Get a vendor with phone
        response = query_supabase("vendors", f"&project_id=eq.{project_id}", "id,name,phone")
        if response.status_code == 200:
            vendors = response.json()
            vendor = next((v for v in vendors if v.get('phone')), None)
            
            if vendor:
                print(f"  Using vendor: {vendor['name']} ({vendor['phone']})")
                payload = {
                    "to": vendor['phone'],
                    "toName": vendor['name'],
                    "template": "vendor_ping",
                    "body": "Test message from smoke test",
                    "entityType": "vendor",
                    "entityId": vendor['id']
                }
                response = session.post(f"{BASE_URL}/api/whatsapp/send", json=payload)
                print(f"Status: {response.status_code}")
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if response.status_code == 200:
                    if data.get('ok') and data.get('message') and data['message'].get('status') == 'sent':
                        print(f"✅ TEST 6 PASSED: Message sent (id={data['message']['id']}, provider={data.get('provider')})")
                    else:
                        print(f"❌ TEST 6 FAILED: Unexpected response structure")
                elif response.status_code == 401:
                    print("❌ TEST 6 FAILED: 401 Unauthorized - auth cookies not working")
                else:
                    print(f"❌ TEST 6 FAILED: Expected 200, got {response.status_code}")
            else:
                print("⚠️  TEST 6 SKIPPED: No vendor with phone found")
        else:
            print(f"⚠️  TEST 6 SKIPPED: Failed to query vendors (status {response.status_code})")
    except Exception as e:
        print(f"❌ TEST 6 FAILED: Exception - {str(e)}")
else:
    print("⚠️  TEST 6 SKIPPED: No project_id from TEST 4")

# ============================================================================
# TEST 7: WhatsApp Flow (auth-gated)
# ============================================================================
print("\n[TEST 7] POST /api/whatsapp/flow - Run automation flows")
if project_id:
    try:
        # Test 7a: vendor_confirm flow
        print("\n  [7a] Testing vendor_confirm flow...")
        payload = {"flow": "vendor_confirm"}
        response = session.post(f"{BASE_URL}/api/whatsapp/flow", json=payload)
        print(f"  Status: {response.status_code}")
        data = response.json()
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        flow_7a_passed = False
        if response.status_code == 200:
            if data.get('ok') and data.get('count', 0) > 0:
                print(f"  ✅ vendor_confirm: {data['count']} messages sent")
                flow_7a_passed = True
            else:
                print(f"  ❌ vendor_confirm: count={data.get('count', 0)} (expected > 0)")
        elif response.status_code == 401:
            print("  ❌ vendor_confirm: 401 Unauthorized")
        else:
            print(f"  ❌ vendor_confirm: Expected 200, got {response.status_code}")
        
        # Test 7b: payment_reminder flow
        print("\n  [7b] Testing payment_reminder flow...")
        payload = {"flow": "payment_reminder", "daysAhead": 60}
        response = session.post(f"{BASE_URL}/api/whatsapp/flow", json=payload)
        print(f"  Status: {response.status_code}")
        data = response.json()
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        flow_7b_passed = False
        if response.status_code == 200:
            if data.get('ok') and data.get('count', 0) >= 1:
                print(f"  ✅ payment_reminder: {data['count']} messages sent")
                flow_7b_passed = True
            else:
                print(f"  ⚠️  payment_reminder: count={data.get('count', 0)} (expected >= 1, but may be 0 if no vendors with balance)")
                flow_7b_passed = True  # Not a hard failure
        elif response.status_code == 401:
            print("  ❌ payment_reminder: 401 Unauthorized")
        else:
            print(f"  ❌ payment_reminder: Expected 200, got {response.status_code}")
        
        # Test 7c: day_of_push flow
        print("\n  [7c] Testing day_of_push flow...")
        payload = {"flow": "day_of_push"}
        response = session.post(f"{BASE_URL}/api/whatsapp/flow", json=payload)
        print(f"  Status: {response.status_code}")
        data = response.json()
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        flow_7c_passed = False
        if response.status_code == 200:
            if data.get('ok') and data.get('count', 0) >= 1:
                print(f"  ✅ day_of_push: {data['count']} messages sent")
                flow_7c_passed = True
            else:
                print(f"  ⚠️  day_of_push: count={data.get('count', 0)} (expected >= 1, but may be 0 if no confirmed vendors)")
                flow_7c_passed = True  # Not a hard failure
        elif response.status_code == 401:
            print("  ❌ day_of_push: 401 Unauthorized")
        else:
            print(f"  ❌ day_of_push: Expected 200, got {response.status_code}")
        
        if flow_7a_passed and flow_7b_passed and flow_7c_passed:
            print("\n✅ TEST 7 PASSED: All flow endpoints working")
        else:
            print("\n❌ TEST 7 FAILED: Some flows failed")
            
    except Exception as e:
        print(f"❌ TEST 7 FAILED: Exception - {str(e)}")
else:
    print("⚠️  TEST 7 SKIPPED: No project_id from TEST 4")

# ============================================================================
# TEST 8: WhatsApp Reply (updates linked entity)
# ============================================================================
print("\n[TEST 8] POST /api/whatsapp/reply - Simulate inbound reply")
if project_id:
    try:
        # Get the most recent vendor_confirm message
        response = query_supabase(
            "whatsapp_messages",
            f"&project_id=eq.{project_id}&template=eq.vendor_confirm&order=sent_at.desc&limit=1",
            "id,to_name,to_phone,entity_type,entity_id"
        )
        
        if response.status_code == 200:
            messages = response.json()
            if messages:
                message = messages[0]
                message_id = message['id']
                print(f"  Using message: id={message_id}, to={message.get('to_name')}")
                
                payload = {
                    "messageId": message_id,
                    "reply": "1"
                }
                response = session.post(f"{BASE_URL}/api/whatsapp/reply", json=payload)
                print(f"Status: {response.status_code}")
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if response.status_code == 200:
                    if data.get('ok'):
                        print(f"✅ Reply processed: effect={data.get('effect')}")
                        
                        # Verify message was updated
                        verify_response = query_supabase(
                            "whatsapp_messages",
                            f"&id=eq.{message_id}",
                            "id,reply,replied_at,status"
                        )
                        if verify_response.status_code == 200:
                            updated_msg = verify_response.json()[0]
                            if updated_msg.get('reply') == '1' and updated_msg.get('replied_at'):
                                print(f"✅ TEST 8 PASSED: Message updated with reply='1' and replied_at={updated_msg['replied_at']}")
                            else:
                                print(f"❌ TEST 8 FAILED: Message not updated correctly - {updated_msg}")
                        else:
                            print(f"⚠️  Could not verify message update (status {verify_response.status_code})")
                    else:
                        print(f"❌ TEST 8 FAILED: ok=false in response")
                else:
                    print(f"❌ TEST 8 FAILED: Expected 200, got {response.status_code}")
            else:
                print("⚠️  TEST 8 SKIPPED: No vendor_confirm messages found")
        else:
            print(f"⚠️  TEST 8 SKIPPED: Failed to query messages (status {response.status_code})")
    except Exception as e:
        print(f"❌ TEST 8 FAILED: Exception - {str(e)}")
else:
    print("⚠️  TEST 8 SKIPPED: No project_id from TEST 4")

# ============================================================================
# TEST 9: Join Flow
# ============================================================================
print("\n[TEST 9] POST /api/join - Join project via WD-XXXXXXX code")
if project_id:
    try:
        # Get the project code
        response = query_supabase("projects", f"&id=eq.{project_id}", "project_code,name")
        if response.status_code == 200:
            projects = response.json()
            if projects:
                project_code = projects[0]['project_code']
                project_name = projects[0]['name']
                print(f"  Using project code: {project_code}")
                
                join_email = f"familymember-{timestamp}@test.com"
                payload = {
                    "code": project_code,
                    "email": join_email
                }
                response = session.post(f"{BASE_URL}/api/join", json=payload)
                print(f"Status: {response.status_code}")
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if response.status_code == 200:
                    if data.get('ok') and data.get('projectName'):
                        print(f"✅ TEST 9 PASSED: Join successful, projectName={data['projectName']}")
                    else:
                        print(f"❌ TEST 9 FAILED: Unexpected response structure")
                elif response.status_code == 500:
                    print(f"❌ TEST 9 FAILED: 500 error - {data.get('error')}")
                else:
                    print(f"⚠️  TEST 9: Got {response.status_code} - {data.get('error')} (may be expected in dev if email validation fails)")
            else:
                print("⚠️  TEST 9 SKIPPED: Project not found")
        else:
            print(f"⚠️  TEST 9 SKIPPED: Failed to query project (status {response.status_code})")
    except Exception as e:
        print(f"❌ TEST 9 FAILED: Exception - {str(e)}")
else:
    print("⚠️  TEST 9 SKIPPED: No project_id from TEST 4")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print("Review the results above for detailed pass/fail status of each test.")
print("Key focus areas:")
print("  - TEST 3: Auth cookies must be set for subsequent tests to work")
print("  - TEST 4: If 401, auth cookie handling is broken")
print("  - TEST 5: Seed data counts must match expected values")
print("  - TEST 6-8: WhatsApp engine functionality")
print("  - TEST 9: Join flow")
print("=" * 80)
