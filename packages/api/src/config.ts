/**
 * API Gateway Configuration
 * Environment-based configuration for the Layer 4 API Gateway
 */

export interface Layer3Endpoints {
  intelligence: string;
  security: string;
  automation: string;
  governance: string;
  data: string;
  ecosystem: string;
  research: string;
  interface: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface Config {
  // Server Configuration
  port: number;
  host: string;
  nodeEnv: string;

  // Layer 3 Core Endpoints
  layer3Endpoints: Layer3Endpoints;

  // Authentication
  jwtSecret: string;
  apiKeySalt: string;
  jwtExpirationHours: number;

  // Rate Limiting
  rateLimit: RateLimitConfig;

  // Database Connection Strings (placeholders for MVP)
  database: {
    identityUrl: string;
    usageUrl: string;
    metricsUrl: string;
  };

  // Usage Ledger Service
  usageLedgerUrl: string;

  // Stripe Configuration
  stripe: {
    secretKey: string;
    webhookSecret: string;
    enabled: boolean;
  };

  // Logging
  logging: {
    level: string;
    pretty: boolean;
  };
}

const config: Config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Layer 3 Core Endpoints
  layer3Endpoints: {
    intelligence: process.env.INTELLIGENCE_CORE_URL || 'http://localhost:3001',
    security: process.env.SECURITY_CORE_URL || 'http://localhost:3002',
    automation: process.env.AUTOMATION_CORE_URL || 'http://localhost:3003',
    governance: process.env.GOVERNANCE_CORE_URL || 'http://localhost:3004',
    data: process.env.DATA_CORE_URL || 'http://localhost:3005',
    ecosystem: process.env.ECOSYSTEM_CORE_URL || 'http://localhost:3006',
    research: process.env.RESEARCH_CORE_URL || 'http://localhost:3007',
    interface: process.env.INTERFACE_CORE_URL || 'http://localhost:3008',
  },

  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  apiKeySalt: process.env.API_KEY_SALT || 'development-salt-change-in-production',
  jwtExpirationHours: parseInt(process.env.JWT_EXPIRATION_HOURS || '24', 10),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute default
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Database Connection Strings (placeholders for MVP)
  database: {
    identityUrl: process.env.IDENTITY_DB_URL || 'postgresql://localhost:5432/agentics_identity',
    usageUrl: process.env.USAGE_DB_URL || 'postgresql://localhost:5432/agentics_usage',
    metricsUrl: process.env.METRICS_DB_URL || 'postgresql://localhost:5432/agentics_metrics',
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    enabled: process.env.STRIPE_ENABLED === 'true',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development',
  },

  // Usage Ledger Service URL
  usageLedgerUrl: process.env.USAGE_LEDGER_URL || 'http://localhost:3009',
};

export default config;
