# Harbor 32 MiB 例外 + `validate()` 边界回归：受限 test 单元运行记录

- 日期：2026-11-05
- 模式：`test`（合成夹具，**不**解包真实归档、**不**跑 `harbor`/`extract` 目标循环）
- 授权：Lead 批准 **ONE** 次受限 test；`GO-test.txt` 单次闸；未建 `GO-harbor.txt` / `GO-extract.txt`
- 结果：**`exc_overall_rc=0`**，`passed=59 failed=0 skipped=0`，`verdict=PASSED_ALL_CASES`

## 1. 实际命令与 GO 闸处理（非破坏流程）

```bash
# 1) 备份已消费的 GO-test.txt（独占创建 + cmp 核对）
ts=$(date -u +%Y%m%dT%H%M%SZ); bak="GO-test.history.${ts}.txt"
( set -C; cat GO-test.txt > "$bak" ); cmp -s GO-test.txt "$bak"
# 2) 同一 inode 定点恢复为严格单行（不 move / 不 delete / 不覆盖历史）
printf 'GO test\n' > GO-test.txt
# 3) 唯一一次运行
bash experiments/third-party-pilots/extract/run.sh test
# 4) 运行后追加消费说明关闭闸
printf 'consumed=yes ...\n' >> GO-test.txt
```

| 项 | 值 |
| --- | --- |
| 备份文件 | `experiments/third-party-pilots/extract/GO-test.history.20261104T183205Z.txt` |
| 备份前内容 | 183 B，sha256 `1fd902a713eda581d41b6e92ab1ddb418d709f71aeff22db70bf30afbf4084ce` |
| 备份核对 | `cmp` 一致（`BACKUP_IDENTICAL=yes`） |
| inode（前后同一） | `1197406` |
| 恢复后闸值 | 8 B，sha256 `7b7e5923c4c759bd772277c27d911316259701b8e6e2734488ba0a3c99076e0b`，`GATE_VALUE_EXACT=yes` |
| 运行后关闭 | 182 B，sha256 `aaea528fa06eaac242b1321847b2e09639512b0849808607105911b205d264e8`，`GATE_CLOSED=yes` |

## 2. 原始路径与退出码

```
exc_run_dir=/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T183219Z-exc-test-412255-11967
exc_unit=exc-third-party-test-20261104T183219Z-412255
exc_overall_rc=0
```

`status.txt`：`work_rc=0`、`record_rc=0`、`unpack=not_attempted`、`refusal=none`。
`systemd-run.rc`：`0`。`verdict.txt`：`unit_rc=0`、`overall_rc=0`、`hash_status=identical`。

## 3. 计数（`negative-tests.txt` 实测）

```
passed=59 failed=0 skipped=0
verdict=PASSED_ALL_CASES
suite_seconds=2.2
```

本轮新增/改名的 13 条全部 pass：

| 用例 | 结果 |
| --- | --- |
| `validate_exception_accepts_exactly_32MiB` | pass —— "validate() planned the pinned member with a 33554432-byte limit and reported it as the exception member" |
| `validate_exception_refuses_32MiB_plus_one` | pass —— "validate() refused 33554433 bytes against the 33554432-byte exception" |
| `validate_ordinary_accepts_20MiB` | pass —— "ordinary member planned with the 20971520-byte limit and no exception reported" |
| `validate_ordinary_refuses_20MiB_plus_one` | pass —— "validate() refused 20971521 bytes against the 20971520-byte limit" |
| `budget_exception_signature_is_fixed`（改名） | pass —— 仅签名检查 |
| 其余 7 条 `budget_*` | pass |

错归档/身份相关用例也 pass：`exception_path_in_unpinned_archive_refused`（真实 pin 路径 + 合成归档 ⇒ 仍按 20 MiB 拒绝）、`hash_mismatch_refused`（归档哈希与 `--expect-sha256` 不符 ⇒ rc=70）、`bad_hash_argument_refused`、`missing_archive_refused`、`oversized_member_refused`（20 MiB+1 普通成员被拒）。两条正控 `positive_control_with_license` / `positive_control_without_license` 均为 byte-exact 且摘要一致。

## 4. 资源信封与隔离（实测读回）

