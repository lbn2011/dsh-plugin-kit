# Harbor 归档离线解包（`harbor` 模式）：受限单次运行记录

- 日期：2026-11-05
- 模式：`harbor`（Harbor-only 固定目标；**不**重复 Toolkit、不接受 archive 参数）
- 授权：Lead 批准 **ONE** 次离线 `harbor` 解包（用户固定文件 32 MiB 授权范围内）；`GO-harbor.txt` 单次闸
- 结果：**`exc_overall_rc=0`**，`target=harbor extract_rc=0 verdict=extracted`，**32 MiB 例外实际被使用**

## 1. 命令与 GO 闸

```bash
# 1) 确认闸不存在（未创建过）
[ -e GO-harbor.txt ]            # → 不存在
# 2) 独占创建严格单行
( set -C; printf 'GO harbor\n' > GO-harbor.txt )
# 3) 唯一一次运行
bash experiments/third-party-pilots/extract/run.sh harbor
# 4) 追加消费说明关闭
printf 'consumed=yes ...\n' >> GO-harbor.txt
```

| 项 | 值 |
| --- | --- |
| 闸创建后 | 10 B，sha256 `827281098ee0055046d4cf558555d59454b830271256f63873bdf179a210fc55`，`GATE_VALUE_EXACT=yes` |
| 运行后关闭 | 135 B，sha256 `4164e6c173d3a498a0309f03d13b8259d765c502b9987b638ce3e00b895b3372`，`GATE_CLOSED=yes` |
| 未触碰 | `GO-test.txt`（182 B，已消费关闭）、`GO-extract.txt`（已消费关闭） |

## 2. 原始路径与退出码

```
exc_run_dir=/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T183510Z-exc-harbor-412432-5819
exc_unit=exc-third-party-harbor-20261104T183510Z-412432
exc_overall_rc=0
```

`status.txt`：`work_rc=0`、`record_rc=0`、`unpack=attempted`、`refusal=none`。
`extract-manifest.txt`：`target_selection=harbor (fixed, no archive input accepted)`、
`target=harbor extract_rc=0`、`verdict=extracted`、`final_work_rc=0`。

## 3. 归档哈希与实际校验

```
archive=/root/dsh-ecosystem-spec/experiments/third-party-pilots/acquire/runs/20261104T170138Z-acquire-409347-8019/artifacts/harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9.tar.gz
archive_sha256=c6d0588c74cba742c310958ccefffaebdad8984deefdd524816df6d80445cef4   (= acquire 记录的 pin 值)
expected_top=dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9
```

解包器在 `main` 内对**磁盘字节**重新计算 sha256 并与 `--expect-sha256` 比对，一致后才进入
`validate`；报告里的 `archive_sha256` 就是这次实际计算结果（与 pin 相同）。
**归档哈希仅证明字节与采集时一致，不是 commit 认证、不是 Git 签名、不证明上游作者身份。**

## 4. 32 MiB 例外（实际生效）

```
file_budget_exception_policy=harbor-board-index-32MiB (pinned archive_sha256 AND expected_top AND exact member path AND regular file; not configurable)
file_budget_exception_member=dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9/board/index.json
file_budget_exception_used=yes
file_budget_exception_limit_bytes=33554432
```

- 该成员实际字节数 **31,988,917**（`extract-harbor.txt:81` 逐文件行），首次 `extract` 运行时正因它
  超过 20 MiB 而被拒；本次在例外下通过，`declared_bytes = written_bytes = 70,906,310`。
- 逐文件摘要示例：`e624d5120734edfaac4c715a3e069ffdf674c32e36f339275cf56ebf16fbef8e  31988917  <top>/board/index.json`。
- 例外仍在两遍遍历中各自重算（`validate` 一次、写入期一次），任一遍不满足四条件即回落到 20 MiB。

## 5. 成员/总量/许可证

```
members_validated=279
files_written=252
declared_bytes=70906310
written_bytes=70906310
budget_total_bytes=134217728   budget_file_bytes=20971520   budget_members=10000
license_files_found=1
license_present=yes
license_file  7cfca0a2a21dc7b205a5c4289dc1605056280edb858e2ea5894d38efaa926f6d  1065  <top>/LICENSE
```

- 输出目录：`…/runs/20261104T183510Z-exc-harbor-412432-5819/out-harbor/`
- 逐文件摘要与字节：`…/extract-harbor.txt`（`[files]` 段，每行 sha256/字节/相对路径；
  `[license]` 段在文件末尾）
