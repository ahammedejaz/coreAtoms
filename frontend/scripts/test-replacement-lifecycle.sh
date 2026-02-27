#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# test-replacement-lifecycle.sh
#
# Tests the full replacement lifecycle via CLI (Supabase REST API + 
# Delhivery edge function). Covers both paths:
#   Path A (severe damage):  pending → approved → replacement_shipped
#   Path B (minor damage):   pending → approved → pickup_scheduled
#                             → pickup_received → replacement_shipped
#
# Usage:
#   chmod +x scripts/test-replacement-lifecycle.sh
#   ./scripts/test-replacement-lifecycle.sh
#
# Requirements: curl, jq
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${CYAN}━━━ ${BOLD}$1${NC}"; }
ok()   { echo -e "  ${GREEN}✔ $1${NC}"; }
fail() { echo -e "  ${RED}✘ $1${NC}"; exit 1; }
info() { echo -e "  ${YELLOW}→ $1${NC}"; }

# ── Configuration — UPDATE THESE ──
# You can also export them as environment variables before running.
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo -e "${RED}${BOLD}Missing required env vars. Set before running:${NC}"
    echo ""
    echo "  export SUPABASE_URL=\"https://your-project.supabase.co\""
    echo "  export SUPABASE_ANON_KEY=\"your-anon-key\""
    echo "  export SUPABASE_SERVICE_ROLE_KEY=\"your-service-role-key\""
    echo ""
    exit 1
fi

REST="$SUPABASE_URL/rest/v1"
FUNC="$SUPABASE_URL/functions/v1"

# Headers for service-role access (bypasses RLS)
AUTH_HDR="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
KEY_HDR="apikey: $SUPABASE_SERVICE_ROLE_KEY"
CT="Content-Type: application/json"
PREFER="Prefer: return=representation"

# ═══════════════════════════════════════════════════════════════════════
# STEP 0: Pick a delivered order to test with
# ═══════════════════════════════════════════════════════════════════════
step "STEP 0 — Finding a delivered order to use for testing"

