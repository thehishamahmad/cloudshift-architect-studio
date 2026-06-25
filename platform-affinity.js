/**
 * CloudShift Architect Studio - Platform Affinity Engine (v3.2 foundation)
 *
 * Isolated rule engine for assessing multi-platform fit across an application
 * landscape. This file does not replace or mutate the v3.1.1 recommendation
 * engine; it is safe to call independently for debugging and future UI work.
 */

(function attachPlatformAffinity(global) {
  const SUPPORTED_PLATFORMS = Object.freeze([
    'Cloud Run',
    'GKE',
    'Compute Engine',
    'BigQuery',
    'Cloud Storage',
    'Cloud CDN'
  ]);

  function normalizeList(value) {
    return Array.isArray(value)
      ? value.filter(Boolean).map(item => String(item).trim()).filter(Boolean)
      : [];
  }

  function normalizeWorkloadProfiles(value) {
    const normalizer = global.CloudShiftWorkloadProfiles?.normalize;
    if (typeof normalizer === 'function') return normalizer(value);
    return Array.from(new Set(normalizeList(value)));
  }

  function normalizeCharacteristicProfiles(value, workloads) {
    const normalizer = global.CloudShiftCharacteristics?.normalize;
    if (typeof normalizer === 'function') return normalizer(value, workloads);
    return Array.from(new Set(normalizeList(value)));
  }

  function createEmptyScores() {
    return SUPPORTED_PLATFORMS.reduce((scores, platform) => {
      scores[platform] = 0;
      return scores;
    }, {});
  }

  function addScore(scores, reasoning, platform, points, reason) {
    if (!SUPPORTED_PLATFORMS.includes(platform) || !Number.isFinite(points) || points === 0) return;
    scores[platform] += points;
    reasoning.push({ platform, points, reason });
  }

  function calculatePlatformAffinity(inputs = {}) {
    const workloads = normalizeWorkloadProfiles(inputs.workloads);
    const characteristics = normalizeCharacteristicProfiles(inputs.characteristics, workloads);
    const trafficPattern = String(inputs.trafficPattern || 'dynamic');
    const dataTransfer = Math.max(0, Number(inputs.dataTransfer) || 0);
    const scores = createEmptyScores();
    const reasoning = [];

    const hasWorkload = value => workloads.includes(value);
    const hasCharacteristic = value => characteristics.includes(value);

    workloads.forEach(workload => {
      switch (workload) {
        case 'web-portal':
        case 'api-backend':
          addScore(scores, reasoning, 'Cloud Run', 18, `${workload} fits managed serverless application hosting.`);
          break;
        case 'enterprise-app':
          addScore(scores, reasoning, 'Compute Engine', 20, `${workload} often has legacy runtime, licensing, or stateful migration constraints.`);
          addScore(scores, reasoning, 'Cloud Storage', 8, `${workload} commonly requires document, export, or attachment storage.`);
          break;
        case 'data-analytics':
          addScore(scores, reasoning, 'BigQuery', 25, `${workload} strongly aligns to analytical warehouse and BI query patterns.`);
          addScore(scores, reasoning, 'Cloud Storage', 10, `${workload} benefits from object staging and data lake storage.`);
          break;
        case 'ai-ml-platform':
          addScore(scores, reasoning, 'GKE', 12, `${workload} may need orchestrated services for ML application components.`);
          addScore(scores, reasoning, 'BigQuery', 10, `${workload} benefits from analytical feature and training datasets.`);
          addScore(scores, reasoning, 'Cloud Storage', 10, `${workload} needs model, artifact, and dataset storage.`);
          break;
        case 'media-streaming':
          addScore(scores, reasoning, 'Cloud Storage', 18, `${workload} is content-heavy and benefits from durable object storage.`);
          addScore(scores, reasoning, 'Cloud CDN', 16, `${workload} benefits from edge caching for learner or media delivery.`);
          break;
        case 'transactional-platform':
          addScore(scores, reasoning, 'Cloud Run', 16, `${workload} fits managed application services for storefront and API components.`);
          if (dataTransfer >= 2000) addScore(scores, reasoning, 'Cloud CDN', 12, `${workload} benefits from edge caching when transfer volume is material.`);
          addScore(scores, reasoning, 'Cloud Storage', 6, `${workload} commonly stores static assets and exports.`);
          break;
        case 'iot-event-platform':
          addScore(scores, reasoning, 'Cloud Run', 12, `${workload} fits event-driven service consumers and lightweight processing.`);
          addScore(scores, reasoning, 'BigQuery', 8, `${workload} commonly feeds telemetry analytics.`);
          addScore(scores, reasoning, 'Cloud Storage', 6, `${workload} benefits from event staging and archival storage.`);
          break;
        default:
          addScore(scores, reasoning, 'Cloud Run', 4, `${workload} receives a conservative managed application default.`);
      }
    });

    if (workloads.length === 0) {
      addScore(scores, reasoning, 'Cloud Run', 5, 'No workload profiles were provided, so Cloud Run receives a safe default affinity.');
    }

    if (hasCharacteristic('stateless')) {
      addScore(scores, reasoning, 'Cloud Run', 14, 'Stateless workloads fit request-driven serverless scaling.');
    }
    if (hasCharacteristic('microservices')) {
      addScore(scores, reasoning, 'GKE', 22, 'Microservices or multi-service platforms can benefit from orchestration and service-level scaling.');
    }
    if (hasCharacteristic('stateful')) {
      addScore(scores, reasoning, 'Compute Engine', 12, 'Stateful runtime requirements increase VM affinity.');
      addScore(scores, reasoning, 'GKE', 4, 'Stateful services may require orchestration if later discovery confirms a microservices model.');
    }
    if (hasCharacteristic('event-driven')) {
      addScore(scores, reasoning, 'Cloud Run', 10, 'Event-driven workloads fit serverless request and event processing.');
    }
    if (hasCharacteristic('realtime')) {
      addScore(scores, reasoning, 'GKE', 8, 'Real-time services may need tuned orchestration and scaling controls.');
      addScore(scores, reasoning, 'Cloud Run', 5, 'Real-time APIs can fit Cloud Run when stateless and container-ready.');
    }
    if (hasCharacteristic('batch')) {
      addScore(scores, reasoning, 'BigQuery', 8, 'Batch processing often feeds analytical or transformation workloads.');
      addScore(scores, reasoning, 'Cloud Storage', 6, 'Batch pipelines commonly stage files in object storage.');
    }

    if (['static', 'mixed', 'video'].includes(trafficPattern) && dataTransfer >= 2000) {
      addScore(scores, reasoning, 'Cloud CDN', 10, `${trafficPattern} traffic increases edge caching affinity.`);
      addScore(scores, reasoning, 'Cloud Storage', 8, `${trafficPattern} traffic often includes cacheable object content.`);
    }
    if (trafficPattern === 'api') {
      addScore(scores, reasoning, 'Cloud Run', 8, 'API-intensive traffic fits managed container endpoints when stateless.');
      addScore(scores, reasoning, 'GKE', 6, 'API-intensive multi-service estates may benefit from Kubernetes controls.');
    }
    if (dataTransfer >= 2000) {
      addScore(scores, reasoning, 'Cloud CDN', 12, 'High monthly transfer increases CDN optimization opportunity.');
      addScore(scores, reasoning, 'Cloud Storage', 8, 'High transfer commonly pairs with object storage optimization.');
    }

    const rankedPlatforms = SUPPORTED_PLATFORMS
      .map(platform => ({ platform, score: scores[platform] }))
      .sort((a, b) => b.score - a.score || SUPPORTED_PLATFORMS.indexOf(a.platform) - SUPPORTED_PLATFORMS.indexOf(b.platform));

    const primaryPlatform = rankedPlatforms[0]?.score > 0 ? rankedPlatforms[0].platform : 'Cloud Run';
    const supportingPlatforms = rankedPlatforms
      .filter(item => item.platform !== primaryPlatform && item.score > 0)
      .map(item => item.platform);

    return {
      primaryPlatform,
      supportingPlatforms,
      platformScores: scores,
      reasoning
    };
  }

  function debugPlatformAffinity(inputs = {}) {
    const result = calculatePlatformAffinity(inputs);
    if (global.console && typeof global.console.table === 'function') {
      global.console.table(result.platformScores);
      global.console.debug('CloudShift Platform Affinity reasoning:', result.reasoning);
    } else if (global.console && typeof global.console.debug === 'function') {
      global.console.debug('CloudShift Platform Affinity result:', result);
    }
    return result;
  }

  const api = Object.freeze({
    supportedPlatforms: SUPPORTED_PLATFORMS,
    calculatePlatformAffinity,
    debugPlatformAffinity
  });

  global.CloudShiftPlatformAffinity = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
