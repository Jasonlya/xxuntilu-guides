# xxuntilu guides

把私有 Obsidian 知识库变成**可公开分享的交互式学习站点**：三栏阅读、清单可勾选、问答可自测，私密笔记则通过「构建期剔除 + AES-GCM 密文包」隔离。

- 站点仓库（公开）：`https://github.com/Jasonlya/xxuntilu-guides`
- 知识库仓库（私有）：`https://github.com/Jasonlya/obsidian-vault`
- 本地知识库：`~/Documents/Obsidian Vault`
- 线上地址：`https://jasonlya.github.io/xxuntilu-guides/`

## 一、它到底怎么跑

```text
[私有 Obsidian Vault]
  ├── 00-Inbox/            ─┐
  ├── 1-软件测试/ … 6-前端/ ─┼─ git push ─→ [GitHub Actions]
  ├── 4-面试/面试宝典/…     ─┤                ├─ ① AI 把 00-Inbox 归类并回写仓库
  └── 99-Private/          ─┘                ├─ ② 私密笔记：剔除 或 加密成密文包
                                             ├─ ③ next build → 静态站点
                                             ├─ ④ 泄漏扫描（扫不到私密明文才允许发布）
                                             └─ ⑤ 发布 GitHub Pages
[访客] 只看到公开笔记与一把锁
[你]   输主密码 → 浏览器本地解密 → 看到私密随记
```

三种内容，三条路径：

| 内容 | 放在哪 / 怎么标 | 公开站点里 | 你自己 |
| :--- | :--- | :--- | :--- |
| 公开笔记 | 六个知识域目录，且未标私密 | 正常展示，可勾清单、可自测 | 全量阅读，进度记在本机 |
| 私密笔记 | `99-Private/` 目录，或 frontmatter 写 `private: true` | 默认**构建期剔除**；配置主密码后只发布密文 | 输密码在浏览器解密查看 |
| 临时记录 / Key | 站点「个人保险箱」页面 | 不存在于任何产物 | 主密码加密后只存本机 LocalStorage |

> 安全红线：隐藏按钮不算加密。这个项目里私密内容从来不以明文进入 `out/`，构建末尾的 `scripts/check-leaks.mjs` 会用标题、路径、正文片段反向扫描产物，命中即失败。

## 二、本地开发

```bash
npm install
npm run dev          # 先同步 Vault 内容，再启动 next dev
```

`npm run dev` 默认读取 `~/Documents/Obsidian Vault`，也可以用环境变量指定：

```bash
cp .env.example .env.local   # 改成自己的路径/密钥，已在 .gitignore 中
```

常用命令：

| 命令 | 作用 |
| :--- | :--- |
| `npm run content` | 从 Vault 生成 `content/`（manifest、笔记 JSON、搜索索引、密文包） |
| `npm run dev` / `npm run build` | 内容 + 站点（静态导出到 `out/`） |
| `npm run archive -- --limit 3` | 预演 00-Inbox 自动归档（默认 dry-run，不动文件） |
| `npm run archive -- --apply` | 真正移动并回写 frontmatter |
| `npm run verify:leaks` | 扫描 `out/`，确认没有私密明文 |
| `npm run test:crypto` | 验证「Node 加密 → 浏览器解密」字节级一致 |

### 内容管线做了什么

1. 遍历 Vault，跳过 `.obsidian/`、`.git/`、`00-MOC/`（自动生成的导航）、`outputs/`（个人交付物）。
2. 解析 frontmatter，生成标题、摘要、汉字数、阅读时长、标签、知识域/分组。
3. `[[双链]]` 在构建期解析成站内链接；指向私密笔记的链接一律替换成「🔒 私密笔记」，连标题都不外泄。
4. 生成反向链接（谁引用了我），只统计公开来源。
5. 私密笔记写入 `content/private/index.json`（gitignore），再由 `scripts/encrypt-private.mjs` 加密。

## 三、GitHub 仓库配置（一次性）

### 1. 生成 deploy key（对 Vault 仓库有读写权限）

```bash
ssh-keygen -t ed25519 -C "xxuntilu-guides-actions" -f ./vault_deploy_key -N ""
```

- 公钥 `vault_deploy_key.pub` → Vault 仓库 `Settings → Deploy keys → Add deploy key`，**勾选 Allow write access**（归档后要 commit 回写）。
- 私钥 `vault_deploy_key` 全文 → 站点仓库 `Settings → Secrets and variables → Actions → Secrets`，名字 `VAULT_DEPLOY_KEY`。

### 2. 其余 Secrets / Variables

| 类型 | 名称 | 是否必需 | 说明 |
| :--- | :--- | :--- | :--- |
| Secret | `VAULT_DEPLOY_KEY` | 必需 | 上一步的私钥 |
| Secret | `VAULT_MASTER_PASSWORD` | 可选 | 私密区主密码，≥ 8 位；不配置则私密笔记完全不进产物 |
| Secret | `LLM_API_KEY` | 可选 | 自动归档用，DeepSeek/OpenAI 兼容接口均可；不配置则跳过归档 |
| Variable | `VAULT_REPO` | 可选 | 默认 `Jasonlya/obsidian-vault` |
| Variable | `LLM_BASE_URL` | 可选 | 默认 `https://api.deepseek.com/v1` |
| Variable | `LLM_MODEL` | 可选 | 默认 `deepseek-chat` |

### 3. 打开 Pages

仓库 `Settings → Pages → Build and deployment → Source` 选 **GitHub Actions**。

