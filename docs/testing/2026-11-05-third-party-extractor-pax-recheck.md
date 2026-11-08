# 第三方归档解包器测试：PAX/NUL 修正后的单次重测记录（第三次 test，实际运行）

- 日期：2026-11-05
- 范围：`experiments/third-party-pilots/extract/`（离线安全解包切片）的 **test 模式**，仅一次运行
- 授权：Lead 批准 ONE 受限 `test`（非 `extract`）；沿用非破坏 GO 流程
- 结果：**overall_rc=0**，套件 `passed=46 failed=0 skipped=0`（`PASSED_ALL_CASES`）
- 前两次历史：`2026-11-05-third-party-extractor-unit.md`（42/2/1，overall 72）、
  `2026-11-05-third-party-extractor-recheck.md`（45/0/1，overall 72）——两份原样保留，本文件不覆盖

本文件只记录**本次实际观测值**。未做安全认证，未解包任何真实归档，未加载/运行任何插件代码。

## 1. GO 闸处理（非破坏，第三次）

沿用上次流程，没有任何 move/delete，既有历史文件未被覆盖：

| 项目 | 值 |
| --- | --- |
| 处理前 `GO-test.txt` | 191 B，`sha256 659625404c2b660c7c6a6265ddf0e9635b077b6a68db36b011fdc73c04c92994`（上一轮已消费态，2 行） |
| 备份（独占创建 + `cmp` 核对） | `experiments/third-party-pilots/extract/GO-test.history.20261104T175358Z.txt`，sha256 同上，`backup_verified=yes` |
| 定点替换 | 同 inode（`1197406` → `1197406`），内容替换为严格单行 `GO test\n`（`od -c` 核对，`GATE_VALUE_EXACT=yes`），sha256 `7b7e5923c4c759bd772277c27d911316259701b8e6e2734488ba0a3c99076e0b` |
| 运行后关闭 | 追加消费说明，sha256 `1fd902a713eda581d41b6e92ab1ddb418d709f71aeff22db70bf30afbf4084ce`，判定 `GATE_CLOSED=yes` |

未创建 `GO-extract.txt`；`GO-test.history.20261104T174305Z.txt`（116 B）保持原样。

## 2. 执行（ONE，无重试）

```
bash experiments/third-party-pilots/extract/run.sh test
exc_overall_rc=0
exc_run_dir=/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T175406Z-exc-test-411129-13028
exc_unit=exc-third-party-test-20261104T175406Z-411129
```

本次只运行一次 `test`，未重试、未改成 `extract`、未触碰真实归档
（`status.txt`: `unpack=not_attempted`、`refusal=none`）。

## 3. 结果（实测计数与 NUL 具体结果）

`negative-tests.txt` / `unit.log`：

```
passed=46 failed=0 skipped=0
verdict=PASSED_ALL_CASES
suite_seconds=2.0
negative_tests_rc=0
negative_tests_verdict=passed_no_skips
final_work_rc=0
```

NUL 用例（本次修正的目标）：

```
case=nul_name_refused verdict=pass detail=refused with rc=70 and created nothing
```

即：PAX `path` 记录构造的夹具通过前置读回断言（存储名确含 `\x00`），解包器以 rc=70 拒绝，
且未创建输出目录与证据文件。对照组（同次运行、未改动）`normalize_reject_nul_char` 仍 pass。

关于 skip 归零的诚实说明：

- `empty_member_refused` 本次也 **pass**（`refused with rc=70 and created nothing`），
  即其读回名字与期望一致、未被判为夹具限制。因此本次 `skipped=0` 并非"取消了 skip 机制"，
  而是**当前没有用例触发** `MAYBE_UNENCODABLE` 分支；该分支代码仍在（见 `negative-tests.py`
  的 `MAYBE_UNENCODABLE` 与 `EXPECTED_STORED_NAMES` 两档判定）。
- `passed=46` 与上一轮 `45`+1 skip 的差别是：NUL 由 skip 转为真实拒绝用例并通过，
  另加 `empty_member_refused` 由 skip 转为通过。

## 4. 资源信封与隔离（实测读回）

`extract-manifest.txt`（payload 在 unit 内自证读数）：

