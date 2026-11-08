# Toolkit 回滚改造：单次受限差分运行记录（2026-11-05）

本文件记录**唯一一次**已授权的 Toolkit 回滚改造受限运行。运行对象是
`experiments/third-party-pilots/toolkit-rollback-modified/` 下的改造副本与它的差分测试文件。

> **记录性质**：`differential.test.mjs` 自带顺序 runner，只打印 `case=` / `summary=` 行，
> **不是** `node --test`，因此下面的数字是**自定义记录**，不是 TAP 结果，也不是测试框架计数。
> 早先原版基线运行的 6/6 属于**历史对照**，**不可与本次相加**；两次运行使用不同的测试文件、
> 不同的输入集合，无法合并成一个总数。

## 1. 命令与产物位置

- 授权：Lead 批准**一次** Toolkit rollback 受限对比；操作用 GATE 文件 `GO-rollback.txt`
  在运行前用文件工具创建为严格单行 `GO rollback`（此前不存在，无既有消费历史被覆盖）。
- 执行（唯一一次）：
  `bash experiments/third-party-pilots/toolkit-rollback-modified/run.sh rollback`
- launcher 输出：`rbk_overall_rc=0`、`launcher_exit=0`
- run 目录：
  [`runs/20261104T203558Z-rbk-rollback-416410-5374/`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/)
- unit：`rbk-third-party-rollback-20261104T203558Z-416410`

原始证据（全部为 run 目录内文件，未做任何二次 shell 统计）：

