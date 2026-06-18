export async function onRequest(context) {
  const { request } = context;

  // จัดการ CORS preflight (Browser จะส่ง OPTIONS มาก่อน POST เสมอ)
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
  const targetUrl = `https://lod.kokkokm.com${targetPath}${url.search}`;

  // อ่าน Body ออกมาเป็น text ก่อนส่งต่อ (วิธีที่เชื่อถือได้ที่สุด)
  let body = null;
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    body = await request.text();
  }

  // ส่งรีเควสต์ใหม่ไปหา Odoo แบบสะอาดๆ (ไม่แนบ Header เก่าที่ทำให้สับสน)
  const odooResponse = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body,
  });

  // อ่าน Response จาก Odoo แล้วส่งกลับหาหน้าเว็บ
  const responseText = await odooResponse.text();

  return new Response(responseText, {
    status: odooResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
