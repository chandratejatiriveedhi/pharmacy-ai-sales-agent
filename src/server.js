const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes and middleware
const aiAgentRoutes = require('./routes/aiAgent');
const webhookRoutes = require('./routes/webhooks');
const customerRoutes = require('./routes/customers');
const productRoutes = require('./routes/products');
const promotionRoutes = require('./routes/promotions');
const analyticsRoutes = require('./routes/analytics');

// Import services
const DatabaseService = require('./services/DatabaseService');
const TelegramBot = require('./services/TelegramBot');
const WhatsAppBot = require('./services/WhatsAppBot');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

class PharmacyAISalesAgent {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupServices();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Logging
    this.app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Static files
    this.app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    logger.info('Middleware setup completed');
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/v1/ai-agent', aiAgentRoutes);
    this.app.use('/webhook', webhookRoutes);
    this.app.use('/api/v1/customers', customerRoutes);
    this.app.use('/api/v1/products', productRoutes);
    this.app.use('/api/v1/promotions', promotionRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Pharmacy AI Sales Agent API',
        version: '1.0.0',
        documentation: '/api/v1/docs'
      });
    });

    logger.info('Routes setup completed');
  }

  async setupServices() {
    try {
      // Initialize database
      await DatabaseService.initialize();
      logger.info('Database service initialized');

      // Initialize bots if enabled
      if (process.env.ENABLE_TELEGRAM === 'true') {
        this.telegramBot = new TelegramBot();
        await this.telegramBot.initialize();
        logger.info('Telegram bot initialized');
      }

      if (process.env.ENABLE_WHATSAPP === 'true') {
        this.whatsappBot = new WhatsAppBot();
        await this.whatsappBot.initialize();
        logger.info('WhatsApp bot initialized');
      }

    } catch (error) {
      logger.error('Service initialization failed:', error);
      process.exit(1);
    }
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        message: `${req.method} ${req.originalUrl} not found`
      });
    });

    // Global error handler
    this.app.use(errorHandler);

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    logger.info('Error handling setup completed');
  }

  async start() {
    try {
      this.server = this.app.listen(this.port, () => {
        logger.info(`🚀 Pharmacy AI Sales Agent started on port ${this.port}`);
        logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
        logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('🛑 Shutting down Pharmacy AI Sales Agent...');
    
    try {
      // Close server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        logger.info('✅ HTTP server closed');
      }

      // Close database connections
      await DatabaseService.close();
      logger.info('✅ Database connections closed');

      // Close bot connections
      if (this.telegramBot) {
        await this.telegramBot.stop();
        logger.info('✅ Telegram bot stopped');
      }

      if (this.whatsappBot) {
        await this.whatsappBot.stop();
        logger.info('✅ WhatsApp bot stopped');
      }

      logger.info('👋 Shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the application
if (require.main === module) {
  const app = new PharmacyAISalesAgent();
  app.start();
}

module.exports = PharmacyAISalesAgent;
