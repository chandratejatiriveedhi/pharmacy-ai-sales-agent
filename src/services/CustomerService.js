const DatabaseService = require('./DatabaseService');
const logger = require('../utils/logger');

class CustomerService {
  static async getCustomerById(customerId) {
    try {
      const query = 'SELECT * FROM customers WHERE customer_id = $1';
      const result = await DatabaseService.query(query, [customerId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting customer by ID:', error);
      throw error;
    }
  }

  static async getCustomerByPhone(phone) {
    try {
      const query = 'SELECT * FROM customers WHERE phone = $1 OR whatsapp_phone = $1';
      const result = await DatabaseService.query(query, [phone]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting customer by phone:', error);
      throw error;
    }
  }

  static async createCustomer(customerData) {
    try {
      const {
        customer_id, first_name, last_name, email, phone, date_of_birth,
        gender, address_line1, city, state, zip_code, country
      } = customerData;

      const query = `
        INSERT INTO customers (
          customer_id, first_name, last_name, email, phone, date_of_birth,
          gender, address_line1, city, state, zip_code, country,
          registration_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 'Active')
        RETURNING *
      `;

      const result = await DatabaseService.query(query, [
        customer_id, first_name, last_name, email, phone, date_of_birth,
        gender, address_line1, city, state, zip_code, country
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw error;
    }
  }

  static async updateCustomer(customerId, updateData) {
    try {
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

      const query = `
        UPDATE customers 
        SET ${setClause}, updated_at = NOW()
        WHERE customer_id = $1
        RETURNING *
      `;

      const result = await DatabaseService.query(query, [customerId, ...values]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw error;
    }
  }

  static async getCustomerPurchaseHistory(customerId, limit = 10) {
    try {
      const query = `
        SELECT * FROM sales_history 
        WHERE customer_id = $1 
        ORDER BY transaction_date DESC 
        LIMIT $2
      `;
      
      const result = await DatabaseService.query(query, [customerId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting customer purchase history:', error);
      throw error;
    }
  }

  static async updateLoyaltyPoints(customerId, pointsToAdd) {
    try {
      const query = `
        UPDATE customers 
        SET loyalty_points = loyalty_points + $2,
            updated_at = NOW()
        WHERE customer_id = $1
        RETURNING loyalty_points
      `;

      const result = await DatabaseService.query(query, [customerId, pointsToAdd]);
      return result.rows[0]?.loyalty_points || 0;
    } catch (error) {
      logger.error('Error updating loyalty points:', error);
      throw error;
    }
  }
}

module.exports = CustomerService;