```
cgroup_proof=yes
cgroup_memory_max=805306368
cgroup_memory_swap_max=0
cgroup_pids_max=32
cgroup_cpu_max=50000 100000
unit_proof=yes
unit_type=exec
unit_memory_max=805306368
unit_memory_swap_max=0
unit_tasks_max=32
unit_runtime_max_raw=2min
unit_runtime_max_normalized_usec=120000000
```

- 单次内存门槛：`exc_gate_memavailable_kib=1829516 ≥ 1228800`，`exc_gate=pass`，采样 1 次。
- 隔离：`PrivateNetwork=yes`（unit）+ `--unshare-net`（bwrap）；`--ro-bind / /`，
  仅 run 目录可写；`env -i` 最小 `PATH` + `PYTHONDONTWRITEBYTECODE=1` + `HOME`/`TMPDIR` 指向 run 目录。
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

`extract.py`、`payload.sh`、`run.sh` 与上轮同值，说明本次只改了测试与文档（与代码改动范围一致）。

## 6. 终态与清理

`verdict.txt`：`unit_rc=0`、`systemd-run.rc=0`、`unit_load_state=not-found`、
`unit_active_state=inactive`、`unit_sub_state=dead`、`unit_main_pid=0`、
`terminal_state=not_found_loadstate`、`terminal_confirmed=yes`、`after_show_rc=0`、
`after_terminal_confirmed=yes`。`unit-scan.txt` 为空。

运行指标（`unit.log`）：`Service runtime 2.156s`、`CPU time consumed 1.096s`、
`Memory peak 35.9M (swap: 0B)`、`Finished with result: success`。

`unit_unload_guaranteed=no` —— 本切片不声称证明彻底卸载，仅以 systemd 视角 `not-found` 佐证。

## 7. 偏差与限制（均为本次实际观测）

1. **清理命令返回非零**：`cleanup_stop_rc=5`、`cleanup_reset_failed_rc=1`，原因是 unit 在
   `Type=exec` 正常退出后已被 systemd 立即回收（`before_stop load=not-found`），
   `systemctl stop/reset-failed` 报 "Unit ... not loaded"。终态以
   `terminal_state=not_found_loadstate` + `terminal_confirmed=yes` 结构化确认，故未计为失败；
   这与上一轮（unit 处于 `failed`）出现 `stop_rc=0` 的情形不同，此处如实区分。
2. **`unit-props.txt` 是事后快照，不能用作信封证据**：该文件在 unit 退出后由 launcher 读取，
   因此出现 `Type=`（空）、`RuntimeMaxUSec=infinity`、`TasksMax=4652`、`MemoryMax=infinity`。
   有效的信封读数来自 payload **在 unit 内**的自证（`extract-manifest.txt`，见第 4 节）。
   不得用 `unit-props.txt` 支持"限制已生效"，反过来也不得据它声称限制未生效。
3. **`MemoryPeak` 两个取值**：`unit.log` 报 `35.9M`，`MemoryPeak` 属性为 `[not set]`（unit 已回收）。
   仅保留日志观测值，不推算精确字节数。
4. 本次**仍是 test 模式**：真实归档未解包、未安装、未构建、未运行任何插件代码
   （`unpack=not_attempted`）。
5. 未触碰 GUI `http://127.0.0.1:3080`，未触碰生产 `/root/.dsh`。
6. `GO-test.txt` 现为**已消费/关闭**状态；再次运行需**新的**单次授权，不得据本记录重跑。

## 8. 证据边界

- `passed=46` 只证明该套件在当前解释器（CPython 3.13）与本次信封下、对**合成夹具**的行为，
  不构成安全认证，不含任何插件加载/注册/处置证据，也不构成对真实第三方归档的结论。
- 名字策略作用于 `tarfile` **解析后**的名字；原始 512 字节头不是策略边界。
  NUL 的载体边界（ustar 名字字段不能 / PAX `path` 能）依据
  `/usr/lib/python3.13/tarfile.py:158-172`、`:1245-1261`、`:1492-1513`、`:1650-1652`，
  仍**未**验证 GNU `GNUTYPE_LONGNAME` 是否在 NUL 处截断。
- 网络隔离与只读根由 argv + 运行成功支持，未做独立的逃逸测试。
