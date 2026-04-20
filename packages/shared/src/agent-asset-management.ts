/* Batch 137 — Agent Asset Management types */

export type AssetCategory = 'code' | 'document' | 'image' | 'model' | 'dataset' | 'template' | 'plugin' | 'certificate' | 'key';
export type AssetLifecycle = 'draft' | 'active' | 'deprecated' | 'archived' | 'deleted';
export type AssetTransferType = 'assign' | 'share' | 'revoke' | 'clone' | 'migrate';
export type AssetLicenseType = 'mit' | 'apache2' | 'gpl3' | 'proprietary' | 'creative_commons' | 'custom';

export interface DigitalAsset {
  id: string;
  name: string;
  category: AssetCategory;
  lifecycle: AssetLifecycle;
  ownerId?: string;
  version: string;
  filePath?: string;
  fileSize?: number;
  checksum?: string;
  mimeType?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AssetTransfer {
  id: string;
  assetId: string;
  fromOwner?: string;
  toOwner: string;
  transferType: AssetTransferType;
  reason?: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled';
  completedAt?: string;
  createdAt: string;
}

export interface AssetLicense {
  id: string;
  assetId: string;
  licenseType: AssetLicenseType;
  licenseeId?: string;
  grantedBy?: string;
  permissions: string[];
  restrictions: string[];
  validFrom: string;
  validUntil?: string;
  revoked: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssetManagementStats {
  totalAssets: number;
  activeAssets: number;
  transfersPending: number;
  licensesActive: number;
  byCategory: Array<{ category: AssetCategory; count: number }>;
  storageUsed: number;
}
