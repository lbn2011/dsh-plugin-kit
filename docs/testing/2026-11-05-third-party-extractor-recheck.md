# extract 切片重测记录（2026-11-05，单次授权，test 模式）

本文件记录 Lead 授权后的**一次** `run.sh test` 重测，用于验证上一轮对
`repeated_trailing_slash_refused` 归因更正后的套件。**这不是通过记录**：`overall_rc=72`
（证据不完整），原因与预测一致（NUL 归档夹具仍 skip）。

上一轮（`passed=42 failed=2 skipped=1`，`overall_rc=72`）的原始记录保留在
`2026-11-05-third-party-extractor-unit.md`，本文不改写它。

## 1. GO 闸处理（非破坏性，历史未丢失）

`run.sh:63-72` 要求 `GO-$MODE.txt` 的 `cat` 输出**严格等于** `GO test`（内部换行保留），
因此"在同一文件里追加授权标记"与"闸合法"不可兼得。经 Lead 批准采用非破坏性变体，实际执行：

| 步骤 | 操作 | 证据 |
| --- | --- | --- |
| 1 | 只读 `GO-test.txt` 原内容并备份为**排他新文件** `GO-test.history.20261104T174305Z.txt`（`set -C` + `cat >`，不覆盖既有文件） | 原文件 116 B，`sha256=16451dc3d093a30421137a0cc093bdd3812186e9a550db398d0d0521529c9a18` |
| 2 | `cmp -s GO-test.txt GO-test.history.<ts>.txt` 核对一致 | `BACKUP_VERIFIED=yes`，备份 `sha256` 与原件逐字节一致 |
| 3 | 定点替换 `GO-test.txt` 为严格单行 `GO test`（`printf … >`，同一 inode，**未 move/delete**） | `od -c` = `G O   t e s t \n`；`GATE_VALUE_EXACT=yes` |
| 4 | 运行结束后追加已消费说明，**重新关闭门禁** | `GATE_CLOSED=yes`（见第 3 节末） |

备份与授权路径均已写入本节及第 3 节；**未创建 `GO-extract.txt`**，`extract` 模式仍无授权。

## 2. 执行（ONE，仅一次，无重试）

```
cd /root/dsh-ecosystem-spec
bash experiments/third-party-pilots/extract/run.sh test
```

- 退出码：`exc_overall_rc=72`
- run 目录：`/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T174318Z-exc-test-410684-21411`
- unit：`exc-third-party-test-20261104T174318Z-410684`（transient，`Type=exec`）
- 未做额外探针、未 `bash -n`、未自动修复、未重跑。

## 3. 结果（实测计数与退出码）

套件（`negative-tests.txt`）：

```
negative_tests_rc=4
negative_tests_verdict=incomplete_due_to_skips
passed=45 failed=0 skipped=1
suite_seconds=1.9
```

**45 通过 / 0 失败 / 1 跳过**（上轮 42/2/1）。按既定映射
`4 → incomplete_due_to_skips → final_work_rc=72`，`/usr/bin/systemd-run` rc=72，
`verdict.txt` 中 `overall_rc=72`。**有 skip 即 overall 非通过，未把 45 通过写成"全部通过"。**

- 唯一 skip：`case=nul_name_refused verdict=skip reason=tarfile cannot encode this member detail=stored names ['top/a'] differ from ['top/a\x00b'] (not proof of anything)`。
  写盘时被截断为 `top/a`，夹具不具备该用例依赖的属性 —— 当时记为**具名夹具限制**，不虚构 tar 级拒绝。
  **（该归因在 §9 已更正：截断来自旧夹具用 GNU 名字字段，PAX `path` 记录可以承载 NUL；skip 理由串
  是当次原始输出，保留不改。）**
- 本轮改动涉及的用例全部 pass：`normalize_reject_repeated_trailing_slash`、
  `normalize_reject_nul_char`、`slashdot_component_refused`、`duplicate_member_refused`，以及正向边界
  `parser_normalizes_dir_trailing_slashes`（detail 明写 tarfile 对目录 rstrip、原始头字节不是策略边界）。
