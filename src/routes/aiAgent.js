const express = require('express');
const AIAgentService = require('../services/AIAgentService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route POST /api/v1/ai-agent/process
 * @desc Process customer message with AI agent
 * @access Public
 */
router.post('/process', async (req, res) => {
  try {
    const { customerId, message, channel = 'web' } = req.body;

    // Validate required fields
    if (!customerId || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'customerId and message are required'
      });
    }

    logger.info(`Processing AI agent request for customer ${customerId} via ${channel}`);

    // Process message with AI agent
    const response = await AIAgentService.processMessage(customerId, message, channel);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('Error in AI agent processing:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process message with AI agent'
    });
  }
});

/**
 * @route POST /api/v1/ai-agent/chat
 * @desc Simple chat interface for testing
 * @access Public
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, customerId = 'test-customer' } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const response = await AIAgentService.processMessage(customerId, message, 'web');

    res.json({
      response: response.response,
      intent: response.intent,
      confidence: response.confidence
    });

  } catch (error) {
    logger.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'Failed to process chat message'
    });
  }
});

/**
 * @route GET /api/v1/ai-agent/conversation/:customerId
 * @desc Get conversation history for a customer
 * @access Public
 */
router.get('/conversation/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const context = await AIAgentService.getConversationContext(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        messages: context.recent_messages || [],
        lastIntent: context.last_intent,
        lastUpdated: context.last_updated
      }
    });

  } catch (error) {
    logger.error('Error getting conversation history:', error);
    res.status(500).json({
      error: 'Failed to get conversation history'
    });
  }
});

/**
 * @route DELETE /api/v1/ai-agent/conversation/:customerId
 * @desc Clear conversation history for a customer
 * @access Public
 */
router.delete('/conversation/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Clear conversation context (implementation depends on your storage)
    await AIAgentService.clearConversationContext(customerId);

    res.json({
      success: true,
      message: 'Conversation history cleared'
    });

  } catch (error) {
    logger.error('Error clearing conversation history:', error);
    res.status(500).json({
      error: 'Failed to clear conversation history'
    });
  }
});

/**
 * @route GET /api/v1/ai-agent/health
 * @desc Check AI agent health and configuration
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      aiModel: process.env.AI_MODEL || 'gpt-4',
      conversationsActive: AIAgentService.conversations?.size || 0,
      features: {
        openai: !!process.env.OPENAI_API_KEY,
        telegram: !!process.env.TELEGRAM_BOT_TOKEN,
        whatsapp: !!process.env.WHATSAPP_ACCESS_TOKEN
      }
    };

    res.json(health);

  } catch (error) {
    logger.error('Error checking AI agent health:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
