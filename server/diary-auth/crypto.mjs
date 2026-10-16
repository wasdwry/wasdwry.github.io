export const bytes = value => new TextEncoder().encode(value);
export function base64url(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async value => base64url(await crypto.subtle.digest('SHA-256', bytes(value)));

// GitHub downloads PKCS#1 keys; Web Crypto imports PKCS#8. Wrap the RSA key
// without changing its contents. PKCS#8 keys work directly as well.
function der(tag, content) {
  let size = content.length, length = [];
  do { length.unshift(size & 255); size >>>= 8; } while (size);
  return new Uint8Array([tag, ...(content.length < 128 ? [content.length] : [128 + length.length, ...length]), ...content]);
}
export async function appJWT(pem, clientId, now) {
  let key = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    const rsaAlgorithm = [48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0];
    key = der(48, [2, 1, 0, ...rsaAlgorithm, ...der(4, key)]);
  }
  const imported = await crypto.subtle.importKey('pkcs8', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const input = base64url(bytes(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' +
    base64url(bytes(JSON.stringify({ iat: now - 60, exp: now + 540, iss: clientId })));
  return input + '.' + base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', imported, bytes(input)));
}
