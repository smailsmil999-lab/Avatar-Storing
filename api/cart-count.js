// Vercel Serverless Function for Cart Count Tracking
// Deploy this to: https://avatar-storing-pbxk.vercel.app/api/cart-count
// 
// Setup Instructions:
// 1. Create a Vercel KV database in your Vercel dashboard (Storage tab)
// 2. Install @vercel/kv: npm install @vercel/kv
// 3. Deploy this file to your Vercel project in the /api folder

import { kv } from '@vercel/kv';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    // GET: Fetch cart count for a variant
    if (req.method === 'GET') {
      const { product_id, variant_id } = req.query;

      if (!product_id || !variant_id) {
        return res.status(400).json({ error: 'product_id and variant_id required' });
      }

      const key = `cart_count_${product_id}_${variant_id}`;
      
      // Get count from KV store
      let count = await kv.get(key);
      
      // If no count exists, return 0
      if (count === null || count === undefined) {
        count = 0;
      }

      // Also get timestamp to check if it's stale
      const timestamp = await kv.get(`${key}_timestamp`);
      const now = Date.now();
      
      // If data is older than 1 hour, reset to 0
      if (timestamp && (now - timestamp) > 3600000) {
        count = 0;
        await kv.set(key, 0);
        await kv.set(`${key}_timestamp`, now);
      }

      return res.status(200).json({ 
        count: parseInt(count) || 0,
        product_id,
        variant_id 
      });
    }

    // POST: Increment cart count when someone adds to cart
    if (req.method === 'POST') {
      const { product_id, variant_id, action = 'increment' } = req.body || {};

      if (!product_id || !variant_id) {
        return res.status(400).json({ error: 'product_id and variant_id required' });
      }

      const key = `cart_count_${product_id}_${variant_id}`;
      const timestampKey = `${key}_timestamp`;
      
      // Get current count
      let currentCount = await kv.get(key);
      if (currentCount === null || currentCount === undefined) {
        currentCount = 0;
      }

      // Increment or decrement
      let newCount;
      if (action === 'increment') {
        newCount = parseInt(currentCount) + 1;
      } else if (action === 'decrement') {
        newCount = Math.max(0, parseInt(currentCount) - 1);
      } else if (action === 'set') {
        newCount = parseInt(req.body.count) || 0;
      } else {
        newCount = parseInt(currentCount);
      }

      // Store in KV with timestamp
      await kv.set(key, newCount);
      await kv.set(timestampKey, Date.now());

      return res.status(200).json({ 
        count: newCount,
        product_id,
        variant_id 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Cart count API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

