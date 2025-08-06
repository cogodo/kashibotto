#!/bin/bash
# Kashibotto Vercel Info Helper Script
# This script helps you get the necessary Vercel information for deployment
echo "🔍 Kashibotto Vercel Info Helper"
echo "=================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please log in to Vercel..."
    vercel login
fi

echo ""
echo "📋 Getting Vercel Information..."
echo ""

# Get user info
echo "👤 User Information:"
vercel whoami
echo ""

# Get organization info
echo "🏢 Organization Information:"
vercel org ls
echo ""

# Get project list
echo "📦 Project Information:"
vercel ls
echo ""

echo "🔑 Next Steps:"
echo "1. Go to https://vercel.com/account/tokens"
echo "2. Create a new token with full scope"
echo "3. Copy the token"
echo ""
echo "📝 For deployment, run:"
echo "   ./deploy.sh"
echo ""
echo "🎯 If you haven't deployed yet, run:"
echo "   vercel --prod"
echo "   Then run this script again to get the project ID." 