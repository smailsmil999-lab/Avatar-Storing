const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Your Shopify credentials
const SHOPIFY_STORE = 'gcc1nj-hi.myshopify.com';
const ACCESS_TOKEN = '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';

// Enable CORS
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Main endpoint
app.get('/', async (req, res) => {
  console.log('GET request received:', req.query);
  
  try {
    if (req.query.path_prefix === '/apps/reviews') {
      const productId = req.query.product_id;
      
      if (!productId) {
        return res.status(400).json({ error: 'product_id required' });
      }
      
      console.log('Fetching reviews for product:', productId);
      
      // For now, return empty reviews to test
      res.json({ reviews: [] });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST endpoint for reviews
app.post('/', async (req, res) => {
  console.log('POST request received:', req.body);
  
  try {
    if (req.query.path_prefix === '/apps/reviews') {
      const { product_id, rating, title, body, author, customer_id, verified, date } = req.body;
      
      if (!product_id || !rating || !title || !body) {
        return res.status(400).json({ error: 'product_id, rating, title, body required' });
      }
      
      console.log('Saving review:', { product_id, rating, title, author, customer_id });
      
      // For now, just return success
      res.json({ reviews: [] });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
