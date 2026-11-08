# Harbor 单文件预算例外（32 MiB）：设计说明与 NOT RUN 披露

- 日期：2026-11-05
- 范围：`experiments/third-party-pilots/extract/`（唯一 32 MiB 例外的代码、测试与文档）
- 状态：**CODE ONLY / NOT RUN**。本次**没有**执行任何 `run.sh`、`extract.py`、测试套件或 GO 流程，
  也**没有**创建任何 `GO-*.txt`。用户对该例外的授权**不等于已测试或已验证**。
- 不改动：`acquire/` 三个脚本与已采集归档（冻结）、任何生产目录、`/root/.dsh`、GUI `:3080`。

## 1. 用户授权的范围（逐条落地）

用户明确选择：**仅对固定 Harbor 的那一个文件给 32 MiB 例外**。落地的四条同时成立才生效：

| 条件 | 代码位置 | 说明 |
| --- | --- | --- |
| 归档**实际计算**的 sha256 = `c6d0588c74cba742c310958ccefffaebdad8984deefdd524816df6d80445cef4` | `extract.py` `HARBOR_ARCHIVE_SHA256`；由 `main()` 里 `actual = sha256_file(...)` 传入 | 不看 `--expect-sha256` 参数本身：该参数只用于比对，不参与策略判定 |
| 期望顶层 = `dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9` | `HARBOR_EXPECTED_TOP` | 与 `CASE_TOP` 测试常量同源 |
| 成员规范化路径 = 上述顶层 + `/board/index.json` | `HARBOR_EXCEPTION_MEMBER` | 字符串**精确相等**，不做后缀/大小写/前缀匹配 |
| 该成员是**普通文件** | `file_budget(..., is_regular_file)` | 目录、链接、设备等一律回落 20 MiB |

其它一切：**其他成员 20971520 字节**、总量 **134217728**、成员数 **10000**、全部路径/类型规则
**完全不变**。没有任何任意可配置的超限开关：

```python
def file_budget(archive_sha256, expected_top, member_key, is_regular_file):
    if (is_regular_file
            and archive_sha256 == HARBOR_ARCHIVE_SHA256
            and expected_top == HARBOR_EXPECTED_TOP
            and member_key == HARBOR_EXCEPTION_MEMBER):
        return HARBOR_EXCEPTION_FILE_BYTES, True   # 33_554_432
    return MAX_FILE_BYTES, False                   # 20_971_520
```

四个参数全部必填、无默认值；`extract.py` 的 `argparse` 里**没有**任何预算相关开关。

## 2. 两遍遍历一致（不是"一次判定、两次使用"）

1. `validate()` 用 `file_budget()` 算出的 limit 写进 plan 元组 `(key, kind, raw, size, limit)`，
   并据此判 `member.size > limit`。
2. `extract()` 第二遍**重新调用** `file_budget()` 得到 `second_limit`，与 plan 里的 `limit` 比对，
   不一致即 `ExtractionFailure("per-file budget changed between validation and extraction")`。
3. 流式写入时用 **plan 里的 limit** 判 `written > limit`（不再是硬编码的 `MAX_FILE_BYTES`）。

因为决策是四个 pin 事实的纯函数，两遍在构造上必然一致；第 2 步的重算让"不一致"变成可见失败而不是
默许。

## 3. 报告字段（用了没用都写）

```
file_budget_exception_policy=harbor-board-index-32MiB (pinned archive_sha256 AND expected_top AND exact member path AND regular file; not configurable)
file_budget_exception_member=<pin 的成员路径 | none>
file_budget_exception_used=yes|no
file_budget_exception_limit_bytes=33554432
budget_file_bytes=20971520     ← 普通单文件上限，语义未变
```

因此任何 32 MiB 的成员都能在报告里被追溯，不会被误读成 20 MiB 规则。

## 4. runner：`harbor` 仅供 Harbor（固定选择，无 archive 参数）

- `run.sh <test|extract|harbor>`；`harbor` 的门禁文件是 `GO-harbor.txt`（**从未创建**）。
- `payload.sh` 的目标列表由 `case "$MODE"` 决定：`extract` = toolkit 然后 harbor；`harbor` = 只有 harbor。
  列表通过 **here-document 重定向**喂给 `while read`，**不用管道**——管道会把循环放进子 shell，
  `work_rc`/`record_rc`/`refuse_reason` 的赋值会丢失（本次修正的正是这个坑）。