- 上轮两条失败中：`repeated_trailing_slash_refused` 已按 parser 事实删除并改为正向边界；
  `duplicate_slashdot_refused` 已改名 `slashdot_component_refused` 并断言可达的 `'.' component`。

`status.txt`：`work_rc=72 record_rc=0 unpack=not_attempted refusal=none`。

门禁收尾（`GO-test.txt` 末行为本次消费说明）：

```
GO test
consumed=yes run_id=20261104T174318Z-exc-test-410684-21411 overall_rc=72 reason=incomplete_due_to_skips single_use_authorization_spent=yes backup=GO-test.history.20261104T174305Z.txt
```

## 4. 资源信封与隔离（实测读回）

`gate.txt`：`exc_gate_memavailable_kib=1694928` ≥ `required_kib=1228800`，`exc_gate=pass`，`exc_gate_samples=1`。

`argv.txt`（有效 argv，原样）：

```
systemd-run --wait --pipe --unit=exc-third-party-test-20261104T174318Z-410684
  --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0
  --property=TasksMax=32 --property=RuntimeMaxSec=120 --property=CPUQuota=50%
  --property=PrivateNetwork=yes --property=WorkingDirectory=…/extract
  -- /bin/bash …/payload.sh <unit> <run-dir> test 1694928
```

`extract-manifest.txt` 读回（`cgroup_proof=yes`、`unit_proof=yes`）：
`cgroup_memory_max=805306368`、`cgroup_memory_swap_max=0`、`cgroup_pids_max=32`、
`cgroup_cpu_max=50000 100000`；`unit_type=exec`、`unit_runtime_max_raw=2min`、
`unit_runtime_max_normalized_usec=120000000`、`unit_memory_max=805306368`、`unit_memory_swap_max=0`、
`unit_tasks_max=32`。沙箱：`env -i`（`PATH` 最小 + `PYTHONDONTWRITEBYTECODE=1` + `HOME`/`TMPDIR` 指向 run 目录）、
`ro-bind:/ only <run-dir> writable`、`sandbox_net=unshare-net (no route)`（并与 `PrivateNetwork=yes` 一致）。

实测开销：`Service runtime: 2.067s`、`CPU time consumed: 1.048s`、`Memory peak: 34.6M (swap: 0B)`；
`unit-props.txt` 另记 `MemoryPeak=36311040`、`CPUUsageNSec=1048361000`、`CPUQuotaPerSecUSec=500ms`、
`Result=exit-code`。

## 5. 冻结输入校验（前后逐字节一致）

`hashes-before.txt` 与 `hashes-after.txt` **完全相同**，`verdict.txt: hash_status=identical`：

```
db52044c24e26afa66dca6cc0323d7541f5461f0f787879f9f1b28cce83324e6  …/extract/run.sh
aad620cce19aef51e5783f6f220d1fc365ddb174ab8e0b0797d38c6673c22cd6  …/extract/payload.sh
cdd4bfe5b947723a0b7deb828729231b5ec36f49f8b5fedf15e535f64d5e635a  …/extract/extract.py
cd45832f1fb46ccaee9d29b7683df00f4b89a9c571e01b67e6f17efdeafdce6b  …/extract/tests/negative-tests.py
73359a115df9a3542674cdce342c05e229b9a4733f703c93835fbec048749b31  …/extract/README.md
```

（`negative-tests.py` 与 `README.md` 的哈希相对上轮变化，正是第 10 节更正的落盘结果；
本轮运行期间未再变动。）

## 6. 终态与清理

`verdict.txt`：`unit_load_state=loaded`、`unit_active_state=failed`、`unit_sub_state=failed`、
`unit_main_pid=0`、`terminal_state=failed_mainpid0`、`terminal_confirmed=yes`、
`unit_show_rc=0`；`cleanup_stop_rc=0`、`cleanup_reset_failed_rc=0`、
`state_after_cleanup=not_found_loadstate`、`after_show_rc=0`、`after_terminal_confirmed=yes`。
`unit-scan.txt` 为空，随后查询 `exc-* / acq-* / p0-* / acc-* / admission-*` 亦无残留单元。
`unit_unload_guaranteed=no` —— 本脚本不声称证明彻底卸载。

