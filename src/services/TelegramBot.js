const TelegramBot = require('node-telegram-bot-api');
const AIAgentService = require('./AIAgentService');
const DatabaseService = require('./DatabaseService');
const logger = require('../utils/logger');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN not provided');
      }

      this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
        polling: true,
        request: {
          agentOptions: {
            keepAlive: true,
            family: 4
          }
        }
      });

      await this.setupEventHandlers();
      await this.setupCommands();
      
      this.isInitialized = true;
      logger.info('✅ Telegram bot initialized successfully');
      
    } catch (error) {
      logger.error('❌ Telegram bot initialization failed:', error);
      throw error;
    }
  }

  async setupEventHandlers() {
    // Handle text messages
    this.bot.on('message', async (msg) => {
      try {
        if (msg.text && !msg.text.startsWith('/')) {
          await this.handleTextMessage(msg);
        }
      } catch (error) {
        logger.error('Error handling Telegram message:', error);
        await this.sendErrorMessage(msg.chat.id);
      }
    });

    // Handle callback queries (inline keyboard buttons)
    this.bot.on('callback_query', async (query) => {
      try {
        await this.handleCallbackQuery(query);
      } catch (error) {
        logger.error('Error handling callback query:', error);
      }
    });

    // Handle errors
    this.bot.on('error', (error) => {
      logger.error('Telegram bot error:', error);
    });

    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error:', error);
    });
  }

  async setupCommands() {
    const commands = [
      { command: 'start', description: 'Start conversation with pharmacy assistant' },
      { command: 'help', description: 'Get help and available commands' },
      { command: 'products', description: 'Browse available products' },
      { command: 'orders', description: 'View your recent orders' },
      { command: 'prescriptions', description: 'Manage your prescriptions' },
      { command: 'promotions', description: 'View current promotions and discounts' }
    ];

    await this.bot.setMyCommands(commands);
    
    // Command handlers
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStartCommand(msg);
    });

    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelpCommand(msg);
    });

    this.bot.onText(/\/products/, async (msg) => {
      await this.handleProductsCommand(msg);
    });

    this.bot.onText(/\/orders/, async (msg) => {
      await this.handleOrdersCommand(msg);
    });

    this.bot.onText(/\/prescriptions/, async (msg) => {
      await this.handlePrescriptionsCommand(msg);
    });

    this.bot.onText(/\/promotions/, async (msg) => {
      await this.handlePromotionsCommand(msg);
    });
  }

  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userMessage = msg.text;

    logger.info(`Telegram message from ${userId}: ${userMessage}`);

    // Show typing indicator
    await this.bot.sendChatAction(chatId, 'typing');

    // Get or create customer
    const customer = await this.getOrCreateCustomer(msg.from);

    // Process message with AI agent
    const response = await AIAgentService.processMessage(
      customer.customer_id, 
      userMessage, 
      'telegram'
    );

    // Send response
    await this.sendResponse(chatId, response);
  }

  async handleStartCommand(msg) {
    const chatId = msg.chat.id;
    const welcomeMessage = `
🏥 **Welcome to Pharmacy Assistant!**

I'm your AI-powered pharmacy assistant, here to help you with:

💊 **Product Recommendations** - Find the right medications and health products
💰 **Best Prices** - Get discounts and promotions
📋 **Prescription Management** - Track refills and renewals
🚚 **Order Tracking** - Check your order status
❓ **Health Questions** - Get basic health information

Just type your question or need, and I'll help you right away!

*Example: "I need something for headaches" or "Show me my recent orders"*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💊 Browse Products', callback_data: 'browse_products' },
          { text: '💰 View Promotions', callback_data: 'view_promotions' }
        ],
        [
          { text: '📋 My Prescriptions', callback_data: 'my_prescriptions' },
          { text: '🛒 Recent Orders', callback_data: 'recent_orders' }
        ],
        [
          { text: '❓ Help', callback_data: 'help' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleHelpCommand(msg) {
    const helpMessage = `
🆘 **How can I help you?**

**Available Commands:**
• /start - Start conversation
• /products - Browse products
• /orders - View recent orders
• /prescriptions - Manage prescriptions
• /promotions - Current offers

**What you can ask me:**
• "I need pain relief medication"
• "What's good for cold and flu?"
• "Show me vitamins on sale"
• "When is my prescription due?"
• "What's the price of [product name]?"

**Tips:**
✅ Be specific about your needs
✅ Mention symptoms for better recommendations
✅ Ask about bulk discounts
✅ I can help with product comparisons

Just type your question naturally - I understand regular language! 😊
    `;

    await this.bot.sendMessage(msg.chat.id, helpMessage, {
      parse_mode: 'Markdown'
    });
  }

  async handleProductsCommand(msg) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '💊 Medications', callback_data: 'category_medications' },
          { text: '🌿 Supplements', callback_data: 'category_supplements' }
        ],
        [
          { text: '🩹 First Aid', callback_data: 'category_first_aid' },
          { text: '👁️ Eye Care', callback_data: 'category_eye_care' }
        ],
        [
          { text: '🦷 Oral Care', callback_data: 'category_oral_care' },
          { text: '🧴 Personal Care', callback_data: 'category_personal_care' }
        ],
        [
          { text: '🔍 Search Products', callback_data: 'search_products' }
        ]
      ]
    };

    await this.bot.sendMessage(msg.chat.id, '🏪 **Product Categories**\n\nChoose a category to browse:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id.toString();

    // Acknowledge the callback query
    await this.bot.answerCallbackQuery(query.id);

    // Get customer
    const customer = await this.getOrCreateCustomer(query.from);

    switch (data) {
      case 'browse_products':
        await this.handleProductsCommand({ chat: { id: chatId } });
        break;
        
      case 'view_promotions':
        await this.showPromotions(chatId, customer.customer_id);
        break;
        
      case 'my_prescriptions':
        await this.showPrescriptions(chatId, customer.customer_id);
        break;
        
      case 'recent_orders':
        await this.showRecentOrders(chatId, customer.customer_id);
        break;
        
      default:
        if (data.startsWith('category_')) {
          const category = data.replace('category_', '').replace('_', ' ');
          await this.showCategoryProducts(chatId, category);
        }
    }
  }

  async showPromotions(chatId, customerId) {
    try {
      const promotions = await DatabaseService.getActivePromotions();
      
      if (promotions.length === 0) {
        await this.bot.sendMessage(chatId, '📢 No active promotions at the moment. Check back soon!');
        return;
      }

      let message = '💰 **Current Promotions & Discounts**\n\n';
      
      promotions.slice(0, 5).forEach((promo, index) => {
        message += `${index + 1}. **${promo.name}**\n`;
        message += `   ${promo.description}\n`;
        
        if (promo.discount_percentage) {
          message += `   💸 ${promo.discount_percentage}% OFF\n`;
        } else if (promo.discount_amount) {
          message += `   💸 $${promo.discount_amount} OFF\n`;
        }
        
        message += `   📅 Valid until: ${new Date(promo.end_date).toLocaleDateString()}\n\n`;
      });

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error('Error showing promotions:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t load the promotions right now.');
    }
  }

  async showRecentOrders(chatId, customerId) {
    try {
      const orders = await DatabaseService.getCustomerPurchaseHistory(customerId, 5);
      
      if (orders.length === 0) {
        await this.bot.sendMessage(chatId, '🛒 You don\'t have any recent orders. Start shopping to see your orders here!');
        return;
      }

      let message = '🛒 **Your Recent Orders**\n\n';
      
      orders.forEach((order, index) => {
        message += `${index + 1}. **${order.product_name}**\n`;
        message += `   💰 $${order.total_price}\n`;
        message += `   📅 ${new Date(order.transaction_date).toLocaleDateString()}\n\n`;
      });

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error('Error showing recent orders:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t load your orders right now.');
    }
  }

  async sendResponse(chatId, response) {
    try {
      let message = response.response;
      
      // Add quick action buttons if relevant
      let keyboard = null;
      
      if (response.intent === 'product_search' && response.actions?.length > 0) {
        const products = response.actions.find(a => a.type === 'product_search')?.data || [];
        
        if (products.length > 0) {
          keyboard = {
            inline_keyboard: products.slice(0, 3).map(product => [{
              text: `🛒 Order ${product.name} - $${product.price}`,
              callback_data: `order_${product.id}`
            }])
          };
        }
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      logger.error('Error sending response:', error);
      await this.sendErrorMessage(chatId);
    }
  }

  async sendErrorMessage(chatId) {
    const errorMessage = `
❌ **Oops! Something went wrong**

I'm having trouble processing your request right now. Please try:

• Rephrasing your question
• Using simpler terms
• Trying again in a moment

If the problem persists, you can contact our support team.
    `;

    await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
  }

  async getOrCreateCustomer(telegramUser) {
    try {
      // Try to find existing customer by Telegram ID or phone
      let customer = await DatabaseService.query(
        'SELECT * FROM customers WHERE telegram_id = $1', 
        [telegramUser.id.toString()]
      );

      if (customer.rows.length > 0) {
        return customer.rows[0];
      }

      // Create new customer
      const customerId = `CUST-TG-${Date.now()}`;
      const newCustomer = {
        customer_id: customerId,
        first_name: telegramUser.first_name || 'Telegram',
        last_name: telegramUser.last_name || 'User',
        email: `${customerId}@telegram.user`,
        phone: telegramUser.username ? `@${telegramUser.username}` : customerId,
        telegram_id: telegramUser.id.toString(),
        preferred_language: telegramUser.language_code || 'English',
        communication_preference: 'Telegram'
      };

      const result = await DatabaseService.query(`
        INSERT INTO customers (
          customer_id, first_name, last_name, email, phone, telegram_id,
          preferred_language, communication_preference, registration_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'Active')
        RETURNING *
      `, [
        newCustomer.customer_id, newCustomer.first_name, newCustomer.last_name,
        newCustomer.email, newCustomer.phone, newCustomer.telegram_id,
        newCustomer.preferred_language, newCustomer.communication_preference
      ]);

      logger.info(`Created new Telegram customer: ${customerId}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Error getting/creating customer:', error);
      throw error;
    }
  }

  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.isInitialized = false;
      logger.info('✅ Telegram bot stopped');
    }
  }
}

module.exports = TelegramBotService;
