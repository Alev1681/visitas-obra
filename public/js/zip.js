/* ZIP simples (sem compressão) para backup: as fotos já são JPEG e o arquivo abre em qualquer computador.
 * Os dados das fotos ficam como Blob (não são copiados para a memória do JavaScript), por isso o backup
 * é leve mesmo com milhares de fotos. Também lê ZIPs compactados (deflate) se o navegador suportar. */
window.Zip = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  const crc32 = u8 => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const dosTime = d => ({
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  });

  return {
    // entries: [{ name, data: string | Uint8Array | Blob }] → Blob application/zip
    async build(entries, onProgress) {
      const parts = [];
      const central = [];
      const { time, date } = dosTime(new Date());
      let offset = 0;
      let i = 0;
      for (const e of entries) {
        const name = enc.encode(e.name);
        const data = e.data instanceof Blob ? e.data : new Blob([typeof e.data === 'string' ? enc.encode(e.data) : e.data]);
        const crc = crc32(new Uint8Array(await data.arrayBuffer()));

        const lh = new DataView(new ArrayBuffer(30 + name.length));
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);
        lh.setUint16(6, 0x0800, true); // nomes em UTF-8
        lh.setUint16(8, 0, true);      // sem compressão
        lh.setUint16(10, time, true);
        lh.setUint16(12, date, true);
        lh.setUint32(14, crc, true);
        lh.setUint32(18, data.size, true);
        lh.setUint32(22, data.size, true);
        lh.setUint16(26, name.length, true);
        new Uint8Array(lh.buffer).set(name, 30);

        const ch = new DataView(new ArrayBuffer(46 + name.length));
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true);
        ch.setUint16(8, 0x0800, true);
        ch.setUint16(10, 0, true);
        ch.setUint16(12, time, true);
        ch.setUint16(14, date, true);
        ch.setUint32(16, crc, true);
        ch.setUint32(20, data.size, true);
        ch.setUint32(24, data.size, true);
        ch.setUint16(28, name.length, true);
        ch.setUint32(42, offset, true);
        new Uint8Array(ch.buffer).set(name, 46);

        parts.push(lh.buffer, data);
        central.push(ch.buffer);
        offset += lh.byteLength + data.size;
        if (offset > 0xFFFFFFFF - 1048576) throw new Error('Backup grande demais para um único ZIP. Use "só as novidades".');
        onProgress?.(++i, entries.length);
      }
      const cdSize = central.reduce((s, b) => s + b.byteLength, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, entries.length, true);
      end.setUint16(10, entries.length, true);
      end.setUint32(12, cdSize, true);
      end.setUint32(16, offset, true);
      return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
    },

    // Lê só o índice do ZIP; o conteúdo de cada arquivo é pedido depois, um por vez.
    async read(file) {
      if (file.size < 22) throw new Error('Arquivo ZIP inválido.');
      const tailLen = Math.min(file.size, 65557);
      const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
      let p = tailLen - 22;
      while (p >= 0 && tail.getUint32(p, true) !== 0x06054b50) p--;
      if (p < 0) throw new Error('Arquivo ZIP inválido.');
      const total = tail.getUint16(p + 10, true);
      const cdSize = tail.getUint32(p + 12, true);
      const cdOff = tail.getUint32(p + 16, true);
      if (total === 0xFFFF || cdOff === 0xFFFFFFFF) throw new Error('ZIP grande demais (zip64) não é suportado.');

      const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
      const map = new Map();
      let q = 0;
      for (let i = 0; i < total; i++) {
        if (cd.getUint32(q, true) !== 0x02014b50) throw new Error('Índice do ZIP corrompido.');
        const method = cd.getUint16(q + 10, true);
        const csize = cd.getUint32(q + 20, true);
        const nameLen = cd.getUint16(q + 28, true);
        const extraLen = cd.getUint16(q + 30, true);
        const cmtLen = cd.getUint16(q + 32, true);
        const off = cd.getUint32(q + 42, true);
        map.set(dec.decode(new Uint8Array(cd.buffer, q + 46, nameLen)), { method, csize, off });
        q += 46 + nameLen + extraLen + cmtLen;
      }

      return {
        names: () => [...map.keys()],
        has: name => map.has(name),
        async blob(name, type = '') {
          const e = map.get(name);
          if (!e) return null;
          const lh = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer());
          const start = e.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
          const raw = file.slice(start, start + e.csize, type);
          if (e.method === 0) return raw;
          if (e.method === 8 && typeof DecompressionStream === 'function') {
            return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob().then(b => b.slice(0, b.size, type));
          }
          throw new Error('Este ZIP usa uma compressão não suportada. Use o arquivo original gerado pelo app.');
        },
      };
    },
  };
})();
