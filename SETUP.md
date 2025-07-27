# 🚀 Quick Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (or use Docker)
- OpenAI API key
- Telegram Bot Token and/or WhatsApp Business API access
- N8N account (optional for cloud, included in Docker setup)

## 📦 Installation Options

### Option 1: Docker Setup (Recommended)

1. **Clone and configure**
   ```bash
   git clone https://github.com/chandratejatiriveedhi/pharmacy-ai-sales-agent.git
   cd pharmacy-ai-sales-agent
   cp .env.example .env
   ```

2. **Edit environment variables in `.env`**
   ```bash
   # Essential configuration
   OPENAI_API_KEY=your_openai_api_key_here
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_token_here
   ```

3. **Add your CSV data**
   ```bash
   # Place your pharmacy data files in the data/ directory:
   # - pharmacy_customers_25.csv
   # - pharmacy_customers_26_75.csv  
   # - pharmacy_customers_76_100.csv
   # - pharmacy_products_001_025.csv
   # - pharmacy_products_026_050.csv
   # - pharmacy_products_051_075.csv
   # - pharmacy_products_076_100.csv
   # - pharmacy_promotions.csv (already included)
   # - pharmacy_customer_sales_history.csv
   ```

4. **Start the complete stack**
   ```bash
   docker-compose up -d
   ```

5. **Seed the database**
   ```bash
   docker-compose exec app npm run db:seed
   ```

6. **Access the applications**
   - **Main API**: http://localhost:3000
   - **N8N Workflows**: http://localhost:5678 (admin/pharmacy123)
   - **Database**: localhost:5432 (pharmacy_user/pharmacy_pass)

### Option 2: Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup PostgreSQL with pgvector**
   ```bash
   # Create database
   createdb pharmacy_db
   
   # Run schema
   psql pharmacy_db < database/schema.sql
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database and API credentials
   ```

4. **Seed database with your data**
   ```bash
   npm run db:seed
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Telegram Bot Setup

1. Create bot with @BotFather on Telegram
2. Get bot token and add to `.env`
3. Set webhook URL in N8N workflow

### WhatsApp Business API Setup

1. Set up WhatsApp Business API account
2. Get access token and phone number ID
3. Configure webhook endpoint

### N8N Workflow Import

1. Access N8N at http://localhost:5678
2. Import workflows from `n8n-workflows/` directory
3. Configure credentials for each service
4. Activate workflows

## 🧪 Testing

### Test AI Agent
```bash
curl -X POST http://localhost:3000/api/v1/ai-agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I need something for headaches", "customerId": "test-user"}'
```

### Test Telegram Bot
1. Find your bot on Telegram
2. Send `/start` command
3. Try natural language queries like "Show me pain relief products"

### Test WhatsApp (if configured)
1. Send message to your WhatsApp Business number
2. Bot should respond with product recommendations

## 📊 Data Management

### Your CSV Data Structure
- **Customers**: 100 customers with complete profiles
- **Products**: 100 pharmacy products with detailed information
- **Promotions**: 15 active promotions with various discount types
- **Sales History**: 100+ transactions linking customers and products

### Adding More Data
```bash
# Add new CSV files to data/ directory
# Run seeding script to import
npm run db:seed
```

## 🔍 Monitoring

### Health Checks
- **API Health**: http://localhost:3000/health
- **AI Agent Status**: http://localhost:3000/api/v1/ai-agent/health
- **Database**: Check connection in logs

### Logs
```bash
# View application logs
docker-compose logs -f app

# View N8N logs  
docker-compose logs -f n8n

# Local development logs
tail -f logs/combined.log
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart if needed
docker-compose restart postgres
```

**AI Agent Not Responding**
```bash
# Check OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Check logs for errors
docker-compose logs app | grep -i error
```

**N8N Workflows Not Working**
1. Check N8N credentials configuration
2. Verify webhook URLs are accessible
3. Test individual workflow nodes

**Bot Not Responding**
1. Verify bot tokens in environment variables
2. Check webhook configuration in N8N
3. Ensure firewall allows incoming webhooks

### Support Resources

- **GitHub Issues**: https://github.com/chandratejatiriveedhi/pharmacy-ai-sales-agent/issues
- **N8N Documentation**: https://docs.n8n.io
- **OpenAI API Docs**: https://platform.openai.com/docs

## 🎯 Next Steps

1. **Customize AI Prompts**: Edit `src/services/AIAgentService.js`
2. **Add More Products**: Update CSV files and re-seed database
3. **Configure Analytics**: Set up tracking for customer interactions
4. **Deploy to Production**: Use cloud services for scalability
5. **Add Payment Integration**: Connect to payment processors
6. **Implement Prescription Verification**: Add pharmacy compliance features

## 📈 Production Deployment

### Recommended Architecture
- **Application**: Deploy to Replit, Heroku, or cloud VPS
- **Database**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
- **N8N**: Use N8N Cloud or self-hosted instance
- **Monitoring**: Add Sentry for error tracking
- **Load Balancing**: Use Nginx or cloud load balancer

### Performance Optimization
- Enable Redis caching
- Implement database connection pooling
- Add CDN for static assets
- Configure log rotation
- Set up database indexing for large datasets

---

**🎉 Your pharmacy AI sales agent is ready to serve customers!**

Start testing with simple queries like:
- "I need something for allergies"
- "What vitamins do you recommend?"
- "Show me my recent orders"
- "Are there any current promotions?"
