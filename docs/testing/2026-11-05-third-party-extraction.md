# 第三方归档离线真实解包：单次 extract 运行记录

- 日期：2026-11-05
- 范围：`experiments/third-party-pilots/extract/`，**extract 模式**（仅字节与路径，不执行任何仓库代码）
- 授权：Lead 批准 ONE 次 `bash experiments/third-party-pilots/extract/run.sh extract`
- 结果：**overall_rc=70**（`refusal=extractor_refused:harbor`）
  - `toolkit`：`extract_rc=0`，`verdict=extracted`，297 文件 / 1,248,623 字节 / 11 个 LICENSE 已保存
  - `harbor`：`extract_rc=70`，`verdict=refused_by_extractor`，**按设计拒绝**（单文件预算），
    校验先于写入 ⇒ **无输出目录、无报告文件**，首败即停，**未尝试第二目标之后的任何动作**，未重试

本文件只记录本次实际观测值。**不得由本次结果推出"该解包器普遍安全"，也不得推出任何第三方插件
可安全运行**——本次只覆盖两个特定归档的字节与路径层面处理。

## 1. GO 闸（新建 extract 闸并消费关闭）

| 项目 | 值 |
| --- | --- |
| 运行前是否存在 `GO-extract.txt` | 否（`GO_extract_preexisting=no`） |
| 创建方式 | `( set -C; printf 'GO extract\n' > GO-extract.txt )` 排他；`od -c` 核对 |
| 门禁值 | 严格单行 `GO extract`，`GATE_VALUE_EXACT=yes`，sha256 `245a49e251d37538679b0be3286b03194e4a4ef9441292bd4cfb607501de5c75` |
| 运行后关闭 | 追加消费说明，`GATE_CLOSED=yes`，sha256 `054eb0ec106618d540312227d4d764924df3f3ec669ef958bb2ba0de96846b93` |

`GO-test.txt` 与两个 `GO-test.history.*.txt` 未改动。

## 2. 执行（ONE，无重试，无额外探针）

```
bash experiments/third-party-pilots/extract/run.sh extract
exc_overall_rc=70
exc_run_dir=/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T175647Z-exc-extract-411315-5767
exc_unit=exc-third-party-extract-20261104T175647Z-411315
```

固定输入未改：`payload.sh:48-54` 的归档路径、`sha256`、`expected_top` 与既有值一致
（`archive_sha256_expected` 见第 3 节）。未安装、未构建、未执行任何脚本
（`no_archive_content_executed=yes`、`evidence_scope=bytes_and_paths_only`）。

## 3. 两目标实际状态

### 3.1 toolkit（成功）

```
archive=/root/dsh-ecosystem-spec/experiments/third-party-pilots/acquire/runs/20261104T170138Z-acquire-409347-8019/artifacts/toolkit-c3319d9d3e78a18191e1381461b69e84bc547575.tar.gz
archive_sha256=deedca61dbc38b67fc13acd8a7d22cb38f5589a9fbf07213ced3b2649ef768c8
expected_top=dsh-toolkit-c3319d9d3e78a18191e1381461b69e84bc547575
members_validated=355
files_written=297
declared_bytes=1248623
written_bytes=1248623
target=toolkit extract_rc=0 verdict=extracted
```

- 输出（保留现场）：`runs/20261104T175647Z-exc-extract-411315-5767/out-toolkit/dsh-toolkit-c3319d9d3e78a18191e1381461b69e84bc547575/`
- 逐文件摘要与字节见 `extract-toolkit.txt`（含每成员一行 sha256/字节/相对路径）。
- 成员 355 中 297 为普通文件、其余为目录（`files_written=297` 与磁盘实测 `find -type f | wc -l` 一致，
  `du -sb` 为 1,248,623 与 `written_bytes` 一致）。

### 3.2 toolkit 的 LICENSE 证据（原字节哈希 + 保存路径）

