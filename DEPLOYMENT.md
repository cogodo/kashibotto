# 🚀 Deployment Guide

This guide will help you deploy Kashibotto to Render (backend) and GitHub Pages (frontend).

## 📋 Prerequisites

- GitHub repository at `cogodo/kashibotto`
- Render account at [render.com](https://render.com)
- Node.js 18+ installed locally

## 🎯 Backend Deployment (Render)

### Step 1: Prepare Backend for Render

1. **Create a Render account** at [render.com](https://render.com)
2. **Connect your GitHub repository** to Render
3. **Create a new Web Service**:
   - **Name**: `kashibotto-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 2: Configure Environment Variables

In your Render dashboard, add these environment variables:

```env
NODE_ENV=production
CORS_ORIGIN=https://cogodo.github.io
PORT=10000
GENIUS_ACCESS_TOKEN=your_genius_access_token_here
```

### Step 3: Deploy Backend

1. **Push your code** to GitHub
2. **Render will automatically deploy** your backend
3. **Note your Render URL** (e.g., `https://kashibotto-backend.onrender.com`)

## 🎯 Frontend Deployment (GitHub Pages)

### Step 1: Configure GitHub Pages

1. **Go to your repository settings** on GitHub
2. **Navigate to Pages** in the left sidebar
3. **Configure Pages**:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (or your default branch)
   - **Folder**: `/docs`

### Step 2: Update API URL

1. **Get your Render URL** from the backend deployment
2. **Update the API URL** in `frontend/src/utils/api.ts`:
   ```typescript
   const API_BASE_URL = import.meta.env.PROD 
     ? 'https://your-actual-render-url.onrender.com' // Replace with your actual URL
     : '';
   ```

### Step 3: Build and Deploy Frontend

1. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Commit and push the docs folder**:
   ```bash
   git add docs
   git commit -m "Deploy to GitHub Pages"
   git push
   ```

3. **Verify deployment** at `https://cogodo.github.io/kashibotto`

## 🔧 Configuration Files

### Frontend Configuration (`frontend/vite.config.ts`)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/kashibotto/', // Base path for GitHub Pages
  build: {
    outDir: 'docs', // Build to docs folder for GitHub Pages
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

### Backend Configuration (`backend/src/config/index.ts`)

The backend now supports multiple CORS origins and will automatically parse comma-separated values.

### Render Configuration (`render.yaml`)

```yaml
services:
  - type: web
    name: kashibotto-backend
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    rootDir: backend
    envVars:
      - key: NODE_ENV
        value: production
      - key: CORS_ORIGIN
        value: https://cogodo.github.io
      - key: PORT
        value: 10000
```

## 🧪 Testing Your Deployment

### Test Backend

```bash
# Test health check
curl https://your-render-url.onrender.com/

# Test API endpoints
curl "https://your-render-url.onrender.com/api/search?q=君の名は"
```

### Test Frontend

1. **Visit** `https://cogodo.github.io/kashibotto`
2. **Test search functionality**
3. **Test lyrics processing**
4. **Verify all features work**

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `CORS_ORIGIN` is set correctly in Render
2. **Build Failures**: Check that all dependencies are in `package.json`
3. **404 Errors**: Verify the base path is set correctly in Vite config
4. **API Errors**: Check that the Render URL is correct in the frontend

### Debugging Steps

1. **Check Render logs** in the dashboard
2. **Check GitHub Pages logs** in repository settings
3. **Test API endpoints** directly with curl
4. **Verify environment variables** are set correctly

## 🎉 Success!

Once deployed, your application will be available at:
- **Frontend**: `https://cogodo.github.io/kashibotto`
- **Backend**: `https://your-render-url.onrender.com`

Happy coding! 🚀
