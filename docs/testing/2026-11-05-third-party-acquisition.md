# 第三方试点采集切片 — 单次实际运行记录

日期：2026-11-05（本地 01:01，UTC 2026-11-04T17:01:38Z）
状态：**已执行一次（ONE）**，成功。仅下载，未解包、未安装、未构建、未运行任何插件。
运行单元：`acq-third-party-20261104T170138Z-409347.service`（transient，`--collect`，已终止且已回收）
运行目录：`experiments/third-party-pilots/acquire/runs/20261104T170138Z-acquire-409347-8019/`

## 1. 实际命令（唯一一次，无重试、无轮询）

```
cd /root/dsh-ecosystem-spec && bash experiments/third-party-pilots/acquire/run.sh
```

启动器拉起且仅拉起一个 unit（argv 原文见 `argv.txt`）：

```
systemd-run --wait --pipe --collect --unit=acq-third-party-20261104T170138Z-409347
  --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0
  --property=TasksMax=32 --property=RuntimeMaxSec=120 --property=CPUQuota=50%
  --property=WorkingDirectory=.../acquire -- /bin/bash .../payload.sh <unit> <run>
```

unit 内唯一工作负载：串行下载两个固定 commit 的 codeload tar.gz，随后写 manifest 与哈希清单，结束。

## 2. 三份输入脚本的前后哈希（一致）

| 文件 | sha256（before = after） |
| --- | --- |
| `acquire/run.sh` | `f1ac96cac4b4d5a01ccb1a19de5a27acb15a328d9d355cb729299f3713f3c723` |
| `acquire/payload.sh` | `a3c990e8581b31dcbf1e4ce82e8b2a9612e13b1c00e0a9a278d6dc0a770ee510` |
| `acquire/README.md` | `92077ac332984ba40c56b923281a0f471ccf2c4b82bab060d5be5d26f2b5561a` |

`hash_status=identical`；未发生漂移，脚本在执行期间未被修改。

## 3. 两个目标：URL / HTTP / 字节 / 归档哈希

| id | 仓库 | pinned commit | HTTP | bytes | sh | gzip magic |
| --- | --- | --- | --- | --- | --- | --- |
| toolkit | `omdsh-dev/dsh-toolkit` | `c3319d9d3e78a18191e1381461b69e84bc547575` | 200 | 336,829 | `deedca61dbc38b67fc13acd8a7d22cb38f5589a9fbf07213ced3b2649ef768c8` | `1f8b` |
| harbor | `ZSeven-W/dsh-harbor` | `9465c9fb36d753ae66d45a6617e4d51db8163df9` | 200 | 4,105,625 | `c6d0588c74cba742c310958ccefffaebdad8984deefdd524816df6d80445cef4` | `1f8b` |

URL 均为字面量、`num_redirects=0`、`content_type=application/x-gzip`：

- https://codeload.github.com/omdsh-dev/dsh-toolkit/tar.gz/c3319d9d3e78a18191e1381461b69e84bc547575
- https://codeload.github.com/ZSeven-W/dsh-harbor/tar.gz/9465c9fb36d753ae66d45a6617e4d51db8163df9

原始产物（未解包），完整路径：

- `/root/dsh-ecosystem-spec/experiments/third-party-pilots/acquire/runs/20261104T170138Z-acquire-409347-8019/artifacts/toolkit-c3319d9d3e78a18191e1381461b69e84bc547575.tar.gz`
- `/root/dsh-ecosystem-spec/experiments/third-party-pilots/acquire/runs/20261104T170138Z-acquire-409347-8019/artifacts/harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9.tar.gz`

## 4. 有效资源限制、退出码、峰值

从内核与 systemd 双向读回、逐项比对通过（`acq_capture_ok=yes`）：

- cgroup：`memory.max=805306368`、`memory.swap.max=0`、`pids.max=32`、`cpu.max=50000 100000`
- unit：`Type=exec`、`MemoryMax=805306368`、`MemorySwapMax=0`、`TasksMax=32`、`RuntimeMaxUSec` 解析为 `120000000`
- 容量门槛（单次采样，无轮询）：`MemAvailable=1,491,592 KiB` ≥ 要求 `1,228,800 KiB` → `acq_gate=pass`
- 传输限制（**配置项**，非直接观测值）：每目标 `--connect-timeout 10`、`--max-time 40`；字节上限由 `/usr/bin/prlimit --fsize=20971520:20971520` 施加于下载子进程（**每文件**）。该上限的**存在**由 `argv.txt` 与本次成功执行支持；`RLIMIT_FSIZE` 本身**未被读回**，边界也**未被触达**，因此不能称为已直接观测到的限制值。
- 峰值：`memory.peak=25,423,872` B（约 24.2 MiB）、`memory.current=23,072,768` B、`pids.peak=6`、`memory.events.local` 全 0（无 oom/oom_kill）
- 时间：unit `Service runtime: 5.162s`、`CPU time 255ms`（远低于 120 s 预算）

退出码：`systemd_run_rc=0`、`acq_workload_rc=0`、`acq_record_rc=0`、`acq_final_rc=0`、`acceptance_exit=0`、启动器 `LAUNCHER_RC=0`。

## 5. 偏差与未覆盖项（如实记录，不作补正）

1. `acq_runtime_usec_numeric=<unavailable>`：`busctl` 未取到 transient unit 的 `RuntimeMaxUSec` 属性；脚本按既定回退解析 `systemctl show` 的 `2min` → `120000000`，该项**由回退路径而非 D-Bus 直读**确认。
2. `RLIMIT_FSIZE` 上限**从未被触发**：两个归档（0.32 MiB / 3.9 MiB）远低于 20 MiB。因此"传输中被截断"的行为**未被本次运行验证**；配置项由 `argv.txt` 与本次成功执行支持，但限制值未被读回，边界未被触达。
3. `journal_status=ok`（与 `--collect` 下常见 unavailable 不同），journal 已落盘。

## 6. 证据边界（必须与上述数字一起引用）

- **URL 与归档 sha256 只识别本次拿到的字节**，不证明这些字节等于 URL 中所指的 commit：不是 Git 签名，不是 tag/ref 校验，不证明作者与来源可信。commit 本身来自 `commits/main.atom` 与 Lead 指定，未经 Git 协议握手验证。
- **未解包**，因此**没有做 LICENSE 字节核验**：两个仓库的许可证文本仍在 archive 内，尚不可引用为许可证证据。
- 沙箱内**网络未隔离**，且 `--ro-bind / /` 仍允许**读取**宿主只读根；`env -i` + `curl -q` 只是窄缓解。
- 以上**不是安全认证**，也不含任何插件运行时证据（无 Loader、无 host、无 GUI、无插件加载）。

## 7. 收尾状态

- unit 已终止并被 `--collect` 回收：`systemctl status` 返回 `could not be found`；`acq-*`/`p0-*`/`acc-*`/`admission-*` 均无活动单元 → **没有需要清理的残留 unit**，本任务未创建其他 unit。
- 未触碰 `http://127.0.0.1:3080`，未触碰生产 `/root/.dsh`，未解包、未安装、未构建、未运行插件。
- 产物保留在运行目录，未删除、未重试。
