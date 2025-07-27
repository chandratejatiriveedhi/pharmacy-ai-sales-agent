const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      await this.pool.query('SELECT NOW()');
      await this.installExtensions();
      
      this.isInitialized = true;
      logger.info('✅ Database connection established successfully');
      
    } catch (error) {
      logger.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async installExtensions() {
    try {
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      logger.info('✅ pgvector extension installed');
    } catch (error) {
      logger.warn('⚠️ Could not install pgvector extension:', error.message);
    }
  }

  async query(text, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug(`Query executed in ${duration}ms`);
      return result;
    } catch (error) {
      logger.error(`Query failed:`, error.message);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async searchProducts(searchTerm, limit = 10) {
    const query = `
      SELECT * FROM products 
      WHERE name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1
      ORDER BY 
        CASE 
          WHEN name ILIKE $1 THEN 1
          WHEN description ILIKE $1 THEN 2
          ELSE 3
        END
      LIMIT $2
    `;
    
    const result = await this.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }

  async getProductsByCategory(category, limit = 20) {
    const query = 'SELECT * FROM products WHERE category = $1 LIMIT $2';
    const result = await this.query(query, [category, limit]);
    return result.rows;
  }

  async getActivePromotions() {
    const query = `
      SELECT * FROM promotions 
      WHERE status = 'active' 
      AND start_date <= NOW() 
      AND end_date >= NOW()
      ORDER BY discount_percentage DESC
    `;
    
    const result = await this.query(query);
    return result.rows;
  }

  async getCustomerPurchaseHistory(customerId, limit = 10) {
    const query = `
      SELECT * FROM sales_history 
      WHERE customer_id = $1 
      ORDER BY transaction_date DESC 
      LIMIT $2
    `;
    
    const result = await this.query(query, [customerId, limit]);
    return result.rows;
  }

  async createSalesRecord(saleData) {
    const {
      transaction_id, customer_id, product_id, product_name, category,
      quantity, unit_price, total_price, discount_applied, promotion_used,
      payment_method, loyalty_points_earned
    } = saleData;

    const query = `
      INSERT INTO sales_history (
        transaction_id, customer_id, transaction_date, product_id, product_name,
        category, quantity, unit_price, total_price, discount_applied,
        promotion_used, payment_method, loyalty_points_earned
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await this.query(query, [
      transaction_id, customer_id, product_id, product_name, category,
      quantity, unit_price, total_price, discount_applied, promotion_used,
      payment_method, loyalty_points_earned
    ]);

    return result.rows[0];
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isInitialized = false;
      logger.info('✅ Database connections closed');
    }
  }
}

module.exports = new DatabaseService();
