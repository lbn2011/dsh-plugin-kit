# 第三方解包切片：单次受限 unit 执行记录（test 模式）

日期：2026-11-05（本地时间 01:31，run id 内嵌 UTC 时间戳 20261104T173121Z）
范围：`experiments/third-party-pilots/extract/` 的负向测试套件，**test 模式单次执行**。
授权：Lead 明确授权 **ONE** 次 `bash experiments/third-party-pilots/extract/run.sh test`，并授权以
`extract/GO-test.txt`（内容 `GO test`）作为**操作闸**。**不授权 extract 模式**，`GO-extract.txt` 未创建
（执行前后均确认为 absent）。GO 文件只是操作标记，不构成任何运行时证据，用后已标为已消费。

## 1. 实际命令

```
cd /root/dsh-ecosystem-spec
bash experiments/third-party-pilots/extract/run.sh test
```

GO 闸创建方式（执行前，独占创建，先检查不存在）：

```
cd experiments/third-party-pilots/extract
ls GO-*.txt            # -> No such file or directory（创建前）
( set -C; printf 'GO test\n' > GO-test.txt )   # noclobber，排他创建
test ! -e GO-extract.txt                        # -> absent
```

launcher 输出：

```
exc_overall_rc=72
exc_run_dir=/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T173121Z-exc-test-410243-28538
exc_unit=exc-third-party-test-20261104T173121Z-410243
```

## 2. 结果（实测值，非估计）

| 项 | 值 |
| --- | --- |
| 套件 `passed` | **42** |
| 套件 `failed` | **2** |
| 套件 `skipped` | **1** |
| 套件 verdict | `FAILED`（`note` 明示：含 skip 的运行不构成整体通过） |
| `negative_tests_rc` | `1` → 映射 `failed` |
| `work_rc` | `72` |
| `record_rc` | `0`（证据全部写入成功） |
| `overall_rc` | **`72`**（解包/测试失败，非拒绝 70、非记录失败 73） |
| `systemd-run.rc` | `72` |
| 套件自报耗时 | `suite_seconds=1.8` |
| unit 侧 `Service runtime` | `2.123s`，`CPU time consumed: 1.047s` |
| `MemoryPeak` | `42803200` B（约 40.8 MiB），swap `0B` |

结论：**本次运行失败**（rc 72）。两条真实失败，一条夹具限制跳过，见第 7 节。

## 3. 五输入前后哈希（逐字节一致，输入未被改动）

执行前后 `hashes-before.txt` / `hashes-after.txt` **逐字节相同**（`hash_status=identical`）：

| 输入 | sha256 |
| --- | --- |
| `extract/run.sh` | `db52044c24e26afa66dca6cc0323d7541f5461f0f787879f9f1b28cce83324e6` |
| `extract/payload.sh` | `aad620cce19aef51e5783f6f220d1fc365ddb174ab8e0b0797d38c6673c22cd6` |
| `extract/extract.py` | `cdd4bfe5b947723a0b7deb828729231b5ec36f49f8b5fedf15e535f64d5e635a` |
| `extract/tests/negative-tests.py` | `550c9d079c40fe9f3febaedaf3269cf5af37de77f4f119f66c34f4cdd52b7865` |
| `extract/README.md` | `f2d6b5566106e79aa0b4a0da9ddc6a84c8fc3d2eb251c557850efdc72fba69de` |

## 4. 有效限制（读回，不是只想传 argv）

来自 `extract-manifest.txt` / `unit-props.txt` / `gate.txt`：

- cgroup（`cgroup_proof=yes`，按 `/proc/self/cgroup` → `/sys/fs/cgroup$rel` 读回）：
  `memory.max=805306368`、`memory.swap.max=0`、`pids.max=32`、`cpu.max=50000 100000`。
- unit（`unit_proof=yes`，`systemctl show` 读回）：`Type=exec`、`MemoryMax=805306368`、
  `MemorySwapMax=0`、`TasksMax=32`、`CPUQuotaPerSecUSec=500ms`。
- `RuntimeMaxUSec` 读回原值为 **`2min`**（不是数字），已按 `2min`/`120s`/`120000000` 白名单归一记录：
  `unit_runtime_max_raw=2min`、`unit_runtime_max_normalized_usec=120000000`。
- 单次 MemAvailable 门槛：`exc_gate_memavailable_kib=1752968 ≥ required 1228800`，
  `exc_gate=pass`、`exc_gate_samples=1`。
- 沙箱：`PrivateNetwork=yes`（unit）+ bwrap `--unshare-net`（`sandbox_net=unshare-net (no route)`），
  `--ro-bind / /` 使宿主只读，唯一可写路径为本 run 目录；`env -i` 仅
  `PATH`（最小集）/`PYTHONDONTWRITEBYTECODE=1`/`HOME=run_dir`/`TMPDIR=run_dir/tmp`。
- 解包预算（未触达，仅声明）：总量 `134217728`、单文件 `20971520`、成员上限 `10000`。

## 5. unit 终态与收尾

