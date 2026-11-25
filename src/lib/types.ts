/**
 * 侧栏用的最小字段集：笔记页每次跳转都要重下这棵树，
 * 所以只保留渲染与筛选真正用到的字段，其余可选（域页面走完整 manifest）。
 */
export interface NavNote {
  slug: string;
  title: string;
  id?: string;
  level?: string;
  updated?: string;
  minutes?: number;
  chars?: number;
  summary?: string;
  topics?: string[];
  tags?: string[];
}

export interface NavGroup {
  id: string;
  title: string;
  notes: NavNote[];
  count: number;
}

export interface NavDomain {
  id: string;
  title: string;
  desc: string;
  accent: string;
  groups: NavGroup[];
  count: number;
}

export interface SearchNote {
  slug: string;
  title: string;
  domain: string;
  domainTitle: string;
  group: string;
  level: string;
  updated: string;
  minutes: number;
  chars: number;
  summary: string;
  topics: string[];
  tags: string[];
  id: string;
}

export interface Manifest {
  generatedAt: string;
  vaultCommit: string;
  domain: { name: string; title: string };
  stats: { notes: number; chars: number; minutes: number; privateNotes: number };
  domains: NavDomain[];
  notes: SearchNote[];
}

export interface NoteMeta {
  id: string;
  title: string;
  path: string;
  domain: string;
  domainTitle: string;
  group: string;
  level: string;
  category: string;
  topics: string[];
  tags: string[];
  apiTypes: string[];
  scenes: string[];
  updated: string;
  created: string;
  summary: string;
  chars: number;
  words: number;
  minutes: number;
}

export interface NotePayload {
  slug: string;
  title: string;
  body: string;
  meta: NoteMeta;
  backlinks: { slug: string; title: string }[];
}

export type LinkMap = Record<string, string>;
