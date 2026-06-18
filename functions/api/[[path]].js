export async function onRequest(context) {
  const { request, env } = context;

  // 1. จัดการ CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Credentials': 'true'
      },
    });
  }

  try {
    const url = new URL(request.url);
    const targetPath = url.pathname.replace(/^\/api/, '');
    const targetUrl = `https://lod.kokkokm.com${targetPath}${url.search}`;

    let body = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      const rawText = await request.text();
      
      // Inject Secrets at the Edge
      if (targetPath === '/web/session/authenticate') {
        if (!env.VITE_ODOO_DB || !env.VITE_ODOO_USER || !env.VITE_ODOO_PASSWORD) {
           throw new Error("Missing Odoo Secrets in Cloudflare Environment!");
        }
        const jsonBody = JSON.parse(rawText || '{}');
        jsonBody.params = {
          db: env.VITE_ODOO_DB,
          login: env.VITE_ODOO_USER,
          password: env.VITE_ODOO_PASSWORD
        };
        body = JSON.stringify(jsonBody);
      } else {
        body = rawText;
      }
    }

    // 2. ส่งรีเควสต์ไปหา Odoo โดยส่ง Cookie เก่าไปด้วย (ถ้ามี)
    const odooHeaders = new Headers({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });
    
    // สำคัญมาก: ส่ง Cookie ของผู้ใช้ไปให้ Odoo ด้วย
    const cookie = request.headers.get('Cookie');
    if (cookie) odooHeaders.set('Cookie', cookie);

    const odooResponse = await fetch(targetUrl, {
      method: request.method,
      headers: odooHeaders,
      body: body,
    });

    const responseText = await odooResponse.text();
    
    // 3. ก็อปปี้ Header ส่งกลับหาเว็บเรา โดยเฉพาะ Set-Cookie
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json');
    responseHeaders.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');

    // ทริคสำคัญ: ก็อปปี้ Set-Cookie จาก Odoo ส่งให้ Browser จำ
    const setCookie = odooResponse.headers.get('set-cookie');
    if (setCookie) {
      // ลบ Domain ออก เพื่อให้ Browser ยอมรับ Cookie บนโดเมน Cloudflare ของเรา
      let modifiedCookie = setCookie.replace(/Domain=[^;]+;?/i, '');
      // ปรับแต่งให้รองรับข้ามโดเมนได้ปลอดภัย
      if (!modifiedCookie.includes('SameSite')) {
         modifiedCookie += '; SameSite=None; Secure';
      }
      responseHeaders.set('Set-Cookie', modifiedCookie);
    }

    return new Response(responseText, {
      status: odooResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
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