```
cgroup_proof=yes   memory.max=805306368  memory.swap.max=0  pids.max=32  cpu.max=50000 100000
unit_proof=yes     unit_type=exec  unit_runtime_max_raw=2min → normalized 120000000
                   unit_memory_max=805306368  unit_memory_swap_max=0  unit_tasks_max=32
```

- 单次容量门槛：`exc_gate_memavailable_kib=1802044 ≥ 1228800`，`exc_gate=pass`，采样 1 次。
- 隔离：unit `PrivateNetwork=yes` + bwrap `--unshare-net`；`--ro-bind / /`，仅本次运行目录可写；
  `env -i` 仅最小 `PATH` + `PYTHONDONTWRITEBYTECODE=1` + `HOME`/`TMPDIR` 在运行目录。
- 运行指标（`unit.log`）：`Service runtime 2.501s`、`CPU time consumed 1.249s`、
  `Memory peak 52.5M (swap: 0B)`。
- `unit_unload_guaranteed=no`、`no_archive_content_executed=yes`、`evidence_scope=bytes_and_paths_only`。

## 5. 冻结输入校验（前后逐字节一致）

`hash_status=identical`，5 个输入前后完全相同：

```
ec8aa75f24d8e0bfa768dd32c07d341ace6fec3219b1646e3607df0e9e349f6b  run.sh
b7c63a1584091a5c2534108b02e8bd5c1f765e6313cf03080052992cb8c154eb  payload.sh
99b86adbdf1be7d4f2f815222f43eaff56d28cccf479738cbe3ddd8331d72b52  extract.py
2c0624b48d0271dfb364803b1c9cb7437b2c025df9ef93cab10c4cf4a1edf7e1  tests/negative-tests.py
e3ec27b7dd1ce498dbfb637581d311b93bddfe31a5d855c644b7dbfbacf30b8f  README.md
```

## 6. 终态与清理

`verdict.txt`：`unit_load_state=not-found`、`unit_active_state=inactive`、`unit_sub_state=dead`、
`unit_main_pid=0`、`terminal_state=not_found_loadstate`、`terminal_confirmed=yes`、
`after_show_rc=0`、`after_terminal_confirmed=yes`、`state_after_cleanup=not_found_loadstate`。
`unit-scan.txt` 为空（无残留 unit）。

## 7. 偏差与限制（如实记录）

1. `cleanup_stop_rc=5`、`cleanup_reset_failed_rc=1`：`systemctl` 报 "Unit ... not loaded"。
   原因是运行结束时 unit 已不在 load 表（`--collect` 语义下的瞬时 unit 生命周期），
   **不是**清理失败；`before_stop` 与 `after` 两次结构化读回均为 `not-found/inactive/dead/main_pid=0`，
   `after_terminal_confirmed=yes`。`unit_unload_guaranteed=no`——只以 systemd 视角佐证。
2. `unit-props.txt` / `unit-props-after.txt` 为**事后**快照，不作信封证据；有效读数在
   `extract-manifest.txt`（§4）。
3. `MemoryPeak` 仅有 `unit.log` 的 `52.5M`（属性未读回），不推算精确字节数。
4. **test 模式的覆盖边界**：本模式只跑合成夹具，**不覆盖**
   - `payload.sh` 目标循环里 `rc=73`（记录失败）后是否真的停止后续目标这一**故障注入**路径；
   - `harbor` 模式的 Harbor-only 实际提取（该模式从未运行，`GO-harbor.txt` 从未创建）。
   因此 §1–§6 的通过结论**不能**外推到这两条路径。
5. 未执行任何额外探针：没有再次 `systemd-run`、没有重跑、没有安装、没有真实归档解包；
   未触碰 GUI `http://127.0.0.1:3080` 与生产 `/root/.dsh`。运行后仅用只读方式读取本 run 目录下的
   证据文件（`status.txt`/`verdict.txt`/`negative-tests.txt`/`gate.txt`/`hashes-*.txt`/
   `extract-manifest.txt`/`unit.log`/`unit-cleanup.txt`/`systemd-run.rc`/`unit-scan.txt`）用于本记录。
6. 历史结果保留未改：改动前同一套件的 `46/0/0`（`2026-11-05-third-party-extractor-pax-recheck.md`）
   与 `extract` 模式 `overall 70`（`2026-11-05-third-party-extraction.md`）仍为各自代码版本的实测值。
