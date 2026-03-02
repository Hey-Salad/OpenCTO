#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://opencto-api-worker.heysalad-o.workers.dev}"
WEBHOOK_PATH="/api/v1/billing/webhooks/stripe"

cmd="${1:-help}"

case "$cmd" in
  login)
    stripe login
    ;;
  listen)
    stripe listen --forward-to "${BASE_URL}${WEBHOOK_PATH}"
    ;;
  trigger-checkout)
    stripe trigger checkout.session.completed
    ;;
  trigger-subscription)
    stripe trigger customer.subscription.updated
    ;;
  trigger-invoice)
    stripe trigger invoice.paid
    ;;
  checkout)
    curl -sS -X POST \
      -H 'Authorization: Bearer demo-token' \
      -H 'Content-Type: application/json' \
      "${BASE_URL}/api/v1/billing/checkout/session" \
      -d '{"planCode":"TEAM","interval":"MONTHLY"}'
    echo
    ;;
  subscription)
    curl -sS \
      -H 'Authorization: Bearer demo-token' \
      "${BASE_URL}/api/v1/billing/subscription"
    echo
    ;;
  *)
    cat <<'EOF'
Usage:
  ./scripts/stripe-dev.sh login
  ./scripts/stripe-dev.sh listen
  ./scripts/stripe-dev.sh trigger-checkout
  ./scripts/stripe-dev.sh trigger-subscription
  ./scripts/stripe-dev.sh trigger-invoice
  ./scripts/stripe-dev.sh checkout
  ./scripts/stripe-dev.sh subscription

Optional env:
  BASE_URL=https://opencto-api-worker.heysalad-o.workers.dev
EOF
    ;;
esac
