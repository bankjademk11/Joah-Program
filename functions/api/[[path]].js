export async function onRequest(context) {
  const { request, env } = context;

  // 1. จัดการ CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  try {
    const url = new URL(request.url);
    const targetPath = url.pathname.replace(/^\/api/, '');
    const targetUrl = `https://lod.kokkokm.com${targetPath}${url.search}`;

    console.log(`[PROXY] Incoming request to: ${targetPath}`);

    let body = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      const rawText = await request.text();
      
      // THE CYBER SECURITY FIX: Inject Secrets at the Edge
      if (targetPath === '/web/session/authenticate') {
        console.log("[PROXY] Intercepting Authentication Request...");
        
        if (!env.VITE_ODOO_DB || !env.VITE_ODOO_USER || !env.VITE_ODOO_PASSWORD) {
           throw new Error("Missing Odoo Secrets in Cloudflare Environment!");
        }

        const jsonBody = JSON.parse(rawText || '{}');
        
        // แอบยัดรหัสลับลงไปใน Body
        jsonBody.params = {
          db: env.VITE_ODOO_DB,
          login: env.VITE_ODOO_USER,
          password: env.VITE_ODOO_PASSWORD
        };
        
        body = JSON.stringify(jsonBody);
        console.log("[PROXY] Successfully injected secrets into body.");
      } else {
        body = rawText;
      }
    }

    // 2. ส่งรีเควสต์ไปหา Odoo
    console.log(`[PROXY] Forwarding to Odoo: ${targetUrl}`);
    const odooResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body,
    });

    const responseText = await odooResponse.text();
    console.log(`[PROXY] Odoo Response Status: ${odooResponse.status}`);

    // 3. ส่งข้อมูลกลับหน้าเว็บ
    return new Response(responseText, {
      status: odooResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error("[PROXY ERROR]", error.message);
    
    // พ่น Error ออกไปให้เห็นชัดๆ หน้าเว็บเลย จะได้ไม่ต้องคลำหา
    return new Response(JSON.stringify({ 
      error: "Cloudflare Proxy Error", 
      details: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