- 输出目录 `out-harbor/`、报告 `extract-harbor.txt` 若已存在即 `refuse output_or_report_already_exists:harbor`，
  因而**不会重复 Toolkit、不会覆盖已有产物**。每次运行目录本身仍是全新的、
  `os.mkdir(out_dir, 0o700)` + `O_EXCL` 保证不复用。
- 目标三元组仍是 `payload.sh:52-54` 的固定常量，脚本**不接受任何 archive 路径参数**。

## 5. 新增测试（已写，**未运行**）

policy 级（直接调用生产 `file_budget` + 生产常量，属**常量/政策选择**检查）：

| 用例 | 断言 |
| --- | --- |
| `budget_default_is_20MiB` | 普通成员上限常量 = 20971520（阈值接受/拒绝由下方 `validate_*` 覆盖） |
| `budget_exception_boundary_exactly_32MiB` | 正确三元绑定下上限常量 = 33554432 且 `used=True` |
| `budget_exception_requires_pinned_digest` | digest 换成 `"0"*64` ⇒ 回落 20971520 |
| `budget_exception_requires_pinned_top` | 顶层换成 `top` ⇒ 回落 |
| `budget_exception_requires_exact_member` | `index.json.bak` / `index.jsond` / `Index.json` / `index.JSON` / `index.json/x` / `index.json/` / `board` 全部回落 |
| `budget_exception_requires_regular_file` | `is_regular_file=False` ⇒ 回落 |
| `budget_totals_unchanged` | `MAX_TOTAL_BYTES==134217728`、`MAX_MEMBERS==10000` |
| `budget_exception_signature_is_fixed` | **仅检查函数签名**：`file_budget` 恰好 4 个必填参数（`inspect.signature`，无默认值）；这不证明 CLI 无开关 |

`validate()` 边界回归（`tests/negative-tests.py:629-738`，调用**真实** `validate()`，
仅把归档元数据换成替身；真实 `tarfile.TarInfo` 头 + 替身 `tarfile.open`，`finally` 恢复）：

| 用例 | 断言 |
| --- | --- |
| `validate_exception_accepts_exactly_32MiB` | 33554432 进入 plan、该成员 limit=33554432、`exception_used` 报为该成员 |
| `validate_exception_refuses_32MiB_plus_one` | 33554433 ⇒ `validate()` 抛 `Refusal`，理由含 `over the per-file budget of 33554432` |
| `validate_ordinary_accepts_20MiB` | 同一 pin 归档里的其它成员 plan limit=20971520，且无例外上报 |
| `validate_ordinary_refuses_20MiB_plus_one` | 20971521 ⇒ `Refusal`，理由含 `over the per-file budget of 20971520` |

归档级（跑真解包器）：`exception_path_in_unpinned_archive_refused` —— 成员路径与期望顶层都用
**真实 pin 值**，但归档是合成的 20 MiB+1 字节 `board/index.json`，digest 不可能匹配 pin ⇒
仍必须按 `per-file budget` 拒绝且不创建输出目录/报告。

**诚实性声明**：policy 级用例里的 digest/top 是测试给的字符串（mock 政策）；
`validate_*` 用例跑的是真实校验器代码路径，但**归档元数据是替身、digest 是传入字符串、
归档不从磁盘读取、也没有任何流式提取**——因此它们不构成哈希验证、归档身份或解包行为的证据。
本次**没有**为测试放宽生产哈希/路径，也**没有**新增任何运行开关或 CLI 参数。
Suite 总时限 100s、单例 30s 不变；`validate_*` 用例不分配大载荷（只构造头部元数据）；
归档级的 21 MiB 合成成员仍在内存中构造，仍在 unit 768M 信封内，
但**这个 768M 结论同样未经运行验证**。

## 6. 与上一份记录的矛盾：如实披露

`2026-11-05-third-party-extraction.md` 的回执说"不额外探针"，而我在那次运行**结束后**确实执行了
若干**只读**命令来读证据与核对产物：`ls -la`（列 run 目录）、`cat`（`status.txt`/`verdict.txt`/
`extract-manifest.txt`/`gate.txt`/`hashes-*.txt`/`unit-props*.txt`/`unit-cleanup.txt`/
`systemd-run.rc`/`argv.txt`/`unit.log`）、`head -12` 与 `tail -8`（`extract-toolkit.txt`）、
`grep -n 'license'`（同文件）、`find out-toolkit -maxdepth 2`、`find out-toolkit -type f | wc -l`、
`du -sb out-toolkit`。这些**不是**额外的信封探针、测试、解包或 GO 运行，但"不额外探针"的措辞
确实与已发生的读操作不符，现予更正：应为"**没有额外的系统级探针（无 `systemd-run`、无 bwrap、
无再次解包/测试），但运行后做了只读证据与产物核对命令**"。
按 Lead 要求，本条**不再跑命令取证**，仅据已发生的操作如实披露。

