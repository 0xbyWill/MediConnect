// Largura de uma folha A4 a 96dpi (px). O HTML dos documentos é desenhado nesse mesmo tamanho.
const A4_WIDTH_PX = 794;

function sanitizeFilename(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const safe = base || 'documento';
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

async function waitForImages(doc: Document) {
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );
}

/**
 * Gera e baixa um PDF (A4, multipágina) a partir de um documento HTML completo.
 * O HTML é renderizado em um iframe oculto e capturado com html2canvas.
 */
export async function downloadHtmlAsPdf(htmlDocument: string, filename: string): Promise<void> {
  // Carrega as libs pesadas apenas quando o usuário realmente gera um PDF.
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasModule.default;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = `${A4_WIDTH_PX}px`;
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  iframe.style.background = '#fff';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Não foi possível preparar o documento para o PDF.');
    doc.open();
    doc.write(htmlDocument);
    doc.close();

    // Aguarda layout e imagens carregarem antes de capturar.
    await waitForImages(doc);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const target = (doc.querySelector('.page') as HTMLElement) || doc.body;

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    // Converte a altura total da imagem para mm mantendo a proporção da largura A4.
    const imgWidthMm = pageWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    let heightLeft = imgHeightMm;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= pageHeightMm;

    while (heightLeft > 0) {
      position -= pageHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
      heightLeft -= pageHeightMm;
    }

    pdf.save(sanitizeFilename(filename));
  } finally {
    iframe.remove();
  }
}
