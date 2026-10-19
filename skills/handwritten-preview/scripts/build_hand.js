const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, PageBreak,
} = require('docx');

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error('用法: node build_hand.js hand.json');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
const base = path.dirname(path.resolve(cfgPath));
const OUT = path.isAbsolute(cfg.out) ? cfg.out : path.join(base, cfg.out);

const FONT_NAME = cfg.font || '平方相思体';
const FONT = { ascii: FONT_NAME, hAnsi: FONT_NAME, eastAsia: FONT_NAME };

const BODY = cfg.bodySize || 24;
const SMALL = cfg.smallSize || 18;
const CAP = cfg.captionSize || 21;
const TITLE = cfg.titleSize || 40;
const LINE = cfg.line || 410;
const PAGE_W = (cfg.page && cfg.page.width) || 8957;
const PAGE_H = (cfg.page && cfg.page.height) || 12302;
const CONTENT_W = PAGE_W;

const p = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { line: LINE, lineRule: 'exact', before: 0, after: 0 },
  indent: opts.noIndent ? undefined : { firstLine: 480 },
  children: [new TextRun({ text, font: FONT, size: opts.size || BODY })],
});

const h1 = (text, pageBreak = false) => new Paragraph({
  spacing: { line: LINE, lineRule: 'exact', before: 0, after: 0 },
  pageBreakBefore: pageBreak,
  children: [new TextRun({ text, font: FONT, size: BODY })],
});

const h2 = text => new Paragraph({
  spacing: { line: LINE, lineRule: 'exact', before: 0, after: 0 },
  children: [new TextRun({ text, font: FONT, size: BODY })],
});

const caption = (text, keepNext = false) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { line: 340, lineRule: 'exact', before: 0, after: 0 },
  keepNext,
  children: [new TextRun({ text, font: FONT, size: CAP })],
});

const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };

function dataTable(spec) {
  const rows = spec.rows;
  const n = rows[0].length;
  const equal = Math.floor(CONTENT_W / n);
  const widths = spec.widths && spec.widths.length === n
    ? spec.widths
    : (() => {
        const arr = Array(n).fill(equal);
        arr[0] = CONTENT_W - equal * (n - 1);
        return arr;
      })();
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    alignment: AlignmentType.CENTER,
    borders,
    rows: rows.map((row, ri) => new TableRow({
      cantSplit: true,
      tableHeader: ri === 0,
      children: row.map((cell, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 20, bottom: 20, left: 30, right: 30 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: 280, lineRule: 'exact' },
          keepNext: ri < rows.length - 1,
          children: [new TextRun({ text: String(cell), font: FONT, size: SMALL })],
        })],
      })),
    })),
  });
}

function figure(spec) {
  const file = path.isAbsolute(spec.file) ? spec.file : path.join(base, spec.file);
  if (!fs.existsSync(file)) throw new Error('图片不存在: ' + file);
  const ext = path.extname(file).slice(1).toLowerCase();
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 240, lineRule: 'auto', before: 0, after: 0 },
      keepNext: true,
      children: [new ImageRun({
        type: ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png',
        data: fs.readFileSync(file),
        transformation: { width: spec.width || 420, height: spec.height || 260 },
        altText: { title: spec.caption || '图', description: spec.caption || '图', name: spec.caption || '图' },
      })],
    }),
    caption(spec.caption || ''),
  ];
}

const body = [];

if (cfg.title) {
  body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE, lineRule: 'exact', before: 0, after: 0 },
    children: [new TextRun({ text: cfg.title, font: FONT, size: TITLE })],
  }));
}

for (const b of (cfg.blocks || [])) {
  switch (b.type) {
    case 'h1': body.push(h1(b.text, b.pageBreak === true)); break;
    case 'h2': body.push(h2(b.text)); break;
    case 'p': body.push(p(b.text)); break;
    case 'note': body.push(p(b.text, { noIndent: true })); break;
    case 'formula': body.push(p(b.text, { noIndent: true, align: AlignmentType.CENTER })); break;
    case 'pagebreak': body.push(new Paragraph({ children: [new PageBreak()] })); break;
    case 'figure': body.push(...figure(b)); break;
    case 'table':
      if (b.caption) body.push(caption(b.caption, true));
      body.push(dataTable(b));
      break;
    default: throw new Error('未知块类型: ' + b.type);
  }
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: BODY },
        paragraph: { spacing: { line: LINE, lineRule: 'exact', before: 0, after: 0 } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('written', OUT, buf.length);
});
