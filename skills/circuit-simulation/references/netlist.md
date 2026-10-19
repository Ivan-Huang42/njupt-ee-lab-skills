# SPICE 网表速查

## 一、基本规则

- 第一行通常是标题，以 `*` 开头。
- 节点 `0` 是地，必须存在。
- 一行一个元件，行尾不能有多余逗号。
- 不区分大小写；注释用 `*` 开头。
- 续行用 `+` 开头。
- 文件以 `.end` 结束。

## 二、元件语法

| 元件 | 语法 | 示例 |
|---|---|---|
| 电阻 | `Rname N1 N2 value` | `R1 A B 1k` |
| 电容 | `Cname N1 N2 value` | `C1 OUT 0 10u` |
| 电感 | `Lname N1 N2 value` | `L1 A B 1m` |
| 独立电压源 | `Vname N+ N- value` | `V1 IN 0 5` |
| 独立电流源 | `Iname N+ N- value` | `I1 IN 0 1m` |
| 直流电压源 | `Vname N+ N- DC value` | `V1 IN 0 DC 12` |
| 正弦源 | `Vname N+ N- SIN(offset amp freq)` | `V1 IN 0 SIN(0 1 1k)` |
| 受控源 E（VCVS） | `Ename N+ N- NC+ NC- gain` | `E1 OUT 0 IN 0 10` |
| 受控源 G（VCCS） | `Gname N+ N- NC+ NC- gm` | `G1 OUT 0 IN 0 1m` |
| 二极管 | `Dname A K model` | `D1 A K DLED` |
| 稳压管 | `Dname A K model` | `D1 A K DZ5V6` |
| NPN 三极管 | `Qname C B E model` | `Q1 C B 0 QNPN` |
| 运放（行为级） | `Ename OUT 0 IN+ IN- 1e6` | `E1 OUT 0 INP INN 1e6` |

单位后缀：`k` = 1e3，`meg` = 1e6，`m` = 1e-3，`u` = 1e-6，`n` = 1e-9，`p` = 1e-12。注意 `M` 在 SPICE 中是毫，不是兆。

## 三、常用分析语句

```spice
.op                              ; 直流工作点
.dc V1 0 5 0.1                   ; 电压源 V1 从 0 扫到 5，步长 0.1
.dc R1 1k 10k 1k                 ; 电阻参数扫描（部分版本支持）
.tran 0 10m 0 10u                ; 0 到 10 ms，最大步长 10 μs
.ac dec 100 10 1meg              ; 10 Hz 到 1 MHz，每十倍频 100 点
.step param RVAL 1k 10k 1k       ; 参数扫描
```

## 四、测量语句 `.meas`

### 工作点/直流

```spice
.meas op U_OUT FIND V(OUT)
.meas op I_R1 FIND I(R1)
.meas dc U_AT_4 FIND V(OUT) AT=4
```

### 最大值、最小值、平均值

```spice
.meas tran U_MAX MAX V(OUT) FROM 1m TO 10m
.meas tran U_MIN MIN V(OUT) FROM 1m TO 10m
.meas tran U_AVG AVG V(OUT) FROM 1m TO 10m
```

### 上升/下降时间

```spice
.meas tran T_RISE TRIG V(OUT) VAL=0.5 RISE=1 TARG V(OUT) VAL=4.5 RISE=1
.meas tran T_FALL TRIG V(OUT) VAL=4.5 FALL=1 TARG V(OUT) VAL=0.5 FALL=1
```

### 等效电阻

方法一：外加测试电流源，测电压。

```spice
I_TEST A 0 1m
.meas op U_TEST FIND V(A)
* R_EQ = U_TEST / 1mA
```

方法二：开路电压 / 短路电流。

```spice
.meas op U_OC FIND V(OUT)
.meas op I_SC FIND I(V_SHORT)
* R_EQ = U_OC / I_SC
```

## 五、常见器件模型

### 二极管

```spice
.model DLED D(Is=1e-20 N=1.8 Rs=10)
.model D1N4148 D(Is=2.52e-9 N=1.752 Rs=0.568 Cjo=4p)
```

### 稳压管

LTspice 中用 `D` 模型加 `BV`：

```spice
.model DZ5V6 D(Is=1e-14 N=1.5 BV=5.6 IBV=5m)
```

### NPN 三极管

```spice
.model QNPN NPN(Is=1e-14 Bf=100 Vaf=100)
```

## 六、示例：戴维南等效

```spice
* Thevenin: open-circuit voltage
V1 IN 0 10
R1 IN A 1k
R2 A 0 2k
R3 A OUT 500
R4 OUT 0 1k
.op
.meas op U_OC FIND V(OUT)
.end
```

```spice
* Thevenin: short-circuit current
V1 IN 0 10
R1 IN A 1k
R2 A 0 2k
R3 A OUT 500
R4 OUT 0 1k
VSHORT OUT 0 0
.op
.meas op I_SC FIND I(VSHORT)
.end
```

```spice
* Thevenin: equivalent resistance (turn off sources)
V1 IN 0 0
R1 IN A 1k
R2 A 0 2k
R3 A OUT 500
R4 OUT 0 1k
I_TEST OUT 0 1m
.op
.meas op U_TEST FIND V(OUT)
.meas op R_EQ PARAM U_TEST/1m
.end
```

## 七、调试顺序

1. 先只放电源和电阻，`.op` 能跑通再加器件。
2. 每个节点至少有一条到地的直流通路，避免悬空。
3. 电流出现 `e+xx` 量级，通常是单位写错（`m` 与 `meg`）。
4. `.meas` 没有结果，先看 `.log` 里是否有 `Error` 或 `Warning`。
5. 扫描类测量失败，检查 `AT=` 是否落在扫描范围内。
