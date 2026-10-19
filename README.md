# 电工电子实验 Skill 包

面向工科“电工电子实验”课程的四个 AI Agent 技能：正式报告、预习报告、手写稿、电路仿真。
默认按南京邮电大学电工电子实验中心格式制作，其他学校改几个字段即可复用。

> 工具只负责排版、计算与仿真。实验数据必须来自真实测量；请遵守所在学校的学术规范。

## 包含的技能

| 技能 | 目录 | 用途 |
|---|---|---|
| 实验报告撰写 | [`skills/lab-report`](skills/lab-report) | 根据讲义要求与实测数据生成正式实验报告 docx，含封面、页眉、图表、误差分析 |
| 预习报告内容撰写 | [`skills/preview-report`](skills/preview-report) | 生成预习报告内容：目的、原理、参数、仿真预测、结论、注意事项 |
| 预习报告手写 | [`skills/handwritten-preview`](skills/handwritten-preview) | 按 158×217 mm 信纸、零页边距、每页约 30 行排出手写稿 |
| 电路自动仿真 | [`skills/circuit-simulation`](skills/circuit-simulation) | 批量运行 SPICE 网表，自动提取 `.meas` 结果，支持 JSON 输出 |

## 适合谁

- 第一次写电工电子实验报告，不知道章节、图表、页眉怎么排。
- 预习报告要求手写在信纸上，需要先有一份行位置准确的底稿。
- 不想装 Multisim，或想用可版本管理的网表做仿真。
- 想把“读讲义 → 算参数 → 仿真 → 排版 → 检查”固化成可复用流程。

## 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | 18+ | 生成 docx |
| npm 包 `docx` | 9.x | 三个报告技能共用 |
| Python | 3.8+ | 运行仿真脚本 |
| LTspice | 17/24+ | 电路仿真 |
| Word / WPS | 任意 | 打开 docx、导出 PDF |
| 手写字体 | 可选 | 默认 `平方相思体`，没有则改 `KaiTi` |

LTspice 下载：<https://www.analog.com/en/resources/design-tools-and-calculators/ltspice-simulator.html>

## 安装

### 1. 放到 Agent 的技能目录

把 `skills/` 下的四个目录复制到你的 Agent 技能目录，例如：

```text
# Trae / 项目级
<项目>/.trae/skills/

# Claude Code / 通用 Agent Skills
~/.claude/skills/
```

复制后目录结构应类似：

```text
.trae/skills/
├── lab-report/
│   └── SKILL.md
├── preview-report/
│   └── SKILL.md
├── handwritten-preview/
│   └── SKILL.md
└── circuit-simulation/
    └── SKILL.md
```

### 2. 安装 docx 依赖

三个报告技能各自独立，进入对应 `scripts` 目录安装一次：

```powershell
cd skills/lab-report/scripts
npm install docx

cd ../../preview-report/scripts
npm install docx

cd ../../handwritten-preview/scripts
npm install docx
```

也可以在每个 `scripts` 目录运行 `npm install`，会自动读取 `package.json`。

### 3. 安装 LTspice

- Windows 默认安装路径：`C:\Program Files\ADI\LTspice\LTspice.exe`
- 其他路径：设置环境变量 `LTSPICE`，或运行时加 `--ltspice "路径"`。
- 首次安装后先用 GUI 打开一次，确认能正常仿真。

### 4. 安装手写字体（可选）

`handwritten-preview` 默认使用 `平方相思体`。没有该字体时：

- 安装字体后重新生成；或
- 在配置里把 `"font": "平方相思体"` 改成 `"font": "KaiTi"`。

## 快速开始

### 正式实验报告

```powershell
cd skills/lab-report/scripts
node build_report.js report.example.json
```

输出 `B00000000-张三-SY1-BG1.docx`。把 `report.example.json` 复制成自己的配置，修改 `meta` 与 `blocks`。

### 预习报告

```powershell
cd skills/preview-report/scripts
node build_preview.js preview.example.json
```

### 手写版预习报告

```powershell
cd skills/handwritten-preview/scripts
node build_hand.js hand.example.json
```

### 电路仿真

```powershell
cd skills/circuit-simulation
python scripts/run_sims.py
python scripts/run_sims.py examples/kirchhoff.cir
python scripts/run_sims.py --dir examples --json result.json
```

## 统一配置格式