```
license_files_found=11
license_present=yes
license_file 8bda1ee96ffdbd04ee68ecb89ba02c1010398f8d081218d809ecf817d45b18a9 1066 <top>/LICENSE
（同 sha256 与 1066 字节，另 10 处：）
packages/dsh-tool-calculator/LICENSE, packages/dsh-tool-csv/LICENSE, packages/dsh-tool-diff/LICENSE,
packages/dsh-tool-encoding/LICENSE, packages/dsh-tool-json/LICENSE, packages/dsh-tool-markdown/LICENSE,
packages/dsh-tool-regex/LICENSE, packages/dsh-tool-schema/LICENSE, packages/dsh-tool-stat/LICENSE,
packages/dsh-tool-time/LICENSE
```

保存路径基准目录：
`/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T175647Z-exc-extract-411315-5767/out-toolkit/dsh-toolkit-c3319d9d3e78a18191e1381461b69e84bc547575/`
根 `LICENSE` 全路径示例：
`…/out-toolkit/dsh-toolkit-c3319d9d3e78a18191e1381461b69e84bc547575/LICENSE`
（sha256 `8bda1ee9…`，1066 B，11 份内容完全相同——**本次只记录字节哈希，未对许可证文本做法律解释**。）

### 3.3 harbor（被拒绝，现场保留）

```
archive=/root/dsh-ecosystem-spec/experiments/third-party-pilots/acquire/runs/20261104T170138Z-acquire-409347-8019/artifacts/harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9.tar.gz
archive_sha256=c6d0588c74cba742c310958ccefffaebdad8984deefdd524816df6d80445cef4
expected_top=dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9
target=harbor extract_rc=70 verdict=refused_by_extractor (partial output kept, no retry)
```

拒绝原因（`unit.log` 原文）：

```
extract: refused: member 'dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9/board/index.json'
          is 31988917 bytes, over the per-file budget of 20971520
```

- 这是**设计内**的单文件预算拒绝（`unpack_cap_file_bytes=20971520`），不是崩溃。
- 校验先于写入，故 **`out-harbor/` 未创建、`extract-harbor.txt` 未生成**（实测：目录中只有
  `out-toolkit`，无 harbor 报告文件）。"partial output kept" 指 toolkit 的成功产物被保留，不重试。
- 后续动作：**未**提升预算、**未**重跑、**未**改归档或期望值。

## 4. 资源信封与隔离（实测读回）

`extract-manifest.txt`（payload 在 unit 内自证）：

```
cgroup_proof=yes   memory.max=805306368  memory.swap.max=0  pids.max=32  cpu.max=50000 100000
unit_proof=yes     unit_type=exec  runtime_max_raw=2min → 120000000  memory_max=805306368  tasks_max=32
```

- 单次门槛：`exc_gate_memavailable_kib=1583808 ≥ 1228800`，`exc_gate=pass`，采样 1 次。
- 隔离：`PrivateNetwork=yes`（unit）+ `--unshare-net`（bwrap），网络无路由；`--ro-bind / /`，
  仅 run 目录可写；`env -i` 最小 `PATH` + `PYTHONDONTWRITEBYTECODE=1` + `HOME`/`TMPDIR` 在 run 目录。
- 运行指标（`unit.log`）：`Service runtime 337ms`、`CPU time consumed 176ms`、
  `Memory peak 19.7M (swap: 0B)`。
- 共享锁 `experiments/acceptance/runs/.acceptance.lock` 仍为串行化手段，不宣称全局唯一。

## 5. 冻结输入校验（前后逐字节一致）

```
hash_status=identical
db52044c24e26afa66dca6cc0323d7541f5461f0f787879f9f1b28cce83324e6  run.sh
aad620cce19aef51e5783f6f220d1fc365ddb174ab8e0b0797d38c6673c22cd6  payload.sh
cdd4bfe5b947723a0b7deb828729231b5ec36f49f8b5fedf15e535f64d5e635a  extract.py
ee0f39b34d77ff9528980a2720831f5ca3250acb3a2001e84520b0642e248cdf  tests/negative-tests.py
f8cdfb036233bb7ee93478392b85d2772ccb845f0e03c657712f9d94b93633b8  README.md
```

