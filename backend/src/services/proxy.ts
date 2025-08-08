import { HttpsProxyAgent } from 'https-proxy-agent';

// Create a single Zyte HTTPS proxy agent instance if API key is present
// Zyte endpoint: api.zyte.com:8011, auth via API key as username
// IMPORTANT: https-proxy-agent expects a proxy URL string or structured host/port
export const zyteAgent = process.env.ZYTE_API_KEY
    ? new HttpsProxyAgent(`http://${process.env.ZYTE_API_KEY}:@api.zyte.com:8011`)
    : undefined;

// If needed in some environments (e.g., Render), Node can be pointed to system CA store:
// export const NODE_SYSTEM_CA = '--use-system-ca';


