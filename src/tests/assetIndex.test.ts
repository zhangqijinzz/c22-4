import { describe, expect, it } from 'vitest';
import { buildAssetIndex, fieldSignature, filterAssets } from '../domain/assetIndex';
import { createDemoWorkspace } from '../models/projectFactory';
import type { BusinessRule, RuleField, RuleProject, WorkspaceDocument } from '../models/ruleModel';

function project(id: string, title: string, fields: RuleField[], rules: BusinessRule[], frozen = false): RuleProject {
  return { id, title, fields, rules, sampleInputs: {}, versions: [], updatedAt: 1, ...(frozen ? { frozenVersionId: 'fv' } : {}) };
}

const rule = (id: string, name: string, fieldId: string, priority: number, result: string): BusinessRule => ({
  id, name, priority, result,
  conditions: { kind: 'group', operator: 'and', conditions: [{ kind: 'predicate', fieldId, operator: 'gte', value: 1 }] },
});

describe('cross-project asset index', () => {
  const levelA: RuleField = { id: 'level-a', name: '会员等级', type: 'enum', enumValues: ['普通', '金卡'] };
  const levelB: RuleField = { id: 'level-b', name: '会员等级', type: 'enum', enumValues: ['普通', '金卡', '黑金'] };
  const amountA: RuleField = { id: 'amount-a', name: '订单金额', type: 'number', min: 0, max: 1000 };
  const amountB: RuleField = { id: 'amount-b', name: '订单金额', type: 'number', min: 0, max: 2000 };
  const projects = [
    project('p1', '项目甲', [levelA, amountA], [rule('r1', '金卡折扣', 'level-a', 30, '免运费')]),
    project('p2', '项目乙', [levelB, amountB], [rule('r2', '黑金召回', 'level-b', 20, '立减 80 元')]),
    project('p3', '项目丙（冻结）', [levelB], [rule('r3', '转人工', 'level-b', 40, '转人工审核')], true),
  ];
  const workspace: WorkspaceDocument = { schemaVersion: 1, projects, activeProjectId: 'p1' };

  it('indexes fields and rules from every project and flags frozen projects', () => {
    const index = buildAssetIndex(workspace);
    expect(index.projects).toHaveLength(3);
    expect(index.fields).toHaveLength(5);
    expect(index.rules).toHaveLength(3);
    expect(index.fields.find((field) => field.fieldId === 'level-b' && field.projectId === 'p3')?.frozen).toBe(true);
    expect(index.rules.find((item) => item.ruleId === 'r3')?.frozen).toBe(true);
  });

  it('shows which rules reference a field within its own project', () => {
    const index = buildAssetIndex(workspace);
    const levelField = index.fields.find((field) => field.fieldId === 'level-a');
    expect(levelField?.referencedRules.map((item) => item.id)).toEqual(['r1']);
    const r2 = index.rules.find((item) => item.ruleId === 'r2');
    expect(r2?.referencedFieldNames).toEqual(['会员等级']);
  });

  it('groups same-name fields and detects option/range divergence', () => {
    const index = buildAssetIndex(workspace);
    const groups = Object.fromEntries(index.sameNameGroups.map((group) => [group.fieldName, group]));
    expect(groups['会员等级'].divergent).toBe(true);
    expect(groups['订单金额'].divergent).toBe(true);
    const signatures = groups['订单金额'].variants.map((variant) => variant.signature);
    expect(signatures).toContain(fieldSignature(amountA));
    expect(signatures).toContain(fieldSignature(amountB));
  });

  it('searches by field name, rule name, hit result, priority interval, and project', () => {
    const index = buildAssetIndex(workspace);
    expect(filterAssets(index, { scope: 'all', keyword: '会员' }).fields).toHaveLength(3);
    const byResult = filterAssets(index, { scope: 'all', keyword: '80 元' });
    expect(byResult.rules.map((rule) => rule.ruleId)).toEqual(['r2']);
    const highPriority = filterAssets(index, { scope: 'rules', keyword: '', priorityMin: 35, priorityMax: undefined });
    expect(highPriority.rules.map((item) => item.ruleId)).toEqual(['r3']);
    const band = filterAssets(index, { scope: 'rules', keyword: '', priorityMin: 20, priorityMax: 30 });
    expect(band.rules.map((item) => item.ruleId).sort()).toEqual(['r1', 'r2']);
    const singleProject = filterAssets(index, { scope: 'all', keyword: '', projectId: 'p2' });
    expect(singleProject.fields.every((field) => field.projectId === 'p2')).toBe(true);
    expect(singleProject.rules.map((field) => field.ruleId)).toEqual(['r2']);
  });

  it('treats same definitions across projects as consistent', () => {
    const same = project('s1', '一', [levelA], []);
    const other = project('s2', '二', [{ ...levelA, id: 'level-a2' }], []);
    const index = buildAssetIndex({ schemaVersion: 1, projects: [same, other], activeProjectId: 's1' });
    expect(index.sameNameGroups[0]?.divergent).toBe(false);
  });

  it('builds the demo workspace with visible divergence and a frozen project', () => {
    const index = buildAssetIndex(createDemoWorkspace());
    expect(index.projects.length).toBeGreaterThanOrEqual(3);
    const memberLevel = index.sameNameGroups.find((group) => group.fieldName === '会员等级');
    expect(memberLevel?.divergent).toBe(true);
    expect(index.projects.some((item) => item.frozen)).toBe(true);
  });
});
