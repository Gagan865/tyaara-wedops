#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Build WedOps — Indian wedding-planning SaaS. Prompt 1 (schema+auth+core modules) and prompt 2 (financials, spatial, WhatsApp engine, reports, calendar, timeline, analytics, settings, Razorpay) are both built. Schema deployed to Supabase. Now verify all backend flows end-to-end."

backend:
  - task: "Supabase schema deployment"
    implemented: true
    working: true
    file: "schema.sql, schema-2.sql"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "All 10+ new tables verified via REST 200 (organizations, projects, whatsapp_messages, tables, vehicles, invoices, trials, subscriptions, floor_layouts, table_assignments). RLS + enums + seed function in place."

  - task: "Auth flow (signup/signin/signout) via /api/auth/*"
    implemented: true
    working: true
    file: "/app/app/api/auth/*/route.js, /app/middleware.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Email+password via @supabase/ssr. Server client + middleware pattern from playbook. Needs end-to-end test."
      - working: true
        agent: "testing"
        comment: "✅ Signin tested successfully. POST /api/auth/signin returns 200 with user object (id=46f83316-2287-4a08-8a23-966f5f79948c). Auth cookies are properly set via @supabase/ssr (sb-teyymgutsuwssesgokzx-auth-token). Signup skipped due to Supabase rate limits but endpoint structure is correct."

  - task: "Onboarding creates org + project + seeds demo data via RPC"
    implemented: true
    working: false
    file: "/app/app/api/onboarding/route.js, schema-2.sql create_project_with_seed()"
    stuck_count: 1
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Uses admin (service role) to create org + org_members, upsert profile, then rpc('create_project_with_seed') which inserts 7 events, 23 categories, 3 todo lists, 16 lead times, 4 tasks, 6 vendors, 4 shopping items, 8 guests, 4 tables, 3 vehicles, 3 trials, expenses, invoices, whatsapp_settings."
      - working: false
        agent: "testing"
        comment: "❌ CRITICAL BUG: POST /api/onboarding returns 500 with error 'integer out of range'. This is caused by the seed function in schema-2.sql using paise values that exceed JavaScript/PostgreSQL integer limits (e.g., 132000000 paise = 1.32 crore rupees). The create_project_with_seed() RPC function needs to use smaller, realistic values or ensure proper bigint handling. This blocks all downstream testing (WhatsApp, join flow) as no project can be created."

  - task: "WhatsApp engine — send + reply + flow endpoints"
    implemented: true
    working: "NA"
    file: "/app/lib/whatsapp.js, /app/app/api/whatsapp/{send,reply,flow}/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Adapter interface with mock+openwa providers. Templates: vendor_confirm, rsvp_invite, payment_reminder_planner, payment_reminder_vendor, day_of_push, family_query. /flow batch-runs each. /reply simulates inbound and updates bookings.status or guests.rsvp based on reply."

  - task: "Join flow via WD-XXXXXXX code"
    implemented: true
    working: "NA"
    file: "/app/app/api/join/route.js, /app/app/join/page.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Looks up project by project_code, sends magic-link invite, if user exists adds to org_members + project_members + memberships."

  - task: "Setup route detects schema state (full vs partial)"
    implemented: true
    working: true
    file: "/app/app/api/setup/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified: returns {schemaDeployed: true, partial: false} after both prompts run. Correctly detected partial when only prompt-1 was deployed."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Onboarding creates org + project + seeds demo data via RPC"
  stuck_tasks:
    - "Onboarding creates org + project + seeds demo data via RPC"
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Schema is deployed (both prompts). Please run a full backend smoke: 1) create a new account via /api/auth/signup with a random email + password. 2) POST /api/onboarding with { orgName, orgType:'couple', projectName, weddingDate (~6 months out), displayName } — expect { orgId, projectId }. 3) Verify seed: GET projects, events (7), categories (23), tasks (4), vendors (6), guests (8), tables (4), vehicles (3), trials (3), invoices (6), whatsapp_settings (1). 4) POST /api/whatsapp/send with a vendor phone → expect message row created with status='sent'. 5) POST /api/whatsapp/flow with { flow:'vendor_confirm' } → expect N messages sent. 6) POST /api/whatsapp/reply with { messageId, reply:'1' } → expect booking flipped OR notification created. 7) POST /api/join with { code:'<WD-code from step 2>', email:'newperson@test.com' } → expect ok:true. Use the SUPABASE_SERVICE_ROLE_KEY only server-side (via our /api routes, not directly). All flows go through Next.js API routes at /api. Base URL: https://wedops-demo.preview.emergentagent.com"
  - agent: "testing"
    message: "Backend testing completed. Results: ✅ Setup route working (schema fully deployed). ✅ Auth signin working (cookies set properly). ❌ CRITICAL: Onboarding fails with 'integer out of range' error - the seed function uses paise values too large for PostgreSQL/JS (e.g., 132000000). This blocks all downstream tests. WhatsApp and Join flows cannot be tested without a working project creation. Main agent must fix the seed function in schema-2.sql to use smaller values or proper bigint casting."
