# 🏥 Pharmacy AI Sales Agent

An intelligent pharmacy sales agent system that enables natural language interactions via WhatsApp/Telegram for product recommendations, price negotiations, and automated sales processing.

## 🎯 Features

- **Natural Language Processing**: Communicate with customers in natural language
- **Intelligent Product Recommendations**: AI-powered suggestions based on customer history
- **Dynamic Price Negotiations**: Automated discount applications and promotions
- **Multi-Channel Support**: WhatsApp and Telegram integration
- **Real-time Inventory**: Live product availability and pricing
- **Customer Analytics**: Purchase history and behavior analysis
- **Prescription Management**: Automated prescription refill reminders

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp/     │    │      N8N        │    │   PostgreSQL    │
│   Telegram Bot  │◄──►│   Workflow      │◄──►│   + pgvector    │
│                 │    │   Orchestrator  │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         └─────────────►│   OpenAI API    │◄─────────────┘
                        │  (GPT-4/Claude) │
                        └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- N8N account
- OpenAI API key
- WhatsApp Business API or Telegram Bot Token

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/chandratejatiriveedhi/pharmacy-ai-sales-agent.git
   cd pharmacy-ai-sales-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize database**
   ```bash
   npm run db:setup
   npm run db:seed
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Import N8N workflows**
   - Import workflows from `n8n-workflows/` directory
   - Configure credentials in N8N dashboard

## 📊 Database Schema

### Core Tables

- **customers**: Customer profiles and preferences
- **products**: Product catalog with pricing and inventory
- **promotions**: Active promotions and discount rules
- **sales_history**: Complete transaction records
- **conversations**: Chat history and context

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pharmacy_db

# APIs
OPENAI_API_KEY=your_openai_key
TELEGRAM_BOT_TOKEN=your_telegram_token
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token

# N8N
N8N_WEBHOOK_URL=your_n8n_webhook_url
N8N_API_KEY=your_n8n_api_key

# Application
PORT=3000
NODE_ENV=development
```

## 🤖 AI Agent Capabilities

### Conversation Features

- **Product Search**: "I need something for headaches"
- **Price Negotiation**: "Can you give me a better price?"
- **Prescription Refills**: "I need to refill my blood pressure medication"
- **Symptom-based Recommendations**: "I have a cold, what do you recommend?"
- **Bulk Purchase Discounts**: "I need to buy vitamins for my family"

### Intelligent Responses

- Context-aware conversations
- Customer history analysis
- Real-time inventory checks
- Automatic promotion applications
- Prescription verification

## 📱 Messaging Integration

### WhatsApp Business API

- Rich media messages
- Quick reply buttons
- Product catalogs
- Payment integration

### Telegram Bot

- Inline keyboards
- File attachments
- Group chat support
- Command-based interactions

## 🔄 N8N Workflows

### Available Workflows

1. **Customer Inquiry Handler** (`customer-inquiry.json`)
2. **Product Recommendation Engine** (`product-recommendations.json`)
3. **Price Negotiation Logic** (`price-negotiation.json`)
4. **Prescription Refill Automation** (`prescription-refills.json`)
5. **Inventory Management** (`inventory-management.json`)

### Workflow Features

- Automatic message routing
- Customer sentiment analysis
- Dynamic pricing calculations
- Inventory level monitoring
- Sales performance tracking

## 📈 Analytics & Reporting

### Available Metrics

- Customer satisfaction scores
- Conversion rates by channel
- Average order values
- Popular product categories
- Promotion effectiveness

### Dashboards

- Real-time sales monitoring
- Customer interaction analytics
- Inventory turnover reports
- Revenue performance tracking

## 🔒 Security & Compliance

### Data Protection

- HIPAA-compliant data handling
- Encrypted customer communications
- Secure API endpoints
- Audit logging

### Privacy Features

- Customer data anonymization
- Consent management
- Data retention policies
- GDPR compliance

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e
```

## 📦 Deployment

### Replit Deployment

1. Fork this repository to Replit
2. Set environment variables in Replit Secrets
3. Run the application

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring setup (health checks)
- [ ] Backup strategy implemented
- [ ] Load balancing configured

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/chandratejatiriveedhi/pharmacy-ai-sales-agent/wiki)
- **Issues**: [GitHub Issues](https://github.com/chandratejatiriveedhi/pharmacy-ai-sales-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/chandratejatiriveedhi/pharmacy-ai-sales-agent/discussions)

## 🔗 Related Projects

- [N8N Workflows](https://n8n.io)
- [OpenAI API](https://openai.com/api)
- [PostgreSQL](https://postgresql.org)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**Built with ❤️ for modern pharmacy automation**
