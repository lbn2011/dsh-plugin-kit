# Harbor 第三方子集复制 — 单次受限执行记录

- 日期：2026-11-05（本地 Asia/Shanghai）；UTC 时刻见 §2
- 运行器：`experiments/third-party-pilots/copy-prep/{run.sh,payload.sh}`
- 脚本：`experiments/third-party-pilots/harbor-modified-prep/copy_harbor.py`（未修改）
- 状态：**已执行一次，通过（overall 0）**；仅复制，未构建、未安装、未测试、未改造、未做 Loader 验证

本记录只描述这一次复制运行。它不是安全评估、许可证结论、构建结果或运行时结论。

## 1. 授权与实际命令

Lead 授权 ONE 次 Harbor 复制（Toolkit 已单独完成）。实际操作：

```
# 1) 排他性检查：copy-prep/ 内无 GO-harbor.txt（glob 仅见 extract/ 下的同名文件，属另一切片）；harbor-modified/ 不存在
# 2) 文件工具写入 copy-prep/GO-harbor.txt，内容严格单行 "GO harbor"
# 3) 唯一一次执行（工作目录 /root/dsh-ecosystem-spec）：
bash experiments/third-party-pilots/copy-prep/run.sh harbor
```

未执行 `bash -n`、未做 node/python 探针、未安装依赖、未构建、未测试、未重试、未跑 Toolkit。

## 2. 时间与退出码

| 项 | 实际值 |
| --- | --- |
| 开始（UTC） | 2026-11-04T20:10:05Z |
| 结束（UTC） | 2026-11-04T20:10:06Z |
| launcher 退出码 | `0` |
| `cpy_overall_rc` | `0` |
| `systemd-run.rc`（unit 退出状态） | `0` |
| `python-exit-code.txt` → `sandbox_invocation_rc` | `0` |
| unit 运行时长 / CPU / 内存峰值 | `Service runtime: 263ms` / `CPU time consumed: 80ms` / `Memory peak: 13.9M (swap: 0B)` |
| unit 结果 | `Finished with result: success`，`code=exited, status=0/SUCCESS` |

run 目录：`experiments/third-party-pilots/copy-prep/runs/20261104T201005Z-cpy-harbor-415550-19863/`
unit：`cpy-third-party-harbor-20261104T201005Z-415550`

## 3. 实际生效的资源限制（actual caps）

caps 由 unit 内、工作开始前的两处读回共同证明（`copy-prep-manifest.txt` 的 `cgroup_*` 段 + `unit-envelope.txt`）：

| 限制 | 读回值 |
| --- | --- |
| cgroup 路径 | `/system.slice/cpy-third-party-harbor-20261104T201005Z-415550.service` |
| 内存上限 | `memory.max=805306368`（768 MiB）；unit `MemoryMax=805306368` |
| swap | `memory.swap.max=0`；unit `MemorySwapMax=0` |
| 任务数 | `pids.max=32`；unit `TasksMax=32` |
| CPU | `cpu.max=50000 100000`（50% of one CPU）；unit `CPUQuotaPerSecUSec=500ms` |
| 进程类型 | unit `Type=exec` |
| 运行时限 | unit `RuntimeMaxUSec` 原始值 `2min` → 归一 `120000000`（未另读 `cpu.stat`） |
| 容量 gate | `MemAvailable=1707908 KiB ≥ 1228800 KiB`，单次采样（`cpy_gate_samples=1`） |
| 网络 | unit `PrivateNetwork=yes` **且** bwrap `--unshare-net`；路由未独立核验 |
| 文件系统 | bwrap `--ro-bind / /`；仅 stage 与本次 `out/` 可写；`/tmp` tmpfs、`/dev` devtmpfs（可写但不持久）；run 目录在沙箱内不可写 |

`unit-props.txt` 为**事后**快照，不作 caps 证据。

## 4. 三个固定输入的前后哈希

`hashes-before.txt` 与 `hashes-after.txt` 逐字节相同（`hash_status=identical`，`hash_rc=0`）：

| 文件 | sha256（前后一致） |
| --- | --- |
| `copy-prep/run.sh` | `345d76fe5e616f9e3e4f75b9390a4065fdd3d4443abaf4e7ad58636d4a8ddbac` |
| `copy-prep/payload.sh` | `19398bd68805ad6e0430445a8209ca5f4f529241a0d51859a3c891b160c53243` |
| `harbor-modified-prep/copy_harbor.py` | `e8b99a886e143d851de9eaae495f0dda2520c9d59846e0c5cc3a618e91a58032` |

边界：三文件输入哈希步骤**不遍历源树**；Python 复制阶段实际扫描并按白名单逐文件校验（见 §5）。因此它不是闭包，`node_modules` 未遍历，传递依赖不受保护。

## 5. 复制结果：20 个文件、199,720 字节

来源 pin：`9465c9fb36d753ae66d45a6617e4d51db8163df9`
来源树：`experiments/third-party-pilots/extract/runs/20261104T183510Z-exc-harbor-412432-5819/out-harbor/dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9`
目标：`experiments/third-party-pilots/harbor-modified/pkg`

| 项 | 值 |
| --- | --- |
| `status` / `verification.all_match` | `copied` / `true` |
| `plan.file_count` | `20` |
| `plan.total_bytes` | `199,720` |
| `verification.errors` / `.failures` | `[]` / `[]` |
| 校验方法 | 整文件 sha256，复制后重新读取，两侧各自等于预扫描 size |

逐文件（源 sha256 = 目标 sha256，全部 `match: true`）：