| 文件 | 用途 |
| --- | --- |
| [`rollback-output.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/rollback-output.txt) | runner 的 `case=` / `summary=` 记录（唯一运行时行为证据） |
| [`toolkit-rollback-manifest.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/toolkit-rollback-manifest.txt) | 信封自证、前置检查、workload 映射 |
| [`verdict.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/verdict.txt) | 退出码、哈希、终态、清理决定 |
| [`unit.log`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/unit.log) | systemd unit 运行摘要 |
| [`node-exit-code.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/node-exit-code.txt) | raw sandbox invocation rc |
| [`gate.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/gate.txt) | 单次容量门槛样本 |
| [`hashes-before.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/hashes-before.txt) / [`hashes-after.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/hashes-after.txt) | 29 个固定输入的运行前后哈希 |
| [`unit-cleanup.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/unit-cleanup.txt) | 清理决定与前后终态 |
| [`unit-props.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/unit-props.txt) / [`unit-props-after.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/unit-props-after.txt) | 前后探针原始输出 |
| [`status.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/status.txt) | payload 侧工作状态 |
| [`unit-scan.txt`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/runs/20261104T203558Z-rbk-rollback-416410-5374/unit-scan.txt) | 启动前活动 unit 扫描（空 = 无其他 pilot unit 活动） |

## 2. 精确计数与退出码

| 项 | 值 |
| --- | --- |
| runner 记录 | `summary passed=13 failed=0 blocked=0 total=13` |
| raw sandbox invocation rc | `0` |
| mapped `work_rc` | `0` |
| `unit_rc`（systemd-run） | `0` |
| `hash_rc` / `hash_status` | `0` / `identical` |
| `overall_rc` | `0` |

13 条记录（名称与自报 detail 摘要）：

| # | case | 结果摘要 |
| --- | --- | --- |
| 1 | `bridge_resolves_bare_specifier_to_checkout_entry` | `defineTool=function`，入口解析到 checkout 的 `lib/index.js` |
| 2 | `modified_module_surface_matches_original` | `name=@deepseek-ai/dsh-toolkit`、`inject=[tools]`、`default=absent` |
| 3 | `original_normal_ten_registrations_no_disposer_calls` | `registrations=10 disposer_calls=0 restored=yes`（原版） |
| 4 | `modified_normal_ten_registrations_no_disposer_calls` | 同上（改造副本）：正常路径不调用 disposer，方法已恢复 |
| 5 | `original_failure_at_fourth_rolls_back_reverse` | 原版：`order=[3,2,1]`、`message_carries_primary_text=yes`、`code=absent` |
| 6 | `modified_failure_at_fourth_rolls_back_reverse_and_keeps_identity` | 改造：`order=[3,2,1]`、`code=ERR_DSH_TOOLKIT_ROLLBACK_CLEAN`、primary/cause 身份保留、`message_has_no_primary_text=yes` |
| 7 | `modified_failure_at_sixth_rolls_back_reverse` | `order=[5,4,3,2,1]`（LIFO 逆序） |
| 8 | `modified_cleanup_failure_is_aggregate_and_keeps_identity` | `aggregate=yes`、`code=ERR_DSH_TOOLKIT_ROLLBACK_AGGREGATE`、`errors=[primary,cleanup]`、身份保留 |
| 9 | `register_restored_before_cleanup_differs_from_original` | 原版回滚期间 `[false,false]`、改造 `[true,true]`（即"先恢复再清理"的显式语义差异） |
| 10 | `hostile_thrown_values_do_not_break_wrapping` | `primitive_number/symbol/frozen_object/throwing_toString` 全部被包装、身份保留 |
| 11 | `gated_disposer_is_awaited_then_released` | `disposer_entry_observed=yes`、`pending_after_event_loop_turn=yes`、`outcome=rejected`、`order=[1]` |
| 12 | `negative_control_detects_early_settlement` | 负对照：`entered_observed=yes`、观测点为 `rejected` → 判据能识别提前结算 |
| 13 | `bridge_hook_deregistered` | `deregister()` 正常返回 |

## 3. 资源与隔离（读回自证）

- cgroup（payload 在 unit 内读回）：`memory.max=805306368`、`memory.swap.max=0`、
  `pids.max=32`、`cpu.max=50000 100000` → `cgroup_proof=yes`。
- unit 属性（读回）：`Type=exec`、`RuntimeMaxUSec` 原始值 `2min` → 归一 `120000000`、
  `MemoryMax=805306368`、`MemorySwapMax=0`、`TasksMax=32` → `unit_proof=yes`。
- 容量门槛：`MemAvailable=1493116 KiB ≥ 1228800 KiB`，**单次采样**（`rbk_gate_samples=1`），
  不在 unit 内复证。
- 网络/文件系统：unit `PrivateNetwork=yes` + bwrap `--unshare-net`；`--ro-bind / /`，
  沙箱内唯一持久可写绑定是本次 `out/`（`/tmp` 为 tmpfs、`/dev` 为 devtmpfs，可写但不持久）。
- unit 运行摘要（`unit.log`）：`Service runtime: 684ms`、`CPU time consumed: 227ms`、
  `Memory peak: 57M (swap: 0B)`、`result success`、`status=0/SUCCESS`。

## 4. 输入哈希范围（29 个具名文件，非闭包）

`hash_status=identical`：运行前后逐个一致。覆盖两个 runner、`differential.test.mjs`、
`projects/dsh-plugin-kit/src/cleanup.js`、原版根入口 + 10 个子包入口、改造副本
`pkg/lib/index.js` 与 `pkg/src/index.ts` + 10 个子包入口、checkout 的
`@deepseek-ai/dsh-tools` `package.json` 与 `lib/index.js`（`preconditions_present=29`）。

关键值：`run.sh` `8a1a8467…`、`payload.sh` `0cca03a0…`、`differential.test.mjs` `f84ad2c9…`、
`kit/src/cleanup.js` `5fab080e…`、改造 `pkg/lib/index.js` `952a166d…`、
`pkg/src/index.ts` `33627fa8…`、checkout `package.json` `da8ee053…`、`lib/index.js` `1889cbf7…`。

**边界**：这 29 个哈希**不是**依赖闭包证明、**不是**构建证明，也**不**说明 `src` 与 `lib` 一致：
不遍历目录树、不枚举解析图、不编译任何东西；`node_modules` 未遍历，传递依赖不受这些哈希保护。

## 5. 终态与清理

- 首次探针：`show_rc=0`、`LoadState=not-found`、`ActiveState=inactive`、`SubState=dead`、
  `MainPID=0` → `terminal_state=not_found_loadstate_mainpid0`、`terminal_confirmed=yes`。
- 清理：`cleanup_action=skipped_already_terminal`（未 `stop`、未 `reset-failed`，
  记 `not_attempted_by_design`）。
- 清理后探针：同上 → `after_terminal_confirmed=yes`；`unit-scan.txt` 为空（无其他 pilot unit 活动）。
- `unit_unload_guaranteed=no`：本流程只证明"本次 unit 已到终态"，不声称插件已卸载或资源已释放。

## 6. 本记录能支持什么、不能支持什么

支持：在上述 768M/swap0/32 tasks/50% CPU/120s 信封、离线私有网络、只读根文件系统、
固定 Node `--max-old-space-size=384` 下，这一份差分文件的 13 条自定义记录全部通过，
其中包含"失败在第 4/第 6 次注册时的 LIFO 回滚""清理失败聚合""原始抛出值身份保留"
"受控闸门下确实在等待""负对照能识别提前结算"。

不能支持：

- **无 Loader 证据**：未经过 Cordis Loader、未启动真实组合、未证明真实宿主挂载；
- **无宿主权限 guard 证据**：假 `ctx.tools.register` 只记录调用并返回可计数 disposer；
- **无编译一致性**：`pkg/lib/index.js` 与 `pkg/src/index.ts` 是两处直接编辑，
  二者是否等价**仍未验证**（本轮也没有编译）；
- **无依赖闭包**：`pkg/package.json` 未声明 kit 依赖，整棵 `pkg` 脱离本工作区不可解析；
  kit 模块是以相对路径外引的实验依赖，不是发布依赖；
- **不泛化普通卸载**：13/13 通过**不等于**"普通（非失败）卸载路径不泄漏"，
  也不提供任何全局兼容性结论；正常路径只证明"未调用 disposer 且方法已恢复"。

## 7. 过程与偏差（如实登记）

1. 本章节数字全部来自上述 run 目录文件；**没有**为取证额外运行 shell 统计命令。
2. `unit-props.txt` 是**事后快照**（`Type=` 为空、`RuntimeMaxUSec=infinity`、
   `MemoryMax=infinity`、`TasksMax=4652`、`LoadState=not-found`），**不能**当作信封证据；
   信封证据以 manifest 第 26-32 行的 unit 内读回为准（`unit_proof=yes`），
   `unit-props.txt` 只用于终态判定（它记录的 `show_rc=0` 与四元状态）。
3. `status.txt` 中 `workload_state=not_applicable` 是解包切片遗留的字段词汇，与本次判定无关。
4. `node-exit-code.txt` 明示 `node_start_not_independently_proven=yes`：
   `sandbox_invocation_rc=0` 是 bwrap 的退出状态，**不单独证明 node 启动成功**；
   node 是否真的跑了只由 `rollback-output.txt` 的 `case=` 行佐证。
5. `GO-rollback.txt` 由文件工具在运行前创建为严格单行；运行结束后在同一文件末尾追加消费说明
   （保留原有内容，不改历史）。
6. payload 输出文件的单次 checked fd 打开失败路径、以及 `exec 5>` 失败注入，**本轮未做故障注入验证**；
   该路径的行为仅由 bash 语义与本轮零命令前的静态审阅支持。
7. 未安装任何依赖、未编译、未运行 Loader、未触碰 3080 GUI、未触碰生产 `/root/.dsh`、
   未修改原版树与 copy 证据。
