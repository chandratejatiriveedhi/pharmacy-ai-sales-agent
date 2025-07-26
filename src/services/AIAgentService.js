const OpenAI = require('openai');
const DatabaseService = require('./DatabaseService');
const CustomerService = require('./CustomerService');
const ProductService = require('./ProductService');
const PromotionService = require('./PromotionService');
const logger = require('../utils/logger');

class AIAgentService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Conversation context storage
    this.conversations = new Map();
    
    // AI configuration
    this.config = {
      model: process.env.AI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    };

    // Initialize system prompt
    this.systemPrompt = this.buildSystemPrompt();
  }

  buildSystemPrompt() {
    return `You are a helpful and knowledgeable pharmacy sales assistant. Your role is to:

1. **Product Recommendations**: Help customers find the right medications and health products based on their needs
2. **Price Negotiations**: Offer appropriate discounts and promotions while maintaining profitability
3. **Health Guidance**: Provide basic health information while emphasizing the need for professional medical advice
4. **Customer Service**: Maintain a friendly, professional, and empathetic tone

**IMPORTANT GUIDELINES:**
- Always prioritize customer safety and health
- Never provide medical diagnosis or replace professional medical advice
- For prescription medications, always verify prescription requirements
- Apply promotions and discounts when applicable
- Maintain customer privacy and confidentiality
- Be transparent about pricing and product information

**AVAILABLE FUNCTIONS:**
- Search products by name, category, or symptoms
- Check customer purchase history and preferences
- Apply promotions and calculate discounts
- Check inventory and availability
- Process orders and payments

**CONVERSATION STYLE:**
- Be conversational and friendly
- Ask clarifying questions when needed
- Provide multiple options when appropriate
- Explain benefits and potential side effects
- Always confirm orders before processing

Remember: You're here to help customers make informed decisions about their health and wellness needs.`;
  }

  async processMessage(customerId, message, channel = 'web') {
    try {
      logger.info(`Processing message from customer ${customerId} via ${channel}`);

      // Get or create conversation context
      const conversation = await this.getConversationContext(customerId);
      
      // Analyze message intent and extract entities
      const messageAnalysis = await this.analyzeMessage(message, conversation);
      
      // Execute appropriate actions based on intent
      const actionResults = await this.executeActions(messageAnalysis, customerId);
      
      // Generate AI response
      const response = await this.generateResponse(message, conversation, actionResults);
      
      // Update conversation context
      await this.updateConversationContext(customerId, message, response, messageAnalysis);
      
      // Log conversation for analytics
      await this.logConversation(customerId, message, response, channel);
      
      return {
        response: response.content,
        intent: messageAnalysis.intent,
        confidence: messageAnalysis.confidence,
        actions: actionResults,
        metadata: {
          tokensUsed: response.usage?.total_tokens || 0,
          model: this.config.model,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Error processing message:', error);
      return {
        response: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or contact our support team if the issue persists.",
        error: error.message
      };
    }
  }

  async analyzeMessage(message, conversation) {
    try {
      const analysisPrompt = `
Analyze this customer message and extract:
1. Primary intent (product_search, price_negotiation, prescription_refill, general_inquiry, complaint, order_status)
2. Confidence level (0-1)
3. Extracted entities (product names, symptoms, quantities, etc.)
4. Customer sentiment (positive, neutral, negative)
5. Urgency level (low, medium, high)

Message: "${message}"
Previous context: ${JSON.stringify(conversation.recent_messages?.slice(-3) || [])}

Respond in JSON format.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing message:', error);
      return {
        intent: 'general_inquiry',
        confidence: 0.5,
        entities: [],
        sentiment: 'neutral',
        urgency: 'low'
      };
    }
  }

  async executeActions(messageAnalysis, customerId) {
    const actions = [];
    
    try {
      switch (messageAnalysis.intent) {
        case 'product_search':
          const products = await this.searchProducts(messageAnalysis.entities);
          actions.push({ type: 'product_search', data: products });
          break;
          
        case 'price_negotiation':
          const promotions = await this.findApplicablePromotions(customerId, messageAnalysis.entities);
          actions.push({ type: 'promotions', data: promotions });
          break;
          
        case 'prescription_refill':
          const prescriptions = await this.getPrescriptionHistory(customerId);
          actions.push({ type: 'prescriptions', data: prescriptions });
          break;
          
        case 'order_status':
          const orders = await this.getRecentOrders(customerId);
          actions.push({ type: 'orders', data: orders });
          break;
      }

      // Always get customer context
      const customer = await CustomerService.getCustomerById(customerId);
      actions.push({ type: 'customer_context', data: customer });

    } catch (error) {
      logger.error('Error executing actions:', error);
      actions.push({ type: 'error', data: { message: error.message } });
    }

    return actions;
  }

  async generateResponse(message, conversation, actions) {
    try {
      // Build context for AI
      const contextData = this.buildContextForAI(actions);
      
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'system', content: `Available data: ${JSON.stringify(contextData)}` },
        ...conversation.recent_messages?.slice(-5) || [],
        { role: 'user', content: message }
      ];

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      });

      return {
        content: response.choices[0].message.content,
        usage: response.usage
      };

    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw new Error('Failed to generate response');
    }
  }

  buildContextForAI(actions) {
    const context = {};
    
    actions.forEach(action => {
      switch (action.type) {
        case 'product_search':
          context.available_products = action.data;
          break;
        case 'promotions':
          context.applicable_promotions = action.data;
          break;
        case 'prescriptions':
          context.prescription_history = action.data;
          break;
        case 'customer_context':
          context.customer_info = {
            name: action.data?.first_name + ' ' + action.data?.last_name,
            loyalty_points: action.data?.loyalty_points,
            total_purchases: action.data?.total_purchases,
            preferred_language: action.data?.preferred_language
          };
          break;
      }
    });

    return context;
  }

  async searchProducts(entities) {
    try {
      let products = [];
      
      // Search by product names
      if (entities.products?.length > 0) {
        for (const productName of entities.products) {
          const found = await ProductService.searchProducts(productName);
          products = products.concat(found);
        }
      }
      
      // Search by symptoms
      if (entities.symptoms?.length > 0) {
        for (const symptom of entities.symptoms) {
          const found = await ProductService.searchBySymptom(symptom);
          products = products.concat(found);
        }
      }
      
      // Search by category
      if (entities.categories?.length > 0) {
        for (const category of entities.categories) {
          const found = await ProductService.getProductsByCategory(category);
          products = products.concat(found);
        }
      }

      // Remove duplicates and limit results
      const uniqueProducts = products.filter((product, index, self) => 
        index === self.findIndex(p => p.id === product.id)
      ).slice(0, 10);

      return uniqueProducts;
    } catch (error) {
      logger.error('Error searching products:', error);
      return [];
    }
  }

  async findApplicablePromotions(customerId, entities) {
    try {
      const customer = await CustomerService.getCustomerById(customerId);
      const activePromotions = await PromotionService.getActivePromotions();
      
      // Filter promotions based on customer segment and product entities
      const applicablePromotions = activePromotions.filter(promo => {
        // Check customer segment eligibility
        if (promo.customer_segments && promo.customer_segments !== 'all') {
          return this.checkCustomerSegmentEligibility(customer, promo.customer_segments);
        }
        return true;
      });

      return applicablePromotions.slice(0, 5);
    } catch (error) {
      logger.error('Error finding promotions:', error);
      return [];
    }
  }

  checkCustomerSegmentEligibility(customer, segments) {
    const customerAge = this.calculateAge(customer.date_of_birth);
    
    if (segments.includes('seniors') && customerAge >= 65) return true;
    if (segments.includes('new_customers') && customer.registration_date > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) return true;
    if (segments.includes('loyalty_members') && customer.loyalty_points > 100) return true;
    
    return false;
  }

  calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  async getPrescriptionHistory(customerId) {
    try {
      const query = `
        SELECT DISTINCT product_name, prescription_number, original_prescription_date, refill_number
        FROM sales_history 
        WHERE customer_id = $1 AND prescription_number IS NOT NULL
        ORDER BY original_prescription_date DESC
        LIMIT 10
      `;
      
      const result = await DatabaseService.query(query, [customerId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting prescription history:', error);
      return [];
    }
  }

  async getRecentOrders(customerId) {
    try {
      const query = `
        SELECT transaction_id, transaction_date, product_name, total_price, notes
        FROM sales_history 
        WHERE customer_id = $1
        ORDER BY transaction_date DESC
        LIMIT 5
      `;
      
      const result = await DatabaseService.query(query, [customerId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting recent orders:', error);
      return [];
    }
  }

  async getConversationContext(customerId) {
    try {
      // Check memory cache first
      if (this.conversations.has(customerId)) {
        return this.conversations.get(customerId);
      }

      // Load from database
      const query = `
        SELECT * FROM conversations 
        WHERE customer_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      const result = await DatabaseService.query(query, [customerId]);
      
      const context = result.rows[0] || {
        customer_id: customerId,
        recent_messages: [],
        context_data: {},
        created_at: new Date()
      };

      this.conversations.set(customerId, context);
      return context;
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      return { customer_id: customerId, recent_messages: [], context_data: {} };
    }
  }

  async updateConversationContext(customerId, userMessage, aiResponse, analysis) {
    try {
      const context = this.conversations.get(customerId) || { recent_messages: [] };
      
      // Add new messages to context
      context.recent_messages = context.recent_messages || [];
      context.recent_messages.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse.content }
      );
      
      // Keep only last 10 messages
      if (context.recent_messages.length > 10) {
        context.recent_messages = context.recent_messages.slice(-10);
      }
      
      // Update context data
      context.last_intent = analysis.intent;
      context.last_updated = new Date();
      
      // Save to memory
      this.conversations.set(customerId, context);
      
      // Save to database
      await this.saveConversationContext(customerId, context);
      
    } catch (error) {
      logger.error('Error updating conversation context:', error);
    }
  }

  async saveConversationContext(customerId, context) {
    try {
      const query = `
        INSERT INTO conversations (customer_id, recent_messages, context_data, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (customer_id) 
        DO UPDATE SET 
          recent_messages = $2,
          context_data = $3,
          updated_at = $4
      `;
      
      await DatabaseService.query(query, [
        customerId,
        JSON.stringify(context.recent_messages),
        JSON.stringify(context.context_data || {}),
        new Date()
      ]);
      
    } catch (error) {
      logger.error('Error saving conversation context:', error);
    }
  }

  async logConversation(customerId, userMessage, aiResponse, channel) {
    try {
      const query = `
        INSERT INTO conversation_logs (customer_id, user_message, ai_response, channel, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await DatabaseService.query(query, [
        customerId,
        userMessage,
        aiResponse,
        channel,
        new Date()
      ]);
      
    } catch (error) {
      logger.error('Error logging conversation:', error);
    }
  }

  // Cleanup old conversations from memory periodically
  startCleanupTimer() {
    setInterval(() => {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      for (const [customerId, context] of this.conversations.entries()) {
        if (context.last_updated < cutoff) {
          this.conversations.delete(customerId);
        }
      }
      
      logger.info(`Cleaned up conversation contexts. Active conversations: ${this.conversations.size}`);
    }, 15 * 60 * 1000); // Clean every 15 minutes
  }
}

module.exports = new AIAgentService();
