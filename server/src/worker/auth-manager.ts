import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * AuthManager — handles authentication for Master-Worker communication.
 * Supports: Token-based auth (primary), IP whitelisting, request signing.
 */
export class AuthManager {
  private nodeSecret: string;
  private ipWhitelist: Set<string>;
  private tokenExpiry: number; // ms

  constructor(nodeSecret: string, options?: { ipWhitelist?: string[]; tokenExpiry?: number }) {
    this.nodeSecret = nodeSecret;
    this.ipWhitelist = new Set(options?.ipWhitelist || []);
    this.tokenExpiry = options?.tokenExpiry || 3600000; // 1 hour
  }

  /**
   * Validate an incoming request from Master.
   * Checks: token, IP whitelist, timestamp freshness.
   */
  validateRequest(req: Request): { valid: boolean; error?: string } {
    // Check token
    const token = req.headers['x-node-secret'] as string || req.headers.authorization?.replace('Bearer ', '');
    if (!token || !this.verifyToken(token)) {
      return { valid: false, error: 'Invalid or missing token' };
    }

    // Check IP whitelist (if configured)
    if (this.ipWhitelist.size > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      const normalizedIp = clientIp.replace(/^::ffff:/, '');
      if (!this.ipWhitelist.has(normalizedIp) && !this.ipWhitelist.has('*')) {
        return { valid: false, error: `IP ${normalizedIp} not in whitelist` };
      }
    }

    // Check timestamp freshness (prevent replay attacks)
    const timestamp = req.headers['x-timestamp'] as string;
    if (timestamp) {
      const reqTime = parseInt(timestamp);
      const now = Date.now();
      if (Math.abs(now - reqTime) > this.tokenExpiry) {
        return { valid: false, error: 'Request timestamp expired' };
      }
    }

    return { valid: true };
  }

  /**
   * Generate a signed token for Master→Worker communication.
   */
  generateToken(nodeId: string, expiresAt?: number): string {
    const payload = {
      nodeId,
      iat: Date.now(),
      exp: expiresAt || Date.now() + this.tokenExpiry,
    };
    const signature = crypto
      .createHmac('sha256', this.nodeSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return Buffer.from(JSON.stringify({ ...payload, sig: signature })).toString('base64');
  }

  /**
   * Verify a token's signature and expiry.
   */
  verifyToken(token: string): boolean {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

      // Check expiry
      if (decoded.exp && decoded.exp < Date.now()) {
        return false;
      }

      // Verify signature
      const { sig, ...payload } = decoded;
      const expectedSig = crypto
        .createHmac('sha256', this.nodeSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return sig === expectedSig;
    } catch {
      return false;
    }
  }

  /**
   * Express middleware for node authentication.
   */
  middleware() {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      const result = this.validateRequest(req);
      if (!result.valid) {
        return res.status(401).json({ error: result.error });
      }
      next();
    };
  }
}

interface AuthRequest extends Request {
  nodeId?: string;
}
