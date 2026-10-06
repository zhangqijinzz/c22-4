import type { BusinessRule, RuleCondition, RuleField, RuleProject, WorkspaceDocument } from '../models/ruleModel';

export interface AssetProject {
  id: string;
  title: string;
  frozen: boolean;
  fieldCount: number;
  ruleCount: number;
}

export interface FieldAsset {
  kind: 'field';
  fieldId: string;
  fieldName: string;
  fieldType: RuleField['type'];
  signature: string;
  projectId: string;
  projectTitle: string;
  frozen: boolean;
  referencedRules: { id: string; name: string; priority: number; result: string }[];
}

export interface RuleAsset {
  kind: 'rule';
  ruleId: string;
  ruleName: string;
  priority: number;
  result: string;
  projectId: string;
  projectTitle: string;
  frozen: boolean;
  referencedFieldIds: string[];
  referencedFieldNames: string[];
}

export type AssetEntry = FieldAsset | RuleAsset;

export interface SameNameVariant {
  field: FieldAsset;
  signature: string;
  divergent: boolean;
}

export interface SameNameGroup {
  fieldName: string;
  projectCount: number;
  variants: SameNameVariant[];
  signatures: string[];
  divergent: boolean;
}

export interface AssetFilter {
  scope: 'all' | 'fields' | 'rules';
  keyword: string;
  priorityMin?: number;
  priorityMax?: number;
  projectId?: string;
}

export interface AssetIndex {
  projects: AssetProject[];
  fields: FieldAsset[];
  rules: RuleAsset[];
  sameNameGroups: SameNameGroup[];
  totalResults: number;
}

export interface FilteredAssets {
  fields: FieldAsset[];
  rules: RuleAsset[];
  groups: SameNameGroup[];
  total: number;
}

export function buildAssetIndex(workspace: WorkspaceDocument): AssetIndex {
  const projects: AssetProject[] = workspace.projects.map((project) => ({
    id: project.id,
    title: project.title,
    frozen: Boolean(project.frozenVersionId),
    fieldCount: project.fields.length,
    ruleCount: project.rules.length,
  }));

  const fields: FieldAsset[] = workspace.projects.flatMap((project) => project.fields.map((field) => ({
    kind: 'field' as const,
    fieldId: field.id,
    fieldName: field.name,
    fieldType: field.type,
    signature: fieldSignature(field),
    projectId: project.id,
    projectTitle: project.title,
    frozen: Boolean(project.frozenVersionId),
    referencedRules: collectReferencingRules(project, field.id)
      .map((rule) => ({ id: rule.id, name: rule.name, priority: rule.priority, result: rule.result }))
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'zh-CN')),
  })));

  const fieldNameById = new Map<string, string>();
  workspace.projects.forEach((project) => project.fields.forEach((field) => fieldNameById.set(field.id, field.name)));

  const rules: RuleAsset[] = workspace.projects.flatMap((project) => project.rules.map((rule) => {
    const referencedFieldIds = [...new Set(collectFieldIds(rule.conditions))].filter((fieldId) =>
      project.fields.some((field) => field.id === fieldId));
    return {
      kind: 'rule' as const,
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      result: rule.result,
      projectId: project.id,
      projectTitle: project.title,
      frozen: Boolean(project.frozenVersionId),
      referencedFieldIds,
      referencedFieldNames: referencedFieldIds.map((fieldId) => project.fields.find((field) => field.id === fieldId)?.name ?? fieldNameById.get(fieldId) ?? '已删除字段'),
    };
  }));

  return {
    projects,
    fields: fields.sort((a, b) => a.fieldName.localeCompare(b.fieldName, 'zh-CN') || a.projectTitle.localeCompare(b.projectTitle, 'zh-CN')),
    rules: rules.sort((a, b) => b.priority - a.priority || a.ruleName.localeCompare(b.ruleName, 'zh-CN')),
    sameNameGroups: buildSameNameGroups(fields),
    totalResults: fields.length + rules.length,
  };
}

