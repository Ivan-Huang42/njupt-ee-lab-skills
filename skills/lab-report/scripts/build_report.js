const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, PageBreak, Header,
} = require('docx');

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error('用法: node build_report.js report.json');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
const base = path.dirname(path.resolve(cfgPath));
const OUT = path.isAbsolute(cfg.out) ? cfg.out : path.join(base, cfg.out);

const SONG = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' };
const HEI = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimHei' };

const BODY = 24;
const SMALL = 21;
const H1 = 28;
const CONTENT_W = 9026;
const NONE = { style: BorderStyle.NONE };

const p = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { line: 360, lineRule: 'auto', before: opts.before || 0, after: opts.after || 0 },
  indent: opts.noIndent ? undefined : { firstLine: 480 },
  children: [new TextRun({ text, font: SONG, size: opts.size || BODY })],
});

const h1 = text => new Paragraph({
  spacing: { before: 220, after: 100, line: 320, lineRule: 'auto' },
  children: [new TextRun({ text, font: HEI, size: H1, bold: true })],
});

const h2 = text => new Paragraph({
  spacing: { before: 160, after: 80, line: 300, lineRule: 'auto' },
  children: [new TextRun({ text, font: HEI, size: 24, bold: true })],
});

const caption = (text, keepNext = false) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 100, after: 70, line: 280, lineRule: 'auto' },
  keepNext,
  children: [new TextRun({ text, font: SONG, size: SMALL })],
});

const thin = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
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
  const keep = spec.keepTogether !== false;
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
        margins: { top: 25, bottom: 25, left: 40, right: 40 },
        shading: spec.shade && ri === 0 ? { fill: 'F2F2F2', type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: 240, lineRule: 'auto' },
          keepNext: keep && ri < rows.length - 1,
          children: [new TextRun({ text: String(cell), font: SONG, size: SMALL, bold: false })],
        })],
      })),
    })),
  });
}

function figure(spec) {
  const file = path.isAbsolute(spec.file) ? spec.file : path.join(base, spec.file);
  if (!fs.existsSync(file)) throw new Error('图片不存在: ' + file);
  const w = spec.width || 520;
  const h = spec.height || 300;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 40 },
      keepNext: true,
      children: [new ImageRun({
        type: path.extname(file).slice(1).toLowerCase() === 'jpg' ? 'jpg' : 'png',
        data: fs.readFileSync(file),
        transformation: { width: w, height: h },
        altText: { title: spec.caption || '图', description: spec.caption || '图', name: spec.caption || '图' },
      })],
    }),
    caption(spec.caption || '', false),
  ];
}

/* 封面 */
const coverRow = (label, value) => {
  const text = String(value);
  const size = text.length > 16 ? 24 : 28;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2200, type: WidthType.DXA },
        borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { line: 480, lineRule: 'auto' },
          children: [new TextRun({ text: label, font: SONG, size: 28 })],
        })],
      }),
      new TableCell({
        width: { size: 5200, type: WidthType.DXA },
        borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: 480, lineRule: 'auto' },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
          children: [new TextRun({ text, font: SONG, size })],
        })],
      }),
    ],
  });
};

function buildCover(meta) {
  const logoPath = meta.logo
    ? (path.isAbsolute(meta.logo) ? meta.logo : path.join(base, meta.logo))
    : path.join(base, 'logo.png');
  const children = [];
  if (fs.existsSync(logoPath)) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 500, after: 400 },
      children: [new ImageRun({
        type: path.extname(logoPath).toLowerCase() === '.png' ? 'png' : 'jpg',
        data: fs.readFileSync(logoPath),
        transformation: { width: 420, height: 108 },
        altText: { title: '校徽', description: '校徽', name: '校徽' },
      })],
    }));
  } else {
    children.push(new Paragraph({ spacing: { before: 800 }, children: [] }));
  }
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 700 },
    children: [new TextRun({ text: meta.reportTitle || '电工电子实验报告', font: HEI, size: 64, bold: true })],
  }));
  children.push(new Table({
    width: { size: 7400, type: WidthType.DXA },
    columnWidths: [2200, 5200],
    alignment: AlignmentType.CENTER,
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [
      coverRow('课程名称：', meta.course || '电工电子实验（一）'),
      coverRow('实验名称：', meta.title || ''),
      coverRow('学　　院：', meta.college || '通信与信息工程学院'),
      coverRow('班　　级：', meta.class || ''),
      coverRow('学　　号：', meta.sid || ''),
      coverRow('姓　　名：', meta.name || ''),
      coverRow('指导教师：', meta.teacher || ''),
      coverRow('学　　期：', meta.term || ''),
    ],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  return children;
}

/* 正文 */
const body = [];
const meta = cfg.meta || {};

if (cfg.bodyTitle !== false) {
  body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: cfg.bodyTitle || ('实验名称：' + (meta.title || '')), font: HEI, size: 30, bold: true })],
  }));
}

for (const b of (cfg.blocks || [])) {
  switch (b.type) {
    case 'h1': body.push(h1(b.text)); break;
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

const header = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    children: [new TextRun({ text: cfg.headerText || '电工电子实验教学中心', font: SONG, size: SMALL })],
  })],
});

const sectionChildren = cfg.cover === false ? body : [...buildCover(meta), ...body];

const doc = new Document({
  styles: { default: { document: { run: { font: SONG, size: BODY }, paragraph: { spacing: { line: 360, lineRule: 'auto' } } } } },
  sections: [{
    properties: {
      titlePage: cfg.cover !== false,
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1440, bottom: 1134, left: 1440 } },
    },
    headers: cfg.cover === false
      ? { default: header }
      : { first: new Header({ children: [new Paragraph({ children: [] })] }), default: header },
    children: sectionChildren,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('written', OUT, buf.length);
});
