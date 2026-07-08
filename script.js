// AssetRoute — DAM Sync Console
// Simulated pipeline: Ingested -> Metadata Check -> Rendition -> Tagging -> Distributed

const STAGES = [
  { key: "ingested", name: "Ingested" },
  { key: "metadata", name: "Metadata Check" },
  { key: "rendition", name: "Rendition" },
  { key: "tagging", name: "Tagging" },
  { key: "distributed", name: "Distributed" },
];

const ASSET_TYPES = [
  { ext: "jpg", label: "PHOTO", color: "#5ee6c4" },
  { ext: "png", label: "PNG", color: "#8fd3ff" },
  { ext: "ai", label: "VECTOR", color: "#f2a65a" },
  { ext: "mp4", label: "VIDEO", color: "#c792ea" },
  { ext: "pdf", label: "DOC", color: "#ef9a9a" },
];

const NAME_STEMS = [
  "hero-banner", "product-spin-01", "spring-catalog-cover", "sku-4471-front",
  "brand-lockup", "campaign-still-02", "packaging-flat", "retail-signage",
  "social-teaser", "warehouse-photo-09", "sku-8823-detail", "lifestyle-shot-14",
];

const state = {
  queue: 0,
  synced: 0,
  rejected: 0,
  destCounts: { sap: 0, wrike: 0, web: 0 },
  stageCounts: {},
};
STAGES.forEach(s => (state.stageCounts[s.key] = 0));

const trackEl = document.getElementById("pipeline-track");
const laneEl = document.getElementById("asset-lane");
const laneEmptyEl = document.getElementById("lane-empty");
const logBodyEl = document.getElementById("log-body");

function buildTrack() {
  trackEl.innerHTML = "";
  STAGES.forEach((s, i) => {
    const col = document.createElement("div");
    col.className = "stage-col";
    col.innerHTML = `
      <div class="stage-index">STAGE ${String(i + 1).padStart(2, "0")}</div>
      <div class="stage-name">${s.name}</div>
      <div class="stage-count" id="count-${s.key}">0</div>
    `;
    trackEl.appendChild(col);
  });
}
buildTrack();

function updateStat(id, val) {
  document.getElementById(id).textContent = val;
}

function log(tag, message, level = "info") {
  const line = document.createElement("div");
  line.className = "log-line" + (level !== "info" ? ` ${level}` : "");
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  line.innerHTML = `<span class="ts">${ts}</span><span class="tag">[${tag}]</span> ${message}`;
  logBodyEl.appendChild(line);
  logBodyEl.scrollTop = logBodyEl.scrollHeight;
}

function randomAsset() {
  const type = ASSET_TYPES[Math.floor(Math.random() * ASSET_TYPES.length)];
  const stem = NAME_STEMS[Math.floor(Math.random() * NAME_STEMS.length)];
  const width = [1200, 1600, 2048, 3000][Math.floor(Math.random() * 4)];
  const height = Math.round(width * (Math.random() * 0.5 + 0.6));
  const sizeMb = (Math.random() * 18 + 0.4).toFixed(1);
  const hasRights = Math.random() > 0.28; // ~72% pass rights check
  return {
    id: `A${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`,
    name: `${stem}.${type.ext}`,
    type,
    width,
    height,
    sizeMb,
    hasRights,
  };
}

function renderAssetCard(asset) {
  laneEmptyEl.style.display = "none";
  const card = document.createElement("div");
  card.className = "asset-card";
  card.id = `card-${asset.id}`;
  card.innerHTML = `
    <div class="asset-thumb" style="background:${asset.type.color}">${asset.type.label.slice(0, 3)}</div>
    <div class="asset-meta">
      <div class="asset-name">${asset.name}</div>
      <div class="asset-sub">${asset.width}×${asset.height} · ${asset.sizeMb} MB</div>
    </div>
    <div class="asset-stagebar" id="stagebar-${asset.id}">
      ${STAGES.map(s => `<div class="dot" data-stage="${s.key}"></div>`).join("")}
    </div>
  `;
  laneEl.prepend(card);
  return card;
}

function setDot(assetId, stageKey, cls) {
  const bar = document.getElementById(`stagebar-${assetId}`);
  if (!bar) return;
  const dot = bar.querySelector(`[data-stage="${stageKey}"]`);
  if (dot) dot.className = `dot ${cls}`;
}