- 执行期终态：`LoadState=loaded`、`ActiveState=failed`、`SubState=failed`、`MainPID=0`、`Result=exit-code`、
  `show_rc=0` → `terminal_state=failed_mainpid0`、`terminal_confirmed=yes`。
- 清理：**先 `stop` 后 `reset-failed`**，`stop_rc=0`、`reset_failed_rc=0`。
- 清理后：`LoadState=not-found`、`ActiveState=inactive`、`SubState=dead`、`MainPID=0`、
  `after_show_rc=0` → `state_after_cleanup=not_found_loadstate`、`after_terminal_confirmed=yes`。
- 仍明示 `unit_unload_guaranteed=no`：本脚本不声称能证明 unit 已彻底卸载。
- 执行前 `unit-scan.txt` 为空（无 `exc-*`/`acq-*`/`p0-*`/`acc-*`/`admission-*` 活动单元）。

## 6. 原始证据路径（完整、可直接打开）

- run 目录：`/root/dsh-ecosystem-spec/experiments/third-party-pilots/extract/runs/20261104T173121Z-exc-test-410243-28538/`
- `verdict.txt`、`status.txt`、`argv.txt`、`gate.txt`、`unit.log`、`systemd-run.rc`
- `unit-props.txt`、`unit-props-after.txt`、`unit-cleanup.txt`、`unit-scan.txt`
- `extract-manifest.txt`、`negative-tests.txt`（逐用例 pass/fail/skip 与 detail）
- `hashes-before.txt`、`hashes-after.txt`
- 测试夹具工作区 `neg-tmp/`（权限 `0700`，仅本次 run 内）

## 7. 失败与跳过（逐条，含判定）

> 本节为**当时的判定记录，原样保留**；其中第 1 条的"安全缺陷"归因已被第 10 节**撤回**，
> 第 2 条的期望值改法亦被第 10 节更正。本节所有**数值**（42/2/1、rc 72）仍然有效。

1. **`repeated_trailing_slash_refused` — fail（真实缺陷，拒绝未发生）**
   detail：`expected rc=70 got rc=0; reason 'repeated trailing slash' missing from stderr ([]);
   refusal still created the output path; refusal still created the evidence file`。
   含义：对"目录名带重复尾随斜杠"的成员，`extract.py` **没有拒绝**，返回 0 并**真的创建了输出目录与证据文件**。
   这不是证据写不出，而是接受路径判定错误；对安全切片而言属高优先缺陷（本应拒绝却放行）。
2. **`duplicate_slashdot_refused` — fail（夹具/期望排序问题，非放行）**
   detail：`reason 'duplicate canonical member path' missing from stderr
   (["extract: refused: '.' component in member name: 'top/./a'"])`。
   含义：解包器**确实拒绝了**，但先命中 `.` 分量规则，未走到"重复规范路径"分支；该夹具无法表达目标场景。
   之前约定 `top/./a` 属"tarfile 规范化限制"可 skip，此处未被 skip，故计为失败。
3. **`nul_name_refused` — skip（夹具限制）**
   `reason=tarfile cannot encode this member`，`stored names ['top/a'] differ from ['top/a\x00b']`。
   仅为夹具无法编码，**不构成任何通过证据**，且被计入"含 skip 即非整体通过"。

## 8. 偏差与不可得证据（全部列出）

- 本次是**失败运行**：不构成解包器安全性通过、不构成任何插件迁移结论。
- **无真实归档参与**：test 模式只用夹具 tar，两枚真实第三方归档（toolkit/harbor）**未解包**，
  因此**仍无任何真实 LICENSE 原字节核验**。
- **未联网、未安装、未构建、未运行任何插件代码**；`no_archive_content_executed=yes` 仅指本 run 的夹具。
- `unit_unload_guaranteed=no`：卸载由 systemd 侧显示为 `not-found`，但本脚本不声称证明彻底卸载。
- 未做 `bash -n`、未做额外 Python 探针（按授权约束）；因此除本次实际执行覆盖的路径外，
  其它脚本分支仍只有静态正确性。
- `RLIMIT_FSIZE`/`prlimit` 一类传输期上限与本次无关（无下载）；此前 acquire 运行中 20MiB 上限
  **从未触达**，该限制的截断行为至今**未验证**。
- 未触碰 GUI `127.0.0.1:3080`，未触碰生产 `/root/.dsh`，未创建 `GO-extract.txt`。
- 本次未执行任何自动修复或重跑；`GO-test.txt` 单次授权已消费。

## 9. 下一步（需另行授权，本记录不做）

- 修 `repeated_trailing_slash_refused` 暴露的接受路径缺陷（`extract.py` 名称规范化），
  并把 `duplicate_slashdot_refused` 改为可表达的夹具或按既定规则 skip。
- 修复后需**新的**单次 GO 才能重跑；不得据 `GO-test.txt` 的历史存在重跑（该闸已消费）。
- `extract` 模式（真实归档解包）仍**未获授权**，且需独立 GO。

---

# 10. 更正（诊断后追加；上文第 1–9 节保持原样，不覆写历史记录）

