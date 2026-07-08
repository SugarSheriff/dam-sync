# AssetRoute — DAM Sync Console

A live browser simulation of a digital asset management (DAM) sync pipeline: assets are ingested, validated against rights and quality rules, rendered into deployment-ready formats, tagged, and distributed to the downstream systems that consume them.

**[Live demo →](https://sugarsheriff.github.io/dam-sync/)**

## What this demonstrates

Digital asset management sits at the intersection of creative operations and system integration — assets don't just get stored, they get *distributed* to the systems that need them, and each destination has different rules about what it will accept. This project models that pipeline end to end:

- **Ingest** — an asset enters the pipeline with basic file metadata (dimensions, size, type)
- **Metadata validation** — rejects assets missing usage rights records, exceeding size limits, or below minimum resolution, mirroring real DAM governance rules
- **Rendition generation** — simulates the creation of web, thumbnail, and print-ready formats
- **Tagging** — automated indexing before an asset is considered ready to distribute
- **Distribution** — routes the asset to the correct downstream systems based on file type: product imagery to SAP Business One, creative files to Wrike for review, and public-facing renditions to a CDN origin

Toggle "Enforce rights metadata" off to see how validation gating changes pipeline behavior — a good proxy for the kind of business-rule toggles that show up in real ingest pipelines.

## Code samples

The `code-samples/` folder contains representative production-pattern implementations, also viewable in the live demo:

| File | Language | Demonstrates |
|---|---|---|
| `AssetSyncService.cs` | C# | Retry/backoff distribution logic to multiple downstream destinations, dead-letter handling on exhausted retries |
| `asset-metadata.schema.ts` | TypeScript | Shared metadata contract and validation rules between ingest webhook and sync service |
| `dam-health-check.ps1` | PowerShell | Scheduled health check for a sync queue — detects stuck assets and growing dead-letter counts, alerts via webhook |

These are illustrative, not pulled from a live codebase, but reflect the actual patterns used in DAM integration work: backoff-based retry, shared validation contracts between services, and monitoring scripts that catch silent pipeline failures before they become support tickets.

## Stack

Vanilla HTML/CSS/JS for the demo — no build step, no dependencies, deployed directly via GitHub Pages. Design system shared across my other showcase projects (sync-hub, edi-pipeline, FlickFinder).

## Files

```
dam-sync/
├── index.html
├── style.css
├── script.js
├── README.md
└── code-samples/
    ├── AssetSyncService.cs
    ├── asset-metadata.schema.ts
    └── dam-health-check.ps1
```

---

Part of a portfolio series showcasing enterprise integration work across the systems I work with day to day: SAP Business One, Wrike, EDI X12, and DAM platforms.
