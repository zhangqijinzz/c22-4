import type {
  BusinessRule,
  RuleCondition,
  RuleField,
  RuleProject,
  WorkspaceDocument,
} from '../models/ruleModel';

export interface AssetQuery {
  text: string;
  priorityMin?: number;
  priorityMax?: number;
}

export interface RuleRefSummary {
  id: string;
  name: string;
  priority: number;
}

export interface FieldAssetEntry {
  kind: 'field';
  projectId: string;
  projectTitle: string;
  frozen: boolean;
  field: RuleField;
  referencedBy: RuleRefSummary[];
}

export interface RuleAssetEntry {
  kind: 'rule';
  projectId: string;
  projectTitle: string;
  frozen: boolean;
  rule: BusinessRule;
  conditionFieldNames: string[];
}

export interface AssetSearchResult {
  fields: FieldAssetEntry[];
  rules: RuleAssetEntry[];
  projectCount: number;
}

export interface FieldSignatureEntry {
  projectId: string;
  projectTitle: string;
  frozen: boolean;
  field: RuleField;
  signature: string;
  detail: string;
}

export interface FieldDivergenceGroup {
  name: string;
  diverged: boolean;
  entries: FieldSignatureEntry[];
}

export const emptyAssetQuery: AssetQuery = { text: '' };

export function collectConditionFieldIds(condition: RuleCondition, into: Set<string> = new Set()): Set<string> {
  if (condition.kind === 'group') condition.conditions.forEach((child) => collectConditionFieldIds(child, into));
  else into.add(condition.fieldId);
  return into;
}

export function fieldSignature(field: RuleField): string {
  if (field.type === 'number') return `number|${field.min ?? '-inf'}|${field.max ?? '+inf'}`;
  if (field.type === 'enum') return `enum|${(field.enumValues ?? []).join('||')}`;
  return 'boolean';
}

export function fieldRangeDetail(field: RuleField): string {
  if (field.type === 'number') return `${field.min ?? '-∞'} – ${field.max ?? '+∞'}`;
  if (field.type === 'enum') return (field.enumValues ?? []).join(' / ') || '未定义选项';
  return '是 / 否';
}

export function searchWorkspaceAssets(workspace: WorkspaceDocument, query: AssetQuery): AssetSearchResult {
  const text = query.text.trim().toLowerCase();
  const fields: FieldAssetEntry[] = [];
  const rules: RuleAssetEntry[] = [];
  const projectIds = new Set<string>();
  for (const project of workspace.projects) {
    const base = { projectId: project.id, projectTitle: project.title, frozen: Boolean(project.frozenVersionId) };
    for (const field of project.fields) {
      if (text && !field.name.toLowerCase().includes(text)) continue;
      fields.push({
        kind: 'field',
        ...base,
        field,
        referencedBy: project.rules
          .filter((rule) => collectConditionFieldIds(rule.conditions).has(field.id))
          .map((rule) => ({ id: rule.id, name: rule.name, priority: rule.priority })),
      });
      projectIds.add(project.id);
    }
    for (const rule of project.rules) {
      if (text && !rule.name.toLowerCase().includes(text) && !rule.result.toLowerCase().includes(text)) continue;
      if (query.priorityMin !== undefined && rule.priority < query.priorityMin) continue;
      if (query.priorityMax !== undefined && rule.priority > query.priorityMax) continue;
      rules.push({
        kind: 'rule',
        ...base,
        rule,
        conditionFieldNames: conditionFieldNames(project, rule),
      });
      projectIds.add(project.id);
    }
  }
  fields.sort((a, b) => a.field.name.localeCompare(b.field.name, 'zh-CN') || a.projectTitle.localeCompare(b.projectTitle, 'zh-CN'));
  rules.sort((a, b) => b.rule.priority - a.rule.priority || a.rule.name.localeCompare(b.rule.name, 'zh-CN'));
  return { fields, rules, projectCount: projectIds.size };
}

export function findFieldDivergences(workspace: WorkspaceDocument): FieldDivergenceGroup[] {
  const byName = new Map<string, FieldSignatureEntry[]>();
  for (const project of workspace.projects) {
    for (const field of project.fields) {
      const name = field.name.trim();
      if (!name) continue;
      const entries = byName.get(name) ?? [];
      entries.push({
        projectId: project.id,
        projectTitle: project.title,
        frozen: Boolean(project.frozenVersionId),
        field,
        signature: fieldSignature(field),
        detail: fieldRangeDetail(field),
      });
      byName.set(name, entries);
    }
  }
  const groups: FieldDivergenceGroup[] = [];
  for (const [name, entries] of byName) {
    if (new Set(entries.map((entry) => entry.projectId)).size < 2) continue;
    groups.push({ name, diverged: new Set(entries.map((entry) => entry.signature)).size > 1, entries });
  }
  return groups.sort((a, b) => Number(b.diverged) - Number(a.diverged) || a.name.localeCompare(b.name, 'zh-CN'));
}

function conditionFieldNames(project: RuleProject, rule: BusinessRule): string[] {
  const ids = collectConditionFieldIds(rule.conditions);
  return project.fields.filter((field) => ids.has(field.id)).map((field) => field.name);
}
