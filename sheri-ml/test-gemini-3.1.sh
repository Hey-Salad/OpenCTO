#!/bin/bash
# Test Gemini 3.1 models (Pro and Flash)

set -e

API_KEY="[REDACTED_GOOGLE_API_KEY]"
export GEMINI_API_KEY="$API_KEY"

echo "=========================================="
echo "Testing Gemini 3.1 Models"
echo "=========================================="
echo ""

# Test Gemini 3.1 Pro
echo "1. Testing Gemini 3.1 Pro..."
echo "   (Better reasoning, slower, higher quality)"
echo ""

curl -s "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.1-pro:streamGenerateContent?key=${API_KEY}" \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Write a Rust function to calculate fibonacci numbers"
        }
      ]
    }
  ]
}' 2>&1 | grep -E "(text|error|modelVersion)" | head -20

echo ""
echo "✅ Gemini 3.1 Pro test complete"
echo ""
echo "---"
echo ""

# Test Gemini 3.1 Flash
echo "2. Testing Gemini 3.1 Flash..."
echo "   (Faster, good balance)"
echo ""

curl -s "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.1-flash:streamGenerateContent?key=${API_KEY}" \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Explain async/await in 2 sentences"
        }
      ]
    }
  ]
}' 2>&1 | grep -E "(text|error|modelVersion)" | head -20

echo ""
echo "✅ Gemini 3.1 Flash test complete"
echo ""

echo "=========================================="
echo "Summary: Gemini 3.1 Models"
echo "=========================================="
echo ""
echo "✅ gemini-3.1-pro     - Best reasoning & code"
echo "✅ gemini-3.1-flash   - Fast & balanced"
echo ""
echo "Default configured: gemini-3.1-pro"
echo "Config location: ~/.codex/config.toml"
echo ""
echo "Once build completes, use:"
echo "  ./target/release/codex 'your task here'"
echo ""
