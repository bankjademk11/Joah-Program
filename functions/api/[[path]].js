export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // สร้าง URL ปลายทางของ Odoo
  const targetPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = new URL(targetPath, 'https://lod.kokkokm.com');
  targetUrl.search = url.search;

  // คัดลอก Headers และลบ Origin/Referer ทิ้ง เพื่อหลอก Odoo ว่าส่งมาจากตัวมันเอง
  const headers = new Headers(request.headers);
  headers.delete('Origin');
  headers.delete('Referer');

  const fetchOptions = {
    method: request.method,
    headers: headers,
    redirect: 'manual'
  };

  // ถ้าเป็นการส่งข้อมูล (POST) ให้ก็อปปี้ Body ไปด้วย
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOptions.body = await request.clone().arrayBuffer();
  }

  // ส่งรีเควสต์ไปหา Odoo
  const response = await fetch(targetUrl.toString(), fetchOptions);
  
  // สร้าง Response ใหม่เพื่อส่งกลับไปให้หน้าเว็บเรา
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*'); // ป้องกัน Browser บล็อค
  
  return newResponse;
}
