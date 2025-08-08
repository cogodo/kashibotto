import { HttpsProxyAgent } from 'https-proxy-agent';
import tls from 'tls';

// Create a single Zyte HTTPS proxy agent instance if API key is present
// Zyte endpoint: api.zyte.com:8011, auth via API key as username
export const zyteAgent = process.env.ZYTE_API_KEY
    ? new HttpsProxyAgent({
        proxy: `http://${process.env.ZYTE_API_KEY}:@api.zyte.com:8011`,
        // Allow opting out of TLS verification if the host lacks system CAs
        // Prefer fixing host CAs via NODE_OPTIONS=--use-system-ca in prod
        rejectUnauthorized: process.env.ZYTE_INSECURE_TLS === '1' ? false : undefined,
    } as any)
    : undefined;

// If needed in some environments (e.g., Render), Node can be pointed to system CA store:
// export const NODE_SYSTEM_CA = '--use-system-ca';


