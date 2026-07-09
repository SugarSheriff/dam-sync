// AssetSyncService.cs
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
}
