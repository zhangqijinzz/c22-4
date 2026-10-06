import type { AssetQuery, AssetSearchResult, FieldDivergenceGroup } from '../../domain/assetIndex';
import { emptyAssetQuery, findFieldDivergences, searchWorkspaceAssets } from '../../domain/assetIndex';
import type { WorkspacePort } from '../../viewmodels/workspacePort';

export class AssetsViewModel {
  query: AssetQuery = { ...emptyAssetQuery };

  constructor(private readonly workspace: WorkspacePort) {}

  setQuery(patch: Partial<AssetQuery>): void {
    this.query = { ...this.query, ...patch };
  }

  resetQuery(): void {
    this.query = { ...emptyAssetQuery };
  }

  search(): AssetSearchResult {
    const workspace = this.workspace.getSnapshot().workspace;
    return workspace ? searchWorkspaceAssets(workspace, this.query) : { fields: [], rules: [], projectCount: 0 };
  }

  divergences(): FieldDivergenceGroup[] {
    const workspace = this.workspace.getSnapshot().workspace;
    return workspace ? findFieldDivergences(workspace) : [];
  }
}
