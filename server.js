const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Your Shopify credentials
const SHOPIFY_STORE = 'gcc1nj-hi.myshopify.com';
const ACCESS_TOKEN = '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';

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString()
  });
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
      
      // Fetch product metafields
      const response = await axios.get(
        `https://${SHOPIFY_STORE}/admin/api/2023-10/products/${productId}/metafields.json`,
        {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN
          }
        }
      );
      
      const reviewsMetafield = response.data.metafields.find(
        mf => mf.namespace === 'reviews' && mf.key === 'data'
      );
      
      let reviews = reviewsMetafield ? JSON.parse(reviewsMetafield.value) : [];
      
      console.log('Found reviews:', reviews.length);
      
      // Fetch avatars for each review
      for (let review of reviews) {
        if (review.customer_id) {
          try {
            const customerResponse = await axios.get(
              `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${review.customer_id}/metafields.json`,
              {
                headers: {
                  'X-Shopify-Access-Token': ACCESS_TOKEN
                }
              }
            );
            
            const avatarMetafield = customerResponse.data.metafields.find(
              mf => mf.namespace === 'profile' && mf.key === 'avatar_url'
            );
            
            review.avatar_url = avatarMetafield ? avatarMetafield.value : null;
          } catch (error) {
            console.error('Error fetching avatar for customer', review.customer_id, error.message);
            review.avatar_url = null;
          }
        }
      }
      
      res.json({ reviews });
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
      
      // Get existing reviews
      const existingResponse = await axios.get(
        `https://${SHOPIFY_STORE}/admin/api/2023-10/products/${product_id}/metafields.json`,
        {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN
          }
        }
      );
      
      const reviewsMetafield = existingResponse.data.metafields.find(
        mf => mf.namespace === 'reviews' && mf.key === 'data'
      );
      
      const reviews = reviewsMetafield ? JSON.parse(reviewsMetafield.value) : [];
      
      // Add new review
      const newReview = {
        rating: Math.max(1, Math.min(5, parseInt(rating))),
        title: String(title).slice(0, 120),
        body: String(body),
        author: author ? String(author).slice(0, 80) : 'Anonymous',
        customer_id: customer_id ? parseInt(customer_id) : null,
        verified: Boolean(verified),
        date: date || new Date().toISOString().slice(0, 10)
      };
      
      reviews.unshift(newReview);
      
      // Update or create metafield
      const metafieldPayload = {
        metafield: {
          namespace: 'reviews',
          key: 'data',
          value: JSON.stringify(reviews),
          type: 'json'
        }
      };
      
      if (reviewsMetafield) {
        await axios.put(
          `https://${SHOPIFY_STORE}/admin/api/2023-10/metafields/${reviewsMetafield.id}.json`,
          metafieldPayload,
          {
            headers: {
              'X-Shopify-Access-Token': ACCESS_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );
      } else {
        await axios.post(
          `https://${SHOPIFY_STORE}/admin/api/2023-10/metafields.json`,
          {
            ...metafieldPayload,
            metafield: {
              ...metafieldPayload.metafield,
              owner_resource: 'product',
              owner_id: parseInt(product_id)
            }
          },
          {
            headers: {
              'X-Shopify-Access-Token': ACCESS_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      res.json({ reviews });
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
