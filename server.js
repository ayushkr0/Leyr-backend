const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const { marked } = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production'; // In production, use environment variable
const GOOGLE_CLIENT_ID = 'your-google-client-id'; // In production, use environment variable
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Data storage file path
const DATA_FILE = path.join(__dirname, 'data.json');

// Load data from file or initialize empty
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        comments: data.comments || [],
        users: data.users || [],
        notifications: data.notifications || []
      };
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
  return { comments: [], users: [], notifications: [] };
}

// Save data to file
function saveData() {
  try {
    const data = {
      comments,
      users,
      notifications
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Load existing data
const { comments, users, notifications } = loadData();

// In-memory storage for development/testing
// In production, replace this with Firestore
const votes = new Map(); // Track votes: {commentId: {upvotes: number, downvotes: number}}
const userSessions = new Map(); // Track active sessions
const passwordResetTokens = new Map(); // Track password reset tokens: {email: {token, expiresAt}}

// Helper function to build comment tree
function buildCommentTree(comments) {
  const commentMap = new Map();
  const rootComments = [];
  
  // Create a map of all comments
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  
  // Build the tree structure
  comments.forEach(comment => {
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies.push(commentMap.get(comment.id));
      }
    } else {
      rootComments.push(commentMap.get(comment.id));
    }
  });
  
  return rootComments;
}

// Helper function to extract user mentions from text
function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

// Authentication endpoints

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullname, username, email, password } = req.body;
    
    if (!fullname || !username || !email || !password) {
      return res.status(400).json({ error: 'Full name, username, email, and password are required' });
    }
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: Date.now().toString(),
      fullname,
      username,
      email,
      passwordHash,
      createdAt: new Date()
    };
    
    users.push(newUser);
    saveData(); // Save to file
    console.log('New user registered:', { username, email });
    
    // Generate JWT token
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({
      token,
      user: { id: newUser.id, fullname: newUser.fullname, username: newUser.username, email: newUser.email }
    });
    
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login - Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    console.log('User logged in:', { username: user.username, email });
    
    res.json({
      token,
      user: { id: user.id, fullname: user.fullname, username: user.username, email: user.email }
    });
    
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/google - Google OAuth login
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Google token is required' });
    }
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;
    
    // Check if user exists
    let user = users.find(u => u.email === email);
    
    if (!user) {
      // Create new user
      user = {
        id: Date.now().toString(),
        fullname: name,
        username: email.split('@')[0], // Use email prefix as username
        email,
        avatar: picture,
        googleId: payload.sub,
        createdAt: new Date()
      };
      users.push(user);
      saveData(); // Save to file
      console.log('New Google user registered:', { name, email });
    }
    
    // Generate JWT token
    const jwtToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token: jwtToken,
      user: { id: user.id, fullname: user.fullname, username: user.username, email: user.email, avatar: user.avatar }
    });
    
  } catch (error) {
    console.error('Error with Google login:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

// POST /api/auth/forgot-password - Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const user = users.find(u => u.email === email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
    }
    
    // Generate reset token (in production, use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Store reset token
    passwordResetTokens.set(email, { token: resetToken, expiresAt });
    
    // In production, send email here
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: http://localhost:3000/reset-password?token=${resetToken}&email=${email}`);
    
    res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
    
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }
    
    // Validate password
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Check if reset token is valid
    const resetData = passwordResetTokens.get(email);
    if (!resetData || resetData.token !== token || new Date() > resetData.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    
    // Remove used token
    passwordResetTokens.delete(email);
    
    console.log(`Password reset successful for ${email}`);
    
    res.json({ message: 'Password reset successful. You can now login with your new password.' });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/auth/me - Get current user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    user: { id: user.id, fullname: user.fullname, username: user.username, email: user.email, avatar: user.avatar }
  });
});

