const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const DatabaseService = require('../src/services/DatabaseService');
const logger = require('../src/utils/logger');

class DataSeeder {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
  }

  async seedDatabase() {
    try {
      logger.info('🌱 Starting database seeding...');
      
      await DatabaseService.initialize();
      
      // Seed in order due to foreign key dependencies
      await this.seedCustomers();
      await this.seedProducts();  
      await this.seedPromotions();
      await this.seedSalesHistory();
      
      logger.info('✅ Database seeding completed successfully!');
      
    } catch (error) {
      logger.error('❌ Database seeding failed:', error);
      throw error;
    } finally {
      await DatabaseService.close();
    }
  }

  async seedCustomers() {
    logger.info('📊 Seeding customers...');
    
    const customerFiles = [
      'pharmacy_customers_25.csv',
      'pharmacy_customers_26_75.csv', 
      'pharmacy_customers_76_100.csv'
    ];

    let totalCustomers = 0;

    for (const filename of customerFiles) {
      const filePath = path.join(this.dataDir, filename);
      
      if (!fs.existsSync(filePath)) {
        logger.warn(`⚠️ Customer file not found: ${filename}`);
        continue;
      }

      const customers = await this.readCSV(filePath);
      
      for (const customer of customers) {
        try {
          await this.insertCustomer(customer);
          totalCustomers++;
        } catch (error) {
          logger.error(`Error inserting customer ${customer.customer_id}:`, error.message);
        }
      }
    }

    logger.info(`✅ Seeded ${totalCustomers} customers`);
  }

  async seedProducts() {
    logger.info('📦 Seeding products...');
    
    const productFiles = [
      'pharmacy_products_001_025.csv',
      'pharmacy_products_026_050.csv',
      'pharmacy_products_051_075.csv',
      'pharmacy_products_076_100.csv'
    ];

    let totalProducts = 0;

    for (const filename of productFiles) {
      const filePath = path.join(this.dataDir, filename);
      
      if (!fs.existsSync(filePath)) {
        logger.warn(`⚠️ Product file not found: ${filename}`);
        continue;
      }

      const products = await this.readCSV(filePath);
      
      for (const product of products) {
        try {
          await this.insertProduct(product);
          totalProducts++;
        } catch (error) {
          logger.error(`Error inserting product ${product.id}:`, error.message);
        }
      }
    }

    logger.info(`✅ Seeded ${totalProducts} products`);
  }

  async seedPromotions() {
    logger.info('🎯 Seeding promotions...');
    
    const filePath = path.join(this.dataDir, 'pharmacy_promotions.csv');
    
    if (!fs.existsSync(filePath)) {
      logger.warn('⚠️ Promotions file not found');
      return;
    }

    const promotions = await this.readCSV(filePath);
    let totalPromotions = 0;

    for (const promotion of promotions) {
      try {
        await this.insertPromotion(promotion);
        totalPromotions++;
      } catch (error) {
        logger.error(`Error inserting promotion ${promotion.promotion_id}:`, error.message);
      }
    }

    logger.info(`✅ Seeded ${totalPromotions} promotions`);
  }

  async seedSalesHistory() {
    logger.info('💰 Seeding sales history...');
    
    const filePath = path.join(this.dataDir, 'pharmacy_customer_sales_history.csv');
    
    if (!fs.existsSync(filePath)) {
      logger.warn('⚠️ Sales history file not found');
      return;
    }

    const sales = await this.readCSV(filePath);
    let totalSales = 0;

    for (const sale of sales) {
      try {
        await this.insertSalesRecord(sale);
        totalSales++;
      } catch (error) {
        logger.error(`Error inserting sale ${sale.transaction_id}:`, error.message);
      }
    }

    logger.info(`✅ Seeded ${totalSales} sales records`);
  }

  async insertCustomer(customer) {
    const query = `
      INSERT INTO customers (
        customer_id, first_name, last_name, email, phone, date_of_birth,
        gender, address_line1, address_line2, city, state, zip_code, country,
        insurance_provider, insurance_id, emergency_contact_name, emergency_contact_phone,
        allergies, medical_conditions, preferred_language, registration_date,
        last_visit_date, total_purchases, loyalty_points, prescription_count,
        communication_preference, marketing_consent, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      ON CONFLICT (customer_id) DO NOTHING
    `;

    await DatabaseService.query(query, [
      customer.customer_id,
      customer.first_name,
      customer.last_name,
      customer.email,
      customer.phone,
      customer.date_of_birth || null,
      customer.gender,
      customer.address_line1,
      customer.address_line2,
      customer.city,
      customer.state,
      customer.zip_code || null,
      customer.country,
      customer.insurance_provider,
      customer.insurance_id,
      customer.emergency_contact_name,
      customer.emergency_contact_phone,
      customer.allergies,
      customer.medical_conditions,
      customer.preferred_language,
      customer.registration_date || new Date(),
      customer.last_visit_date || null,
      parseFloat(customer.total_purchases) || 0,
      parseInt(customer.loyalty_points) || 0,
      parseInt(customer.prescription_count) || 0,
      customer.communication_preference,
      customer.marketing_consent === 'TRUE' || customer.marketing_consent === 'true',
      customer.status
    ]);
  }

  async insertProduct(product) {
    const query = `
      INSERT INTO products (
        product_id, name, brand, category, subcategory, description,
        price, cost, stock_quantity, min_stock_level, prescription_required,
        dosage_form, strength, package_size, manufacturer, barcode,
        expiry_date, storage_conditions, active_ingredients, side_effects, contraindications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (product_id) DO NOTHING
    `;

    await DatabaseService.query(query, [
      product.id,
      product.name,
      product.brand,
      product.category,
      product.subcategory,
      product.description,
      parseFloat(product.price) || 0,
      parseFloat(product.cost) || 0,
      parseInt(product.stock_quantity) || 0,
      parseInt(product.min_stock_level) || 10,
      product.prescription_required === 'TRUE' || product.prescription_required === 'true',
      product.dosage_form,
      product.strength,
      product.package_size,
      product.manufacturer,
      product.barcode ? parseInt(product.barcode) : null,
      product.expiry_date || null,
      product.storage_conditions,
      product.active_ingredients,
      product.side_effects,
      product.contraindications
    ]);
  }

  async insertPromotion(promotion) {
    const query = `
      INSERT INTO promotions (
        promotion_id, name, description, type, category, start_date, end_date,
        discount_percentage, discount_amount, min_purchase_amount, max_discount_amount,
        applicable_products, applicable_categories, customer_segments,
        usage_limit_per_customer, total_usage_limit, current_usage,
        status, created_by, created_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (promotion_id) DO NOTHING
    `;

    await DatabaseService.query(query, [
      promotion.promotion_id,
      promotion.name,
      promotion.description,
      promotion.type,
      promotion.category,
      promotion.start_date,
      promotion.end_date,
      promotion.discount_percentage ? parseFloat(promotion.discount_percentage) : null,
      promotion.discount_amount ? parseFloat(promotion.discount_amount) : null,
      promotion.min_purchase_amount ? parseFloat(promotion.min_purchase_amount) : null,
      promotion.max_discount_amount ? parseFloat(promotion.max_discount_amount) : null,
      promotion.applicable_products,
      promotion.applicable_categories,
      promotion.customer_segments,
      parseInt(promotion.usage_limit_per_customer) || 1,
      parseInt(promotion.total_usage_limit) || 9999,
      parseInt(promotion.current_usage) || 0,
      promotion.status,
      promotion.created_by,
      promotion.created_date
    ]);
  }

  async insertSalesRecord(sale) {
    const query = `
      INSERT INTO sales_history (
        transaction_id, customer_id, transaction_date, product_id, product_name,
        category, quantity, unit_price, total_price, discount_applied,
        promotion_used, payment_method, prescription_number, pharmacist_id,
        insurance_covered, insurance_copay, loyalty_points_earned, loyalty_points_used,
        refill_number, original_prescription_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (transaction_id) DO NOTHING
    `;

    await DatabaseService.query(query, [
      sale.transaction_id,
      sale.customer_id,
      sale.transaction_date,
      sale.product_id,
      sale.product_name,
      sale.category,
      parseInt(sale.quantity) || 1,
      parseFloat(sale.unit_price) || 0,
      parseFloat(sale.total_price) || 0,
      parseFloat(sale.discount_applied) || 0,
      sale.promotion_used || null,
      sale.payment_method,
      sale.prescription_number || null,
      sale.pharmacist_id || null,
      sale.insurance_covered === 'TRUE' || sale.insurance_covered === 'true',
      parseFloat(sale.insurance_copay) || 0,
      parseInt(sale.loyalty_points_earned) || 0,
      parseInt(sale.loyalty_points_used) || 0,
      sale.refill_number ? parseInt(sale.refill_number) : null,
      sale.original_prescription_date || null,
      sale.notes
    ]);
  }

  readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}

// Run seeder if called directly
if (require.main === module) {
  const seeder = new DataSeeder();
  seeder.seedDatabase()
    .then(() => {
      logger.info('🎉 Database seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Database seeding failed:', error);
      process.exit(1);
    });
}

module.exports = DataSeeder;
