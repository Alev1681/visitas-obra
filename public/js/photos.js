/* Fotos: redução de tamanho, carimbo (data/hora, GPS, obra) e conversões para backup. */
window.Photos = {
  load(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
      img.src = url;
    });
  },

  async process(file, lines = []) {
    const { maxLado, qualidade } = window.CONFIG.foto;
    const img = await this.load(file);
    const s = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    if (lines.length) {
      const fs = Math.max(14, Math.round(Math.min(w, h) / 32));
      const lh = Math.round(fs * 1.35);
      const pad = Math.round(fs * 0.7);
      const bh = lines.length * lh + pad * 2 - (lh - fs);
      ctx.fillStyle = 'rgba(44,44,44,0.72)';
      ctx.fillRect(0, h - bh, w, bh);
      ctx.fillStyle = window.CONFIG.cores.amarelo;
      ctx.fillRect(0, h - bh, Math.max(4, Math.round(fs * 0.35)), bh);
      ctx.font = `600 ${fs}px system-ui, -apple-system, Roboto, Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      lines.forEach((t, i) => ctx.fillText(t, pad * 1.6, h - bh + pad + i * lh, w - pad * 3));
    }

    return new Promise((resolve, reject) =>
      cv.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao comprimir a foto'))), 'image/jpeg', qualidade));
  },

  toDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  },

  async fromDataURL(dataUrl) {
    return (await fetch(dataUrl)).blob();
  },
};
