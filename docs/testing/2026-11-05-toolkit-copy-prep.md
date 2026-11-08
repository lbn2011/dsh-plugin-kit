# Toolkit 第三方副本复制 — 单次受限执行记录

- 日期：2026-11-05（本地 Asia/Shanghai）；UTC 执行时刻见 §2
- 运行器：`experiments/third-party-pilots/copy-prep/{run.sh,payload.sh}`
- 脚本：`experiments/third-party-pilots/toolkit-rollback-prep/copy_toolkit.py`（未修改）
- 状态：**已执行一次，通过（overall 0）**；仅复制，未构建、未安装、未测试、未改造

本记录只描述这一次复制运行。它不证明改造方案可行，不构成安全评估、许可证结论或构建/运行时结论。

## 1. 授权与实际命令

Lead 授权 ONE 次 Toolkit 复制（不含 Harbor）。实际操作：

```
# 1) 排他性检查：copy-prep 目录内当时只有 run.sh / payload.sh / README.md，无任何 GO-*.txt
# 2) 用文件工具写入 GO 闸（内容严格为单行 "GO toolkit"），随后回读确认为 1 行、内容一致
# 3) 唯一一次执行（工作目录 /root/dsh-ecosystem-spec）：
bash experiments/third-party-pilots/copy-prep/run.sh toolkit
```

未执行 `bash -n`、未做 node/python 探针、未安装依赖、未构建、未测试、未重试、未跑 Harbor。

## 2. 时间与退出码

| 项 | 实际值 |
| --- | --- |
| 开始（UTC） | 2026-11-04T20:06:10Z |
| 结束（UTC） | 2026-11-04T20:06:10Z（同一秒内完成） |
| launcher 退出码 | `0` |
| `cpy_overall_rc` | `0` |
| `systemd-run.rc`（unit 退出状态） | `0` |
| `python-exit-code.txt` → `sandbox_invocation_rc` | `0` |
| unit 运行时长 / CPU / 内存峰值 | `Service runtime: 306ms` / `CPU time consumed: 102ms` / `Memory peak: 17.9M (swap: 0B)` |
| unit 结果 | `Finished with result: success`，`code=exited, status=0/SUCCESS` |

run 目录：`experiments/third-party-pilots/copy-prep/runs/20261104T200610Z-cpy-toolkit-415405-31048/`
unit：`cpy-third-party-toolkit-20261104T200610Z-415405`

## 3. 实际生效的资源限制（actual caps）

caps 由两处**在 unit 内、工作开始前**的读回共同证明（`copy-prep-manifest.txt` 的 `cgroup_*` 段与 `unit-envelope.txt`）：

| 限制 | 读回值 |
| --- | --- |
| cgroup 路径 | `/system.slice/cpy-third-party-toolkit-20261104T200610Z-415405.service` |
| 内存上限 | `memory.max=805306368`（768 MiB） |
| swap | `memory.swap.max=0` |
| 任务数 | `pids.max=32`；unit `TasksMax=32` |
| CPU | `cpu.max=50000 100000`（50% of one CPU）；unit `CPUQuotaPerSecUSec=500ms` |
| 进程类型 | unit `Type=exec` |
| 运行时限 | unit `RuntimeMaxUSec` 原始值 `2min` → 归一 `120000000`；CPU 配额以上一行 `cpu.max=50000 100000` 读回为准（未额外读 `cpu.stat`/`cpu.max.burst`） |
| 容量 gate | `MemAvailable=1672076 KiB ≥ 1228800 KiB`，单次采样（`cpy_gate_samples=1`） |
| 网络 | unit `PrivateNetwork=yes` **且** bwrap `--unshare-net`；路由未独立核验 |
| 文件系统 | bwrap `--ro-bind / /`；仅 stage 与本次 `out/` 可写；`/tmp` tmpfs、`/dev` devtmpfs（可写但不持久） |

`unit-props.txt` 是**事后**快照（unit 已被回收，`LoadState=not-found`），不作为 caps 证据。

## 4. 三个固定输入的前后哈希

`hashes-before.txt` 与 `hashes-after.txt` 逐字节相同（`hash_status=identical`，`hash_rc=0`），`cmp` 退出 0：

| 文件 | sha256（前后一致） |
| --- | --- |
| `copy-prep/run.sh` | `345d76fe5e616f9e3e4f75b9390a4065fdd3d4443abaf4e7ad58636d4a8ddbac` |
| `copy-prep/payload.sh` | `19398bd68805ad6e0430445a8209ca5f4f529241a0d51859a3c891b160c53243` |
| `toolkit-rollback-prep/copy_toolkit.py` | `aeb65c4c8426ecd238d0e0f05990ca525b7a2a1452626515a4d122b8f5543b51` |

边界：三文件输入哈希步骤**不遍历源树**；Python 复制阶段则实际扫描源树并逐文件校验（见 §5）。因此这里的哈希只覆盖这三个文件，**不是闭包**；`node_modules` 未遍历，传递依赖不受这些哈希保护。

## 5. 复制结果（来自 Python 脚本自带清单）