// API Endpoints
app.get('/api/comments', async (req, res) => {
  try {
    const { url, page = 1, limit = 20 } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Filter comments by URL
    const filteredComments = comments
      .filter(comment => comment.url === url)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const totalComments = filteredComments.length;
    const totalPages = Math.ceil(totalComments / limitNum);
    
    // Get paginated comments
    const paginatedComments = filteredComments.slice(startIndex, endIndex);

    // Build comment tree for threaded display
    const commentTree = buildCommentTree(paginatedComments);
    
    res.json({
      comments: commentTree,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalComments,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/comments - Create a new comment
app.post('/api/comments', authenticateToken, async (req, res) => {
  try {
    const { url, text, parentId } = req.body;
    
    if (!url || !text) {
      return res.status(400).json({ error: 'URL and text are required' });
    }

    // Sanitize and convert markdown to HTML
    const sanitizedText = DOMPurify.sanitize(text);
    const htmlText = marked(sanitizedText);
    const finalText = DOMPurify.sanitize(htmlText);

    const newComment = {
      id: Date.now().toString(), // Simple ID generation
      url,
      text: finalText,
      rawText: text, // Store original markdown text
      parentId: parentId || null, // Support for replies
      authorId: req.user.id,
      authorName: req.user.username,
      timestamp: new Date(),
      upvotes: 0,
      downvotes: 0
    };

    comments.push(newComment);
    votes.set(newComment.id, { upvotes: 0, downvotes: 0 });
    saveData(); // Save to file
    console.log('New comment added:', newComment);

    // Check for user mentions and create notifications
    const mentions = extractMentions(text);
    mentions.forEach(mention => {
      const mentionedUser = users.find(u => u.username.toLowerCase() === mention.toLowerCase());
      if (mentionedUser && mentionedUser.id !== req.user.id) {
        const notification = {
          id: Date.now().toString() + Math.random(),
          userId: mentionedUser.id,
          type: 'mention',
          message: `${req.user.username} mentioned you in a comment`,
          commentId: newComment.id,
          url: url,
          timestamp: new Date(),
          read: false
        };
        notifications.push(notification);
        
        // Emit notification to mentioned user
        io.emit('notification', { userId: mentionedUser.id, notification });
      }
    });

    // Emit real-time update
    io.emit('newComment', { url, comment: newComment });

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// POST /api/comments/:id/vote - Vote on a comment
app.post('/api/comments/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body; // 'up', 'down', or 'remove'
    
    if (!voteType || !['up', 'down', 'remove'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type. Must be "up", "down", or "remove"' });
    }
    
    const comment = comments.find(c => c.id === id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Handle vote removal
    if (voteType === 'remove') {
      // For demo purposes, we'll just reset the vote counts
      // In a real app, you'd track individual user votes
      comment.upvotes = Math.max(0, comment.upvotes - 1);
      comment.downvotes = Math.max(0, comment.downvotes - 1);
      console.log(`Vote removed from comment ${id}`);
    } else {
      // Update vote counts
      if (voteType === 'up') {
        comment.upvotes++;
      } else {
        comment.downvotes++;
      }
      console.log(`Vote ${voteType} added to comment ${id}`);
    }
    
    // Emit real-time update
    io.emit('commentVoted', { commentId: id, upvotes: comment.upvotes, downvotes: comment.downvotes });
    
    res.json({ success: true, upvotes: comment.upvotes, downvotes: comment.downvotes });
    
  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ error: 'Failed to vote on comment' });
  }
});

// PUT /api/comments/:id - Edit a comment
app.put('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const comment = comments.find(c => c.id === id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Check if user owns the comment
    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }
    
    // Sanitize and convert markdown to HTML
    const sanitizedText = DOMPurify.sanitize(text);
    const htmlText = marked(sanitizedText);
    const finalText = DOMPurify.sanitize(htmlText);
    
    comment.text = finalText;
    comment.rawText = text; // Store original markdown text
    comment.editedAt = new Date();
    
    console.log(`Comment ${id} edited by ${req.user.username}`);
    
    // Emit real-time update
    io.emit('commentEdited', { commentId: id, text, editedAt: comment.editedAt });
    
    res.json(comment);
    
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// DELETE /api/comments/:id - Delete a comment
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const comment = comments.find(c => c.id === id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Check if user owns the comment
    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    // Remove comment and its replies
    const commentIndex = comments.findIndex(c => c.id === id);
    comments.splice(commentIndex, 1);
    
    // Remove replies
    const repliesToRemove = comments.filter(c => c.parentId === id);
    repliesToRemove.forEach(reply => {
      const replyIndex = comments.findIndex(c => c.id === reply.id);
      comments.splice(replyIndex, 1);
    });
    
    console.log(`Comment ${id} deleted by ${req.user.username}`);
    
    // Emit real-time update
    io.emit('commentDeleted', { commentId: id });
    
      res.json({ success: true });
  
} catch (error) {
  console.error('Error deleting comment:', error);
  res.status(500).json({ error: 'Failed to delete comment' });
}
});

// GET /api/notifications - Get user notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const userNotifications = notifications
      .filter(n => n.userId === req.user.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50); // Limit to 50 most recent
    
    res.json(userNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const notification = notifications.find(n => n.id === id && n.userId === req.user.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    notification.read = true;
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('joinRoom', (url) => {
    socket.join(url);
    console.log(`User ${socket.id} joined room: ${url}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Health check: http://localhost:3000/health');
  console.log('WebSocket server ready');
}); 