工作流已经在 `.github/workflows/publish.yml`：

- 触发：push 到 `main`、每天 04:10（北京时间）、手动 `Run workflow`（可勾选是否跑 AI 归档）。
- 构建时注入 `NEXT_PUBLIC_BASE_PATH=/xxuntilu-guides`，以适配项目页子路径。
- 归档 → 回写 Vault → 构建 → 泄漏扫描 → 上传 → 部署，任一步失败都不会发布。

### 4.（可选）Vault 一 push 就重建站点

站点仓库没法被动感知私有库的提交。想让「写完笔记推 Vault 就自动更新」，把 `docs/obsidian-vault-trigger.yml` 复制到 **Vault 仓库** 的 `.github/workflows/`，并在 Vault 仓库加一个 secret `SITE_DISPATCH_TOKEN`（fine-grained PAT，对 `xxuntilu-guides` 有 Actions: write 权限）。

## 四、日常怎么用

### 新笔记随手丢 00-Inbox

```bash
# 写一篇 00-Inbox/xxx.md，然后
npm run archive -- --limit 5            # 先看它打算归到哪
npm run archive -- --apply --limit 5    # 确认后真正归档
```

归档只让模型输出「域 / 子目录 / 标题 / 标签 / 置信度」，**正文一字不改**，frontmatter 由程序合并。置信度 < 0.5 或判断不了时，文件留在收件箱不动——宁可不动，不可乱动。

### 私密笔记

两种写法，任选：

```markdown
---
private: true
---
```

或直接把文件放进 `99-Private/`。另外这些路径默认也会被判定为私密：文件名含「个人经历 / 简历 / 薪资 / 梁尹澳」等。

- 没配 `VAULT_MASTER_PASSWORD`：私密笔记只在本地 Obsidian 可见，站点上连入口都不显示。
- 配了：站点发布 `public/private-vault.enc.json`（密文），顶栏出现「私密区 N」，输密码后在浏览器解密。

改密码 = 重新用新密码构建一次（旧密文无法用新密码解开，属预期行为）。

### 个人保险箱（/vault/）

临时想记的项目故事、Key、复盘：主密码加密后写入本机 LocalStorage。不上传、不同步，清缓存即消失，忘记密码无法恢复。

## 五、上线前自查（对应方案第五节）

1. **归档验证**：在 `00-Inbox/` 放一篇测试笔记推送到 Vault，跑 `Run workflow` 并勾选归档，确认 Action 把它移动到对应知识域并回写提交。
2. **隔离验证**：在 `99-Private/` 放一篇含敏感词的笔记，触发构建，然后在 Pages 站点和 `out/` 里搜该词，确认搜不到；同时确认构建日志出现 `[leak] ✓ 未发现私密笔记明文`。
3. **解锁验证**：打开 `/private/`，输错密码应提示失败；输对后能看到私密笔记正文；刷新页面应重新上锁。
4. **进度验证**：勾几条清单、标记一篇已读，刷新后仍保留；换一个浏览器则是干净的初始状态。

## 六、和原始方案的差异（以及为什么）

| 方案原文 | 这里的实现 | 原因 |
| :--- | :--- | :--- |
| Next.js 代码与笔记同仓库 | 站点在公开库，CI 用 deploy key 拉私有 Vault | Vault 是私有库；公开库只放代码，笔记永远是构建期临时数据 |
| `01-工具与中间件/02-业务与工程实践/03-日常随记` | 按现有六个知识域（`1-软件测试` … `6-前端`） | 与真实 Vault 目录一致，避免为了方案再改库结构 |
| 归档时让 LLM 返回 `formatted_markdown` 整篇 | 只返回分类与元数据，正文由程序拼装 | 整篇回写有改写/截断风险，且成本高；分类任务是模型最稳的部分 |
| PBKDF2 150000 次 | 310000 次 | 公开产物里的密文要抗离线爆破，代价是解锁多几十毫秒 |
| 构建前 `unlink` 私密文件 | 不删除源文件，只在内存/产物层过滤 | CI 里删 checkout 没问题，但本地误跑会伤数据；产物层过滤同样零泄漏 |
| 无泄漏校验 | 新增 `check-leaks.mjs` | 把「应该没泄漏」变成构建门禁 |

## 七、目录结构

```text
.
├── config/site.config.mjs        # 路径、私密规则、知识域元数据、归档目标
├── scripts/
│   ├── sync-vault.mjs            # Vault → content（含私密分流、反链、搜索索引）
│   ├── encrypt-private.mjs       # 私密笔记 → AES-GCM 密文包
│   ├── archive-inbox.mjs         # 00-Inbox 分类归档（默认 dry-run）
│   ├── check-leaks.mjs           # 产物泄漏扫描（CI 门禁）
│   ├── test-crypto.mjs           # 加解密跨运行时自测
│   └── lib/                      # frontmatter 解析、slug、隐私判定、wikilink
├── src/
│   ├── app/                      # 首页 / 笔记 / 知识域 / 私密区 / 保险箱
│   ├── components/               # 三栏阅读、清单、自测、搜索、解锁弹窗
│   └── lib/                      # 内容读取、Markdown 解析、进度、加解密
└── .github/workflows/publish.yml # 归档 → 构建 → 扫码 → 发布 Pages
```

`content/`、`public/private-vault.enc.json`、`public/search-index.json` 都是构建产物，已在 `.gitignore` 中——**笔记永远不进公开仓库**。
