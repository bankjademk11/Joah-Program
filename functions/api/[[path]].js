export async function onRequest(context) {
  const { request, env } = context;

  // จัดการ CORS preflight
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

  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api/, '');

  // 🕵️‍♂️ CYBER SECURITY DEEP DIAGNOSTIC 🕵️‍♂️
  // สกัดการเชื่อมต่อชั่วคราว เพื่อตรวจสอบว่าตู้เซฟ Cloudflare (env) ว่างเปล่าหรือไม่
  if (targetPath === '/web/session/authenticate') {
    // เช็คว่ามีค่าใน env ไหม
    const hasDB = !!env.VITE_ODOO_DB;
    const hasUser = !!env.VITE_ODOO_USER;
    const hasPass = !!env.VITE_ODOO_PASSWORD;

    // ถ้าค่าใดค่าหนึ่งไม่มีอยู่จริง (undefined) ให้ตีกลับบอกหน้าเว็บทันที ไม่ต้องส่งไป Odoo
    if (!hasDB || !hasUser || !hasPass) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        error: {
          code: 500,
          message: "DIAGNOSTIC_INTERCEPT: Cloudflare Edge Function does NOT see the Secrets!",
          data: {
            message: `Cloudflare Env Check -> DB: ${hasDB ? 'FOUND' : 'MISSING'}, USER: ${hasUser ? 'FOUND' : 'MISSING'}, PASS: ${hasPass ? 'FOUND' : 'MISSING'}. This means the variables in Cloudflare Dashboard are being ignored or not set as 'Secrets'.`
          }
        }
      }), {
        status: 200, // แกล้งทำเป็น 200 เพื่อให้ OdooApi.js อ่านข้อความ Error ได้
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ถ้ามีค่าครบ ให้ประกอบร่างตามปกติ
    try {
      const rawText = await request.text();
      const jsonBody = JSON.parse(rawText || '{}');
      jsonBody.params = {
        db: env.VITE_ODOO_DB,
        login: env.VITE_ODOO_USER,
        password: env.VITE_ODOO_PASSWORD
      };
      
      const targetUrl = `https://lod.kokkokm.com${targetPath}${url.search}`;
      const odooResponse = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(jsonBody),
      });

      const responseText = await odooResponse.text();
      return new Response(responseText, {
        status: odooResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      // จับ Error เผื่อ JSON.parse พัง
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        error: { code: 500, message: "PROXY_ERROR", data: { message: error.message } }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // สำหรับ Route อื่นๆ
  const targetUrl = `https://lod.kokkokm.com${targetPath}${url.search}`;
  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  const odooResponse = await fetch(targetUrl, {
    method: request.method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: body,
  });

  const responseText = await odooResponse.text();
  return new Response(responseText, {
    status: odooResponse.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
