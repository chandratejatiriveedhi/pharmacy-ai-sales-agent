const express = require('express');
const DatabaseService = require('../services/DatabaseService');
const router = express.Router();

// Get all customers
router.get('/', async (req, res) => {
  try {
    const result = await DatabaseService.query('SELECT * FROM customers ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await DatabaseService.query('SELECT * FROM customers WHERE customer_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

module.exports = router;
