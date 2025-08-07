# Kashibotto - Japanese Lyrics Segmentation & Translation

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19+-blue?style=for-the-badge&logo=react)](https://reactjs.org)

A web application that segments Japanese song lyrics into individual morphemes/phrases and displays them with hover tooltips showing kana readings, English translations, and dictionary definitions.

## 🌟 Features

- **Lyrics Fetching**: Search and retrieve Japanese song lyrics
- **Morphological Analysis**: Segment lyrics using MeCab
- **Translation**: Translate segments to English using DeepL
- **Interactive UI**: Hover tooltips with readings and translations
- **Real-time Search**: Live search for songs
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Optional: API keys for enhanced functionality (DeepL, Genius)

### Installation

```bash
# Install all dependencies
npm run install:all

# Start backend
cd backend && npm run dev

# Start frontend (new terminal)
cd frontend && npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## 🏗️ Architecture

```
Frontend (React + Vite) ←→ Backend (Node.js + Express)
                              ↓
                    MeCab (Morphological Analysis)
                              ↓
                    DeepL (Translation)
```

## 🔧 Configuration

### Environment Variables

Create `.env` files in both `frontend/` and `backend/` directories:

**Backend** (optional for enhanced functionality):
```env
DEEPL_API_KEY=your_deepl_api_key
GENIUS_ACCESS_TOKEN=your_genius_access_token
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**Frontend**:
```env
VITE_API_BASE_URL=http://localhost:3001
```

## 📁 Project Structure

```
kashibotto/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   └── docs/                # Build output for GitHub Pages
├── backend/                  # Node.js + Express backend
│   ├── src/
│   └── dist/                # Build output
├── package.json             # Root package.json
└── README.md                # This file
```

## 🎯 API Endpoints

- `GET /api/search?q={query}` - Search for songs
- `GET /api/lyrics?song={title}` - Fetch lyrics
- `POST /api/process` - Process lyrics with segmentation
- `GET /` - Health check

## 🚨 Troubleshooting

### Build Issues
```bash
# Check Node.js version (18+)
node --version

# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Development Issues
```bash
# Check if ports are available
lsof -i :3001  # Backend port
lsof -i :5173  # Frontend port

# Kill processes if needed
kill -9 <PID>
```

### API Issues
```bash
# Test backend health
curl http://localhost:3001/

# Test API endpoints
curl "http://localhost:3001/api/search?q=君の名は"
```

## 🎉 Development

### Available Scripts

```bash
# Root level
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start only frontend
npm run dev:backend      # Start only backend
npm run build            # Build both projects
npm run install:all      # Install all dependencies

# Frontend
cd frontend
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Backend
cd backend
npm run dev              # Start with nodemon
npm run build            # Build TypeScript
npm start                # Start production server
```

### Development Workflow

1. **Start Development**:
   ```bash
   npm run dev
   ```

2. **Make Changes**: Edit files in `frontend/src/` or `backend/src/`

3. **Hot Reload**: Changes automatically reload in the browser

4. **Build for Production**:
   ```bash
   npm run build
   ```

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Fetch API
- **Build Tool**: Vite

### Backend
- **Framework**: Node.js with Express.js
- **Language**: TypeScript
- **Morphology**: MeCab
- **Translation**: DeepL API
- **Security**: Helmet, CORS, Rate Limiting

## 🎯 Local Development Tips

- **Backend First**: Always start the backend before the frontend
- **API Testing**: Use curl or Postman to test API endpoints
- **Environment Variables**: Copy `backend/env.example` to `backend/.env`
- **Hot Reload**: Both frontend and backend support hot reloading
- **Logs**: Check terminal output for debugging information

## 🚀 Deployment

This application is configured for deployment to:
- **Backend**: Render (Node.js service)
- **Frontend**: GitHub Pages

See `DEPLOYMENT.md` for detailed deployment instructions.

### Quick Deployment Commands

```bash
# Build frontend for GitHub Pages
cd frontend && npm run build

# Deploy to GitHub Pages
cd frontend && npm run deploy
```

Happy coding! 🚀

## Dictionary Storage Configuration

The dictionary cache can be configured to use different storage backends based on your deployment environment:

### Environment Variables

- `DICTIONARY_STORAGE`: Controls how the dictionary cache is stored
  - `file` (default for development): Uses local file system storage
  - `memory` (default for production): Uses in-memory storage (cache lost on restart)
  - `auto`: Automatically chooses based on NODE_ENV

### Deployment Considerations

**For Local Development:**
- Uses file system storage by default
- Cache persists between restarts
- Cache file stored in `backend/data/dictionary-cache.json`

**For Production (Render, Heroku, etc.):**
- Uses memory-only storage by default
- Cache is lost on each restart/redeploy
- Faster startup, no file system dependencies
- Consider using a database for persistent storage in production

### Adding Persistent Storage

For production deployments where you want persistent cache storage, you can:

1. **Use a database**: Implement a new `DatabaseStorage` class that implements the `StorageBackend` interface
2. **Use Redis**: Add Redis integration for fast, persistent caching
3. **Use cloud storage**: Implement storage using services like AWS S3 or Google Cloud Storage

Example database implementation:
```typescript
class DatabaseStorage implements StorageBackend {
    async load(): Promise<DictionaryCache> {
        // Load from database
    }
    
    async save(cache: DictionaryCache): Promise<void> {
        // Save to database
    }
}
```