ORDER_JSON=$(curl -s "$REST/orders?status=eq.delivered&limit=1&select=id,user_id,status,total_amount_inr,shipping_address,payment_method" \
    -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT")

ORDER_ID=$(echo "$ORDER_JSON" | jq -r '.[0].id // empty')
USER_ID=$(echo "$ORDER_JSON" | jq -r '.[0].user_id // empty')

if [[ -z "$ORDER_ID" ]]; then
    info "No delivered orders found. Trying 'shipped' orders instead..."
    ORDER_JSON=$(curl -s "$REST/orders?status=eq.shipped&limit=1&select=id,user_id,status,total_amount_inr,shipping_address,payment_method" \
        -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT")
    ORDER_ID=$(echo "$ORDER_JSON" | jq -r '.[0].id // empty')
    USER_ID=$(echo "$ORDER_JSON" | jq -r '.[0].user_id // empty')
fi

if [[ -z "$ORDER_ID" ]]; then
    fail "No suitable order found (delivered/shipped). Create one first."
fi

ok "Found order: $ORDER_ID"
ok "User ID:     $USER_ID"
echo "$ORDER_JSON" | jq '.[0]'

# ═══════════════════════════════════════════════════════════════════════
# STEP 1: Create a replacement request (simulate customer action)
# ═══════════════════════════════════════════════════════════════════════
step "STEP 1 — Creating replacement request (pending)"

REPLACEMENT_JSON=$(curl -s "$REST/replacements" \
    -X POST \
    -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT" -H "$PREFER" \
    -d "{
        \"order_id\": \"$ORDER_ID\",
        \"user_id\": \"$USER_ID\",
        \"reason\": \"Damaged in transit\",
        \"description\": \"CLI test - product arrived with severe damage to packaging and product\",
        \"images\": [],
        \"status\": \"pending\"
    }")

REPLACEMENT_ID=$(echo "$REPLACEMENT_JSON" | jq -r '.[0].id // .id // empty')
REPLACEMENT_STATUS=$(echo "$REPLACEMENT_JSON" | jq -r '.[0].status // .status // empty')

if [[ -z "$REPLACEMENT_ID" ]]; then
    echo "$REPLACEMENT_JSON" | jq .
    fail "Failed to create replacement request"
fi

ok "Replacement created: $REPLACEMENT_ID"
ok "Status: $REPLACEMENT_STATUS"

# ═══════════════════════════════════════════════════════════════════════
# STEP 2: Approve the replacement (simulate admin action)
# ═══════════════════════════════════════════════════════════════════════
step "STEP 2 — Approving replacement (pending → approved)"

APPROVE_JSON=$(curl -s "$REST/replacements?id=eq.$REPLACEMENT_ID" \
    -X PATCH \
    -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT" -H "$PREFER" \
    -d '{
        "status": "approved",
        "admin_notes": "CLI test - approved for replacement",
        "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }')

APPROVED_STATUS=$(echo "$APPROVE_JSON" | jq -r '.[0].status // empty')

if [[ "$APPROVED_STATUS" != "approved" ]]; then
    echo "$APPROVE_JSON" | jq .
    fail "Expected status=approved, got: $APPROVED_STATUS"
fi

ok "Status updated: approved"

# ═══════════════════════════════════════════════════════════════════════
# Choose test path
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}Which replacement path do you want to test?${NC}"
echo "  A) Ship directly (severe damage — skip reverse pickup)"
echo "  B) Reverse pickup first (minor damage — pickup → receive → ship)"
echo ""
read -rp "Enter A or B: " PATH_CHOICE

if [[ "${PATH_CHOICE^^}" == "B" ]]; then
    # ═══════════════════════════════════════════════════════════════════
    # PATH B: Reverse Pickup Flow
    # ═══════════════════════════════════════════════════════════════════

    # STEP 3B: Schedule Reverse Pickup
    step "STEP 3B — Scheduling reverse pickup (approved → pickup_scheduled)"

    PICKUP_JSON=$(curl -s "$REST/replacements?id=eq.$REPLACEMENT_ID" \
        -X PATCH \
        -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT" -H "$PREFER" \
        -d '{
            "status": "pickup_scheduled",
            "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
        }')

    PICKUP_STATUS=$(echo "$PICKUP_JSON" | jq -r '.[0].status // empty')
    if [[ "$PICKUP_STATUS" != "pickup_scheduled" ]]; then
        echo "$PICKUP_JSON" | jq .
        fail "Expected pickup_scheduled, got: $PICKUP_STATUS"
    fi
    ok "Status: pickup_scheduled"

    # STEP 4B: Mark Pickup Received
    step "STEP 4B — Marking pickup received (pickup_scheduled → pickup_received)"

    RECEIVED_JSON=$(curl -s "$REST/replacements?id=eq.$REPLACEMENT_ID" \
        -X PATCH \
        -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT" -H "$PREFER" \
        -d '{
            "status": "pickup_received",
            "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
        }')

    RECEIVED_STATUS=$(echo "$RECEIVED_JSON" | jq -r '.[0].status // empty')
    if [[ "$RECEIVED_STATUS" != "pickup_received" ]]; then
        echo "$RECEIVED_JSON" | jq .
        fail "Expected pickup_received, got: $RECEIVED_STATUS"
    fi
    ok "Status: pickup_received"

    # STEP 5B: Ship Replacement
    step "STEP 5B — Shipping replacement via Delhivery Edge Function"
else
    # ═══════════════════════════════════════════════════════════════════
    # PATH A: Ship Directly
    # ═══════════════════════════════════════════════════════════════════
    step "STEP 3A — Shipping replacement directly via Delhivery Edge Function"
fi

# ═══════════════════════════════════════════════════════════════════════
# SHIP REPLACEMENT (common for both paths)
# ═══════════════════════════════════════════════════════════════════════

# Extract shipping address from the order
SHIP_ADDR=$(echo "$ORDER_JSON" | jq '.[0].shipping_address')
SHIP_NAME=$(echo "$SHIP_ADDR" | jq -r '.fullName // .name // "Test Customer"')
SHIP_PHONE=$(echo "$SHIP_ADDR" | jq -r '.phone // .mobile // "9999999999"')
SHIP_LINE1=$(echo "$SHIP_ADDR" | jq -r '.line1 // .address1 // "Test Address Line 1"')
SHIP_LINE2=$(echo "$SHIP_ADDR" | jq -r '.line2 // .address2 // ""')
SHIP_CITY=$(echo "$SHIP_ADDR" | jq -r '.city // "Mumbai"')
SHIP_STATE=$(echo "$SHIP_ADDR" | jq -r '.state // "Maharashtra"')
SHIP_PIN=$(echo "$SHIP_ADDR" | jq -r '.pincode // .zip // "400001"')
SHIP_COUNTRY=$(echo "$SHIP_ADDR" | jq -r '.country // "India"')
TOTAL=$(echo "$ORDER_JSON" | jq -r '.[0].total_amount_inr // 0')

FULL_ADDRESS="$SHIP_LINE1"
[[ -n "$SHIP_LINE2" && "$SHIP_LINE2" != "null" ]] && FULL_ADDRESS="$FULL_ADDRESS, $SHIP_LINE2"

info "Calling delhivery-create-shipment edge function..."
info "Shipping to: $SHIP_NAME, $SHIP_CITY $SHIP_PIN"

SHIP_RESPONSE=$(curl -s "$FUNC/delhivery-create-shipment" \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "$CT" \
    -d "{
        \"order_id\": \"$ORDER_ID\",
        \"shipping_address\": {
            \"name\": \"$SHIP_NAME\",
            \"phone\": \"$SHIP_PHONE\",
            \"address\": \"$FULL_ADDRESS\",
            \"city\": \"$SHIP_CITY\",
            \"state\": \"$SHIP_STATE\",
            \"pin\": \"$SHIP_PIN\",
            \"country\": \"$SHIP_COUNTRY\"
        },
        \"items\": [{\"name\": \"Replacement Product\", \"qty\": 1, \"price\": $TOTAL}],
        \"total_amount\": $TOTAL,
        \"payment_method\": \"prepaid\",
        \"weight\": 500
    }")

echo ""
echo "$SHIP_RESPONSE" | jq .

WAYBILL=$(echo "$SHIP_RESPONSE" | jq -r '.waybill // empty')
TRACKING_URL=$(echo "$SHIP_RESPONSE" | jq -r '.tracking_url // empty')
SHIP_SUCCESS=$(echo "$SHIP_RESPONSE" | jq -r '.success // empty')

if [[ "$SHIP_SUCCESS" != "true" || -z "$WAYBILL" ]]; then
    SHIP_ERROR=$(echo "$SHIP_RESPONSE" | jq -r '.error // "Unknown error"')
    fail "Delhivery shipment failed: $SHIP_ERROR"
fi

ok "Delhivery shipment created!"
ok "Waybill:      $WAYBILL"
ok "Tracking URL: $TRACKING_URL"

# ═══════════════════════════════════════════════════════════════════════
# Update replacement record with tracking info
# ═══════════════════════════════════════════════════════════════════════
step "Updating replacement record → replacement_shipped"

UPDATE_JSON=$(curl -s "$REST/replacements?id=eq.$REPLACEMENT_ID" \
    -X PATCH \
    -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT" -H "$PREFER" \
    -d "{
        \"status\": \"replacement_shipped\",
        \"replacement_waybill\": \"$WAYBILL\",
        \"replacement_tracking_url\": \"$TRACKING_URL\",
        \"updated_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
    }")

FINAL_STATUS=$(echo "$UPDATE_JSON" | jq -r '.[0].status // empty')
FINAL_WAYBILL=$(echo "$UPDATE_JSON" | jq -r '.[0].replacement_waybill // empty')

if [[ "$FINAL_STATUS" != "replacement_shipped" ]]; then
    echo "$UPDATE_JSON" | jq .
    fail "Expected replacement_shipped, got: $FINAL_STATUS"
fi

ok "Final status: replacement_shipped"
ok "Waybill saved: $FINAL_WAYBILL"

# ═══════════════════════════════════════════════════════════════════════
# STEP FINAL: Verify the full record
# ═══════════════════════════════════════════════════════════════════════
step "FINAL — Verifying replacement record"

VERIFY_JSON=$(curl -s "$REST/replacements?id=eq.$REPLACEMENT_ID&select=*" \
    -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT")

echo ""
echo "$VERIFY_JSON" | jq '.[0]'

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✔ Replacement lifecycle test complete!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Replacement ID:    ${BOLD}$REPLACEMENT_ID${NC}"
echo -e "  Order ID:          ${BOLD}$ORDER_ID${NC}"
echo -e "  Waybill:           ${BOLD}$WAYBILL${NC}"
echo -e "  Tracking:          ${BOLD}$TRACKING_URL${NC}"
echo -e "  Final Status:      ${GREEN}${BOLD}replacement_shipped${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════
# Optional: Cleanup
# ═══════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}Want to clean up the test replacement? (removes the record)${NC}"
read -rp "Delete test replacement? (y/N): " CLEANUP

if [[ "${CLEANUP^^}" == "Y" ]]; then
    curl -s "$REST/replacements?id=eq.$REPLACEMENT_ID" \
        -X DELETE \
        -H "$AUTH_HDR" -H "$KEY_HDR" -H "$CT"
    ok "Test replacement deleted."
else
    info "Replacement kept. You can view it in the Admin Dashboard."
fi
