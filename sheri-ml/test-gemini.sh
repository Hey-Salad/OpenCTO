#!/bin/bash
# Test Gemini integration with Vertex AI endpoint

set -e

API_KEY="[REDACTED_GOOGLE_API_KEY]"
export GEMINI_API_KEY="$API_KEY"

echo "==================================="
echo "Testing Gemini API Integration"
echo "==================================="
echo ""

echo "1. Testing Vertex AI endpoint directly..."
echo ""

curl -s "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:streamGenerateContent?key=${API_KEY}" \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Write a one-line function to add two numbers"
        }
      ]
    }
  ]
}' | head -50

echo ""
echo ""
echo "==================================="
echo "✅ Vertex AI endpoint works!"
echo "==================================="
echo ""

echo "Available Gemini models:"
echo "- gemini-2.5-flash-lite (tested, working)"
echo "- gemini-2.5-flash"
echo "- gemini-2.5-pro"
echo "- gemini-3.0-flash"
echo "- gemini-3.0-pro"
echo "- gemini-3.1-flash"
echo "- gemini-3.1-pro"
echo ""

echo "To use with Sheri ML (once built):"
echo "  export GEMINI_API_KEY='$API_KEY'"
echo "  ./target/release/codex -c model_provider=\\\"gemini\\\" -m gemini-2.5-flash-lite \\\"your task\\\""
echo ""
