# Production Deployment Guide

This guide will help you deploy your browser extension backend to production.

## 🚀 Quick Start

### 1. Environment Setup

Copy the example environment file and configure it:

```bash
cp env.example .env
```

### 2. Required Environment Variables

#### Authentication
```bash
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
SESSION_SECRET=your_session_secret_here
```

#### Database (Firestore)
```bash
GOOGLE_CLOUD_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

#### Frontend/Extension Connection
```bash
ALLOWED_ORIGINS=https://your-extension-id.chromiumapp.org,http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

#### Server Configuration
```bash
PORT=3000
NODE_ENV=production
```

## 🔧 Platform-Specific Setup

### Render.com

1. **Create a new Web Service**
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `node server.js`

2. **Environment Variables**
   Add these in your Render dashboard:
   ```
   JWT_SECRET=your_super_secret_jwt_key_here
   GOOGLE_CLOUD_PROJECT_ID=your-firebase-project-id
   ALLOWED_ORIGINS=https://your-extension-id.chromiumapp.org
   NODE_ENV=production
   PORT=10000
   ```

3. **Firebase Service Account**
   - Download your Firebase service account key
   - In Render, go to Environment → Files
   - Upload the JSON file as `service-account-key.json`
   - Set `GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json`

### Heroku

1. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

2. **Set Environment Variables**
   ```bash
   heroku config:set JWT_SECRET=your_super_secret_jwt_key_here
   heroku config:set GOOGLE_CLOUD_PROJECT_ID=your-firebase-project-id
   heroku config:set ALLOWED_ORIGINS=https://your-extension-id.chromiumapp.org
   heroku config:set NODE_ENV=production
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Railway

1. **Connect Repository**
   - Connect your GitHub repo to Railway
   - Railway will auto-detect Node.js

2. **Environment Variables**
   Add in Railway dashboard:
   ```
   JWT_SECRET=your_super_secret_jwt_key_here
   GOOGLE_CLOUD_PROJECT_ID=your-firebase-project-id
   ALLOWED_ORIGINS=https://your-extension-id.chromiumapp.org
   NODE_ENV=production
   ```

### DigitalOcean App Platform

1. **Create App**
   - Connect your GitHub repository
   - Select Node.js environment

2. **Environment Variables**
   Add in App Platform dashboard:
   ```
   JWT_SECRET=your_super_secret_jwt_key_here
   GOOGLE_CLOUD_PROJECT_ID=your-firebase-project-id
   ALLOWED_ORIGINS=https://your-extension-id.chromiumapp.org
   NODE_ENV=production
   ```

## 🔐 Security Checklist

### 1. JWT Secret
- ✅ Use a strong, random secret (at least 32 characters)
- ✅ Never commit secrets to version control
- ✅ Use different secrets for development and production

### 2. CORS Configuration
- ✅ Set `ALLOWED_ORIGINS` to your extension's origin
- ✅ Remove wildcard origins in production
- ✅ Test CORS with your actual extension

### 3. Firebase Security
- ✅ Set up proper Firestore security rules
- ✅ Use service account with minimal permissions
- ✅ Enable Firebase App Check (recommended)

### 4. Environment Variables
- ✅ All secrets are in environment variables
- ✅ No hardcoded credentials
- ✅ Use `.env` for local development only

## 🧪 Testing Production

### 1. Health Check
```bash
curl https://your-app-url.com/health
```

### 2. CORS Test
```bash
curl -H "Origin: https://your-extension-id.chromiumapp.org" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://your-app-url.com/api/comments
```

### 3. Extension Integration
1. Update your extension's `API_BASE_URL` to your production URL
2. Test all functionality (login, comments, voting, etc.)
3. Check browser console for CORS errors

## 📊 Monitoring

### 1. Logs
- Monitor application logs for errors
- Set up log aggregation (e.g., Sentry, LogRocket)

### 2. Performance
- Monitor response times
- Set up alerts for high error rates
- Track API usage

### 3. Security
- Monitor for suspicious activity
- Set up rate limiting
- Enable Firebase App Check

## 🔄 Updates

### 1. Code Updates
```bash
# For Render/Railway/DigitalOcean
git push origin main

# For Heroku
git push heroku main
```

### 2. Environment Variable Updates
- Update in your platform's dashboard
- Restart the application

### 3. Database Migrations
- Firestore schema changes are automatic
- Test migrations in development first

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `ALLOWED_ORIGINS` includes your extension's origin
   - Verify the extension's manifest.json has correct permissions

2. **Firebase Connection Issues**
   - Verify `GOOGLE_CLOUD_PROJECT_ID` is correct
   - Check service account credentials
   - Ensure Firestore is enabled in your Firebase project

3. **JWT Errors**
   - Verify `JWT_SECRET` is set correctly
   - Check token expiration settings

4. **Port Issues**
   - Most platforms use `PORT` environment variable
   - Don't hardcode port numbers

### Debug Mode
For debugging, temporarily set:
```bash
NODE_ENV=development
```

This will enable more verbose logging and relaxed CORS.

## 📝 Example Production .env

```bash
# Authentication
JWT_SECRET=my_super_secret_key_here_make_it_very_long_and_random_123456789
SESSION_SECRET=another_secret_for_sessions_987654321

# Database
GOOGLE_CLOUD_PROJECT_ID=my-awesome-project-123456
GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json

# Frontend
ALLOWED_ORIGINS=https://abcdefghijklmnop.chromiumapp.org,https://my-extension.com
CORS_ORIGIN=https://my-extension.com

# Server
PORT=10000
NODE_ENV=production

# Optional: Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret-here
```

## 🎉 Success!

Once deployed, your extension will have:
- ✅ Secure authentication with JWT
- ✅ Scalable database with Firestore
- ✅ Real-time updates with Socket.IO
- ✅ Production-ready CORS configuration
- ✅ Environment-based configuration
- ✅ Proper security measures

Your browser extension is now production-ready! 🚀