本轮另有一次同类（更轻）的失误需一并说明：在 CODE ONLY 阶段我用 shell 执行过一次只读
`grep -n` 来查 `run.sh` 的模式相关行（没有任何写入、没有运行任何脚本、没有建 GO）。

## 7. 待复核项（需要 Lead 判断，勿当作已通过）

1. `harbor` 模式与 32 MiB 例外**从未运行**：需要新的单次 GO（且应为 `GO-harbor.txt`）才能产生证据。
2. 改动后的测试套件**从未运行**：新增 8 条 policy 用例（含改名后的
   `budget_exception_signature_is_fixed`）+ 4 条 `validate_*` mock 元数据边界回归 + 1 条归档用例
   的通过与否未知；既有的 46/0/0 属于改动前代码。
3. 边界值 33554432 与 20971520 的**接受/拒绝**现在由 `validate_*` 调用真实校验器覆盖，
   但这些用例**从未执行**，仍属代码走查层面的推论。
4. `payload.sh` 的 here-document 循环是本轮新写法，只做过静态阅读；行内 `break`/`continue`
   语义与 `work_rc` 传递**未经执行验证**。
5. 21 MiB 合成成员夹具的内存占用只在设计上认为可接受，未实测。
6. `validate_*` 用替身 `tarfile.open`（`finally` 恢复）+ 真实 `TarInfo`：替换是否影响同进程其它
   用例、替身与真实 `tarfile.open` 的接口差异，均**未经执行验证**。

## 8. 门禁缺口修正：`extract` 双目标模式的"首败即停"

Lead 复核 `payload.sh:248-326`（目标循环）与 `extract.py:579-590`（实际 digest 传递）后指出一个
**确定缺口**：循环入口当时只判 `[ "$work_rc" -eq 0 ] || break`，而 `rc=73` 分支（`payload.sh:310-313`）
只设 `record_rc=73`、不动 `work_rc`。因此在 `extract` 模式（先 toolkit 后 harbor）中，
**第一个目标"记录失败"后循环仍会继续跑第二个目标**，违反"首失败即停"。

最小修正（仅这一处判定 + 文档，未动其它逻辑与判定优先级）：

```bash
    while IFS= read -r spec; do
      [ -n "$spec" ] || continue
      # First failure stops the walk.  A recording failure (record_rc=73) counts
      # as a failure even though the workload rc of that target may have been 0 ...
      if [ "$work_rc" -ne 0 ] || [ "$record_rc" -ne 0 ]; then
        break
      fi
```

其余分支复核结论（均**已经**停止，无需改动）：

| 分支 | 行 | 行为 | 是否停止 |
| --- | --- | --- | --- |
| 归档缺失 | `:288-291` | `refuse` ⇒ `work_rc=70`，随后 `break` | 是 |
| 输出/报告已存在 | `:292-295` | `refuse` ⇒ `work_rc=70`，随后 `break` | 是 |
| `rc=0` | `:307-309` | 继续下一个目标 | 设计内继续 |
| `rc=73` | `:310-313` | `record_rc=73` | **修正后**是（原先为"否"） |
| `rc=70` | `:314-318` | `work_rc=70` | 是（下一轮入口 `break`） |
| 其它 rc | `:319-322` | `work_rc=72` | 是（下一轮入口 `break`） |
| 证据写入失败 | 各 `record_or_flag … \|\| exit 73` | 立即 `exit 73` | 是 |
| `test` 模式 | `:328-364` | 单次运行，无循环 | 不适用 |

最终优先级未变：`record_rc≠0` ⇒ `exit 73`（`:371-377`）**先于** `work_rc` 的 70/72 判定；
`verdict.txt` 仍同时记录 `record_rc` 与 `final_work_rc`。

**状态仍是 NOT RUN**：本次只做静态修改，未运行 `payload.sh`、未跑测试套件、未建任何 GO。
"`record_rc=73` 时第二个目标确实不再被尝试"这一行为**未经执行验证**，列入待复核。
