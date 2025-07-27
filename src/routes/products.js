const express = require('express');
const DatabaseService = require('../services/DatabaseService');
const router = express.Router();

// Search products
router.post('/search', async (req, res) => {
  try {
    const { query, customerId } = req.body;
    const products = await DatabaseService.searchProducts(query, 20);
    res.json({ success: true, data: { products } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const products = await DatabaseService.getProductsByCategory(req.params.category, 20);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const result = await DatabaseService.query('SELECT * FROM products ORDER BY name LIMIT 50');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

module.exports = router;
