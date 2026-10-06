import { useState } from 'react';
import { fieldRangeDetail, type FieldAssetEntry, type FieldDivergenceGroup, type RuleAssetEntry } from '../../domain/assetIndex';
import type { ModuleId } from '../../models/ruleModel';
import type { WorkspaceState } from '../../viewmodels/workspaceViewModel';
import type { AssetsViewModel } from './assetsViewModel';

interface AssetsViewProps {
  state: WorkspaceState;
  viewModel: AssetsViewModel;
  onOpenAsset: (projectId: string, module: ModuleId, anchorId?: string) => void;
}

const typeLabels = { number: 'NUMBER', enum: 'ENUM', boolean: 'BOOLEAN' } as const;

export function AssetsView({ state, viewModel, onOpenAsset }: AssetsViewProps) {
  const [query, setQuery] = useState(viewModel.query);
  const updateQuery = (patch: Partial<typeof query>) => {
    const next = { ...query, ...patch };
    setQuery(next);
    viewModel.setQuery(patch);
  };
  const result = viewModel.search();
  const divergences = viewModel.divergences();
  const projectTotal = state.workspace?.projects.length ?? 0;
  const filtering = Boolean(query.text.trim()) || query.priorityMin !== undefined || query.priorityMax !== undefined;
  const divergedCount = divergences.filter((group) => group.diverged).length;
  return (
    <section className="module-page assets-page">
      <div className="page-heading">
        <div><span className="eyebrow">模块 05 / 跨项目资产</span><h1>资产检索</h1><p>一次检索全部项目的字段与规则，对比同名字段的取值分歧。</p></div>
        <span className="count-chip">{projectTotal} 个项目</span>
      </div>

      <div className="asset-search card-surface">
        <label className="asset-search-box">
          <span>⌕</span>
          <input aria-label="检索字段、规则或命中结果" value={query.text} placeholder="字段名、规则名或命中结果" onChange={(event) => updateQuery({ text: event.target.value })} />
        </label>
        <div className="asset-priority-range">
          <span>优先级</span>
          <input aria-label="优先级下限" type="number" value={query.priorityMin ?? ''} placeholder="最低" onChange={(event) => updateQuery({ priorityMin: event.target.value === '' ? undefined : Number(event.target.value) })} />
          <i>–</i>
          <input aria-label="优先级上限" type="number" value={query.priorityMax ?? ''} placeholder="最高" onChange={(event) => updateQuery({ priorityMax: event.target.value === '' ? undefined : Number(event.target.value) })} />
        </div>
        {filtering && <button className="text-button" onClick={() => { viewModel.resetQuery(); setQuery({ ...viewModel.query }); }}>清除条件</button>}
      </div>
      <p className="asset-summary">命中 {result.fields.length} 个字段 · {result.rules.length} 条规则，涉及 {result.projectCount} 个项目{(query.priorityMin !== undefined || query.priorityMax !== undefined) && '（优先级区间仅作用于规则）'}</p>

      <section className="divergence-section">
        <div className="versions-heading">
          <div><span className="eyebrow">CROSS-PROJECT COMPARE</span><h2>同名字段对照</h2><p>同名字段在不同项目中的取值范围与选项是否一致。</p></div>
        </div>
        {divergences.length ? (
          <div className="divergence-list">
            {divergences.map((group) => <DivergenceCard key={group.name} group={group} onOpenAsset={onOpenAsset} />)}
          </div>
        ) : (
          <div className="version-empty card-surface"><span>⇄</span><p>还没有跨项目的同名字段。在多个项目中定义同名字段后，这里会自动对比取值范围与选项。</p></div>
        )}
        {divergedCount > 0 && <div className="inline-issue">! {divergedCount} 个同名字段的取值定义在项目间已经分歧，展开对照后可点入对应项目统一口径。</div>}
      </section>

      <section className="asset-results">
        <div className="versions-heading"><div><span className="eyebrow">FIELDS</span><h2>字段</h2></div><span className="count-chip">{result.fields.length} 个字段</span></div>
        {result.fields.length ? (
          <div className="asset-list">{result.fields.map((entry) => <FieldAssetRow key={`${entry.projectId}-${entry.field.id}`} entry={entry} onOpenAsset={onOpenAsset} />)}</div>
        ) : <div className="version-empty card-surface"><span>▤</span><p>{filtering ? '没有匹配条件的字段。' : '各项目还没有定义字段。'}</p></div>}
      </section>

      <section className="asset-results">
        <div className="versions-heading"><div><span className="eyebrow">RULES</span><h2>规则</h2></div><span className="count-chip">{result.rules.length} 条规则</span></div>
        {result.rules.length ? (
          <div className="asset-list">{result.rules.map((entry) => <RuleAssetRow key={`${entry.projectId}-${entry.rule.id}`} entry={entry} onOpenAsset={onOpenAsset} />)}</div>
        ) : <div className="version-empty card-surface"><span>⌘</span><p>{filtering ? '没有匹配条件的规则。' : '各项目还没有创建规则。'}</p></div>}
      </section>
    </section>
  );
}