| 路径 | 字节 | sha256 |
| --- | --- | --- |
| `src/hub/index.mjs` | 14,757 | `415adf3b…8714947d` |
| `src/hub/freshness.mjs` | 7,611 | `c12cb344…f578ee25` |
| `src/hub/preflight-job.mjs` | 3,879 | `1ac2b3d1…6dccc9b`（截断显示见报告） |
| `src/scan/index.mjs` | 1,798 | `a74b9d76…66cc9f2ef` |
| `src/scan/runtime.mjs` | 18,593 | `65f617eb…30fee942` |
| `src/scan/discover.mjs` | 9,730 | `ccb9a627…72d4472d` |
| `src/scan/inspect.mjs` | 30,963 | `16660090…6e135d5` |
| `src/scan/evidence.mjs` | 17,464 | `58b269a9…77f56e2` |
| `src/scan/conflicts.mjs` | 5,679 | `930b6d8d…d6db5c5` |
| `src/scan/snapshot.mjs` | 11,984 | `b14fa25e…ca739578` |
| `src/scan/manifest.mjs` | 5,874 | `4b9d606a…a6bb06b` |
| `src/scan/detectors.mjs` | 13,719 | `1f374d31…dd1db5ea` |
| `src/scan/versions.mjs` | 15,541 | `76558e46…ec93834d5` |
| `src/preflight/index.mjs` | 9,959 | `900ac193…bf083361` |
| `src/preflight/checks.mjs` | 8,311 | `76355e72…b71e270c` |
| `src/preflight/pack.mjs` | 5,459 | `e7876d9a…09ad65ba` |
| `src/preflight/semver.mjs` | 5,859 | `d3764472…92fb4ff1` |
| `src/preflight/host.mjs` | 8,989 | `6d7962ca…cf4d0e83c` |
| `LICENSE` | 1,065 | `7cfca0a2a21dc7b205a5c4289dc1605056280edb858e2ea5894d38efaa926f6d` |
| `package.json` | 2,486 | `adf2706ad593013a8cf9a23be6bd59047c21f6f274eae58e7ed27bf4e0b44227` |

上表 sha256 为节省篇幅对中间段做了省略，**完整 64 位值**在 `out/evidence/copy-report.txt`（逐文件 source/target 两行）与 `out/evidence/copy-report.json`（`verification.records[]`）中。

### 许可证对照

| 项 | 值 |
| --- | --- |
| 数量 | `1`（子集只含根 `LICENSE`） |
| 字节 | `1,065` |
| 源 sha256 | `7cfca0a2a21dc7b205a5c4289dc1605056280edb858e2ea5894d38efaa926f6d` |
| 目标 sha256 | 同上（`match: true`） |

报告自述：`upstream MIT notice retained`。这只证明字节一致并保留了上游 MIT 声明，**不是**许可证适用性结论。

### 子集警告（脚本原文要点）

`subset: 18 selected modules + LICENSE + package.json only; not a proven closure and not proven loadable`；`package.json is verbatim; its exports/bin name files that are absent from this subset`；`experimental fixture, not prepared for publishing or install`。即：这不是可加载包的证明，`exports`/`bin` 指向本子集中不存在的目标。

## 6. 单元终态与清理

| 项 | 值 |
| --- | --- |
| 首探针 | `LoadState=not-found`、`ActiveState=inactive`、`SubState=dead`、`MainPID=0`、`show_rc=0` |
| 分类 | `terminal_state=not_found_loadstate_mainpid0`、`terminal_confirmed=yes` |
| 清理动作 | `cleanup_action=skipped_already_terminal`（未 `stop`；`reset-failed` 按设计 `not_attempted`） |
| 事后探针 | `after_terminal_confirmed=yes`，同一分类 |
| `unit_unload_guaranteed` | `no` |

## 7. 失败、流程偏差与证据限制

**失败**：无。无拒绝、无映射失败、无记录失败、无哈希漂移（`hash_status=identical`）。

**流程偏差（如实披露）**

1. GO 闸由我用文件工具写入 `copy-prep/GO-harbor.txt`（写入前确认该文件不存在），非运行器创建。
2. 除唯一一次 `run.sh harbor` 外，我另外执行了两条只读命令：`date -u` ×2（记录起止时刻）与一条包裹运行的外层 `echo "launcher_exit=$rc"`。**运行之后未再执行任何 shell 统计/探针命令**，证据全部用 read/glob 读取。
3. 未独立遍历目标 `pkg` 树复核文件数与字节数；20 个文件 / 199,720 字节来自脚本报告，不是第三方统计。
4. 未做磁盘满故障注入；`cgroup_rel` 的 `awk` 返回码未单独判定（按指示不改动，以 unit 内 cgroup 读回作为 caps 证明）。
5. 未验证 Harbor 运行时行为、未构建、未安装、未改造源码、未做 Loader/插件加载验证。

**证据限制**

- `sandbox_invocation_rc=0` 是 bwrap 的退出状态；本运行器不加探针区分"bwrap 建沙箱失败"与"Python 工作失败"（记录中 `cause_not_distinguished_between_bwrap_setup_and_workload=yes`）。
- 脚本自述报告边界：`component checks over a trusted at-rest tree; not a sandbox and not TOCTOU-free`；`a successful copy means bytes were copied, nothing more`。
- 该子集为**实验夹具**：既未编译也未运行，不能据此声称 Harbor 或其改造版本可用。
- 复制证据不代表上游 Git 真实性（源树来自 pin 下载 + 独立安全解包，sha256 相同不证明字节来自该 commit）。