与第三次 test 运行同值 ⇒ 本次运行未改动被冻结的 5 个输入。

## 6. 终态与清理

`verdict.txt`：`unit_rc=70`、`systemd-run.rc=70`、`unit_load_state=loaded`、
`unit_active_state=failed`、`unit_sub_state=failed`、`unit_main_pid=0`、
`terminal_state=failed_mainpid0`、`terminal_confirmed=yes`、`cleanup_stop_rc=0`、
`cleanup_reset_failed_rc=0`、`state_after_cleanup=not_found_loadstate`、`after_show_rc=0`、
`after_terminal_confirmed=yes`。`unit-scan.txt` 为空（无残留 unit）。
`unit_unload_guaranteed=no` —— 仅以 systemd 视角 `not-found` 佐证，不声称证明彻底卸载。

## 7. 证据边界（重要）

- **archive sha256 只证明传输字节与采集时一致**，不证明等于所指 commit，也不构成 Git 签名或来源真实性证明。
- 本次**未**对 LICENSE 文本作法律判断，只记录原字节哈希与保存路径；"11 份相同"是字节事实。
- 未加载、未解析、未执行归档内任何 JS/TS/脚本；`no_archive_content_executed=yes`。
- toolkit 成功**不代表**其插件能在当前 DSH/kit 下加载、注册或卸载——本次完全没有触碰运行时。
- harbor 被拒**不代表**其内容恶意，仅表示某成员超过本项目自定的 20 MiB 单文件预算。
- 网络隔离与只读根由 argv + 运行成功支持，未做独立逃逸测试。

## 8. 偏差与限制（本次实际观测）

1. `unit-props.txt` 仍是**事后**快照（unit 退出后读取），不可作信封证据；有效读数在
   `extract-manifest.txt`（第 4 节）。本次因 unit 处于 `failed`，`stop_rc=0`/`reset_failed_rc=0`
   正常返回。
2. `harbor` 的成员计数与逐文件摘要**无法提供**：拒绝发生在前置校验阶段，未写入任何内容。
   因此不能声称"harbor 只有某几个超大成员"之类结论，只能引用拒绝消息中的那一个成员与字节数。
3. `MemoryPeak` 仅有 `unit.log` 的 `19.7M`（属性未读回），不推算精确字节数。
4. 本次仅一次运行，未重试、未调整预算、未改 runner；`GO-extract.txt` 已关闭，再次运行需**新的**单次授权。
5. 未触碰 GUI `http://127.0.0.1:3080`，未触碰生产 `/root/.dsh`，未安装/构建/运行任何插件。

## 9. 后续更正："不额外探针"的表述不准确

回执里曾写"不额外探针"。准确表述应为：**没有额外的系统级探针**（没有再次 `systemd-run`、没有
再次 bwrap、没有再次解包或跑测试），**但运行结束后确实执行了只读命令**读取证据并核对产物：

- `ls -la`（列 run 目录）
- `cat`：`status.txt`、`verdict.txt`、`extract-manifest.txt`、`gate.txt`、`hashes-before.txt`、
  `hashes-after.txt`、`unit-props.txt`、`unit-props-after.txt`、`unit-cleanup.txt`、
  `systemd-run.rc`、`argv.txt`、`unit.log`
- `head -12`、`tail -8`、`grep -n 'license'`（`extract-toolkit.txt`）
- `find out-toolkit -maxdepth 2`、`find out-toolkit -type f | wc -l`、`du -sb out-toolkit`

因此 §3.1 的"`files_written=297` 与磁盘实测一致、`du -sb` = 1,248,623 与 `written_bytes` 一致"
**不是 unit 内部读数**，而是运行后外部只读核对的结果；它们是交叉核对，不改变 unit 证据的层级。

按 Lead 要求，本次更正**不补跑任何命令取证**，仅就已发生的操作如实披露；也没有因这些只读命令
而放宽、重跑或改写任何既有结果。
