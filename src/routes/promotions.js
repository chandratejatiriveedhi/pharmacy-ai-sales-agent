const express = require('express');
const DatabaseService = require('../services/DatabaseService');
const router = express.Router();

// Get active promotions
router.get('/', async (req, res) => {
  try {
    const promotions = await DatabaseService.getActivePromotions();
    res.json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// Get applicable promotions for customer
router.post('/applicable', async (req, res) => {
  try {
    const { customerId, products } = req.body;
    const activePromotions = await DatabaseService.getActivePromotions();
    
    // Basic promotion filtering - can be enhanced
    const applicablePromotions = activePromotions.filter(promo => {
      if (promo.customer_segments === 'all') return true;
      // Add more sophisticated filtering logic here
      return false;
    });
    
    res.json({ success: true, data: { promotions: applicablePromotions } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get applicable promotions' });
  }
});

module.exports = router;