export function filterAssets(index: AssetIndex, filter: AssetFilter): FilteredAssets {
  const keyword = filter.keyword.trim().toLocaleLowerCase('zh-CN');
  const inProject = (projectId: string): boolean => !filter.projectId || projectId === filter.projectId;
  const matchesKeyword = (value: string): boolean => !keyword || value.toLocaleLowerCase('zh-CN').includes(keyword);

  const fields = filter.scope === 'rules' ? [] : index.fields.filter((asset) => inProject(asset.projectId) && (
    !keyword
    || matchesKeyword(asset.fieldName)
    || asset.referencedRules.some((rule) => matchesKeyword(rule.name) || matchesKeyword(rule.result))
  ));

  const rules = filter.scope === 'fields' ? [] : index.rules.filter((asset) => {
    if (!inProject(asset.projectId)) return false;
    if (filter.priorityMin !== undefined && asset.priority < filter.priorityMin) return false;
    if (filter.priorityMax !== undefined && asset.priority > filter.priorityMax) return false;
    if (!keyword) return true;
    return matchesKeyword(asset.ruleName)
      || matchesKeyword(asset.result)
      || asset.referencedFieldNames.some((name) => matchesKeyword(name));
  });

  const groups = filter.scope === 'rules' ? [] : index.sameNameGroups
    .filter((group) => !filter.projectId || group.variants.some((variant) => variant.field.projectId === filter.projectId))
    .filter((group) => !keyword || matchesKeyword(group.fieldName))
    .map((group) => filter.projectId
      ? { ...group, variants: group.variants.filter((variant) => variant.field.projectId === filter.projectId) }
      : group);

  return { fields, rules, groups, total: fields.length + rules.length };
}

function buildSameNameGroups(fields: FieldAsset[]): SameNameGroup[] {
  const byName = new Map<string, FieldAsset[]>();
  for (const field of fields) {
    const name = field.fieldName.trim();
    if (!name) continue;
    const list = byName.get(name);
    if (list) list.push(field);
    else byName.set(name, [field]);
  }
  const groups: SameNameGroup[] = [];
  for (const [fieldName, variantsRaw] of byName) {
    if (variantsRaw.length < 2) continue;
    const variants = variantsRaw.sort((a, b) => a.projectTitle.localeCompare(b.projectTitle, 'zh-CN'));
    const signatures = [...new Set(variants.map((variant) => variant.signature))];
    groups.push({
      fieldName,
      projectCount: new Set(variants.map((variant) => variant.projectId)).size,
      variants: variants.map((field) => ({ field, signature: field.signature, divergent: signatures.length > 1 && field.signature !== signatures[0] })),
      signatures,
      divergent: signatures.length > 1,
    });
  }
  return groups.sort((a, b) => Number(b.divergent) - Number(a.divergent) || a.fieldName.localeCompare(b.fieldName, 'zh-CN'));
}

export function fieldSignature(field: RuleField): string {
  if (field.type === 'number') return `数值 ${formatBound(field.min)} – ${formatBound(field.max)}`;
  if (field.type === 'enum') return `枚举 · ${[...new Set(field.enumValues ?? [])].join(' / ') || '无选项'}`;
  return '布尔 · 是 / 否';
}

function formatBound(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '∞' : String(value);
}

function collectReferencingRules(project: RuleProject, fieldId: string): BusinessRule[] {
  return project.rules.filter((rule) => referencesField(rule.conditions, fieldId));
}

function referencesField(condition: RuleCondition, fieldId: string): boolean {
  return condition.kind === 'group'
    ? condition.conditions.some((child) => referencesField(child, fieldId))
    : condition.fieldId === fieldId;
}

function collectFieldIds(condition: RuleCondition): string[] {
  return condition.kind === 'group'
    ? condition.conditions.flatMap(collectFieldIds)
    : [condition.fieldId];
}