- LICENSE 原字节位置：`…/out-harbor/dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9/LICENSE`
  （1065 B，sha256 `7cfca0a2…`）。**仅记录原字节哈希与路径，未作任何法律解释。**
- 总量 70,906,310 ≤ 134,217,728，成员 279 ≤ 10000：**总量与成员数上限未触碰**。
  通用单文件上限 20,971,520 B 仍然生效；本次有一处固定例外
  （`<top>/board/index.json`，31,988,917 B）超过该通用上限，仅因已评审的
  32 MiB 固定例外而通过。故不能概括为"未触碰任何上限"。（2026-11-05 更正，未改动任何历史数值。）

## 6. 资源信封与隔离（实测读回）

```
cgroup_proof=yes   memory.max=805306368  memory.swap.max=0  pids.max=32  cpu.max=50000 100000
unit_proof=yes     unit_type=exec  unit_runtime_max_raw=2min → normalized 120000000
                   unit_memory_max=805306368  unit_memory_swap_max=0  unit_tasks_max=32
```

- 单次容量门槛：`exc_gate_memavailable_kib=1834472 ≥ 1228800`，`exc_gate=pass`，采样 1 次。
- 隔离：unit `PrivateNetwork=yes` + bwrap `--unshare-net`；`--ro-bind / /` 仅本次运行目录可写；
  `env -i` 最小 `PATH` + `PYTHONDONTWRITEBYTECODE=1` + `HOME`/`TMPDIR` 在运行目录；
  共享锁 `experiments/acceptance/runs/.acceptance.lock`（串行化手段，不宣称全局唯一）。
- 运行指标（`unit.log`）：`Service runtime 609ms`、`CPU time consumed 345ms`、
  `Memory peak 85.8M (swap: 0B)`。

## 7. 冻结输入（前后逐字节一致）

`hash_status=identical`：

```
ec8aa75f24d8e0bfa768dd32c07d341ace6fec3219b1646e3607df0e9e349f6b  run.sh
b7c63a1584091a5c2534108b02e8bd5c1f765e6313cf03080052992cb8c154eb  payload.sh
99b86adbdf1be7d4f2f815222f43eaff56d28cccf479738cbe3ddd8331d72b52  extract.py
2c0624b48d0271dfb364803b1c9cb7437b2c025df9ef93cab10c4cf4a1edf7e1  tests/negative-tests.py
e3ec27b7dd1ce498dbfb637581d311b93bddfe31a5d855c644b7dbfbacf30b8f  README.md
```

与刚完成的 `test` 单元同值 ⇒ 本次运行未改动这 5 个输入。

## 8. 终态与清理

`verdict.txt`：`unit_load_state=not-found`、`unit_active_state=inactive`、`unit_sub_state=dead`、
`unit_main_pid=0`、`terminal_state=not_found_loadstate`、`terminal_confirmed=yes`、
`after_show_rc=0`、`after_terminal_confirmed=yes`、`state_after_cleanup=not_found_loadstate`；
`unit-scan.txt` 为空（无残留 unit）；`unit_unload_guaranteed=no`。

## 9. 偏差与限制（如实记录）

1. `cleanup_stop_rc=5`、`cleanup_reset_failed_rc=1`：`systemctl` 报 "Unit ... not loaded"——
   运行结束时瞬时 unit 已不在 load 表，**不是**清理失败；`before_stop` 与 `after` 两次结构化读回
   均为 `not-found/inactive/dead/main_pid=0`。
2. `unit-props*.txt` 为**事后**快照，不作信封证据；有效读数见 `extract-manifest.txt`（§6）。
3. `MemoryPeak` 仅 `unit.log` 的 `85.8M`（属性未读回），不推算精确字节。
4. `files_written=252` 由解包器自身计数；本次**未**用外部 `find`/`du` 复核（避免额外探针）。
5. **不构成兼容性声明**：本次只解出字节与路径，**未**加载、未解析、未执行归档内任何
   JS/TS/脚本（`no_archive_content_executed=yes`），也未在 DSH/kit 中安装或注册；
   因此**不能**据此声称 Harbor 插件与当前运行时兼容。
6. **不覆盖**：`payload.sh` 目标循环 `rc=73` 故障注入路径仍未执行验证（`harbor` 模式只有一个目标，
   循环体只走一轮；`extract` 双目标模式的"首败即停"行为仍属静态推导）。
7. 历史结果未改动：`test` 的 `59/0/0`（`2026-11-05-third-party-harbor-exception-unit.md`）、
   更早的 `46/0/0`、`45/0/1`、`42/2/1`，以及首次 `extract` 的 `overall 70`
   （`2026-11-05-third-party-extraction.md`）。