本节**更正**上文第 7 节两条失败的性质判定与第 9 节拟修方向。上文的实测数值（passed=42 / failed=2 /
skipped=1、`overall_rc=72`、哈希、限制读回、终态）**全部有效且不变**；改的是**归因**。

## 10.1 撤回"尾随斜杠安全漏洞"的结论

原判："`repeated_trailing_slash_refused` 失败 = 解包器放行了重复尾随斜杠，属安全向高优先缺陷"。
**该结论不成立，予以撤回**。依据（只读源码，未执行任何命令）：

- `/usr/lib/python3.13/tarfile.py:1343-1345`：
  `if obj.isdir(): obj.name = obj.name.rstrip("/")` —— 注释原文 "Remove redundant slashes from
  directories"，**目录成员的冗余尾随斜杠在解析阶段就被删除**。
- 同文件 `:1322-1323`：`AREGTYPE` 且名字以 `/` 结尾的头会被**提升为 `DIRTYPE`**，因此该规范化也
  覆盖"带尾随斜杠的普通文件"。
- 夹具用 `{"kind": "dir", "name": "top//"}`（`tests/negative-tests.py` 原第 279-280 行），
  经 `write_archive` 写盘再读回，存储名已是 `top` —— 解包器**从未见到** `top//`。
- `extract.py:141-148` 的辅助函数对 `top//` 是**正确拒绝**的（`repeated trailing slash in member
  name`），单元用例 `normalize_reject_repeated_trailing_slash` 在同一次运行中 **pass**。

因此本次并非"解包器接受了一个恶意名字"，而是**测试前提不可达**：断言了一个 parser 已经抹掉的输入。
`extract.py` 生产逻辑**无证据表明存在该缺陷，故不做任何改动**。

## 10.2 诚实保留的真实边界（不升级为漏洞，也不掩盖）

- 本解包器的名字策略作用于 `tarfile` **解析后**的名字，**原始 512 字节头不是策略边界**。
  原始头写 `top//` 会被 CPython 静默规范化，随后按 `top` 接受 —— 这是 **parser 事实**，
  记录为正向边界，不称遍历漏洞，也不声称"原始字节策略已保证"。
- 可达性差异是有解释的：`top//a`（普通文件）能拒绝（空分量），因为 `rstrip` **只对目录生效**；
  目录级"重复尾随斜杠"在归档层不可达。
- NUL：tar 头**无法表示** NUL，归档层不可能构造该拒绝；不虚构 tar 级拒绝结论。

## 10.3 逐条更正与最小改动（仅 `extract/` 与本文档；`acquire/` 未触碰）

1. `repeated_trailing_slash_refused`（归档拒绝用例）**移除**；改为正向 parser 边界用例
   `parser_normalizes_dir_trailing_slashes`：同一夹具，断言存储名为 `[top, top/a]` 且解包器
   接受，detail 明写"tarfile 对目录 rstrip，原始字节不是策略边界"。
   目录级拒绝仍由 `normalize_reject_repeated_trailing_slash`（`normalize_parts("top//",
   allow_trailing_slash=True)`）覆盖 —— 该回归**保留不动**。
2. `duplicate_slashdot_refused` **改名** `slashdot_component_refused`，期望理由改为**实际可达**的
   `'.' component`（`top/a` + `top/./a` 被 `.` 分量规则拒绝，**不要求**先命中 duplicate 分支；
   真正的重复分支由既有的 `duplicate_member_refused` 覆盖，且该用例本次 pass）。
   同时把它从 `MAYBE_UNENCODABLE` / `MAYBE_UNENCODABLE_CASES` **删除**：tarfile 原样保留 `.`，
   **不得**再用 skip 掩盖。
3. NUL：新增单元用例 `normalize_reject_nul_char`，直接断言
   `normalize_parts("top/a\x00b")` 被拒（`extract.py:127-128` 的 NUL 分支）；
   归档层 `nul_name_refused` **保留为具名夹具限制**（`SKIP_TARFILE_CANNOT_ENCODE`），不虚构 tar 级拒绝。
4. 文件头新增"Raw header bytes versus parsed member names"一节，写明上述边界与三条推论；
   `SKIP_FIXTURE_NORMALIZED` 常量保留并注明当前无用例使用（不再是 `top/./a` 的理由）。
5. `README.md`：第 2 节第 3 条补 parser 边界说明；第 4 节归档用例清单改为"规范化后才重复必须被拒
   + 正向 parser 边界用例"，并把 `top/./a` 从"可 skip 的夹具限制"中移除。

## 10.4 本次更正的状态边界

- **未执行任何命令**（无 `bash -n`、无 python 探针、无重跑），**未创建任何 GO 文件**，
  未解真实归档，未安装，未联网。
- 因此上述改动**没有运行时证据**：新用例与改名后的期望值都只经过源码级推导。
- 因用例集合发生变化（减 1 归档拒绝 + 增 1 正向边界 + 增 1 单元用例），历史 `passed=42/failed=2/
  skipped=1` **不再对应新套件**；新套件的通过率必须在**新的单次 GO** 下重新测，不得引用旧数字。
- `GO-test.txt` 已消费，不得据其重跑。