function FieldAssetRow({ entry, onOpenAsset }: { entry: FieldAssetEntry; onOpenAsset: AssetsViewProps['onOpenAsset'] }) {
  const { field } = entry;
  return (
    <article className="asset-row card-surface">
      <span className="asset-kind-icon asset-kind-field">▤</span>
      <div className="asset-main">
        <div className="asset-title">
          <strong>{field.name || '未命名字段'}</strong>
          <span className="type-tag">{typeLabels[field.type]}</span>
          <span className="asset-range">{fieldRangeDetail(field)}</span>
        </div>
        <div className="asset-refs">
          {entry.referencedBy.length ? (
            <>
              <span className="asset-refs-label">被 {entry.referencedBy.length} 条规则引用</span>
              {entry.referencedBy.map((ref) => (
                <button className="asset-ref-chip" key={ref.id} title={`优先级 ${ref.priority}`} onClick={() => onOpenAsset(entry.projectId, 'rules', ref.id)}>{ref.name || '未命名规则'}</button>
              ))}
            </>
          ) : <span className="asset-refs-label asset-refs-empty">未被任何规则引用</span>}
        </div>
      </div>
      <ProjectSource projectId={entry.projectId} projectTitle={entry.projectTitle} frozen={entry.frozen} />
      <button className="text-button asset-open" onClick={() => onOpenAsset(entry.projectId, 'fields', field.id)}>打开 →</button>
    </article>
  );
}

function RuleAssetRow({ entry, onOpenAsset }: { entry: RuleAssetEntry; onOpenAsset: AssetsViewProps['onOpenAsset'] }) {
  const { rule } = entry;
  return (
    <article className="asset-row card-surface">
      <span className="asset-kind-icon asset-kind-rule">⌘</span>
      <div className="asset-main">
        <div className="asset-title">
          <strong>{rule.name || '未命名规则'}</strong>
          <span className="asset-priority">P{rule.priority}</span>
          <span className="asset-result">↳ {rule.result || '未填写结果'}</span>
        </div>
        <div className="asset-refs">
          {entry.conditionFieldNames.length ? <span className="asset-refs-label">条件引用：{entry.conditionFieldNames.join('、')}</span> : <span className="asset-refs-label asset-refs-empty">尚未设置条件</span>}
        </div>
      </div>
      <ProjectSource projectId={entry.projectId} projectTitle={entry.projectTitle} frozen={entry.frozen} />
      <button className="text-button asset-open" onClick={() => onOpenAsset(entry.projectId, 'rules', rule.id)}>打开 →</button>
    </article>
  );
}

function DivergenceCard({ group, onOpenAsset }: { group: FieldDivergenceGroup; onOpenAsset: AssetsViewProps['onOpenAsset'] }) {
  return (
    <article className={`divergence-card card-surface${group.diverged ? ' divergence-diverged' : ''}`}>
      <header className="divergence-heading">
        <strong>{group.name}</strong>
        <span className={group.diverged ? 'severity-tag severity-danger' : 'severity-tag severity-ok'}>{group.diverged ? '已分歧' : '一致'}</span>
      </header>
      <div className="divergence-entries">
        {group.entries.map((entry) => (
          <button className="divergence-entry" key={`${entry.projectId}-${entry.field.id}`} onClick={() => onOpenAsset(entry.projectId, 'fields', entry.field.id)}>
            <span className="divergence-project">{entry.projectTitle}<ProjectStateBadge frozen={entry.frozen} /></span>
            <span className="divergence-detail">{entry.detail}</span>
            <i>打开 →</i>
          </button>
        ))}
      </div>
    </article>
  );
}

function ProjectSource({ projectId, projectTitle, frozen }: { projectId: string; projectTitle: string; frozen: boolean }) {
  return (
    <div className="asset-source" data-project-id={projectId}>
      <span className="asset-project-name">{projectTitle}</span>
      <ProjectStateBadge frozen={frozen} />
    </div>
  );
}

function ProjectStateBadge({ frozen }: { frozen: boolean }) {
  return <span className={frozen ? 'version-state frozen' : 'version-state'}>{frozen ? '◈ 已冻结' : '◷ 快照'}</span>;
}
