-- Pharmacy AI Sales Agent Database Schema
-- PostgreSQL with pgvector extension for AI capabilities

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code INTEGER,
    country VARCHAR(100) DEFAULT 'USA',
    insurance_provider VARCHAR(255),
    insurance_id VARCHAR(255),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    allergies TEXT,
    medical_conditions TEXT,
    preferred_language VARCHAR(50) DEFAULT 'English',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_visit_date TIMESTAMP,
    total_purchases DECIMAL(10,2) DEFAULT 0.00,
    loyalty_points INTEGER DEFAULT 0,
    prescription_count INTEGER DEFAULT 0,
    communication_preference VARCHAR(50) DEFAULT 'Email',
    marketing_consent BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'Active',
    telegram_id VARCHAR(50),
    whatsapp_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 10,
    prescription_required BOOLEAN DEFAULT FALSE,
    dosage_form VARCHAR(100),
    strength VARCHAR(100),
    package_size VARCHAR(100),
    manufacturer VARCHAR(255),
    barcode BIGINT,
    expiry_date DATE,
    storage_conditions TEXT,
    active_ingredients TEXT,
    side_effects TEXT,
    contraindications TEXT,
    product_embedding VECTOR(1536), -- For AI-powered search
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    promotion_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- percentage, fixed_amount, buy_x_get_y, etc.
    category VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    min_purchase_amount DECIMAL(10,2),
    max_discount_amount DECIMAL(10,2),
    applicable_products TEXT, -- JSON array of product IDs
    applicable_categories TEXT, -- JSON array of categories
    customer_segments VARCHAR(255), -- comma-separated: seniors, new_customers, loyalty_members
    usage_limit_per_customer INTEGER DEFAULT 1,
    total_usage_limit INTEGER,
    current_usage INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_by VARCHAR(100),
    created_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales history table
CREATE TABLE IF NOT EXISTS sales_history (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    product_id VARCHAR(50),
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    discount_applied DECIMAL(10,2) DEFAULT 0.00,
    promotion_used VARCHAR(50),
    payment_method VARCHAR(50),
    prescription_number VARCHAR(100),
    pharmacist_id VARCHAR(50),
    insurance_covered BOOLEAN DEFAULT FALSE,
    insurance_copay DECIMAL(10,2) DEFAULT 0.00,
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_used INTEGER DEFAULT 0,
    refill_number INTEGER,
    original_prescription_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table for AI context
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    recent_messages JSONB,
    context_data JSONB,
    last_intent VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id)
);

-- Conversation logs for analytics
CREATE TABLE IF NOT EXISTS conversation_logs (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    intent VARCHAR(100),
    confidence DECIMAL(3,2),
    channel VARCHAR(50), -- telegram, whatsapp, web
    response_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product embeddings for vector search
CREATE TABLE IF NOT EXISTS product_embeddings (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- N8N workflow logs
CREATE TABLE IF NOT EXISTS workflow_logs (
    id SERIAL PRIMARY KEY,
    workflow_id VARCHAR(100),
    execution_id VARCHAR(100),
    customer_id VARCHAR(50),
    workflow_name VARCHAR(255),
    status VARCHAR(50), -- success, error, running
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics and metrics
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL, -- product_view, purchase, inquiry, etc.
    customer_id VARCHAR(50),
    product_id VARCHAR(50),
    channel VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_telegram_id ON customers(telegram_id);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp_phone ON customers(whatsapp_phone);

CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_description ON products USING gin(to_tsvector('english', description));

CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_date ON sales_history(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales_history(product_id);

CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_customer_id ON conversation_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_created_at ON conversation_logs(created_at);

-- Vector similarity index for product embeddings
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector 
ON product_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Foreign key constraints
ALTER TABLE sales_history 
ADD CONSTRAINT fk_sales_customer 
FOREIGN KEY (customer_id) REFERENCES customers(customer_id);

ALTER TABLE conversations 
ADD CONSTRAINT fk_conversations_customer 
FOREIGN KEY (customer_id) REFERENCES customers(customer_id);

ALTER TABLE conversation_logs 
ADD CONSTRAINT fk_conversation_logs_customer 
FOREIGN KEY (customer_id) REFERENCES customers(customer_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at 
    BEFORE UPDATE ON promotions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data views for analytics
CREATE OR REPLACE VIEW customer_analytics AS
SELECT 
    c.customer_id,
    c.first_name || ' ' || c.last_name as full_name,
    c.total_purchases,
    c.loyalty_points,
    c.prescription_count,
    COUNT(sh.id) as total_transactions,
    AVG(sh.total_price) as avg_order_value,
    MAX(sh.transaction_date) as last_purchase_date,
    DATE_PART('day', CURRENT_DATE - MAX(sh.transaction_date)) as days_since_last_purchase
FROM customers c
LEFT JOIN sales_history sh ON c.customer_id = sh.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.total_purchases, c.loyalty_points, c.prescription_count;

CREATE OR REPLACE VIEW product_analytics AS
SELECT 
    p.product_id,
    p.name,
    p.category,
    p.price,
    p.stock_quantity,
    COUNT(sh.id) as total_sales,
    SUM(sh.quantity) as total_quantity_sold,
    SUM(sh.total_price) as total_revenue,
    AVG(sh.total_price) as avg_sale_price
FROM products p
LEFT JOIN sales_history sh ON p.product_id = sh.product_id
GROUP BY p.product_id, p.name, p.category, p.price, p.stock_quantity;

-- Grant permissions (adjust as needed for your setup)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pharmacy_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pharmacy_user;

-- Insert initial admin/system data if needed
INSERT INTO customers (customer_id, first_name, last_name, email, status) 
VALUES ('SYSTEM', 'System', 'Administrator', 'admin@pharmacy.com', 'Active')
ON CONFLICT (customer_id) DO NOTHING;

COMMIT;
