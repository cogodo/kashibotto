#!/bin/bash
# Kashibotto Vercel Deployment Script
# This script deploys the monorepo to Vercel
set -e

echo "🚀 Starting Kashibotto deployment to Vercel..."

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

echo "📦 Building project..."
npm run build

echo "🌐 Deploying to Vercel..."
vercel --prod --yes

echo "✅ Deployment completed!"
echo ""
echo "🎉 Kashibotto is now live on Vercel!"
echo "Check Vercel dashboard for your deployment URL." 