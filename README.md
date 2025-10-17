# Customer Avatar Server

A Node.js server for managing customer avatars via Shopify App Proxy.

## Setup Instructions

### 1. Configure Your Credentials

Edit `server.js` and replace these values:

```javascript
const SHOPIFY_STORE = 'your-store.myshopify.com'; // Your store URL
const ACCESS_TOKEN = 'your-admin-api-access-token'; // Your access token (starts with shpat_)
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Locally (Optional)

```bash
npm start
```

### 4. Deploy to Vercel (Recommended)

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up with GitHub**
3. **Click "New Project"**
4. **Upload this folder or connect GitHub repo**
5. **Deploy!**

### 5. Configure Shopify App Proxy

1. **Go to your Shopify Admin → Apps → App and sales channel settings**
2. **Click "Develop apps" → "Create an app"**
3. **Name it "Customer Avatar Server"**
4. **Go to "Configuration" tab**
5. **Enable "App proxy"**
6. **Set:**
   - **Subpath prefix:** `apps`
   - **Subpath:** `customer-avatar`
   - **URL:** `https://your-vercel-app.vercel.app`
7. **Save and install the app**

## API Endpoints

- `GET /apps/customer-avatar?id={customerId}` - Get customer avatar
- `POST /apps/customer-avatar` - Save customer avatar

## Environment Variables (Optional)

You can also use environment variables instead of hardcoding:

```bash
SHOPIFY_STORE=your-store.myshopify.com
ACCESS_TOKEN=your-access-token
```

## Testing

Test your deployment:
```bash
curl https://your-vercel-app.vercel.app/health
```

Should return: `{"status":"OK"}`
