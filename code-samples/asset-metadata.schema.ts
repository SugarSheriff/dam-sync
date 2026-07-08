// asset-metadata.schema.ts
// Contract + validator shared between the DAM ingest webhook
// and the sync service's pre-flight checks.

export interface AssetMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  rights: RightsMetadata | null;
  tags: string[];
}

export interface RightsMetadata {
  usageType: "internal" | "web" | "print" | "unrestricted";
  expiresOn: string | null; // ISO date, null = no expiry
  approvedBy: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

const MAX_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB ingest ceiling
const MIN_DIMENSION_PX = 400;

export function validateAssetMetadata(asset: AssetMetadata): ValidationResult {
  if (asset.sizeBytes > MAX_SIZE_BYTES) {
    return { isValid: false, reason: `File exceeds ${MAX_SIZE_BYTES / 1_048_576} MB ingest limit` };
  }

  if (asset.widthPx < MIN_DIMENSION_PX || asset.heightPx < MIN_DIMENSION_PX) {
    return { isValid: false, reason: "Resolution below minimum usable dimensions" };
  }

  if (!asset.rights) {
    return { isValid: false, reason: "Missing usage rights metadata" };
  }

  if (asset.rights.expiresOn && new Date(asset.rights.expiresOn) < new Date()) {
    return { isValid: false, reason: "Usage rights have expired" };
  }

  return { isValid: true };
}

export function destinationsFor(asset: AssetMetadata): string[] {
  const targets: string[] = [];

  if (asset.mimeType.startsWith("image/")) {
    targets.push("sap-business-one", "web-cdn");
  }

  if (asset.mimeType === "application/pdf" || asset.mimeType === "application/illustrator") {
    targets.push("wrike");
  }

  return targets;
}
