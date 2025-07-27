const DatabaseService = require('./DatabaseService');
const logger = require('../utils/logger');

class ProductService {
  static async searchProducts(searchTerm, limit = 10) {
    try {
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
      
      const result = await DatabaseService.query(query, [`%${searchTerm}%`, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error searching products:', error);
      throw error;
    }
  }

  static async searchBySymptom(symptom) {
    try {
      // Map common symptoms to product categories
      const symptomMap = {
        'headache': ['Pain Relief'],
        'pain': ['Pain Relief'],
        'cold': ['Cold & Flu'],
        'flu': ['Cold & Flu'],
        'allergy': ['Allergy Relief'],
        'diabetes': ['Diabetes Care'],
        'vitamin': ['Vitamins', 'Supplements'],
        'supplement': ['Supplements']
      };

      const categories = symptomMap[symptom.toLowerCase()] || [];
      
      if (categories.length === 0) {
        // Fallback to general search
        return await this.searchProducts(symptom);
      }

      const placeholders = categories.map((_, index) => `$${index + 1}`).join(',');
      const query = `
        SELECT * FROM products 
        WHERE category = ANY($1)
        ORDER BY name
        LIMIT 10
      `;

      const result = await DatabaseService.query(query, [categories]);
      return result.rows;
    } catch (error) {
      logger.error('Error searching products by symptom:', error);
      throw error;
    }
  }

  static async getProductsByCategory(category, limit = 20) {
    try {
      const query = 'SELECT * FROM products WHERE category = $1 ORDER BY name LIMIT $2';
      const result = await DatabaseService.query(query, [category, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting products by category:', error);
      throw error;
    }
  }

  static async getProductById(productId) {
    try {
      const query = 'SELECT * FROM products WHERE product_id = $1';
      const result = await DatabaseService.query(query, [productId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting product by ID:', error);
      throw error;
    }
  }

  static async updateStock(productId, quantity) {
    try {
      const query = `
        UPDATE products 
        SET stock_quantity = stock_quantity - $2,
            updated_at = NOW()
        WHERE product_id = $1
        RETURNING stock_quantity
      `;

      const result = await DatabaseService.query(query, [productId, quantity]);
      return result.rows[0]?.stock_quantity || 0;
    } catch (error) {
      logger.error('Error updating product stock:', error);
      throw error;
    }
  }

  static async checkAvailability(productId, requestedQuantity = 1) {
    try {
      const product = await this.getProductById(productId);
      
      if (!product) {
        return { available: false, reason: 'Product not found' };
      }

      if (product.stock_quantity < requestedQuantity) {
        return { 
          available: false, 
          reason: 'Insufficient stock',
          availableQuantity: product.stock_quantity
        };
      }

      return { available: true, product };
    } catch (error) {
      logger.error('Error checking product availability:', error);
      throw error;
    }
  }

  static async getFeaturedProducts(limit = 10) {
    try {
      // Get products with high sales or low stock for featured display
      const query = `
        SELECT p.*, COALESCE(sales_count, 0) as popularity
        FROM products p
        LEFT JOIN (
          SELECT product_id, COUNT(*) as sales_count
          FROM sales_history
          GROUP BY product_id
        ) s ON p.product_id = s.product_id
        ORDER BY popularity DESC, p.price ASC
        LIMIT $1
      `;

      const result = await DatabaseService.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting featured products:', error);
      throw error;
    }
  }

  static async getCategories() {
    try {
      const query = `
        SELECT category, COUNT(*) as product_count
        FROM products
        GROUP BY category
        ORDER BY category
      `;

      const result = await DatabaseService.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting product categories:', error);
      throw error;
    }
  }
}

module.exports = ProductService;
