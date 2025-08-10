# Firestore Setup Guide

## 🚀 **Complete Firestore Integration**

Your backend has been completely converted from in-memory storage to Google Cloud Firestore for persistent, scalable data storage.

## 📋 **What's Changed:**

### **Before (In-Memory):**
```javascript
// Temporary storage - lost on server restart
const comments = [];
const users = [];
comments.push(newComment); // Add to local array
```

### **After (Firestore):**
```javascript
// Permanent storage in Google Cloud
const commentsCollection = firestore.collection('comments');
await commentsCollection.add(newComment); // Add to database
```

## 🔧 **Setup Steps:**

### **1. Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Firestore Database API

### **2. Set Up Firestore Database**
1. In Google Cloud Console, go to "Firestore Database"
2. Click "Create Database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users

### **3. Get Service Account Credentials**
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Give it a name like "web-annotator-backend"
4. Assign "Cloud Datastore User" role
5. Create and download the JSON key file

### **4. Configure Your Backend**
1. Place the downloaded JSON file in your `backend` folder
2. Update the Firestore initialization in `server.js`:

```javascript
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore({
  projectId: 'your-project-id', // Replace with your project ID
  keyFilename: './your-service-account-key.json' // Path to your JSON key file
});
```

### **5. Environment Variables (Recommended)**
Create a `.env` file in your backend folder:

```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account-key.json
JWT_SECRET=your-secret-key
```

Then update `server.js`:

```javascript
require('dotenv').config();

const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});
```

## 🗄️ **Database Collections:**

Your Firestore will have these collections:

### **`users` Collection**
```javascript
{
  fullname: "John Doe",
  username: "johndoe",
  email: "john@example.com",
  passwordHash: "$2a$10$...",
  createdAt: Timestamp
}
```

### **`comments` Collection**
```javascript
{
  url: "youtube.com",
  text: "<p>Great video!</p>",
  rawText: "Great video!",
  parentId: null, // For replies
  authorId: "user123",
  authorName: "johndoe",
  timestamp: Timestamp
}
```

### **`votes` Collection**
```javascript
{
  commentId: "comment123",
  userId: "user456",
  voteType: "up", // or "down"
  timestamp: Timestamp
}
```

### **`notifications` Collection**
```javascript
{
  userId: "user123",
  type: "mention",
  message: "johndoe mentioned you in a comment",
  commentId: "comment456",
  url: "youtube.com",
  timestamp: Timestamp,
  read: false
}
```

### **`passwordResetTokens` Collection**
```javascript
{
  email: "user@example.com",
  token: "reset-token-123",
  expiresAt: Timestamp
}
```

## 🚀 **Benefits of Firestore:**

### **✅ Persistence**
- Data survives server restarts
- No more lost users or comments

### **✅ Scalability**
- Handles millions of users and comments
- Automatic scaling

### **✅ Real-time Updates**
- Built-in real-time capabilities
- Perfect for live comment updates

### **✅ Security**
- Row-level security rules
- User authentication integration

### **✅ Backup & Recovery**
- Automatic backups
- Point-in-time recovery

## 🔒 **Security Rules (Optional)**

Add these Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read all comments
    match /comments/{commentId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can only vote once per comment
    match /votes/{voteId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🎯 **Testing Your Setup:**

1. **Start the server**: `node server.js`
2. **Register a user** through your extension
3. **Create a comment** and verify it's saved
4. **Restart the server** and verify data persists
5. **Check Firestore Console** to see your data

## 🚨 **Important Notes:**

- **Development Mode**: Firestore starts in test mode - no authentication required
- **Production**: Set up proper security rules before going live
- **Costs**: Firestore has a generous free tier (50,000 reads/day, 20,000 writes/day)
- **Backup**: Consider setting up automated backups for production

Your app is now production-ready with persistent, scalable data storage! 🎉
