const DatabaseService = require('./DatabaseService');
const logger = require('../utils/logger');

class PromotionService {
  static async getActivePromotions() {
    try {
      const query = `
        SELECT * FROM promotions 
        WHERE status = 'active' 
        AND start_date <= CURRENT_DATE 
        AND end_date >= CURRENT_DATE
        ORDER BY discount_percentage DESC, discount_amount DESC
      `;
      
      const result = await DatabaseService.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting active promotions:', error);
      throw error;
    }
  }

  static async getPromotionById(promotionId) {
    try {
      const query = 'SELECT * FROM promotions WHERE promotion_id = $1';
      const result = await DatabaseService.query(query, [promotionId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting promotion by ID:', error);
      throw error;
    }
  }

  static async getApplicablePromotions(customerId, products = []) {
    try {
      const customer = await DatabaseService.query(
        'SELECT * FROM customers WHERE customer_id = $1',
        [customerId]
      );

      if (customer.rows.length === 0) {
        return [];
      }

      const customerData = customer.rows[0];
      const activePromotions = await this.getActivePromotions();

      // Filter promotions based on customer eligibility
      const applicablePromotions = activePromotions.filter(promo => {
        return this.checkCustomerEligibility(customerData, promo, products);
      });

      return applicablePromotions;
    } catch (error) {
      logger.error('Error getting applicable promotions:', error);
      throw error;
    }
  }

  static checkCustomerEligibility(customer, promotion, products = []) {
    try {
      // Check customer segment eligibility
      if (promotion.customer_segments && promotion.customer_segments !== 'all') {
        const segments = promotion.customer_segments.split(',');
        
        if (segments.includes('seniors')) {
          const age = this.calculateAge(customer.date_of_birth);
          if (age >= 65) return true;
        }
        
        if (segments.includes('new_customers')) {
          const registrationDate = new Date(customer.registration_date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (registrationDate > thirtyDaysAgo) return true;
        }
        
        if (segments.includes('loyalty_members')) {
          if (customer.loyalty_points > 100) return true;
        }

        if (segments.includes('diabetic_customers')) {
          if (customer.medical_conditions && 
              customer.medical_conditions.toLowerCase().includes('diabetes')) {
            return true;
          }
        }

        if (segments.includes('regular_customers')) {
          if (customer.prescription_count > 5) return true;
        }

        // If specific segments are required but none match
        if (!segments.includes('all')) {
          return false;
        }
      }

      // Check product/category eligibility
      if (promotion.applicable_products) {
        const applicableProducts = promotion.applicable_products.split(',');
        const hasApplicableProduct = products.some(product => 
          applicableProducts.includes(product.product_id)
        );
        if (!hasApplicableProduct && products.length > 0) return false;
      }

      if (promotion.applicable_categories) {
        const applicableCategories = promotion.applicable_categories.split(',');
        const hasApplicableCategory = products.some(product =>
          applicableCategories.includes(product.category)
        );
        if (!hasApplicableCategory && products.length > 0) return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking customer eligibility:', error);
      return false;
    }
  }

  static calculateAge(birthDate) {
    if (!birthDate) return 0;
    
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  static async applyPromotion(promotionId, customerId, orderTotal, products = []) {
    try {
      const promotion = await this.getPromotionById(promotionId);
      
      if (!promotion) {
        return { success: false, error: 'Promotion not found' };
      }

      const customer = await DatabaseService.query(
        'SELECT * FROM customers WHERE customer_id = $1',
        [customerId]
      );

      if (customer.rows.length === 0) {
        return { success: false, error: 'Customer not found' };
      }

      // Check eligibility
      if (!this.checkCustomerEligibility(customer.rows[0], promotion, products)) {
        return { success: false, error: 'Customer not eligible for this promotion' };
      }

      // Check minimum purchase amount
      if (promotion.min_purchase_amount && orderTotal < promotion.min_purchase_amount) {
        return { 
          success: false, 
          error: `Minimum purchase amount of $${promotion.min_purchase_amount} required` 
        };
      }

      // Calculate discount
      let discountAmount = 0;
      
      if (promotion.discount_percentage) {
        discountAmount = (orderTotal * promotion.discount_percentage) / 100;
      } else if (promotion.discount_amount) {
        discountAmount = promotion.discount_amount;
      }

      // Apply maximum discount limit
      if (promotion.max_discount_amount && discountAmount > promotion.max_discount_amount) {
        discountAmount = promotion.max_discount_amount;
      }

      // Update promotion usage
      await this.incrementPromotionUsage(promotionId);

      return {
        success: true,
        discountAmount,
        finalTotal: orderTotal - discountAmount,
        promotion: {
          id: promotion.promotion_id,
          name: promotion.name,
          description: promotion.description
        }
      };

    } catch (error) {
      logger.error('Error applying promotion:', error);
      return { success: false, error: 'Failed to apply promotion' };
    }
  }

  static async incrementPromotionUsage(promotionId) {
    try {
      const query = `
        UPDATE promotions 
        SET current_usage = current_usage + 1,
            updated_at = NOW()
        WHERE promotion_id = $1
        RETURNING current_usage, total_usage_limit
      `;

      const result = await DatabaseService.query(query, [promotionId]);
      
      if (result.rows.length > 0) {
        const { current_usage, total_usage_limit } = result.rows[0];
        
        // Deactivate promotion if usage limit reached
        if (total_usage_limit && current_usage >= total_usage_limit) {
          await DatabaseService.query(
            "UPDATE promotions SET status = 'expired' WHERE promotion_id = $1",
            [promotionId]
          );
        }
      }

    } catch (error) {
      logger.error('Error incrementing promotion usage:', error);
      throw error;
    }
  }

  static async getPromotionsByCategory(category) {
    try {
      const query = `
        SELECT * FROM promotions 
        WHERE status = 'active' 
        AND (applicable_categories LIKE $1 OR applicable_categories = '')
        AND start_date <= CURRENT_DATE 
        AND end_date >= CURRENT_DATE
        ORDER BY discount_percentage DESC
      `;

      const result = await DatabaseService.query(query, [`%${category}%`]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting promotions by category:', error);
      throw error;
    }
  }
}

module.exports = PromotionService;
