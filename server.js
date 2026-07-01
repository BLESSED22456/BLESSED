const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from local .env file if it exists (CJS fallback for dotenv)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const index = trimmed.indexOf('=');
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key) {
          process.env[key] = value;
        }
      }
    }
  });
  console.log('Successfully loaded local environment credentials from .env');
}

const server = http.createServer((req, res) => {
  // Normalize and parse URL path
  let urlPath = req.url.split('?')[0];

  // Route API requests
  if (urlPath === '/api/checkout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { cartItems, shippingDetails } = payload;

        if (!cartItems || !shippingDetails) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing cart items or shipping details' }));
          return;
        }

        // Retrieve credentials securely from environment variables
        const clientId = process.env.QIKINK_CLIENT_ID;
        const accessToken = process.env.QIKINK_ACCESS_TOKEN;
        const qikinkEnv = process.env.QIKINK_ENV || 'sandbox';

        // Endpoint selection
        const qikinkEndpoint = qikinkEnv === 'production'
          ? 'https://api.qikink.com/api/order/create'
          : 'https://sandbox.qikink.com/api/order/create';

        // Split first and last name safely
        const nameParts = (shippingDetails.name || 'Jane Doe').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Jane';
        const lastName = nameParts.slice(1).join(' ') || 'Doe';

        // Format order payload according to Qikink Open API specifications
        const orderPayload = {
          order_number: 'BLSD-' + Date.now(),
          qikink_shipping: '1',
          gateway: 'Prepaid',
          shipping_address: {
            first_name: firstName,
            last_name: lastName,
            address_1: shippingDetails.address || '123 Street Address',
            city: shippingDetails.city || 'Mumbai',
            state: shippingDetails.state || 'Maharashtra',
            postcode: shippingDetails.zip || '400001',
            country: shippingDetails.country || 'IN',
            phone: shippingDetails.phone || '9876543210',
            email: shippingDetails.email || 'customer@example.com'
          },
          line_items: cartItems.map(item => ({
            sku: item.product.sku || 'TEE-BLSD-HANDS',
            quantity: item.quantity || 1,
            size: item.size || 'M',
            color: item.color.name || 'Beige'
          }))
        };

        console.log(`Local Server proxying order payload to Qikink [${qikinkEnv}]:`, JSON.stringify(orderPayload, null, 2));

        if (!clientId || !accessToken) {
          console.warn('Qikink ClientId or AccessToken not found in environment variables. Simulating sandbox success.');
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              message: 'Order simulated successfully in sandbox mode (Missing API keys)',
              order_id: 'QIK-' + Math.floor(Math.random() * 900000 + 100000),
              order_number: orderPayload.order_number
            }));
          }, 1500);
          return;
        }

        // Call Qikink Order Creation API securely using Node's standard https module
        const https = require('https');
        const url = new URL(qikinkEndpoint);
        
        const options = {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ClientId': clientId,
            'Accesstoken': accessToken
          }
        };

        const postReq = https.request(options, (postRes) => {
          let responseBody = '';
          postRes.on('data', d => {
            responseBody += d;
          });
          postRes.on('end', () => {
            console.log('Qikink Response:', responseBody);
            let qikinkData;
            try {
              qikinkData = JSON.parse(responseBody);
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON response from Qikink API', details: responseBody }));
              return;
            }

            if (postRes.statusCode >= 400 || qikinkData.status === 'error') {
              res.writeHead(postRes.statusCode || 400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: qikinkData.message || 'Qikink API order placement failed', details: qikinkData }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: 'Order placed on Qikink successfully',
                order_id: qikinkData.order_id || 'QIK-' + Math.floor(Math.random() * 900000 + 100000),
                order_number: orderPayload.order_number
              }));
            }
          });
        });

        postReq.on('error', (e) => {
          console.error('Qikink request error:', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to connect to Qikink API', message: e.message }));
        });

        postReq.write(JSON.stringify(orderPayload));
        postReq.end();

      } catch (err) {
        console.error('Local checkout error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      }
    });
    return;
  }

  // Handle static file serving
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  let extname = path.extname(filePath);
  let contentType = 'text/html';
  
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpg';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
