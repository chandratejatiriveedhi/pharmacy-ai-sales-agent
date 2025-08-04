require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

class DatabaseSetup {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      // Create database connection
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'pharmacy_db',
        user: process.env.DB_USER || 'pharmacy_user',
        password: process.env.DB_PASSWORD || 'pharmacy_pass',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.pool.connect();
      logger.info('✅ Database connection established');
      client.release();

    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async runSchemaFile() {
    try {
      logger.info('📊 Running database schema...');
      
      // Read schema file
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at: ${schemaPath}`);
      }

      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute schema
      await this.pool.query(schemaSQL);
      
      logger.info('✅ Database schema created successfully');
      
    } catch (error) {
      logger.error('❌ Failed to run schema:', error);
      throw error;
    }
  }

  async createExtensions() {
    try {
      logger.info('🔧 Creating database extensions...');
      
      // Create extensions
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      logger.info('✅ uuid-ossp extension ready');
      
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS "vector"');
      logger.info('✅ pgvector extension ready');
      
    } catch (error) {
      logger.warn('⚠️ Some extensions may not be available:', error.message);
      // Don't throw here as extensions might not be available in all environments
    }
  }

  async verifyTables() {
    try {
      logger.info('🔍 Verifying database tables...');
      
      const tables = [
        'customers',
        'products', 
        'promotions',
        'sales_history',
        'conversations',
        'conversation_logs',
        'product_embeddings',
        'workflow_logs',
        'analytics_events'
      ];

      for (const table of tables) {
        const result = await this.pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);

        if (result.rows[0].exists) {
          logger.info(`✅ Table '${table}' exists`);
        } else {
          logger.warn(`⚠️ Table '${table}' not found`);
        }
      }
      
    } catch (error) {
      logger.error('❌ Error verifying tables:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      logger.info('📈 Creating database indexes...');
      
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_customers_telegram_id ON customers(telegram_id)',
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
        'CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales_history(customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id)'
      ];

      for (const indexSQL of indexes) {
        await this.pool.query(indexSQL);
      }
      
      logger.info('✅ Database indexes created');
      
    } catch (error) {
      logger.error('❌ Error creating indexes:', error);
      // Don't throw, indexes are not critical for basic functionality
    }
  }

  async setupInitialData() {
    try {
      logger.info('🏗️ Setting up initial data...');
      
      // Check if system user exists
      const systemUser = await this.pool.query(
        'SELECT * FROM customers WHERE customer_id = $1',
        ['SYSTEM']
      );

      if (systemUser.rows.length === 0) {
        await this.pool.query(`
          INSERT INTO customers (
            customer_id, first_name, last_name, email, status, 
            registration_date, created_at, updated_at
          ) VALUES (
            'SYSTEM', 'System', 'Administrator', 'admin@pharmacy.com', 'Active',
            NOW(), NOW(), NOW()
          )
        `);
        logger.info('✅ System user created');
      } else {
        logger.info('✅ System user already exists');
      }
      
    } catch (error) {
      logger.error('❌ Error setting up initial data:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('✅ Database connections closed');
    }
  }

  async setupDatabase() {
    try {
      logger.info('🚀 Starting database setup...');
      
      await this.initialize();
      await this.createExtensions();
      await this.runSchemaFile();
      await this.verifyTables();
      await this.createIndexes();
      await this.setupInitialData();
      
      logger.info('🎉 Database setup completed successfully!');
      
    } catch (error) {
      logger.error('💥 Database setup failed:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.setupDatabase()
    .then(() => {
      logger.info('✅ Database setup script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Database setup script failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSetup;
