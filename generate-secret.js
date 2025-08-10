#!/usr/bin/env node

const crypto = require('crypto');

// Generate a secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('🔐 Generated Secure Secrets for Production');
console.log('==========================================');
console.log('');
console.log('JWT_SECRET=' + jwtSecret);
console.log('');
console.log('SESSION_SECRET=' + sessionSecret);
console.log('');
console.log('📝 Copy these to your .env file or production environment variables');
console.log('');
console.log('⚠️  Keep these secrets secure and never commit them to version control!');
console.log('');
console.log('💡 You can also use this command to generate a new secret:');
console.log('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
