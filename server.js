const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const sharp = require('sharp');
const app = express();

// Replace these with your actual credentials
const SHOPIFY_STORE = 'gcc1nj-hi.myshopify.com'; // Replace with your store URL (e.g., 'my-store.myshopify.com')
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
      // For App Proxy, data comes in req.body as JSON
      const { id, url } = req.body;
      const customerId = parseInt(id);
      
      console.log('App Proxy POST data:', { id, url, customerId });

      let finalAvatarUrl = url;

      // If a data URL is provided, compress it before storing
      if (url && url.startsWith('data:')) {
        console.log('Compressing data URL for storage...');
        
        try {
          console.log('Starting image compression...');
          console.log('Original data URL length:', url.length);
          
          // Extract base64 data
          const base64Data = url.split(',')[1];
          const mimeType = url.split(';')[0].split(':')[1];
          console.log('MIME type:', mimeType);
          
          // Convert to buffer
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('Buffer size:', buffer.length, 'bytes');
          
          // Compress image to reduce size - more aggressive for phone images
          console.log('Applying primary compression...');
          const compressedBuffer = await sharp(buffer)
            .resize(150, 150, { fit: 'cover' }) // Smaller size for better compression
            .jpeg({ 
              quality: 50, // Lower quality for smaller file size
              progressive: true, // Better compression
              mozjpeg: true // Use mozjpeg encoder for better compression
            })
            .toBuffer();
          
          // Convert back to data URL
          const compressedBase64 = compressedBuffer.toString('base64');
          finalAvatarUrl = `data:image/jpeg;base64,${compressedBase64}`;
          console.log('Primary compression result length:', finalAvatarUrl.length);
          
          // If still too large, apply even more aggressive compression
          if (finalAvatarUrl.length > 60000) {
            console.log('Still too large, applying ultra compression...');
            const ultraCompressedBuffer = await sharp(buffer)
              .resize(120, 120, { fit: 'cover' })
              .jpeg({ 
                quality: 30, // Very low quality
                progressive: true,
                mozjpeg: true
              })
              .toBuffer();
            
            const ultraCompressedBase64 = ultraCompressedBuffer.toString('base64');
            finalAvatarUrl = `data:image/jpeg;base64,${ultraCompressedBase64}`;
            console.log('Ultra compression result length:', finalAvatarUrl.length);
          }
          
          console.log('Data URL compressed successfully, original length:', url.length, 'compressed length:', finalAvatarUrl.length);
        } catch (compressError) {
          console.error('Error compressing data URL:', compressError);
          console.error('Compression error details:', compressError.message);
          console.error('Stack trace:', compressError.stack);
          
          // Fallback: try basic compression without advanced options
          try {
            console.log('Trying fallback compression...');
            const fallbackBuffer = await sharp(Buffer.from(url.split(',')[1], 'base64'))
              .resize(100, 100, { fit: 'cover' })
              .jpeg({ quality: 40 })
              .toBuffer();
            
            const fallbackBase64 = fallbackBuffer.toString('base64');
            finalAvatarUrl = `data:image/jpeg;base64,${fallbackBase64}`;
            console.log('Fallback compression successful, length:', finalAvatarUrl.length);
          } catch (fallbackError) {
            console.error('Fallback compression also failed:', fallbackError.message);
            // Last resort: use original URL
            finalAvatarUrl = url;
          }
        }
      } else if (!url) {
        // If URL is empty, it means remove avatar - delete the metafield
        console.log('Removing avatar - deleting metafield');
        
        try {
          // First, get existing metafields to find the avatar metafield ID
          const existingMetafields = await axios.get(
            `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
              headers: {
                'X-Shopify-Access-Token': ACCESS_TOKEN
              }
            }
          );
          
          const avatarMetafield = existingMetafields.data.metafields.find(
            mf => mf.namespace === 'profile' && mf.key === 'avatar_url'
          );
          
          if (avatarMetafield) {
            // Delete the existing metafield
            await axios.delete(
              `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields/${avatarMetafield.id}.json`,
              {
                headers: {
                  'X-Shopify-Access-Token': ACCESS_TOKEN
                }
              }
            );
            console.log('Avatar metafield deleted successfully');
          } else {
            console.log('No avatar metafield found to delete');
          }
        } catch (deleteError) {
          console.error('Error deleting metafield:', deleteError.response ? deleteError.response.data : deleteError.message);
          throw deleteError;
        }
        
        res.json({ url: '' });
        return; // Exit early for removal
      }
      
      // Update customer metafield (only for non-empty values)
      const metafieldPayload = {
        metafield: {
          namespace: 'profile',
          key: 'avatar_url',
          value: finalAvatarUrl,
          type: 'multi_line_text_field'
        }
      };

      console.log('Saving metafield:', metafieldPayload);

      const metafieldResponse = await axios.post(
        `https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customerId}/metafields.json`,
        metafieldPayload,
        {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Metafield saved successfully:', metafieldResponse.data);
      res.json({ url: finalAvatarUrl });
    } catch (error) {
      console.error('Error saving avatar - Full error:', error);
      console.error('Error response:', error.response ? error.response.data : 'No response data');
      console.error('Error status:', error.response ? error.response.status : 'No status');
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
