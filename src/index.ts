import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import jwt from 'jsonwebtoken';
import cryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { getDirections, getSearch, getWeather } from './api';

const app = express();

// Set basic security headers
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// CORS configuration - allow only your frontend domain
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];
const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Signature',
    'X-Session-Token',
  ],
};
app.use(cors(corsOptions));

// ----- CONFIGURATION -----
const config = {
  // Secret keys - store in .env file or secret manager in production
  JWT_SECRET: process.env.JWT_SECRET,
  API_SECRET: process.env.API_SECRET,

  // Token settings
  SESSION_TOKEN_EXPIRY: 3600, // 1 hour in seconds

  // HoneyPot APIs for attack detection
  HONEYPOT_ENDPOINTS: [
    '/api/v1/internal/config',
    '/api/data/raw',
    '/api/system/status',
  ],

  // Blocklist for known malicious actors
  BLOCKED_IPS: new Set(),
};

// ----- RATE LIMITING -----
// Global rate limiting (IP-based)
const globalRateLimiter = new RateLimiterMemory({
  points: 100, // Number of allowed requests
  duration: 60, // per 1 minute
});

// Stricter rate limiting for auth endpoints
const authRateLimiter = new RateLimiterMemory({
  points: 5, // only 5 requests
  duration: 60, // per 1 minute
  blockDuration: 300, // Block for 5 minutes on exceeding limit
});

// Session-based rate limiting
const sessionLimiters = new Map();

// ----- SESSION TOKEN MANAGEMENT -----
// Storage for active session tokens
const activeTokens = new Map();

// Generate a secure session token for frontend sessions
app.post('/api/auth/session', async (req, res) => {
  try {
    // Apply rate limiting for auth endpoints
    if (req.ip) {
      await authRateLimiter.consume(req.ip);
    }

    // Check the referrer
    const referrer = req.headers.referer || '';
    if (!referrer.includes('your-frontend-domain.com')) {
      return res.status(403).json({ error: 'Invalid referrer' });
    }

    // Generate random session ID
    const sessionId = uuidv4();

    // Create a JWT with the session ID and short expiration time
    const token = jwt.sign({ sessionId }, config.JWT_SECRET, {
      expiresIn: config.SESSION_TOKEN_EXPIRY,
    });

    // Store token in active token list with timestamp
    activeTokens.set(sessionId, {
      token,
      created: Date.now(),
      clientIp: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });

    // Create a rate limiter for this session
    sessionLimiters.set(
      sessionId,
      new RateLimiterMemory({
        points: 50, // 50 requests
        duration: 60, // per minute
        blockDuration: 60, // Block for 1 minute on exceeding limit
      })
    );

    // Set token as cookie and also send it as JSON
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: config.SESSION_TOKEN_EXPIRY * 1000,
    });

    return res.json({ token });
  } catch (error: any) {
    if (error.remainingPoints !== undefined) {
      return res.status(429).json({ error: 'Too many requests, please wait' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// ----- REQUEST VALIDATION AND SIGNING -----
// Middleware to validate session token and request signature
const validateRequest = async (req, res, next) => {
  try {
    // Rate limiting (global and IP-based)
    await globalRateLimiter.consume(req.ip);

    // Check if the IP is blocked
    if (config.BLOCKED_IPS.has(req.ip)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Get token from authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader
      ? authHeader.split(' ')[1]
      : req.cookies.session_token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // 2. Validate JWT
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 3. Check if the session is active
    const sessionInfo = activeTokens.get(decoded.sessionId);
    if (!sessionInfo) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // 4. Verify client fingerprint (IP & User-Agent)
    if (sessionInfo.clientIp !== req.ip) {
      config.BLOCKED_IPS.add(req.ip); // Potential token theft - block IP
      return res.status(403).json({ error: 'Security violation detected' });
    }

    // 5. Session-based rate limiting
    const sessionLimiter = sessionLimiters.get(decoded.sessionId);
    if (sessionLimiter) {
      await sessionLimiter.consume(decoded.sessionId);
    }

    // 6. Signature validation (optional but recommended)
    const signature = req.headers['x-request-signature'];
    if (signature) {
      // Create the expected signature from request data
      const timestamp = req.headers['x-timestamp'] || '';
      const path = req.originalUrl;
      const body = JSON.stringify(req.body);

      const expectedSignature = cryptoJS
        .HmacSHA256(
          `${timestamp}${path}${body}${decoded.sessionId}`,
          config.API_SECRET
        )
        .toString();

      // Compare with the provided signature
      if (signature !== expectedSignature) {
        // Invalid signature - potential attack
        return res.status(403).json({ error: 'Invalid request signature' });
      }
    }

    // Pass the session ID to subsequent handlers
    req.sessionId = decoded.sessionId;
    next();
  } catch (error: any) {
    // Rate limit reached
    if (error.remainingPoints !== undefined) {
      return res
        .status(429)
        .json({ error: 'Rate limit reached. Please wait.' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

// ----- HONEYPOT ENDPOINTS -----
// Setup honeypot endpoints to detect scanning/enumeration
config.HONEYPOT_ENDPOINTS.forEach((endpoint) => {
  app.all(endpoint, (req, res) => {
    // Block the attacker's IP
    config.BLOCKED_IPS.add(req.ip);
    console.log(`Honeypot triggered: ${req.ip} accessed ${endpoint}`);

    // Pretend to return a normal response to avoid alerting the attacker
    res.status(200).json({ status: 'ok' });
  });
});

// ----- PROXY ENDPOINT TO EXTERNAL APIs -----
// Protected endpoint acting as a proxy to paid external APIs
app.post('/api/proxy/:service', validateRequest, async (req, res) => {
  try {
    const { service } = req.params;
    const allowedServices = ['weather', 'direction', 'search'];

    // Validate requested service
    if (!allowedServices.includes(service)) {
      return res.status(400).json({ error: 'Invalid service' });
    }

    let data;
    switch (service) {
      case 'weather':
        data = await getWeather(
          req.body.lat,
          req.body.lon,
          new Date(req.body.datetime)
        );
        break;
      case 'direction':
        data = await getDirections({
          mode: req.body.mode,
          coords: req.body.coords,
          language: req.body.language,
          departAt: req.body.departAt,
        });
        break;
      case 'search':
        data = await getSearch(req.body.query, req.body.language);
        break;
      default:
        return res.status(400).json({ error: 'Service not supported' });
    }

    // Log usage for billing purposes
    // TODO: check if sessionId is valid
    console.log(
      `API usage: ${service} by session ${req.headers['x-session-token']}`
    );

    if (!data) {
      return res.status(500).json({ error: 'No data returned from service' });
    }

    return res.json(data);
  } catch (error) {
    console.error('API Proxy error:', error);
    return res.status(500).json({ error: 'Error accessing external service' });
  }
});

// ----- TOKEN ROTATION MECHANISM -----
// Periodic cleanup of expired tokens (every 15 minutes)
setInterval(() => {
  const now = Date.now();

  for (const [sessionId, info] of activeTokens.entries()) {
    // Remove tokens older than the expiration time
    if (now - info.created > config.SESSION_TOKEN_EXPIRY * 1000) {
      activeTokens.delete(sessionId);
      sessionLimiters.delete(sessionId);
    }
  }
}, 15 * 60 * 1000);

// ----- START SERVER -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