三个报告技能都使用“JSON 配置 + 块列表”的方式描述正文，改内容不需要改代码。

```json
{
  "out": "B00000000-张三-SY1-BG1.docx",
  "meta": {
    "course": "电工电子实验（一）",
    "title": "线性电阻与非线性电阻伏安特性",
    "class": "你的班级",
    "sid": "你的学号",
    "name": "你的姓名",
    "teacher": "指导教师",
    "term": "2026—2027 学年  第一学期"
  },
  "blocks": [
    { "type": "h1", "text": "一、实验目的" },
    { "type": "p", "text": "..." },
    { "type": "table", "caption": "表 1  线性电阻伏安特性", "rows": [["U / V", "0", "1.0"], ["I / mA", "0", "1.03"]] },
    { "type": "figure", "file": "curve.png", "width": 520, "height": 289, "caption": "图 1  伏安特性曲线" }
  ]
}
```

支持的块类型：

| 类型 | 作用 | 关键字段 |
|---|---|---|
| `h1` | 一级标题 | `text` |
| `h2` | 二级标题 | `text` |
| `p` | 正文（首行缩进） | `text` |
| `note` | 正文（不缩进） | `text` |
| `formula` | 居中公式 | `text` |
| `pagebreak` | 强制分页 | 无 |
| `figure` | 图片 + 图题 | `file`、`width`、`height`、`caption` |
| `table` | 表格 + 表题 | `caption`、`rows`、`shade`、`widths` |

图片路径相对配置文件所在目录；也可以写绝对路径。

## 目录结构

```text
njupt-ee-lab-skills/
├── README.md
├── LICENSE
├── .gitignore
└── skills/
    ├── lab-report/
    │   ├── SKILL.md
    │   ├── references/format.md
    │   └── scripts/
    │       ├── build_report.js
    │       ├── report.example.json
    │       └── package.json
    ├── preview-report/
    │   ├── SKILL.md
    │   ├── references/content.md
    │   └── scripts/
    │       ├── build_preview.js
    │       ├── preview.example.json
    │       └── package.json
    ├── handwritten-preview/
    │   ├── SKILL.md
    │   ├── references/format.md
    │   └── scripts/
    │       ├── build_hand.js
    │       ├── hand.example.json
    │       └── package.json
    └── circuit-simulation/
        ├── SKILL.md
        ├── references/netlist.md
        ├── examples/*.cir
        └── scripts/run_sims.py
```

## 常见问题

**Q：`Cannot find module 'docx'`**
在对应的 `scripts` 目录运行 `npm install docx`，不要在仓库根目录安装。

**Q：找不到 LTspice**
用 `--ltspice` 指定路径，或设置环境变量：

```powershell
$env:LTSPICE = "C:\Program Files\ADI\LTspice\LTspice.exe"
```

**Q：仿真报“没有读到 .meas 结果”**
检查网表是否有 `.meas` 语句、是否以 `.end` 结束，以及 `.log` 是否生成。

**Q：手写版字体不对**
字体没安装，Word 自动替换了。安装字体后重新生成；临时可用 `KaiTi`。

**Q：图片不显示 / 报“图片不存在”**
`file` 路径是相对配置文件目录的。把图片和 JSON 放在同一目录，或写绝对路径。

**Q：中文路径导致 LTspice 失败**
把网表复制到纯英文路径再运行。

**Q：页边距为 0 打印被裁切**
普通打印机有不可打印边距。建议导出 PDF 后照抄，或先用废纸试打。

## 自定义学校格式

- 封面字段：改 `SKILL.md` 与 `references/format.md` 中的说明，配置里填自己的学校/学院。
- 页眉：改配置的 `headerText`。
- 校徽：把 `logo.png` 放在配置文件同目录，或设置 `meta.logo`；没有校徽时封面自动留白。
- 手写纸尺寸：改 `handwritten-preview` 配置的 `page.width` / `page.height`（单位 twips）。
- 报告结构：按讲义要求增删 `blocks`，不要把别的实验的章节直接套过来。

## 贡献

欢迎提交 Issue / PR：

- 新增实验项目的示例配置或网表；
- 适配其他学校的封面与页眉；
- 修复排版、仿真兼容性问题。

提交前请确认不包含个人姓名、学号、身份证号、联系方式等隐私信息。

## License

[MIT](LICENSE)
