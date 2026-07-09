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

function updateAcceptanceRate() {
  const total = state.synced + state.rejected;
  const el = document.getElementById("stat-rate");
  if (total === 0) {
    el.textContent = "—";
    return;
  }
  const pct = Math.round((state.synced / total) * 100);
  el.textContent = `${pct}%`;
  el.className = "stat-value" + (pct < 70 ? " err" : " ok");
}

function log(tag, message, level = "info") {
  const line = document.createElement("div");
  line.className = "log-line" + (level !== "info" ? ` ${level}` : "");
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  line.innerHTML = `<span class="ts">${ts}</span><span class="tag">[${tag}]</span> ${message}`;
  logBodyEl.appendChild(line);
  logBodyEl.scrollTop = logBodyEl.scrollHeight;
}

const UPLOADERS = ["M. Chen", "R. Osei", "J. Alvarez", "S. Patel", "K. Novak", "T. Ibarra"];
const USAGE_TYPES = ["internal", "web", "print", "unrestricted"];

function randomChecksum() {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomAsset() {
  const type = ASSET_TYPES[Math.floor(Math.random() * ASSET_TYPES.length)];
  const stem = NAME_STEMS[Math.floor(Math.random() * NAME_STEMS.length)];
  const width = [1200, 1600, 2048, 3000][Math.floor(Math.random() * 4)];
  const height = Math.round(width * (Math.random() * 0.5 + 0.6));
  const sizeMb = (Math.random() * 18 + 0.4).toFixed(1);
  const hasRights = Math.random() > 0.28; // ~72% pass rights check
  const rights = hasRights
    ? {
        usageType: USAGE_TYPES[Math.floor(Math.random() * USAGE_TYPES.length)],
        approvedBy: UPLOADERS[Math.floor(Math.random() * UPLOADERS.length)],
        expiresOn: Math.random() > 0.7
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * (30 + Math.random() * 300)).toISOString().slice(0, 10)
          : null,
      }
    : null;

  return {
    id: `A${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`,
    name: `${stem}.${type.ext}`,
    type,
    width,
    height,
    sizeMb,
    hasRights,
    rights,
    checksum: randomChecksum(),
    uploadedBy: UPLOADERS[Math.floor(Math.random() * UPLOADERS.length)],
  };
}

function renderAssetCard(asset) {
  laneEmptyEl.style.display = "none";
  const card = document.createElement("div");
  card.className = "asset-card";
  card.id = `card-${asset.id}`;
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", "false");
  card.innerHTML = `
    <div class="asset-thumb" style="background:${asset.type.color}">${asset.type.label.slice(0, 3)}</div>
    <div class="asset-meta">
      <div class="asset-name">${asset.name}</div>
      <div class="asset-sub">${asset.width}×${asset.height} · ${asset.sizeMb} MB</div>
    </div>
    <div class="asset-stagebar" id="stagebar-${asset.id}">
      ${STAGES.map(s => `<div class="dot" data-stage="${s.key}"></div>`).join("")}
    </div>
    <div class="asset-chevron">▾</div>
    <div class="asset-details" id="details-${asset.id}">
      ${renderDetailRows(asset)}
    </div>
  `;

  const toggle = () => {
    const expanded = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(expanded));
  };
  card.addEventListener("click", (e) => {
    if (e.target.closest(".reject-reason")) return;
    toggle();
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  laneEl.prepend(card);
  return card;
}

function renderDetailRows(asset) {
  const rightsRow = asset.rights
    ? `<div class="detail-row"><span>Usage rights</span><span>${asset.rights.usageType}${asset.rights.expiresOn ? ` · expires ${asset.rights.expiresOn}` : " · no expiry"}</span></div>
       <div class="detail-row"><span>Approved by</span><span>${asset.rights.approvedBy}</span></div>`
    : `<div class="detail-row"><span>Usage rights</span><span class="detail-missing">not on file</span></div>`;

  return `
    <div class="detail-row"><span>Uploaded by</span><span>${asset.uploadedBy}</span></div>
    ${rightsRow}
    <div class="detail-row"><span>Checksum (SHA-1)</span><span class="detail-mono">${asset.checksum}…</span></div>
    <div class="detail-row"><span>Asset ID</span><span class="detail-mono">${asset.id}</span></div>
  `;
}

function setDot(assetId, stageKey, cls) {
  const bar = document.getElementById(`stagebar-${assetId}`);
  if (!bar) return;
  const dot = bar.querySelector(`[data-stage="${stageKey}"]`);
  if (dot) dot.className = `dot ${cls}`;
}

async function deliverToDestination(asset, key) {
  const el = document.getElementById(`dest-${key}`);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // ~18% transient failure chance per attempt, tapering with each retry
    const failChance = 0.18 / attempt;
    const failed = Math.random() < failChance;

    if (!failed) {
      el.classList.add("lit");
      setTimeout(() => el.classList.remove("lit"), 900);
      state.destCounts[key] += 1;
      document.getElementById(`dest-${key}-count`).textContent = state.destCounts[key];
      if (attempt > 1) {
        log("DELIVER", `${asset.name} reached ${labelFor(key)} on retry ${attempt - 1}`, "warn");
      } else {
        log("SYNC", `${asset.name} distributed to ${labelFor(key)}`);
      }
      return true;
    }

    if (attempt < maxAttempts) {
      const delayMs = [400, 900][attempt - 1] || 900;
      el.classList.add("retrying");
      log("RETRY", `delivery to ${labelFor(key)} failed for ${asset.name}, retrying in ${(delayMs / 1000).toFixed(1)}s`, "warn");
      await wait(delayMs);
      el.classList.remove("retrying");
    }
  }

  log("DEADLETTER", `${asset.name} exhausted retries for ${labelFor(key)}; routed to dead letter`, "error");
  return false;
}

async function distributeAsset(asset) {
  const targets = pickDistributionTargets(asset);
  const results = await Promise.all(targets.map(t => deliverToDestination(asset, t)));
  return results.every(Boolean);
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
    updateAcceptanceRate();
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

  const allDelivered = await distributeAsset(asset);

  if (!allDelivered) {
    setDot(asset.id, "distributed", "rejected");
    card.classList.add("status-rejected");
    const reasonEl = document.createElement("div");
    reasonEl.className = "reject-reason";
    reasonEl.textContent = "PARTIAL FAILURE — one or more deliveries moved to dead letter";
    card.appendChild(reasonEl);
    state.rejected += 1;
    state.queue -= 1;
    updateStat("stat-rejected", state.rejected);
    updateStat("stat-queue", state.queue);
    updateAcceptanceRate();
    return;
  }

  setDot(asset.id, "distributed", "done");
  bumpStageCount("distributed", 1);

  state.synced += 1;
  state.queue -= 1;
  updateStat("stat-synced", state.synced);
  updateStat("stat-queue", state.queue);
  updateAcceptanceRate();
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

document.getElementById("btn-clear-log").addEventListener("click", () => {
  logBodyEl.innerHTML = "";
  log("BOOT", "Log cleared.");
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
