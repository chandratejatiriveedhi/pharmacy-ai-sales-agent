const axios = require('axios');
const AIAgentService = require('./AIAgentService');
const DatabaseService = require('./DatabaseService');
const logger = require('../utils/logger');

class WhatsAppBotService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    this.apiUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        throw new Error('WhatsApp Business API credentials not provided');
      }

      // Test the API connection
      await this.testConnection();
      
      this.isInitialized = true;
      logger.info('✅ WhatsApp Business API initialized successfully');
      
    } catch (error) {
      logger.error('❌ WhatsApp Business API initialization failed:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      logger.info('WhatsApp Business API connection test successful');
      return response.data;
    } catch (error) {
      logger.error('WhatsApp Business API connection test failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendMessage(to, message, messageType = 'text') {
    try {
      if (!this.isInitialized) {
        throw new Error('WhatsApp service not initialized');
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: messageType
      };

      if (messageType === 'text') {
        payload.text = { body: message };
      } else if (messageType === 'template') {
        payload.template = message;
      } else if (messageType === 'interactive') {
        payload.interactive = message;
      }

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`WhatsApp message sent to ${to}:`, response.data);
      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendInteractiveMessage(to, message, buttons = []) {
    try {
      const interactiveMessage = {
        type: 'button',
        body: { text: message },
        action: {
          buttons: buttons.map((button, index) => ({
            type: 'reply',
            reply: {
              id: `btn_${index}`,
              title: button.title || button
            }
          }))
        }
      };

      return await this.sendMessage(to, interactiveMessage, 'interactive');
    } catch (error) {
      logger.error('Error sending interactive WhatsApp message:', error);
      // Fallback to regular text message
      return await this.sendMessage(to, message);
    }
  }

  async handleIncomingMessage(messageData) {
    try {
      const { from, text, timestamp, name } = messageData;
      const userMessage = text?.body || '';

      if (!userMessage) {
        logger.warn('Received empty WhatsApp message');
        return;
      }

      logger.info(`WhatsApp message from ${from} (${name}): ${userMessage}`);

      // Get or create customer
      const customer = await this.getOrCreateCustomer(from, name);

      // Process message with AI agent
      const response = await AIAgentService.processMessage(
        customer.customer_id,
        userMessage,
        'whatsapp'
      );

      // Send response based on intent
      if (response.intent === 'product_search' && response.actions?.length > 0) {
        const products = response.actions.find(a => a.type === 'product_search')?.data || [];
        
        if (products.length > 0) {
          // Send response with product buttons
          const buttons = products.slice(0, 3).map(product => ({
            title: `${product.name} - $${product.price}`
          }));

          await this.sendInteractiveMessage(from, response.response, buttons);
        } else {
          await this.sendMessage(from, response.response);
        }
      } else {
        await this.sendMessage(from, response.response);
      }

    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
      
      // Send error message to user
      if (messageData.from) {
        await this.sendMessage(
          messageData.from,
          "I'm having trouble processing your request right now. Please try again in a moment."
        );
      }
    }
  }

  async getOrCreateCustomer(phoneNumber, displayName) {
    try {
      // Try to find existing customer by WhatsApp phone
      let customer = await DatabaseService.query(
        'SELECT * FROM customers WHERE whatsapp_phone = $1 OR phone = $1',
        [phoneNumber]
      );

      if (customer.rows.length > 0) {
        return customer.rows[0];
      }

      // Create new customer
      const customerId = `CUST-WA-${Date.now()}`;
      const customerData = {
        customer_id: customerId,
        first_name: displayName || 'WhatsApp',
        last_name: 'User',
        email: `${customerId}@whatsapp.user`,
        phone: phoneNumber,
        whatsapp_phone: phoneNumber,
        preferred_language: 'English',
        communication_preference: 'WhatsApp'
      };

      const result = await DatabaseService.query(`
        INSERT INTO customers (
          customer_id, first_name, last_name, email, phone, whatsapp_phone,
          preferred_language, communication_preference, registration_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'Active')
        RETURNING *
      `, [
        customerData.customer_id, customerData.first_name, customerData.last_name,
        customerData.email, customerData.phone, customerData.whatsapp_phone,
        customerData.preferred_language, customerData.communication_preference
      ]);

      logger.info(`Created new WhatsApp customer: ${customerId}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Error getting/creating WhatsApp customer:', error);
      throw error;
    }
  }

  // Webhook verification for WhatsApp
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      logger.info('WhatsApp webhook verified successfully');
      return challenge;
    } else {
      logger.warn('WhatsApp webhook verification failed');
      return null;
    }
  }

  // Parse webhook payload
  parseWebhookPayload(body) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];

        return {
          from: message.from,
          text: message.text,
          timestamp: message.timestamp,
          name: contact?.profile?.name,
          messageId: message.id,
          type: message.type
        };
      }

      return null;
    } catch (error) {
      logger.error('Error parsing WhatsApp webhook payload:', error);
      return null;
    }
  }

  async markAsRead(messageId) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      };

      await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.debug(`Marked WhatsApp message as read: ${messageId}`);
    } catch (error) {
      logger.error('Error marking WhatsApp message as read:', error);
    }
  }

  async stop() {
    this.isInitialized = false;
    logger.info('✅ WhatsApp Business API service stopped');
  }
}

module.exports = WhatsAppBotService;
