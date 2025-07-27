const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

class DatabaseSeeder {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'pharmacy_db',
      user: process.env.DB_USER || 'pharmacy_user',
      password: process.env.DB_PASSWORD || 'pharmacy_pass',
      ssl: false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  async initialize() {
    console.log('🔄 Initializing database seeder...');
    
    try {
      const testResult = await this.pool.query('SELECT NOW() as current_time, version() as db_version');
      console.log('Database configuration:', {
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'pharmacy_db',
        user: process.env.DB_USER || 'pharmacy_user',
        ssl: false
      });
      console.log('Database connection test successful:', testResult.rows[0]);
      console.log('✅ Database seeder initialized');
    } catch (error) {
      console.error('❌ Failed to initialize database seeder:', error.message);
      throw error;
    }
  }

  // Helper function to safely handle dates
  cleanDate(dateValue) {
    if (!dateValue || dateValue === 'N/A' || dateValue === '' || dateValue === 'null' || dateValue === 'NULL') {
      return null;
    }
    return dateValue;
  }

  // Helper function to safely handle numbers
  cleanNumber(value) {
    if (!value || value === 'N/A' || value === '' || value === 'null') {
      return null;
    }
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  // Helper function to safely handle integers
  cleanInteger(value) {
    if (!value || value === 'N/A' || value === '' || value === 'null') {
      return null;
    }
    const num = parseInt(value);
    return isNaN(num) ? null : num;
  }

  // Helper function to safely handle booleans
  cleanBoolean(value) {
    if (!value || value === 'N/A' || value === '' || value === 'null') {
      return false;
    }
    return value === 'TRUE' || value === 'true' || value === '1' || value === 1;
  }

  async readCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const fullPath = path.join(__dirname, '..', 'data', filePath);
      
      console.log(`📖 Reading CSV file: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${fullPath}`);
        resolve([]);
        return;
      }