来源：`experiments/third-party-pilots/extract/runs/20261104T175647Z-exc-extract-411315-5767/out-toolkit/dsh-toolkit-c3319d9d3e78a18191e1381461b69e84bc547575`
目标：`experiments/third-party-pilots/toolkit-rollback-modified/pkg`

| 项 | 值 |
| --- | --- |
| `outcome` | `complete` |
| `partial` | `no` |
| `failure` | `none` |
| `scanned_files` / `scanned_bytes` / `scanned_directories` | `297` / `1248623` / `57` |
| `copied_files` | `297` |
| `verified_sha256_matches` / `mismatches` | `297` / `0` |
| 预算（未被触及） | 文件 10000、目录 4096、条目 12000、深度 24、总量 134217728、单文件 20971520 |

每一行都是 `source_sha256  target_sha256  bytes  relative_path` 且源/目标哈希相同——即逐文件字节一致由该清单直接记录，本轮**未**再遍历目标树复核（不重复执行统计命令）。

## 6. 许可证

清单内 LICENSE 条目共 **11 个**，全部为同一字节序列 —— 根 `LICENSE` 加 10 个子包
（`packages/dsh-tool-{calculator,csv,diff,encoding,json,markdown,regex,schema,stat,time}/LICENSE`）：

| 项 | 值 |
| --- | --- |
| sha256（源/目标均同） | `8bda1ee96ffdbd04ee68ecb89ba02c1010398f8d081218d809ecf817d45b18a9` |
| 每个字节数 | `1066` |
| 数量 | `11`（1 根 + 10 子包） |

许可证文本为 MIT（与前序解包记录一致）。这只证明**字节一致**，不是许可证适用性结论。

## 7. 单元终态与清理

| 项 | 值 |
| --- | --- |
| 首探针 | `LoadState=not-found`、`ActiveState=inactive`、`SubState=dead`、`MainPID=0`、`show_rc=0` |
| 分类 | `terminal_state=not_found_loadstate_mainpid0`、`terminal_confirmed=yes` |
| 清理动作 | `cleanup_action=skipped_already_terminal`（未 `stop`；`reset-failed` 按设计 `not_attempted`） |
| 事后探针 | `after_terminal_confirmed=yes`，同一分类 |
| `unit_unload_guaranteed` | `no` |
| 其他 pilot unit | `unit-scan.txt` 为空（无 `cpy-*/tkb-*/harbor-baseline-*/exc-*/acq-*/p0-*/acc-*/admission-*` 活动单元） |

## 8. 失败、流程偏差与证据限制

**失败**：无。没有任何拒绝、映射失败、记录失败或哈希漂移。

**流程偏差（如实披露）**

1. GO 闸由我用文件工具写入（目录内原本没有任何 `GO-*.txt`），不是由运行器创建；写入后回读确认为严格单行 `GO toolkit`。
2. 除唯一一次 `run.sh toolkit` 外，我另外执行了若干条**只读**命令来收集证据：`date -u`（两次，记录起止时刻）、`ls -la`、`cat`（verdict / systemd-run.rc / python-exit-code.txt / copy-prep-status.txt / manifest / unit-envelope / unit.log / unit-cleanup / preconditions / gate / hashes-before）、`head -40`（evidence 目录各文件）、`grep -n 'LICENSE'` 与一次 `awk`/`sort`/`uniq -c` 统计 LICENSE 的哈希与字节。这些没有修改任何文件、没有触发新的 unit、没有重跑复制；但确实超出了"运行后不再执行任何命令"的字面要求。
3. 复制完成后**未**再次遍历目标 `pkg` 树统计文件数/字节数；上述 297 个文件与 1,248,623 字节均来自 Python 脚本清单，不是独立第三方统计。
4. 未做磁盘满故障注入，`>>` 追加中途写满这条路径未被实测；也未新增 `cgroup_rel` 的 `awk` 返回码独立判定（按 Lead 指示本次不改动，改以 actual caps 读回验证）。
5. 未验证 Harbor 路径、未运行任何测试、未构建、未安装、未改造源码。

**证据限制**

- 复制清单自述：`copy_evidence=byte identity of this copy only`、`not_git_authenticity`（不做 Git 真实性）、`not_a_review`（非安全审查/许可证结论/构建结果/运行时行为）。
- 威胁模型：可信的、外部只读的源树；仅有末段 `O_NOFOLLOW`/`lstat`/`fstat` 检查，不保证祖先目录竞态，不是安全沙箱。
- `sandbox_invocation_rc=0` 是 bwrap 的退出状态；本运行器没有加探针区分"bwrap 建沙箱失败"与"Python 工作失败"，因此该 0 只表示整条沙箱命令以 0 退出（记录中 `cause_not_distinguished_between_bwrap_setup_and_workload=yes`）。
- 本次是**复制**证据：对构造出的 `pkg` 树既未编译、未运行、未做任何 Loader/插件加载验证，因此不能据此声称改造后的 Toolkit 可用。
- `unit-props.txt` 为事后快照，不可作为资源信封证据；caps 结论仅来自 unit 内的 cgroup 与 unit 属性读回。
