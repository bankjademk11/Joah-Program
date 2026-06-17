export async function onRequest(context) {
  // Extract the original request URL
  const url = new URL(context.request.url);
  
  // Create the target Odoo URL (remove /api prefix)
  const targetPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = new URL(targetPath, 'https://lod.kokkokm.com');
  targetUrl.search = url.search;

  // Clone the request with the new target URL
  const newRequest = new Request(targetUrl.toString(), context.request);
  
  // Forward the request to Odoo
  const response = await fetch(newRequest);
  
  // Return Odoo's response back to the browser
  return response;
}
