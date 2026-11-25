import { homedir } from 'node:os';
import path from 'node:path';

/**
 * 站点与内容管线的唯一配置入口。
 * 所有脚本（同步、归档、泄漏检查）都从这里读，避免规则散落。
 */

export const vaultDir =
  process.env.VAULT_DIR && process.env.VAULT_DIR.trim()
    ? process.env.VAULT_DIR.trim()
    : path.join(homedir(), 'Documents', 'Obsidian Vault');

/** 不进公开站点的目录（注意：这里只是“不上站”，不代表删除本地文件） */
export const excludeDirs = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  'outputs',
  '00-MOC',
]);

/** 只发布 Markdown；附件默认不发布，避免简历/截图等原件外泄 */
export const publishExtensions = new Set(['.md']);

/**
 * 私密判定：命中任一规则即视为私密，公开产物中绝不出现明文。
 * 1) 目录命中（如 99-Private）
 * 2) 文件名/路径命中个人敏感词
 * 3) Frontmatter 显式声明
 */
export const privateDirNames = new Set(['99-private', '99-私密', 'private', '_private']);

export const privatePathPatterns = [
  /个人经历/i,
  /简历/i,
  /薪资/i,
  /工资单/i,
  /银行/i,
  /身份证/i,
  /offer[-_ ]?letter/i,
  /梁尹澳/i,
];

export const privateFrontmatterFlags = [
  ['private', true],
  ['visibility', 'private'],
  ['publish', false],
  ['status', 'private'],
  ['sensitive', true],
];

export const domainMeta = {
  '1-软件测试': {
    title: '软件测试',
    short: '测试',
    desc: '接口测试套路、用例设计方法、测试工具与自动化。',
    accent: '#4f46e5',
  },
  '2-技术基础': {
    title: '技术基础',
    short: '基础',
    desc: '协议与传输、数据库与中间件、运维与排错。',
    accent: '#0f766e',
  },
  '3-业务知识': {
    title: '业务知识',
    short: '业务',
    desc: '支付、行情、ERP 等业务域的接口与坑。',
    accent: '#b45309',
  },
  '4-面试': {
    title: '面试',
    short: '面试',
    desc: '面试宝典、题库与答题骨架。',
    accent: '#be123c',
  },
  '5-AI与Agent': {
    title: 'AI 与 Agent',
    short: 'AI',
    desc: 'Agent 执行循环、RAG 链路、评测与判分。',
    accent: '#7c3aed',
  },
  '6-前端': {
    title: '前端',
    short: '前端',
    desc: 'Vue / React / TypeScript 与前端测试。',
    accent: '#0369a1',
  },
  '00-规范': {
    title: '库规范',
    short: '规范',
    desc: '写作规范、库使用说明与批量生成校验。',
    accent: '#475569',
  },
};

/** 归档脚本允许写入的目标：域名 -> 子目录白名单 */
export const archiveTargets = {
  '1-软件测试': ['接口测试', '测试工具', '测试方法'],
  '2-技术基础': ['协议与传输', '数据库与中间件', '运维与排查'],
  '3-业务知识': ['ERP', '其他业务', '支付', '行情'],
  '4-面试': ['面试宝典', '题库'],
  '5-AI与Agent': ['RAG', 'agent相关', 'agent评测'],
  '6-前端': [],
};

/** 归档前台展示顺序 */
export const domainOrder = ['1-软件测试', '2-技术基础', '3-业务知识', '5-AI与Agent', '4-面试', '6-前端', '00-规范'];

/** 分组展示顺序：按认知顺序读，而不是按拼音；未列出的组排在后面按音序 */
export const groupOrder = {
  // 按测试链路排序：定范围 → 拆需求 → 设计 → 数据环境 → 接口 → 场景 → 可靠性 → 集成 → 断言 → 回归度量 → 工具
  '1-软件测试': [
    '00-总览',
    '01-策略与范围',
    '02-用例设计',
    '03-数据与环境',
    '04-接口语义',
    '05-业务场景',
    '06-一致性与可靠性',
    '07-集成与契约',
    '08-断言与缺陷',
    '09-回归与度量',
    '10-工具链',
  ],
  '2-技术基础': [
    '总览',
    'HTTP 与协议',
    '鉴权与会话',
    '接口形态',
    '网络与网关',
    '数据库与中间件',
    '运维与排查',
  ],
  '3-业务知识': ['总览', '交易与营销', '支付', 'ERP', '行情', '内容与消息', '平台与数据', '设备与合规'],
  '4-面试': ['总览', '面试宝典', '题库'],
  // 先总览（知识体系）定坐标，再给路线；认证与真题是 L6 的测量入口
  '5-AI与Agent': ['00-总览', '学习路线', '主线 01-05', '认证与真题', '体系与参考'],
};

/**
 * 组内显式顺序（按文件前缀匹配）：同组混排 L1/L2 时，仅靠编号会得到
 * "先具体接口、后通用方法"的顺序，与链路相反；这里按认知顺序写死。
 * 未列出的组仍按文件名编号排。
 */
export const noteOrder = {
  // 定范围先于拆需求
  '01-策略与范围': ['L2-26', 'L2-24'],
  // 先讲五种一致性判据，再落到六类可靠性接口
  '06-一致性与可靠性': [
    'L2-08', 'L2-09', 'L2-10', 'L2-11', 'L2-12',
    'L1-16', 'L1-17', 'L1-24', 'L1-25', 'L1-29', 'L1-30',
  ],
  // 工具按使用链路：发请求 → 看报文 → 写脚本 → 压测 → UI 自动化
  '10-工具链': [
    'curl-httpie', 'Postman-Apifox', 'Charles-mitmproxy', 'Wireshark',
    'pytest-httpx', 'JMeter', '浏览器自动化',
  ],
  // 先定考哪张证，再看公开基准怎么判，最后才是刷题与靶场
  '认证与真题': ['AI测试认证', '大模型评测基准', 'AI测试刷题'],
};

export const siteMeta = {
  name: 'xxuntilu guides',
  title: '测试与 AI 工程知识库',
  description: '接口测试、用例设计、业务域与 Agent 评测的公开学习笔记；私密笔记走密文隔离。',
  repo: 'https://github.com/Jasonlya/xxuntilu-guides',
  vaultRepo: 'https://github.com/Jasonlya/obsidian-vault',
  author: '梁尹澳',
};

/** 私密笔记密文包的输出位置（构建产物，禁止提交） */
export const privateBundlePath = path.join('public', 'private-vault.enc.json');
