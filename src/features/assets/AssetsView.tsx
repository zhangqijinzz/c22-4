import { useMemo, useState, type ReactNode } from 'react';
import type { AssetFilter, FieldAsset, RuleAsset, SameNameGroup } from '../../domain/assetIndex';
import type { WorkspaceState } from '../../viewmodels/workspaceViewModel';
import type { AssetsViewModel } from './assetsViewModel';

interface AssetsViewProps { state: WorkspaceState; viewModel: AssetsViewModel }

type Scope = AssetFilter['scope'];

const scopeOptions: { id: Scope; label: string }[] = [
  { id: 'all', label: '全部资产' },
  { id: 'fields', label: '字段' },
  { id: 'rules', label: '规则' },
];

const emptyFilter: AssetFilter = { scope: 'all', keyword: '', priorityMin: undefined, priorityMax: undefined, projectId: undefined };

export function AssetsView({ state, viewModel }: AssetsViewProps) {
  const index = viewModel.index();
  const [filter, setFilter] = useState<AssetFilter>(emptyFilter);
  const filtered = useMemo(() => viewModel.filtered(filter), [viewModel, filter]);
  const activeProjectId = state.project?.id;
  const divergenceCount = index?.sameNameGroups.filter((group) => group.divergent).length ?? 0;

  const patch = (partial: Partial<AssetFilter>) => setFilter((current) => ({ ...current, ...partial }));
  const parsePriority = (raw: string, key: 'priorityMin' | 'priorityMax'): void => {
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    const value = parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
    setFilter((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="module-page assets-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">模块 05 / 跨项目资产</span>
          <h1>资产总览</h1>
          <p>横跨所有项目检索字段与规则，看清引用关系，以及同名字段在项目间是否已经分歧。</p>
        </div>
        <span className="count-chip">{index?.projects.length ?? 0} 个项目 · {index?.fields.length ?? 0} 字段 · {index?.rules.length ?? 0} 规则</span>
      </div>

      <div className="asset-summary">
        <SummaryCard label="纳入项目" value={index?.projects.length ?? 0} detail="快照与冻结一起呈现" icon="▦" tone="blue" />
        <SummaryCard label="字段资产" value={index?.fields.length ?? 0} detail={`${index?.sameNameGroups.length ?? 0} 组跨项目同名字段`} icon="▤" tone="green" />
        <SummaryCard label="规则资产" value={index?.rules.length ?? 0} detail="按优先级与命中结果检索" icon="⌘" tone="mint" />
        <SummaryCard label="取值已分歧" value={divergenceCount} detail={divergenceCount ? '同名字段定义不一致' : '同名定义保持一致'} icon="⚠" tone={divergenceCount ? 'red' : 'green'} />
      </div>

      <div className="asset-filter card-surface">
        <div className="asset-scope" role="tablist" aria-label="资产类型">
          {scopeOptions.map((option) => <button key={option.id} role="tab" aria-selected={filter.scope === option.id} className={`asset-scope-tab${filter.scope === option.id ? ' asset-scope-tab-active' : ''}`} onClick={() => patch({ scope: option.id })}>{option.label}</button>)}
        </div>
        <label className="asset-search"><span>⌕</span><input value={filter.keyword} onChange={(event) => patch({ keyword: event.target.value })} placeholder="按字段名、规则名或命中结果检索…" aria-label="资产关键词" /></label>
        {filter.scope !== 'fields' && <div className="asset-priority">
          <span>优先级区间</span>
          <input type="number" aria-label="优先级下限" value={filter.priorityMin ?? ''} onChange={(event) => parsePriority(event.target.value, 'priorityMin')} placeholder="下限" />
          <i>—</i>
          <input type="number" aria-label="优先级上限" value={filter.priorityMax ?? ''} onChange={(event) => parsePriority(event.target.value, 'priorityMax')} placeholder="上限" />
        </div>}
        <label className="asset-project-filter"><span>项目</span><select aria-label="按项目筛选" value={filter.projectId ?? ''} onChange={(event) => patch({ projectId: event.target.value || undefined })}><option value="">全部项目</option>{index?.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
        <button className="text-button asset-reset" onClick={() => setFilter(emptyFilter)}>重置</button>
      </div>

      {filtered && filtered.total === 0 && filter.scope !== 'rules' && filtered.groups.length === 0 && (
        <div className="empty-card card-surface"><div className="empty-icon">⌕</div><h2>没有匹配的资产</h2><p>换一个字段名、规则名、命中结果，或放宽优先级区间后再试。</p></div>
      )}

      {filtered && filtered.fields.length > 0 && (
        <AssetSection title="字段资产" eyebrow="FIELDS" count={filtered.fields.length}>
          {filtered.fields.map((asset) => <FieldAssetRow key={`${asset.projectId}-${asset.fieldId}`} asset={asset} current={asset.projectId === activeProjectId} onOpen={() => viewModel.open(asset.projectId, { kind: 'field', fieldId: asset.fieldId })} onOpenRule={(ruleId) => viewModel.open(asset.projectId, { kind: 'rule', ruleId })} />)}
        </AssetSection>
      )}

      {filtered && filtered.rules.length > 0 && (
        <AssetSection title="规则资产" eyebrow="RULES" count={filtered.rules.length}>
          {filtered.rules.map((asset) => <RuleAssetRow key={`${asset.projectId}-${asset.ruleId}`} asset={asset} current={asset.projectId === activeProjectId} onOpen={() => viewModel.open(asset.projectId, { kind: 'rule', ruleId: asset.ruleId })} />)}
        </AssetSection>
      )}

      {filtered && filter.scope !== 'rules' && filtered.groups.length > 0 && (
        <section className="same-name-section">
          <div className="versions-heading"><div><span className="eyebrow">CROSS-PROJECT COMPARISON</span><h2>同名字段对照</h2><p>同名不等于同义：类型、取值范围或选项集合不一致时标记为已分歧。</p></div><span className="count-chip">{filtered.groups.filter((group) => group.divergent).length} 组已分歧 / {filtered.groups.length} 组</span></div>
          <div className="same-name-grid">{filtered.groups.map((group) => <SameNameCard key={group.fieldName} group={group} activeProjectId={activeProjectId} onOpen={(asset) => viewModel.open(asset.projectId, { kind: 'field', fieldId: asset.fieldId })} />)}</div>
        </section>
      )}
    </section>
  );
}

function SummaryCard({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: string; tone: string }) {
  return <article className={`metric-card card-surface metric-${tone}`}><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></article>;
}

function AssetSection({ title, eyebrow, count, children }: { title: string; eyebrow: string; count: number; children: ReactNode }) {
  return <section className="asset-section"><div className="versions-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="count-chip">{count} 条结果</span></div><div className="asset-list">{children}</div></section>;
}

function ProjectTag({ title, frozen, current }: { title: string; frozen: boolean; current: boolean }) {
  return <span className="asset-project-tags"><span className={`asset-project-chip${current ? ' is-current' : ''}`} title={current ? '当前正在查看的项目' : '点击定位会先切换到该项目'}>{current && <i />}{title}</span><StateTag frozen={frozen} /></span>;
}

function StateTag({ frozen }: { frozen: boolean }) {
  return frozen
    ? <span className="asset-state asset-state-frozen" title="项目已冻结，资产为冻结快照内容">◈ 冻结</span>
    : <span className="asset-state" title="项目处于可编辑快照状态">◷ 快照</span>;
}

function FieldAssetRow({ asset, current, onOpen, onOpenRule }: { asset: FieldAsset; current: boolean; onOpen: () => void; onOpenRule: (ruleId: string) => void }) {
  return (
    <article className="asset-row card-surface">
      <div className="asset-row-main">
        <span className={`asset-type-tag type-${asset.fieldType}`}>{asset.fieldType === 'number' ? 'NUMBER' : asset.fieldType === 'enum' ? 'ENUM' : 'BOOL'}</span>
        <div className="asset-row-copy">
          <strong>{asset.fieldName || '未命名字段'}</strong>
          <span className="asset-signature">{asset.signature}</span>
          <div className="asset-refs">
            <span className="asset-refs-label">被 {asset.referencedRules.length} 条规则引用</span>
            {asset.referencedRules.slice(0, 4).map((rule) => <button key={rule.id} className="asset-ref-chip" onClick={() => onOpenRule(rule.id)} title={`${rule.name} · P${rule.priority} → ${rule.result || '未填写结果'}`}>{rule.name}<b>P{rule.priority}</b></button>)}
            {asset.referencedRules.length > 4 && <em className="asset-ref-more">+{asset.referencedRules.length - 4}</em>}
          </div>
        </div>
      </div>
      <div className="asset-row-side"><ProjectTag title={asset.projectTitle} frozen={asset.frozen} current={current} /><button className="button button-subtle asset-open" onClick={onOpen}>定位字段 →</button></div>
    </article>
  );
}

function RuleAssetRow({ asset, current, onOpen }: { asset: RuleAsset; current: boolean; onOpen: () => void }) {
  return (
    <article className="asset-row card-surface">
      <div className="asset-row-main">
        <span className="asset-priority-badge">P{asset.priority}</span>
        <div className="asset-row-copy">
          <strong>{asset.ruleName || '未命名规则'}</strong>
          <span className="asset-result"><span className="result-arrow">↳</span>{asset.result || <em className="asset-result-empty">尚未填写命中结果</em>}</span>
          <span className="asset-fields-label">引用字段：{asset.referencedFieldNames.length ? asset.referencedFieldNames.join('、') : '无条件'}</span>
        </div>
      </div>
      <div className="asset-row-side"><ProjectTag title={asset.projectTitle} frozen={asset.frozen} current={current} /><button className="button button-subtle asset-open" onClick={onOpen}>定位规则 →</button></div>
    </article>
  );
}

function SameNameCard({ group, activeProjectId, onOpen }: { group: SameNameGroup; activeProjectId?: string; onOpen: (asset: FieldAsset) => void }) {
  return (
    <article className={`same-name-card card-surface${group.divergent ? ' same-name-divergent' : ''}`}>
      <header className="same-name-head"><strong>{group.fieldName}</strong><span className={group.divergent ? 'severity-tag severity-danger' : 'severity-tag severity-ok'}>{group.divergent ? `取值已分歧 · ${group.signatures.length} 种` : '定义一致'}</span></header>
      <p className="same-name-hint">出现在 {group.projectCount} 个项目中</p>
      <div className="same-name-variants">
        {group.variants.map((variant) => (
          <button key={`${variant.field.projectId}-${variant.field.fieldId}`} className={`same-name-variant${variant.divergent ? ' is-divergent' : ''}${variant.field.projectId === activeProjectId ? ' is-current-variant' : ''}`} onClick={() => onOpen(variant.field)} title="定位到该项目中的字段">
            <span className="variant-signature">{variant.signature}</span>
            <span className="variant-project"><i />{variant.field.projectTitle}<StateTag frozen={variant.field.frozen} /></span>
            <b className="variant-go">→</b>
          </button>
        ))}
      </div>
    </article>
  );
}
