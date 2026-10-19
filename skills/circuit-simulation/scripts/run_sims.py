#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch-run SPICE netlists with LTspice and collect .meas results.

Usage:
    python run_sims.py                         # run every .cir in ../examples
    python run_sims.py path/to/circuit.cir     # run one netlist
    python run_sims.py --dir path/to/dir       # run every .cir in a directory
    python run_sims.py --json result.json      # also write machine-readable JSON
    python run_sims.py --ltspice PATH ...      # explicit LTspice executable

LTspice lookup order:
    1. --ltspice
    2. LTSPICE environment variable
    3. common Windows/macOS install locations
    4. `LTspice` / `ltspice` on PATH
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_DIR = HERE.parent / "examples"

# Lines produced by LTspice in the .log file, e.g.
#   i_r1: I(R1)=0.005235  AT 4
MEAS_RE = re.compile(
    r"^\s*([A-Za-z_]\w*)\s*:\s*[^=]+=\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)"
)


def find_ltspice(explicit: str | None = None) -> str:
    """Return a usable LTspice executable path or exit with a helpful message."""
    candidates: list[str] = []
    if explicit:
        candidates.append(explicit)
    if os.environ.get("LTSPICE"):
        candidates.append(os.environ["LTSPICE"])

    local = os.environ.get("LOCALAPPDATA", "")
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")

    candidates += [
        os.path.join(program_files, "ADI", "LTspice", "LTspice.exe"),
        os.path.join(local, "Programs", "ADI", "LTspice", "LTspice.exe"),
        os.path.join(program_files, "LTC", "LTspiceXVII", "XVIIx64.exe"),
        os.path.join(program_files_x86, "LTC", "LTspiceXVII", "XVIIx64.exe"),
        os.path.join(program_files_x86, "LTC", "LTspiceIV", "scad3.exe"),
        "/Applications/LTspice.app/Contents/MacOS/LTspice",
    ]

    for name in ("LTspice", "ltspice", "XVIIx64", "scad3"):
        found = shutil.which(name)
        if found:
            candidates.append(found)

    for path in candidates:
        if path and Path(path).is_file():
            return str(Path(path))

    sys.exit(
        "找不到 LTspice。请用 --ltspice 指定可执行文件，或设置环境变量 LTSPICE。\n"
        "Windows 常见路径：C:\\Program Files\\ADI\\LTspice\\LTspice.exe"
    )


def parse_log(log_path: Path) -> dict[str, float]:
    """Parse `.meas` result lines from an LTspice log file."""
    values: dict[str, float] = {}
    if not log_path.exists():
        return values
    with log_path.open(encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            match = MEAS_RE.match(line)
            if match:
                values[match.group(1)] = float(match.group(2))
    return values


def run_one(exe: str, cir: Path, timeout: int = 120) -> dict[str, float]:
    """Run one netlist in batch mode and return its measurements."""
    cir = cir.resolve()
    log_path = cir.with_suffix(".log")
    if log_path.exists():
        log_path.unlink()

    cmd = [exe, "-b", "-run", str(cir)]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cir.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"仿真超时（>{timeout}s）：{cir.name}")

    if proc.returncode != 0:
        output = proc.stdout.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(f"LTspice 返回 {proc.returncode}：{cir.name}\n{output}")

    values = parse_log(log_path)
    if not values:
        raise RuntimeError(
            f"没有读到 .meas 结果：{cir.name}\n"
            "请检查网表中是否有 .meas 语句，以及 .log 是否生成。"
        )
    return values


def unit_of(name: str) -> tuple[str, float]:
    """Infer display unit and scale factor from a measurement name."""
    lowered = name.lower()
    suffixes = [
        ("_kohm", "kΩ", 1e-3),
        ("_mohm", "mΩ", 1e3),
        ("_ohm", "Ω", 1.0),
        ("_ma", "mA", 1e3),
        ("_ua", "μA", 1e6),
        ("_na", "nA", 1e9),
        ("_a", "A", 1.0),
        ("_mv", "mV", 1e3),
        ("_kv", "kV", 1e-3),
        ("_v", "V", 1.0),
        ("_mw", "mW", 1e3),
        ("_w", "W", 1.0),
    ]
    for suffix, unit, scale in suffixes:
        if lowered.endswith(suffix):
            return unit, scale

    if lowered.startswith("i"):
        return "mA", 1e3
    if lowered.startswith("r"):
        return "Ω", 1.0
    if lowered.startswith("p"):
        return "W", 1.0
    return "V", 1.0


def format_value(name: str, value: float) -> str:
    unit, scale = unit_of(name)
    scaled = value * scale
    if unit in ("μA", "nA", "mA", "A"):
        return f"{scaled:9.3f} {unit}"
    if unit in ("kΩ", "mΩ", "Ω"):
        return f"{scaled:9.2f} {unit}"
    return f"{scaled:9.4f} {unit}"


def print_result(cir: Path, values: dict[str, float]) -> None:
    print(f"\n== {cir.name}")
    width = max((len(k) for k in values), default=8)
    for key, value in values.items():
        print(f"  {key:<{width}}  {format_value(key, value)}")


def collect(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(p for p in path.glob("*.cir") if p.is_file()))
        elif path.suffix.lower() == ".cir":
            files.append(path)
        else:
            print(f"跳过非 .cir 文件：{path}", file=sys.stderr)
    # Remove duplicates while keeping order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in files:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(resolved)
    return unique


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-run LTspice netlists and collect .meas results.")
    parser.add_argument("paths", nargs="*", help="netlist files or directories")
    parser.add_argument("--dir", dest="directory", help="directory containing .cir files")
    parser.add_argument("--ltspice", help="path to the LTspice executable")
    parser.add_argument("--json", dest="json_out", help="write results to a JSON file")
    parser.add_argument("--timeout", type=int, default=120, help="per-netlist timeout in seconds")
    args = parser.parse_args()

    targets: list[Path] = [Path(p) for p in args.paths]
    if args.directory:
        targets.append(Path(args.directory))
    if not targets:
        targets = [DEFAULT_DIR]

    files = collect(targets)
    if not files:
        print("没有找到 .cir 网表。", file=sys.stderr)
        return 1

    exe = find_ltspice(args.ltspice)
    print(f"LTspice: {exe}")
    print(f"待运行: {len(files)} 个网表")

    results: dict[str, dict[str, float]] = {}
    failed = 0
    for cir in files:
        try:
            values = run_one(exe, cir, timeout=args.timeout)
        except Exception as exc:  # noqa: BLE001 - report and continue with other files
            failed += 1
            print(f"\n!! {cir.name} 失败：{exc}", file=sys.stderr)
            continue
        results[cir.name] = values
        print_result(cir, values)

    if args.json_out:
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(results, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nJSON 已写入：{out_path.resolve()}")

    print(f"\n完成：成功 {len(results)}，失败 {failed}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
