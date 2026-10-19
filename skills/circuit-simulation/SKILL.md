---
name: circuit-simulation
description: 用 SPICE 网表做电工电子实验的直流/暂态仿真并自动提取测量值。当用户要求“仿真电路”“跑仿真”“验证基尔霍夫/叠加定理/戴维南定理”“用 LTspice 算工作点”或需要预习报告中的仿真数据时使用。
---

# 电路自动仿真

## 适用范围

- 用 SPICE 网表描述电路，批处理运行，自动读取 `.meas` 结果。
- 适合验证性实验的直流工作点、分压分流、基尔霍夫定律、叠加定理、戴维南/诺顿等效、二极管与稳压管特性、晶体管静态工作点。
- 不用于 PCB 布局、电磁场仿真或需要交互操作的电路设计。
- 运行器默认调用 LTspice；网表本身是标准 SPICE，可换用 ngspice 等（需自行调整测量语句）。

## 输入清单

1. 电路拓扑与元件参数（电阻、电源、二极管型号等）。
2. 要验证的物理量：节点电压、支路电流、开路电压、短路电流、等效电阻。
3. 仿真类型：`.op`（工作点）、`.dc`（扫描）、`.tran`（暂态）。
4. 输出用途：终端查看、JSON、插入预习/实验报告。

## 工作流程

1. **画拓扑**：在纸上或原理图工具中确认节点编号，选一个节点为地 `0`。
2. **写网表**：在 `.cir` 文件中按“元件名 节点1 节点2 参数”逐行描述。
3. **加测量**：每条 `.meas` 只测一个量，命名遵循下方约定。
4. **跑仿真**：`python scripts/run_sims.py 你的网表.cir`。
5. **核对**：用 KCL/KVL 或理论公式手算一遍，确认量级与符号。
6. **交付**：把结果填入报告；需要图表时再导出波形或扫描曲线。

## 快速开始

```powershell
cd <本技能目录>
python scripts/run_sims.py                     # 跑 examples/ 下全部网表
python scripts/run_sims.py examples/kirchhoff.cir
python scripts/run_sims.py --dir 你的网表目录 --json result.json
```

指定 LTspice 路径（自动查找失败时）：

```powershell
python scripts/run_sims.py --ltspice "C:\Program Files\ADI\LTspice\LTspice.exe" examples
```

也可以设置环境变量 `LTSPICE`。

## 测量命名约定

脚本按名字判断单位，建议统一使用下列前缀/后缀：

| 名字示例 | 含义 | 输出单位 |
|---|---|---|
| `I_R1`、`I_AB` | 支路电流 | mA |
| `U_AB`、`V_B` | 节点/支路电压 | V |
| `R_EQ`、`REQ` | 等效电阻 | Ω |
| `P_R1` | 功率 | W |
| `I_R1_mA` | 强制以 mA 输出 | mA |
| `U_AB_mV` | 强制以 mV 输出 | mV |
| `R_EQ_kOhm` | 强制以 kΩ 输出 | kΩ |

后缀优先级最高；没有后缀时按首字母推断：`I` 电流、`R` 电阻、`P` 功率，其余按电压。

## 网表最小示例

```spice
* 分压电路
V1 IN 0 5
R1 IN OUT 1k
R2 OUT 0 2k
.op
.meas op U_OUT FIND V(OUT)
.meas op I_R1 FIND I(R1)
.end
```

运行后终端输出：

```text
== divider.cir
  U_OUT       3.3333 V
  I_R1        1.6667 mA
```

## 常用仿真类型

| 类型 | 语句 | 用途 |
|---|---|---|
| 工作点 | `.op` | 直流偏置、静态工作点 |
| 直流扫描 | `.dc V1 0 5 0.1` | 伏安特性、传输特性 |
| 暂态 | `.tran 0 10m 0 10u` | 电容充放电、整流波形 |
| 参数扫描 | `.step param R 1k 10k 1k` | 参数敏感性 |

`.meas` 的 `FIND` 可配合 `WHEN`、`AT`、`FROM/TO` 使用：

```spice
.meas tran U_MAX MAX V(OUT) FROM 1m TO 10m
.meas tran T_RISE TRIG V(OUT) VAL=0.5 RISE=1 TARG V(OUT) VAL=4.5 RISE=1
```

## 常见错误

- **没有地节点**：每个网表必须有 `0` 节点，否则无法求解。
- **节点名不一致**：`A` 与 `a` 在部分 SPICE 中视为同一节点，但不要依赖这一点。
- **电流方向为负**：`I(R1)` 的正方向是从第一个节点流向第二个节点，符号与实物接线无关。
- **`.meas` 写在 `.end` 之后**：不会执行。
- **扫描点没覆盖测量点**：`.dc` 范围必须包含 `.meas ... AT=` 的值。
- **LTspice 找不到**：用 `--ltspice` 或环境变量 `LTSPICE` 指定。
- **中文路径**：LTspice 批处理对部分中文路径不友好，必要时把网表放到纯英文目录。
- **日志是旧的**：脚本运行前会删除同名 `.log`，不要手工复用旧日志。

## 工具链

- `scripts/run_sims.py`：批量运行、解析 `.log`、格式化输出、可选 JSON。
- `examples/`：基尔霍夫、叠加定理、戴维南等效的完整示例网表。
- `references/netlist.md`：SPICE 语法、元件模型、测量语句速查。

## 依赖

- Python 3.8+
- LTspice（Windows/macOS）。安装后先用 GUI 打开一次，确认可正常仿真。
- 不需要额外的 Python 包。
