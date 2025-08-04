const TelegramBot = require('node-telegram-bot-api');
const AIAgentService = require('./AIAgentService');
const DatabaseService = require('./DatabaseService');
const ProductService = require('./ProductService');
const PromotionService = require('./PromotionService');
const logger = require('../utils/logger');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
    this.userSessions = new Map(); // Store user conversation state
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
      
      // Start session cleanup interval
      this.startSessionCleanup();
      
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

    // Handle contact sharing
    this.bot.on('contact', async (msg) => {
      try {
        await this.handleContactShare(msg);
      } catch (error) {
        logger.error('Error handling contact share:', error);
      }
    });

    // Handle location sharing
    this.bot.on('location', async (msg) => {
      try {
        await this.handleLocationShare(msg);
      } catch (error) {
        logger.error('Error handling location share:', error);
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
      { command: 'search', description: 'Search for specific products' },
      { command: 'orders', description: 'View your recent orders' },
      { command: 'prescriptions', description: 'Manage your prescriptions' },
      { command: 'promotions', description: 'View current promotions and discounts' },
      { command: 'contact', description: 'Get pharmacy contact information' },
      { command: 'nearest', description: 'Find nearest pharmacy location' },
      { command: 'profile', description: 'View and manage your profile' }
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

    this.bot.onText(/\/search(.*)/, async (msg, match) => {
      await this.handleSearchCommand(msg, match[1]?.trim());
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

    this.bot.onText(/\/contact/, async (msg) => {
      await this.handleContactCommand(msg);
    });

    this.bot.onText(/\/nearest/, async (msg) => {
      await this.handleNearestCommand(msg);
    });

    this.bot.onText(/\/profile/, async (msg) => {
      await this.handleProfileCommand(msg);
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

    // Update user session
    this.updateUserSession(chatId, msg.from, userMessage);

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
    const userName = msg.from.first_name || 'there';
    
    const welcomeMessage = `
🏥 **Welcome to PharmaCare Assistant, ${userName}!**

I'm your AI-powered pharmacy assistant, here to help you with:

💊 **Product Recommendations** - Find the right medications and health products
💰 **Best Prices** - Get discounts and promotions
📋 **Prescription Management** - Track refills and renewals
🚚 **Order Tracking** - Check your order status
❓ **Health Questions** - Get basic health information
📍 **Store Locations** - Find nearest pharmacy

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
          { text: '🔍 Search Products', callback_data: 'search_products' },
          { text: '📞 Contact Info', callback_data: 'contact_info' }
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

    // Initialize user session
    this.updateUserSession(chatId, msg.from);
  }

  async handleHelpCommand(msg) {
    const helpMessage = `
🆘 **PharmaCare Assistant Help**

**Available Commands:**
• /start - Start conversation
• /products - Browse products
• /search [item] - Search for specific products
• /orders - View recent orders
• /prescriptions - Manage prescriptions
• /promotions - Current offers
• /contact - Store information
• /nearest - Find nearest location
• /profile - Manage your profile

**What you can ask me:**
• "I need pain relief medication"
• "What's good for cold and flu?"
• "Show me vitamins on sale"
• "When is my prescription due?"
• "What's the price of aspirin?"

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

    await this.bot.sendMessage(msg.chat.id, '🏪 **Product Categories**\\n\\nChoose a category to browse:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleSearchCommand(msg, searchTerm) {
    const chatId = msg.chat.id;
    
    if (!searchTerm) {
      await this.bot.sendMessage(chatId, '🔍 What would you like to search for? Please type: /search [product name]');
      return;
    }

    await this.performProductSearch(chatId, searchTerm);
  }

  async performProductSearch(chatId, searchTerm) {
    try {
      await this.bot.sendMessage(chatId, `🔍 Searching for "${searchTerm}"...`);

      const products = await DatabaseService.searchProducts(searchTerm, 8);

      if (products.length === 0) {
        await this.bot.sendMessage(chatId, 
          `❌ No products found for "${searchTerm}". Try different keywords or browse our categories.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📋 Browse Categories', callback_data: 'browse_products' }
              ]]
            }
          }
        );
        return;
      }

      let message = `🔍 **Search Results for "${searchTerm}":**\n\n`;
      
      products.forEach((product, index) => {
        message += `${index + 1}. **${product.name}**\n`;
        message += `   💰 $${product.price}\n`;
        message += `   📦 ${product.category}\n`;
        if (product.description) {
          message += `   📝 ${product.description.substring(0, 80)}...\n`;
        }
        message += `\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🛒 Place Order', callback_data: 'place_order' },
            { text: '🔍 New Search', callback_data: 'search_products' }
          ],
          [
            { text: '📋 Browse Categories', callback_data: 'browse_products' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error('Error searching products:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, search is temporarily unavailable. Please try again later.');
    }
  }

  async handleContactCommand(msg) {
    const chatId = msg.chat.id;
    
    const contactMessage = `
📞 **PharmaCare Contact Information**

🏥 **Main Store:**
📍 123 Health Street, Medical District
📞 Phone: (555) 123-CARE
🕒 Hours: Mon-Fri 8AM-9PM, Sat 9AM-7PM, Sun 10AM-6PM

🚚 **Delivery Service:**
📞 (555) ORDER-RX
⏰ Same-day delivery available

💊 **Prescription Department:**
📞 (555) RX-REFILL
📧 prescriptions@pharmacare.com

🆘 **Emergency:**
📞 (555) 911-HELP
*For medical emergencies, call 911*

🌐 **Online:**
💻 www.pharmacare.com
📧 info@pharmacare.com

*How can we help you today?*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📍 Get Directions', callback_data: 'get_directions' },
          { text: '🛒 Place Order', callback_data: 'place_order' }
        ],
        [
          { text: '💊 Browse Products', callback_data: 'browse_products' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, contactMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleNearestCommand(msg) {
    const chatId = msg.chat.id;
    
    await this.bot.sendMessage(chatId, 
      '📍 To find the nearest pharmacy location, please share your location:', 
      {
        reply_markup: {
          keyboard: [[{
            text: '📍 Share Location',
            request_location: true
          }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      }
    );
  }

  async handleLocationShare(msg) {
    const chatId = msg.chat.id;
    const location = msg.location;
    
    // Remove location keyboard
    await this.bot.sendMessage(chatId, '📍 Location received! Finding nearest pharmacies...', {
      reply_markup: { remove_keyboard: true }
    });

    const nearestStores = `
📍 **Nearest PharmaCare Locations:**

1. **Main Pharmacy** (0.3 miles)
   📍 123 Health Street
   📞 (555) 123-CARE
   🕒 Open until 9PM
   
2. **Downtown Branch** (0.8 miles)
   📍 456 Main Avenue
   📞 (555) 456-CARE
   🕒 Open 24/7
   
3. **Medical Center** (1.2 miles)
   📍 789 Hospital Way
   📞 (555) 789-CARE
   🕒 Open until 8PM

*Tap a location for directions and more details.*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🗺️ Directions to Main', url: 'https://maps.google.com/?q=pharmacy' }
        ],
        [
          { text: '📞 Call Main Store', url: 'tel:+15551234567' },
          { text: '🛒 Order Online', callback_data: 'place_order' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, nearestStores, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleProfileCommand(msg) {
    const chatId = msg.chat.id;
    
    try {
      const customer = await this.getOrCreateCustomer(msg.from);
      
      const profileMessage = `
👤 **Your Profile**

📝 **Name:** ${customer.first_name} ${customer.last_name}
📧 **Email:** ${customer.email}
📞 **Phone:** ${customer.phone}
🗣️ **Language:** ${customer.preferred_language}
📅 **Member since:** ${new Date(customer.registration_date).toLocaleDateString()}
⭐ **Status:** ${customer.status}

*Want to update your information?*
      `;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✏️ Update Profile', callback_data: 'update_profile' },
            { text: '📞 Update Phone', callback_data: 'update_phone' }
          ],
          [
            { text: '🛒 Recent Orders', callback_data: 'recent_orders' },
            { text: '💊 My Prescriptions', callback_data: 'my_prescriptions' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, profileMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error('Error showing profile:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t load your profile right now.');
    }
  }

  async handleContactShare(msg) {
    const chatId = msg.chat.id;
    const contact = msg.contact;
    
    if (contact.user_id === msg.from.id) {
      // User shared their own contact
      try {
        await DatabaseService.query(
          'UPDATE customers SET phone = $1 WHERE telegram_id = $2',
          [contact.phone_number, msg.from.id.toString()]
        );
        
        await this.bot.sendMessage(chatId, '✅ Your phone number has been updated successfully!');
      } catch (error) {
        logger.error('Error updating phone number:', error);
        await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t update your phone number.');
      }
    }
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

      case 'search_products':
        await this.bot.sendMessage(chatId, '🔍 What would you like to search for? Just type the product name.');
        break;

      case 'contact_info':
        await this.handleContactCommand({ chat: { id: chatId } });
        break;

      case 'help':
        await this.handleHelpCommand({ chat: { id: chatId } });
        break;

      case 'place_order':
        await this.handleOrderProcess(chatId, customer.customer_id);
        break;

      case 'update_phone':
        await this.bot.sendMessage(chatId, '📞 Please share your contact to update your phone number:', {
          reply_markup: {
            keyboard: [[{
              text: '📞 Share Contact',
              request_contact: true
            }]],
            one_time_keyboard: true,
            resize_keyboard: true
          }
        });
        break;
        
      default:
        if (data.startsWith('category_')) {
          const category = data.replace('category_', '').replace('_', ' ');
          await this.showCategoryProducts(chatId, category);
        } else if (data.startsWith('order_')) {
          const productId = data.replace('order_', '');
          await this.handleProductOrder(chatId, productId, customer.customer_id);
        }
    }
  }

  async handleOrderProcess(chatId, customerId) {
    const orderMessage = `
🛒 **Place Your Order**

Choose how you'd like to order:

1️⃣ **Browse Products** - See our full catalog
2️⃣ **Search Specific Items** - Find exactly what you need
3️⃣ **Reorder Previous** - Quick reorder from history
4️⃣ **Prescription Refill** - Refill your medications

*Or just tell me what you need!*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💊 Browse Products', callback_data: 'browse_products' },
          { text: '🔍 Search Items', callback_data: 'search_products' }
        ],
        [
          { text: '🔄 Reorder Previous', callback_data: 'reorder_previous' },
          { text: '💊 Prescription Refill', callback_data: 'prescription_refill' }
        ],
        [
          { text: '📞 Call to Order', url: 'tel:+15551234567' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, orderMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async showCategoryProducts(chatId, category) {
    try {
      const products = await DatabaseService.getProductsByCategory(category, 10);
      
      if (products.length === 0) {
        await this.bot.sendMessage(chatId, `❌ No products found in category "${category}".`);
        return;
      }

      let message = `📋 **${category} Products:**\n\n`;
      
      products.forEach((product, index) => {
        message += `${index + 1}. **${product.name}**\n`;
        message += `   💰 Price: $${product.price}\n`;
        if (product.description) {
          message += `   📝 ${product.description.substring(0, 80)}...\n`;
        }
        message += `\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🛒 Place Order', callback_data: 'place_order' },
            { text: '📋 All Categories', callback_data: 'browse_products' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error('Error fetching category products:', error);
      await this.bot.sendMessage(chatId, `❌ Sorry, couldn't fetch products for category "${category}".`);
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
        
        if (promo.end_date) {
          message += `   📅 Valid until: ${new Date(promo.end_date).toLocaleDateString()}\n`;
        }
        message += `\n`;
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

  async showPrescriptions(chatId, customerId) {
    try {
      // This would integrate with your prescription management system
      const prescriptionMessage = `
💊 **Your Prescriptions**

📋 Currently, prescription management is being set up. In the meantime:

📞 **Call us:** (555) RX-REFILL
📧 **Email:** prescriptions@pharmacare.com
🌐 **Online:** www.pharmacare.com/prescriptions

**What we can help with:**
• Prescription refills
• Transfer prescriptions
• Medication reminders
• Insurance verification
• Dosage questions

*We'll notify you when online prescription management is ready!*
      `;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📞 Call Prescription Dept', url: 'tel:+15555551234' },
            { text: '🌐 Visit Website', url: 'https://pharmacare.com' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, prescriptionMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      logger.error('Error showing prescriptions:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t load your prescriptions right now.');
    }
  }

  updateUserSession(chatId, user, message = null) {
    const session = this.userSessions.get(chatId) || {
      userId: user.id,
      userName: user.first_name || 'User',
      lastActivity: new Date(),
      conversationHistory: []
    };

    session.lastActivity = new Date();
    
    if (message) {
      session.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Keep only last 20 messages
      if (session.conversationHistory.length > 20) {
        session.conversationHistory = session.conversationHistory.slice(-20);
      }
    }

    this.userSessions.set(chatId, session);
  }

  startSessionCleanup() {
    // Clean old sessions every hour
    setInterval(() => {
      this.cleanOldSessions();
    }, 60 * 60 * 1000);
  }

  cleanOldSessions() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [chatId, session] of this.userSessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.userSessions.delete(chatId);
        logger.info(`🧹 Cleaned old session for user: ${session.userName}`);
      }
    }
  }

  async getOrCreateCustomer(telegramUser) {
    try {
      // Try to find existing customer by Telegram ID
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

If the problem persists, you can contact our support team at (555) 123-CARE.
    `;

    await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
  }

  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.isInitialized = false;
      logger.info('✅ Telegram bot stopped');
    }
  }

  isActive() {
    return this.isInitialized;
  }
}

module.exports = TelegramBotService;
