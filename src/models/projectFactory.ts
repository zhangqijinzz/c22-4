import type { BusinessRule, RuleField, RuleProject, RuleVersion, WorkspaceDocument } from './ruleModel';

export function createDemoWorkspace(): WorkspaceDocument {
  const membership: RuleProject = {
    id: 'project-membership', title: '会员权益与折扣策略',
    fields: [
      { id: 'member-level', name: '会员等级', type: 'enum', enumValues: ['普通会员', '银卡会员', '金卡会员'] },
      { id: 'cart-total', name: '订单金额', type: 'number', min: 0, max: 5000 },
      { id: 'coupon-active', name: '使用优惠券', type: 'boolean' },
    ],
    rules: [
      rule('rule-gold-discount', '金卡大额订单', 30, '免运费 · 9 折', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'member-level', operator: 'eq', value: '金卡会员' },
        { kind: 'predicate', fieldId: 'cart-total', operator: 'gte', value: 1000 },
      ] }),
      rule('rule-coupon-discount', '优惠券订单', 30, '立减 80 元', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'coupon-active', operator: 'isTrue', value: true },
        { kind: 'predicate', fieldId: 'cart-total', operator: 'gte', value: 800 },
      ] }),
      rule('rule-gold-hidden', '金卡高额加赠', 10, '赠送积分礼包', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'member-level', operator: 'eq', value: '金卡会员' },
        { kind: 'predicate', fieldId: 'cart-total', operator: 'gte', value: 1500 },
      ] }),
      rule('rule-out-of-range', '超范围人工审核', 40, '转人工审核', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'cart-total', operator: 'gt', value: 5000 },
      ] }),
    ],
    sampleInputs: { 'member-level': '金卡会员', 'cart-total': 1200, 'coupon-active': true },
    versions: [], updatedAt: Date.now(),
  };

  const retention: RuleProject = {
    id: 'project-retention', title: '会员挽留与召回策略',
    fields: [
      { id: 'rt-member-level', name: '会员等级', type: 'enum', enumValues: ['普通会员', '银卡会员', '金卡会员', '黑金会员'] },
      { id: 'rt-cart-total', name: '订单金额', type: 'number', min: 0, max: 3000 },
      { id: 'rt-dormant-days', name: '距上次下单天数', type: 'number', min: 0, max: 365 },
    ],
    rules: [
      rule('rule-black-recall', '黑金流失召回', 35, '赠送 50 元召回券', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'rt-member-level', operator: 'eq', value: '黑金会员' },
        { kind: 'predicate', fieldId: 'rt-dormant-days', operator: 'gte', value: 60 },
      ] }),
      rule('rule-silver-wake', '银卡沉睡唤醒', 20, '推送满 200 减 30', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'rt-member-level', operator: 'eq', value: '银卡会员' },
        { kind: 'predicate', fieldId: 'rt-dormant-days', operator: 'gte', value: 30 },
      ] }),
      rule('rule-normal-recall', '普通会员召回', 10, '立减 80 元', { kind: 'group', operator: 'and', conditions: [
        { kind: 'predicate', fieldId: 'rt-member-level', operator: 'eq', value: '普通会员' },
        { kind: 'predicate', fieldId: 'rt-dormant-days', operator: 'gte', value: 90 },
      ] }),
    ],
    sampleInputs: { 'rt-member-level': '黑金会员', 'rt-cart-total': 900, 'rt-dormant-days': 75 },
    versions: [], updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  };

  const frozenFields: RuleField[] = [
    { id: 'fl-member-level', name: '会员等级', type: 'enum', enumValues: ['普通会员', '银卡会员', '金卡会员', '钻石会员'] },
    { id: 'fl-cart-total', name: '订单金额', type: 'number', min: 100, max: 8000 },
    { id: 'fl-region', name: '收货区域', type: 'enum', enumValues: ['同城', '跨省', '偏远地区'] },
  ];
  const frozenRules = [
    rule('rule-city-fast', '同城优先发货', 25, '当日达 · 免运费', { kind: 'group', operator: 'and', conditions: [
      { kind: 'predicate', fieldId: 'fl-region', operator: 'eq', value: '同城' },
      { kind: 'predicate', fieldId: 'fl-cart-total', operator: 'gte', value: 100 },
    ] }),
    rule('rule-remote-review', '偏远地区审核', 35, '转人工审核', { kind: 'group', operator: 'and', conditions: [
      { kind: 'predicate', fieldId: 'fl-region', operator: 'eq', value: '偏远地区' },
    ] }),
    rule('rule-diamond-gift', '钻石会员加赠', 20, '赠送积分礼包', { kind: 'group', operator: 'and', conditions: [
      { kind: 'predicate', fieldId: 'fl-member-level', operator: 'eq', value: '钻石会员' },
      { kind: 'predicate', fieldId: 'fl-cart-total', operator: 'gte', value: 2000 },
    ] }),
  ];
  const frozenSampleInputs = { 'fl-member-level': '钻石会员', 'fl-cart-total': 2600, 'fl-region': '同城' };
  const frozenVersion: RuleVersion = {
    id: 'version-frozen-fulfillment', name: '冻结版本 1', savedAt: Date.now() - 1000 * 60 * 60 * 50, frozen: true,
    fields: cloneData(frozenFields), rules: cloneData(frozenRules), sampleInputs: cloneData(frozenSampleInputs),
  };

  const fulfillment: RuleProject = {
    id: 'project-fulfillment', title: '订单履约与风控（已冻结）',
    fields: cloneData(frozenFields),
    rules: cloneData(frozenRules),
    sampleInputs: cloneData(frozenSampleInputs),
    versions: [frozenVersion],
    frozenVersionId: frozenVersion.id,
    updatedAt: frozenVersion.savedAt,
  };

  return { schemaVersion: 1, projects: [membership, retention, fulfillment], activeProjectId: membership.id };
}

function rule(id: string, name: string, priority: number, result: string, conditions: BusinessRule['conditions']): BusinessRule {
  return { id, name, priority, result, conditions };
}

export function createBlankProject(ordinal: number): RuleProject {
  return { id: makeId('project'), title: `未命名规则项目 ${ordinal}`, fields: [], rules: [], sampleInputs: {}, versions: [], updatedAt: Date.now() };
}

export function createVersionSnapshot(project: RuleProject, name: string, frozen: boolean): RuleVersion {
  return {
    id: makeId('version'), name, savedAt: Date.now(), frozen,
    fields: cloneData(project.fields), rules: cloneData(project.rules), sampleInputs: cloneData(project.sampleInputs),
  };
}

export function cloneData<T>(value: T): T {
  return structuredClone(value);
}

export function makeId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}