      fs.createReadStream(fullPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          console.log(`✅ Read ${results.length} rows from ${filePath}`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error(`❌ Error reading ${filePath}:`, error.message);
          reject(error);
        });
    });
  }

  async seedProducts() {
    console.log('\n🔄 Seeding products...');
    
    const productFiles = [
      'pharmacy_products_026_050.csv',
      'pharmacy_products_051_075.csv',
      'pharmacy_products_076_100.csv'
    ];
    
    let allProducts = [];
    for (const file of productFiles) {
      try {
        const products = await this.readCSV(file);
        allProducts = allProducts.concat(products);
      } catch (error) {
        console.log(`⚠️  Skipping ${file}: ${error.message}`);
      }
    }
    
    if (allProducts.length === 0) {
      console.log('⚠️  No product data found');
      return;
    }

    console.log(`📦 Found ${allProducts.length} products to process`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const product of allProducts) {
      try {
        const query = `
          INSERT INTO products (
            product_id, name, brand, category, subcategory, description,
            price, cost, stock_quantity, min_stock_level, prescription_required,
            dosage_form, strength, package_size, manufacturer, barcode,
            expiry_date, storage_conditions, active_ingredients, side_effects, contraindications
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          ) ON CONFLICT (product_id) DO NOTHING
        `;
        
        const values = [
          product.id, // Using 'id' from CSV as product_id
          product.name,
          product.brand || null,
          product.category,
          product.subcategory || null,
          product.description || null,
          this.cleanNumber(product.price),
          this.cleanNumber(product.cost),
          this.cleanInteger(product.stock_quantity),
          this.cleanInteger(product.min_stock_level),
          this.cleanBoolean(product.prescription_required),
          product.dosage_form || null,
          product.strength || null,
          product.package_size || null,
          product.manufacturer || null,
          this.cleanInteger(product.barcode),
          this.cleanDate(product.expiry_date), // This is the critical fix!
          product.storage_conditions || null,
          product.active_ingredients || null,
          product.side_effects || null,
          product.contraindications || null
        ];
        
        const result = await this.pool.query(query, values);
        if (result.rowCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
        
        if ((inserted + skipped) % 10 === 0) {
          console.log(`📦 Processed ${inserted + skipped}/${allProducts.length} products (${inserted} new, ${skipped} skipped)`);
        }
      } catch (error) {
        console.log(`⚠️  Error with product ${product.id}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`✅ Products seeding complete: ${inserted} inserted, ${skipped} skipped`);
  }

  async seedCustomers() {
    console.log('\n🔄 Seeding customers...');
    
    const customerFiles = [
      'pharmacy_customers_25.csv',
      'pharmacy_customers_26_75.csv',
      'pharmacy_customers_76_100.csv'
    ];
    
    let allCustomers = [];
    for (const file of customerFiles) {
      try {
        const customers = await this.readCSV(file);
        allCustomers = allCustomers.concat(customers);
      } catch (error) {
        console.log(`⚠️  Skipping ${file}: ${error.message}`);
      }
    }
    
    if (allCustomers.length === 0) {
      console.log('⚠️  No customer data found');
      return;
    }

    console.log(`📦 Found ${allCustomers.length} customers to process`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const customer of allCustomers) {
      try {
        const query = `
          INSERT INTO customers (
            customer_id, first_name, last_name, email, phone,
            date_of_birth, gender, address_line1, address_line2,
            city, state, zip_code, country, insurance_provider,
            insurance_id, emergency_contact_name, emergency_contact_phone,
            allergies, medical_conditions, preferred_language,
            registration_date, last_visit_date, total_purchases,
            loyalty_points, prescription_count, communication_preference,
            marketing_consent, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28
          ) ON CONFLICT (customer_id) DO NOTHING
        `;
        
        const values = [
          customer.customer_id,
          customer.first_name,
          customer.last_name,
          customer.email,
          customer.phone,
          this.cleanDate(customer.date_of_birth),
          customer.gender,
          customer.address_line1,
          customer.address_line2 || null,
          customer.city,
          customer.state,
          this.cleanInteger(customer.zip_code),
          customer.country,
          customer.insurance_provider || null,
          customer.insurance_id || null,
          customer.emergency_contact_name || null,
          customer.emergency_contact_phone || null,
          customer.allergies || null,
          customer.medical_conditions || null,
          customer.preferred_language || 'English',
          this.cleanDate(customer.registration_date),
          this.cleanDate(customer.last_visit_date),
          this.cleanNumber(customer.total_purchases),
          this.cleanInteger(customer.loyalty_points),
          this.cleanInteger(customer.prescription_count),
          customer.communication_preference || 'Email',
          this.cleanBoolean(customer.marketing_consent),
          customer.status || 'Active'
        ];
        
        const result = await this.pool.query(query, values);
        if (result.rowCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
        
        if ((inserted + skipped) % 25 === 0) {
          console.log(`📦 Processed ${inserted + skipped}/${allCustomers.length} customers`);
        }
      } catch (error) {
        console.log(`⚠️  Error with customer ${customer.customer_id}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`✅ Customers seeding complete: ${inserted} inserted, ${skipped} skipped`);
  }

  async seedPromotions() {
    console.log('\n🔄 Seeding promotions...');
    
    try {
      const promotions = await this.readCSV('pharmacy_promotions.csv');
      
      if (promotions.length === 0) {
        console.log('⚠️  No promotion data found');
        return;
      }

      console.log(`📦 Found ${promotions.length} promotions to process`);
      
      let inserted = 0;
      let skipped = 0;
      
      for (const promotion of promotions) {
        try {
          const query = `
            INSERT INTO promotions (
              promotion_id, name, description, type, category,
              start_date, end_date, discount_percentage, discount_amount,
              min_purchase_amount, max_discount_amount, applicable_products,
              applicable_categories, customer_segments, usage_limit_per_customer,
              total_usage_limit, current_usage, status, created_by, created_date
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) ON CONFLICT (promotion_id) DO NOTHING
          `;
          
          const values = [
            promotion.promotion_id,
            promotion.name,
            promotion.description || null,
            promotion.type,
            promotion.category || null,
            this.cleanDate(promotion.start_date),
            this.cleanDate(promotion.end_date),
            this.cleanNumber(promotion.discount_percentage),
            this.cleanNumber(promotion.discount_amount),
            this.cleanNumber(promotion.min_purchase_amount),
            this.cleanNumber(promotion.max_discount_amount),
            promotion.applicable_products || null,
            promotion.applicable_categories || null,
            promotion.customer_segments || null,
            this.cleanInteger(promotion.usage_limit_per_customer),
            this.cleanInteger(promotion.total_usage_limit),
            this.cleanInteger(promotion.current_usage),
            promotion.status || 'active',
            promotion.created_by || null,
            this.cleanDate(promotion.created_date)
          ];
          
          const result = await this.pool.query(query, values);
          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.log(`⚠️  Error with promotion ${promotion.promotion_id}: ${error.message}`);
          skipped++;
        }
      }
      
      console.log(`✅ Promotions seeding complete: ${inserted} inserted, ${skipped} skipped`);
    } catch (error) {
      console.log(`⚠️  Error seeding promotions: ${error.message}`);
    }
  }

  async seedSalesHistory() {
    console.log('\n🔄 Seeding sales history...');
    
    try {
      const salesHistory = await this.readCSV('pharmacy_customer_sales_history.csv');
      
      if (salesHistory.length === 0) {
        console.log('⚠️  No sales history data found');
        return;
      }

      console.log(`📦 Found ${salesHistory.length} sales transactions to process`);
      
      let inserted = 0;
      let skipped = 0;
      
      for (const sale of salesHistory) {
        try {
          const query = `
            INSERT INTO sales_history (
              transaction_id, customer_id, transaction_date, product_id, product_name,
              category, quantity, unit_price, total_price, discount_applied,
              promotion_used, payment_method, prescription_number, pharmacist_id,
              insurance_covered, insurance_copay, loyalty_points_earned, loyalty_points_used,
              refill_number, original_prescription_date, notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            ) ON CONFLICT (transaction_id) DO NOTHING
          `;
          
          const values = [
            sale.transaction_id,
            sale.customer_id,
            this.cleanDate(sale.transaction_date),
            sale.product_id,
            sale.product_name,
            sale.category || null,
            this.cleanInteger(sale.quantity),
            this.cleanNumber(sale.unit_price),
            this.cleanNumber(sale.total_price),
            this.cleanNumber(sale.discount_applied),
            sale.promotion_used || null,
            sale.payment_method || null,
            sale.prescription_number || null,
            sale.pharmacist_id || null,
            this.cleanBoolean(sale.insurance_covered),
            this.cleanNumber(sale.insurance_copay),
            this.cleanInteger(sale.loyalty_points_earned),
            this.cleanInteger(sale.loyalty_points_used),
            this.cleanNumber(sale.refill_number),
            this.cleanDate(sale.original_prescription_date),
            sale.notes || null
          ];
          
          const result = await this.pool.query(query, values);
          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
          
          if ((inserted + skipped) % 25 === 0) {
            console.log(`📦 Processed ${inserted + skipped}/${salesHistory.length} sales records`);
          }
        } catch (error) {
          console.log(`⚠️  Error with transaction ${sale.transaction_id}: ${error.message}`);
          skipped++;
        }
      }
      
      console.log(`✅ Sales history seeding complete: ${inserted} inserted, ${skipped} skipped`);
    } catch (error) {
      console.log(`⚠️  Error seeding sales history: ${error.message}`);
    }
  }

  async run() {
    try {
      await this.initialize();
      
      console.log('\n🌱 Starting database seeding process...');
      
      await this.seedCustomers();
      await this.seedProducts();
      await this.seedPromotions();
      await this.seedSalesHistory();
      
      console.log('\n🎉 Database seeding completed successfully!');
      console.log('\n📊 Final Summary:');
      
      // Show final counts
      const customerCount = await this.pool.query('SELECT COUNT(*) FROM customers');
      const productCount = await this.pool.query('SELECT COUNT(*) FROM products');
      const promotionCount = await this.pool.query('SELECT COUNT(*) FROM promotions');
      const salesCount = await this.pool.query('SELECT COUNT(*) FROM sales_history');
      
      console.log(`   👥 Total Customers: ${customerCount.rows[0].count}`);
      console.log(`   📦 Total Products: ${productCount.rows[0].count}`);
      console.log(`   🏷️  Total Promotions: ${promotionCount.rows[0].count}`);
      console.log(`   💰 Total Sales Records: ${salesCount.rows[0].count}`);
      
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// Run the seeder
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DatabaseSeeder;