function lightDestination(key) {
  const el = document.getElementById(`dest-${key}`);
  el.classList.add("lit");
  setTimeout(() => el.classList.remove("lit"), 900);
  state.destCounts[key] += 1;
  document.getElementById(`dest-${key}-count`).textContent = state.destCounts[key];
}

function bumpStageCount(key, delta) {
  state.stageCounts[key] += delta;
  const el = document.getElementById(`count-${key}`);
  if (el) el.textContent = state.stageCounts[key];
}

async function runAsset(asset) {
  state.queue += 1;
  updateStat("stat-queue", state.queue);
  const card = renderAssetCard(asset);
  log("INGEST", `${asset.name} received (${asset.sizeMb} MB)`);

  await wait(350);
  setDot(asset.id, "ingested", "done");
  bumpStageCount("ingested", 1);

  // Metadata check
  await wait(500);
  setDot(asset.id, "metadata", "active");
  await wait(600);
  const strict = document.getElementById("toggle-strict").checked;

  if (strict && !asset.hasRights) {
    setDot(asset.id, "metadata", "rejected");
    card.classList.add("status-rejected");
    const reasonEl = document.createElement("div");
    reasonEl.className = "reject-reason";
    reasonEl.textContent = "REJECTED — missing usage rights metadata";
    card.appendChild(reasonEl);
    log("REJECT", `${asset.name} failed metadata validation: no rights record on file`, "error");
    state.rejected += 1;
    state.queue -= 1;
    updateStat("stat-rejected", state.rejected);
    updateStat("stat-queue", state.queue);
    return;
  }

  setDot(asset.id, "metadata", "done");
  bumpStageCount("metadata", 1);
  log("VALIDATE", `${asset.name} passed metadata check`);

  // Rendition
  await wait(450);
  setDot(asset.id, "rendition", "active");
  await wait(650);
  setDot(asset.id, "rendition", "done");
  bumpStageCount("rendition", 1);
  log("RENDER", `${asset.name} renditions generated (web, thumbnail, print)`);

  // Tagging
  await wait(400);
  setDot(asset.id, "tagging", "active");
  await wait(500);
  setDot(asset.id, "tagging", "done");
  bumpStageCount("tagging", 1);
  log("TAG", `${asset.name} auto-tagged and indexed`);

  // Distribution
  await wait(400);
  setDot(asset.id, "distributed", "active");
  await wait(500);
  setDot(asset.id, "distributed", "done");
  bumpStageCount("distributed", 1);

  const targets = pickDistributionTargets(asset);
  targets.forEach(t => lightDestination(t));
  log("SYNC", `${asset.name} distributed to ${targets.map(labelFor).join(", ")}`, "warn");

  state.synced += 1;
  state.queue -= 1;
  updateStat("stat-synced", state.synced);
  updateStat("stat-queue", state.queue);
}

function pickDistributionTargets(asset) {
  if (asset.type.ext === "jpg" || asset.type.ext === "png") return ["sap", "web"];
  if (asset.type.ext === "ai" || asset.type.ext === "pdf") return ["wrike"];
  return ["wrike", "web"];
}

