const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Replace these with your actual credentials
const SHOPIFY_STORE = '1euqu4-w1.myshopify.com'; // Replace with your store URL (e.g., 'my-store.myshopify.com')
const ACCESS_TOKEN = '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'; // Replace with your access token (starts with shpat_)

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '5mb' })); // Increase JSON body limit for data URLs
app.use(express.urlencoded({ extended: true, limit: '5mb' })); // For URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// App Proxy health check endpoint
app.get('/apps/customer-avatar/health', (req, res) => {
  res.json({ status: 'OK' });
});

// GET avatar endpoint (for App Proxy)
app.get('/', async (req, res) => {
  // Check if this is an App Proxy request
  if (req.query.path_prefix === '/apps/customer-avatar') {
    // This is a GET request to /apps/customer-avatar
    try {
      const customerId = req.query.id;
      
      // Fetch customer metafields
      const response = await axios.get(
        `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields.json`,
        {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN
          }
        }
      );
      
      const avatarMetafield = response.data.metafields.find(
        mf => mf.namespace === 'profile' && mf.key === 'avatar_url'
      );
      
      const avatarUrl = avatarMetafield ? avatarMetafield.value : '';
      
      res.json({ url: avatarUrl });
    } catch (error) {
      console.error('Error fetching avatar:', error.response ? error.response.data : error.message);
      res.status(500).json({ url: '', error: 'Failed to fetch avatar' });
    }
  } else {
    // Not an App Proxy request, return 404
    res.status(404).json({ error: 'Not found' });
  }
});

// GET avatar endpoint (direct access)
app.get('/apps/customer-avatar', async (req, res) => {
  try {
    const customerId = req.query.id;
    
    // Fetch customer metafields
    const response = await axios.get(
      `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN
        }
      }
    );
    
    const avatarMetafield = response.data.metafields.find(
      mf => mf.namespace === 'profile' && mf.key === 'avatar_url'
    );
    
    const avatarUrl = avatarMetafield ? avatarMetafield.value : '';
    
    res.json({ url: avatarUrl });
  } catch (error) {
    console.error('Error fetching avatar:', error.response ? error.response.data : error.message);
    res.status(500).json({ url: '', error: 'Failed to fetch avatar' });
  }
});

// POST avatar endpoint (for App Proxy)
app.post('/', upload.single('avatar'), async (req, res) => {
  // Check if this is an App Proxy request
  if (req.query.path_prefix === '/apps/customer-avatar') {
    // This is a POST request to /apps/customer-avatar
    try {
      const { id, url } = req.body; // 'url' will be a data URL or empty string
      const customerId = parseInt(id);

      let finalAvatarUrl = url;

      // If a data URL is provided, upload it to Shopify Files API
      if (url && url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        const mimeType = url.split(';')[0].split(':')[1];
        const extension = mimeType.split('/')[1];
        
        const fileUploadResponse = await axios.post(
          `https://${SHOPIFY_STORE}/admin/api/2023-10/files.json`,
          {
            file: {
              filename: `customer_avatar_${customerId}.${extension}`,
              content_type: mimeType,
              attachment: base64Data
            }
          },
          {
            headers: {
              'X-Shopify-Access-Token': ACCESS_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );
        finalAvatarUrl = fileUploadResponse.data.file.url; // Get CDN URL
      } else if (!url) {
        // If URL is empty, it means remove avatar
        finalAvatarUrl = '';
      }
      
      // Update customer metafield
      const metafieldPayload = {
        metafield: {
          namespace: 'profile',
          key: 'avatar_url',
          value: finalAvatarUrl,
          type: 'single_line_text_field'
        }
      };

      await axios.post(
        `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields.json`,
        metafieldPayload,
        {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      res.json({ url: finalAvatarUrl });
    } catch (error) {
      console.error('Error saving avatar:', error.response ? error.response.data : error.message);
      res.status(500).json({ error: 'Failed to save avatar', details: error.response ? error.response.data : error.message });
    }
  } else {
    // Not an App Proxy request, return 404
    res.status(404).json({ error: 'Not found' });
  }
});

// POST avatar endpoint (direct access)
app.post('/apps/customer-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const { id, url } = req.body; // 'url' will be a data URL or empty string
    const customerId = parseInt(id);

    let finalAvatarUrl = url;

    // If a data URL is provided, upload it to Shopify Files API
    if (url && url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      const mimeType = url.split(';')[0].split(':')[1];
      const extension = mimeType.split('/')[1];
      
      const fileUploadResponse = await axios.post(
        `https://${SHOPIFY_STORE}/admin/api/2023-10/files.json`,
        {
          file: {
            filename: `customer_avatar_${customerId}.${extension}`,
            content_type: mimeType,
            attachment: base64Data
          }
        },
        {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      finalAvatarUrl = fileUploadResponse.data.file.url; // Get CDN URL
    } else if (!url) {
      // If URL is empty, it means remove avatar
      finalAvatarUrl = '';
    }
    
    // Update customer metafield
    const metafieldPayload = {
      metafield: {
        namespace: 'profile',
        key: 'avatar_url',
        value: finalAvatarUrl,
        type: 'single_line_text_field'
      }
    };

    await axios.post(
      `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields.json`,
      metafieldPayload,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({ url: finalAvatarUrl });
  } catch (error) {
    console.error('Error saving avatar:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to save avatar', details: error.response ? error.response.data : error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
