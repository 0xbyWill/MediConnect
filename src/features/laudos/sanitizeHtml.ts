export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  div.querySelectorAll('script').forEach(el => el.remove());
  div.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    });
    if (el.getAttribute('href')?.startsWith('javascript:')) el.removeAttribute('href');
    if (el.getAttribute('src')?.startsWith('javascript:')) el.removeAttribute('src');
  });

  return div.innerHTML;
}