function labelFor(key) {
  return { sap: "SAP Business One", wrike: "Wrike", web: "Web CDN" }[key];
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

document.getElementById("btn-generate").addEventListener("click", () => {
  runAsset(randomAsset());
});

document.getElementById("btn-batch").addEventListener("click", async () => {
  for (let i = 0; i < 5; i++) {
    runAsset(randomAsset());
    await wait(280);
  }
});

// ---------- Code sample tabs ----------
const CODE_SAMPLES = {
  cs: `// AssetSyncService.cs
// Distributes validated DAM assets to downstream systems with
// retry/backoff, matching the pattern used across integration jobs.

public class AssetSyncService
{
    private readonly IAssetRepository _assets;
    private readonly IReadOnlyList<IAssetDestination> _destinations;
    private readonly ILogger<AssetSyncService> _log;

    private static readonly TimeSpan[] BackoffSchedule =
    {
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(30)
    };

    public AssetSyncService(
        IAssetRepository assets,
        IEnumerable<IAssetDestination> destinations,
        ILogger<AssetSyncService> log)
    {
        _assets = assets;
        _destinations = destinations.ToList();
        _log = log;
    }

    public async Task SyncAsync(AssetRecord asset, CancellationToken ct)
    {
        var validation = MetadataValidator.Validate(asset);
        if (!validation.IsValid)
        {
            await _assets.MarkRejectedAsync(asset.Id, validation.Reason, ct);
            _log.LogWarning("Asset {AssetId} rejected: {Reason}", asset.Id, validation.Reason);
            return;
        }

        var targets = _destinations.Where(d => d.Accepts(asset)).ToList();

        foreach (var destination in targets)
        {
            await SendWithRetryAsync(asset, destination, ct);
        }

        await _assets.MarkDistributedAsync(asset.Id, targets.Select(t => t.Name), ct);
    }

    private async Task SendWithRetryAsync(
        AssetRecord asset, IAssetDestination destination, CancellationToken ct)
    {
        for (var attempt = 0; attempt <= BackoffSchedule.Length; attempt++)
        {
            try
            {
                await destination.PublishAsync(asset, ct);
                _log.LogInformation(
                    "Asset {AssetId} delivered to {Destination}", asset.Id, destination.Name);
                return;
            }
            catch (Exception ex) when (attempt < BackoffSchedule.Length)
            {
                var delay = BackoffSchedule[attempt];
                _log.LogWarning(ex,
                    "Delivery to {Destination} failed for {AssetId}, retry {Attempt} in {Delay}",
                    destination.Name, asset.Id, attempt + 1, delay);
                await Task.Delay(delay, ct);
            }
        }

        await _assets.MarkFailedAsync(asset.Id, destination.Name, ct);
        _log.LogError(
            "Asset {AssetId} exhausted retries for {Destination}; routed to dead letter",
            asset.Id, destination.Name);
    }
}`,

  ts: `// asset-metadata.schema.ts
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
    return { isValid: false, reason: \`File exceeds \${MAX_SIZE_BYTES / 1_048_576} MB ingest limit\` };
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
}`,

  ps1: `# dam-health-check.ps1
# Scheduled task: confirms the DAM sync queue is draining and
# alerts if assets are stuck or the dead-letter queue is growing.

param(
    [string]$DamApiBaseUrl = $env:DAM_API_BASE_URL,
    [string]$AlertWebhookUrl = $env:SYNC_ALERT_WEBHOOK,
    [int]$StuckThresholdMinutes = 30,
    [int]$DeadLetterAlertCount = 5
)

function Get-QueueSnapshot {
    param([string]$BaseUrl)

    $headers = @{ Authorization = "Bearer $env:DAM_API_TOKEN" }
    Invoke-RestMethod -Uri "$BaseUrl/sync/queue/status" -Headers $headers -Method Get
}

function Send-Alert {
    param([string]$Message)

    if (-not $AlertWebhookUrl) { return }

    $body = @{ text = $Message } | ConvertTo-Json
    Invoke-RestMethod -Uri $AlertWebhookUrl -Method Post -Body $body -ContentType "application/json"
}

try {
    $snapshot = Get-QueueSnapshot -BaseUrl $DamApiBaseUrl
    $now = Get-Date

    $stuck = $snapshot.inFlight | Where-Object {
        ((New-TimeSpan -Start ([datetime]$_.enqueuedAt) -End $now).TotalMinutes) -gt $StuckThresholdMinutes
    }

    if ($stuck.Count -gt 0) {
        $names = ($stuck | Select-Object -ExpandProperty assetName) -join ", "
        Send-Alert "DAM sync: $($stuck.Count) asset(s) stuck past $StuckThresholdMinutes min - $names"
        Write-Warning "Stuck assets detected: $names"
    }

    if ($snapshot.deadLetterCount -ge $DeadLetterAlertCount) {
        Send-Alert "DAM sync: dead-letter queue at $($snapshot.deadLetterCount) items - investigate"
        Write-Warning "Dead-letter queue threshold exceeded: $($snapshot.deadLetterCount)"
    }

    Write-Output "Health check complete: $($snapshot.inFlight.Count) in flight, $($snapshot.deadLetterCount) dead-lettered."
}
catch {
    Send-Alert "DAM sync health check failed to run: $($_.Exception.Message)"
    Write-Error "Health check error: $($_.Exception.Message)"
    exit 1
}`,
};

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".code-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

Object.entries(CODE_SAMPLES).forEach(([key, code]) => {
  const panel = document.querySelector(`#panel-${key} code`);
  panel.textContent = code;
});

// Seed the log
log("BOOT", "AssetRoute sync console initialized. Awaiting ingest.");
