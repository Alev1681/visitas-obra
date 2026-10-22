/* Fotos: redução de tamanho, carimbo (data/hora, GPS, obra), miniaturas e conversões. */
window.Photos = {
  THUMB: 256, // lado maior da miniatura (px): a lista usa miniaturas, nunca a foto inteira

  load(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
      img.src = url;
    });
  },

  toBlob(canvas, quality) {
    return new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao comprimir a foto'))), 'image/jpeg', quality));
  },

  // Miniatura a partir de um canvas ou imagem já desenhados.
  thumbFrom(source, w, h) {
    const s = Math.min(1, this.THUMB / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * s));
    cv.height = Math.max(1, Math.round(h * s));
    cv.getContext('2d').drawImage(source, 0, 0, cv.width, cv.height);
    return this.toBlob(cv, 0.7);
  },

  // Miniatura de uma foto já salva (fotos antigas, feitas antes das miniaturas existirem).
  async thumbOf(blob) {
    const img = await this.load(blob);
    return this.thumbFrom(img, img.naturalWidth, img.naturalHeight);
  },

  // Devolve { blob, thumb }: foto reduzida (com carimbo) e a miniatura dela.
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

    const [blob, thumb] = await Promise.all([this.toBlob(cv, qualidade), this.thumbFrom(cv, w, h)]);
    return { blob, thumb };
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