## 7. 偏差与限制

1. `RuntimeMaxUSec` 仍以 `2min` 形式返回（已按规则归一化为 `120000000` 并记录 raw + normalized）。
2. `MemoryPeak` 在两处取值不同（`unit.log` 的 `34.6M` 与 `unit-props.txt` 的 `36311040`），
   均如实记录，不取其一冒充准确值。
3. `unit_unload_guaranteed=no`：卸载仅以 systemd 视角 `not-found` 佐证。
4. 本次**仍然只是 test 模式**：`unpack=not_attempted`，真实归档**未解包**、未安装、未构建、未运行插件代码。
5. 未触碰 GUI `http://127.0.0.1:3080`，未触碰生产 `/root/.dsh`。
6. `GO-test.txt` 现处于**已消费/关闭**状态；再次运行需要**新的**单次授权，不得据本次记录重跑。

## 8. 证据边界

- 45 通过只证明该测试套件在当前解释器与本次信封下的行为，**不构成安全认证**，不含任何插件加载、
  注册、处置或运行时证据。
- 唯一 skip 使本次结论为**证据不完整**。
- 名字策略的作用对象是 `tarfile` 解析后的名字，**原始 512 字节头不是策略边界**（详见
  `2026-11-05-third-party-extractor-unit.md` 第 10 节与 `extract/README.md` 第 2 节）。

## 9. 追加更正（NUL 夹具，CODE ONLY，未重跑）

本文件 §8 旧稿写有"NUL 在归档层不可表示"，该表述**过宽，已作废**。只读核对
`/usr/lib/python3.13/tarfile.py` 后的准确边界：

| 载体 | 能否承载 NUL | 源码依据 |
| --- | --- | --- |
| ustar/GNU 100 字节名字字段 | 不能（写入填充/截断，读回遇首个 NUL 即停） | `stn():158-164`、`nts():166-172` |
| PAX `path` 记录 | 能（长度分帧，值 utf-8 编码） | `_create_pax_generic_header():1245-1261`、`_proc_pax():1492-1513` |
| PAX 应用到成员 | 保留，仅对 path 做 `rstrip("/")` | `_apply_pax_info():1650-1652` |
| 自动生成 path 记录的条件 | 仅非 ASCII 或长度 >100 字节，已存在时优先用给定值 | `create_pax_header():1089-1101` |

因此本次 skip 的真实原因**只是旧夹具用 GNU 头**（读回被截成 `top/a`），不是 tar 格式的普遍限制。

相应修改（仅 `extract/tests/negative-tests.py` 与 `extract/README.md`，生产 `extract.py`、
`payload.sh`、`run.sh`、`acquire/` 未改）：

1. `write_archive(path, specs, fmt=tarfile.GNU_FORMAT)` 增加可选 `fmt` 与每成员 `pax_headers`（默认行为不变）。
2. `nul_name_refused` 用 `PAX_FORMAT` + 显式 `path` 记录构造，从 `MAYBE_UNENCODABLE` 移入必须拒绝集合
   （期望拒绝理由含 `NUL byte`），并断言不创建输出目录与证据文件。
3. 新增 `EXPECTED_STORED_NAMES`：先读回并**严格断言** `member.name` 真含 NUL；不匹配记 **failed**，
   不降级为 skip。`normalize_reject_nul_char` 单元回归保持不变。
4. 未新增结论：GNU `GNUTYPE_LONGNAME` 是否同样在 NUL 截断**未验证**（需单独读源码），不从
   `create_gnu_header` 的长度判断反推；PAX 物理扩展头不进入 `tarfile` 的成员迭代，故不声称成员数增加。

**状态：代码已改但未执行。** `45 passed / 0 failed / 1 skipped`（本节之前的历史记录）与更早的
`42 / 2 / 1` 均为**修改前**的实测数字，保持原样；本次修改后的期望结果**不预填**，需新的单次 GO 才可重测。
