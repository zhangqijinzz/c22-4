import { describe, expect, it } from 'vitest';
import { findFieldDivergences, searchWorkspaceAssets } from '../domain/assetIndex';
import { createDemoWorkspace } from '../models/projectFactory';
import type { RuleProject, WorkspaceDocument } from '../models/ruleModel';

function workspaceWith(projects: RuleProject[]): WorkspaceDocument {
  return { schemaVersion: 1, projects, activeProjectId: projects[0].id };
}

describe('searchWorkspaceAssets', () => {
  const workspace = createDemoWorkspace();

  it('returns every field and rule across projects when the query is empty', () => {
    const result = searchWorkspaceAssets(workspace, { text: '' });
    expect(result.fields).toHaveLength(6);
    expect(result.rules).toHaveLength(6);
    expect(result.projectCount).toBe(2);
  });

  it('matches fields by name and lists referencing rules of the same project', () => {
    const result = searchWorkspaceAssets(workspace, { text: '会员等级' });
    expect(result.fields).toHaveLength(2);
    const membership = result.fields.find((entry) => entry.projectId === 'project-membership');
    expect(membership?.referencedBy.map((rule) => rule.id).sort()).toEqual(['rule-gold-discount', 'rule-gold-hidden']);
    expect(result.rules.map((entry) => entry.rule.id)).toEqual([]);
  });

  it('matches rules by hit result and keeps the source project state', () => {
    const result = searchWorkspaceAssets(workspace, { text: '人工复核' });
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].projectTitle).toBe('门店收银风控');
    expect(result.rules[0].frozen).toBe(false);
    expect(result.rules[0].conditionFieldNames).toEqual(['订单金额']);
  });

  it('filters rules by priority range without hiding matching fields', () => {
    const result = searchWorkspaceAssets(workspace, { text: '', priorityMin: 40, priorityMax: 55 });
    expect(result.rules.map((entry) => entry.rule.id)).toEqual(['rule-black-card', 'rule-out-of-range']);
    expect(result.fields).toHaveLength(6);
    const narrowed = searchWorkspaceAssets(workspace, { text: '订单', priorityMin: 40, priorityMax: 50 });
    expect(narrowed.rules).toHaveLength(0);
    expect(narrowed.fields.map((entry) => entry.field.name)).toEqual(['订单金额', '订单金额']);
  });

  it('marks entries from frozen projects as frozen', () => {
    const frozenWorkspace = workspaceWith(createDemoWorkspace().projects.map((project, index) => index === 0 ? { ...project, frozenVersionId: 'version-x' } : project));
    const result = searchWorkspaceAssets(frozenWorkspace, { text: '会员' });
    const byProject = Object.fromEntries(result.fields.map((entry) => [entry.projectId, entry.frozen]));
    expect(byProject['project-membership']).toBe(true);
    expect(byProject['project-store-risk']).toBe(false);
  });
});

describe('findFieldDivergences', () => {
  it('flags same-named fields whose ranges or options differ across projects', () => {
    const groups = findFieldDivergences(createDemoWorkspace());
    const byName = new Map(groups.map((group) => [group.name, group.diverged]));
    expect(byName).toEqual(new Map([['会员等级', true], ['订单金额', true], ['使用优惠券', false]]));
    expect(groups.at(-1)?.diverged).toBe(false);
    const memberLevel = groups.find((group) => group.name === '会员等级');
    expect(memberLevel?.entries).toHaveLength(2);
    expect(memberLevel?.entries.find((entry) => entry.projectId === 'project-store-risk')?.detail).toContain('黑卡会员');
  });

  it('ignores names that only exist in a single project', () => {
    const workspace = createDemoWorkspace();
    workspace.projects = workspace.projects.slice(0, 1);
    expect(findFieldDivergences(workspace)).toEqual([]);
  });

  it('treats a changed field type as divergence', () => {
    const workspace = createDemoWorkspace();
    const converted: RuleProject = {
      ...workspace.projects[1],
      fields: workspace.projects[1].fields.map((field) => field.name === '使用优惠券' ? { ...field, type: 'enum' as const, enumValues: ['是', '否'] } : field),
    };
    const groups = findFieldDivergences(workspaceWith([workspace.projects[0], converted]));
    expect(groups.find((group) => group.name === '使用优惠券')?.diverged).toBe(true);
  });
});
