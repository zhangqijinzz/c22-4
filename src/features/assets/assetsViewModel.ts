import { buildAssetIndex, filterAssets, type AssetFilter, type FilteredAssets } from '../../domain/assetIndex';
import type { AssetTarget } from '../../viewmodels/workspaceViewModel';
import type { WorkspacePort } from '../../viewmodels/workspacePort';

export class AssetsViewModel {
  constructor(private readonly workspace: WorkspacePort) {}

  index() {
    const workspace = this.workspace.getSnapshot().workspace;
    return workspace ? buildAssetIndex(workspace) : null;
  }

  filtered(filter: AssetFilter): FilteredAssets | null {
    const index = this.index();
    return index ? filterAssets(index, filter) : null;
  }

  open(projectId: string, target: AssetTarget): void {
    this.workspace.openAsset(projectId, target);
  }
}
