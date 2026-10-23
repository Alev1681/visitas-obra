/* Gerador de planilha Excel (.xlsx) sem bibliotecas: um .xlsx é um ZIP de arquivos XML em UTF-8, então
 * os acentos chegam corretos em qualquer programa (Excel, Google Planilhas, LibreOffice), ao contrário
 * do CSV, cuja codificação cada programa adivinha. Usa Zip.build (js/zip.js). */
window.Xlsx = (() => {
  const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  // Remove caracteres que o XML 1.0 não aceita e escapa os especiais; o Excel limita a célula a 32767 caracteres.
  const texto = s => String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .slice(0, 32000)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // 0 → A, 25 → Z, 26 → AA …
  const coluna = n => {
    let s = '';
    for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
    return s;
  };

  const celula = (v, c, r, estilo = 0) => {
    if (v === null || v === undefined || v === '') return '';
    const ref = `${coluna(c)}${r}`;
    const s = estilo ? ` s="${estilo}"` : '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${texto(v)}</t></is></c>`;
  };

  const ESTILOS = `${XML}<styleSheet xmlns="${NS}">`
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF024089"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  return {
    MIME,
    // cabecalho: ['Coluna A', …]; linhas: [[texto ou número, …], …] → Blob .xlsx
    async build(cabecalho, linhas, { nome = 'Planilha' } = {}) {
      const largura = cabecalho.map((h, i) => {
        const maior = Math.max(String(h).length, ...linhas.slice(0, 300).map(l => String(l[i] ?? '').split('\n')[0].length));
        return Math.min(45, Math.max(10, maior + 2));
      });
      const cols = largura.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
      const cab = `<row r="1">${cabecalho.map((h, i) => celula(h, i, 1, 1)).join('')}</row>`;
      const corpo = linhas.map((l, r) => `<row r="${r + 2}">${l.map((v, i) => celula(v, i, r + 2)).join('')}</row>`).join('');
      const ultima = `${coluna(cabecalho.length - 1)}${linhas.length + 1}`;
      const planilha = `${XML}<worksheet xmlns="${NS}"><dimension ref="A1:${ultima}"/>`
        + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>'
        + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${cab}${corpo}</sheetData>`
        + `<autoFilter ref="A1:${ultima}"/></worksheet>`;

      const zip = await Zip.build([
        { name: '[Content_Types].xml', data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
          + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
        { name: '_rels/.rels', data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
          + `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
        { name: 'xl/workbook.xml', data: `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="${texto(nome).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
        { name: 'xl/_rels/workbook.xml.rels', data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
          + `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>`
          + `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>` },
        { name: 'xl/styles.xml', data: ESTILOS },
        { name: 'xl/worksheets/sheet1.xml', data: planilha },
      ]);
      return zip.slice(0, zip.size, MIME);
    },
  };
})();
