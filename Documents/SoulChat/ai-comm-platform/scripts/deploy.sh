#!/bin/bash
set -e

echo "=== AI Communication Platform — Deploy ==="
echo ""

# Detect platform
if command -v railway &> /dev/null; then
  PLATFORM="railway"
elif command -v fly &> /dev/null; then
  PLATFORM="fly"
else
  echo "Error: No deployment CLI found."
  echo "Install one of:"
  echo "  Railway: npm i -g @railway/cli"
  echo "  Fly.io:  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

echo "Platform: $PLATFORM"
echo ""

# Step 1: Run tests
echo "Step 1/4: Running tests..."
npm run test:run
echo ""

# Step 2: Build
echo "Step 2/4: Building TypeScript..."
npm run build
echo ""

# Step 3: Deploy backend
echo "Step 3/4: Deploying backend to $PLATFORM..."
if [ "$PLATFORM" = "railway" ]; then
  railway up --detach
elif [ "$PLATFORM" = "fly" ]; then
  fly deploy
fi
echo ""

# Step 4: Deploy frontend (if Vercel CLI is available)
echo "Step 4/4: Deploying dashboard..."
if command -v vercel &> /dev/null; then
  cd dashboard
  vercel --prod
  cd ..
else
  echo "  Vercel CLI not found. Deploy dashboard manually:"
  echo "  cd dashboard && npx vercel --prod"
fi

echo ""
echo "=== Deploy complete ==="
echo "Backend: Check $PLATFORM dashboard for URL"
echo "Health:  curl <backend-url>/health"
