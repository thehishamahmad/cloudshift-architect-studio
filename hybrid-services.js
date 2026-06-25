/**
 * CloudShift Architect Studio - Hybrid Service Recommendation Engine (v3.2 Stage 6.5)
 *
 * Parallel service layer that aligns existing v3.1.1 services with the hybrid
 * recommendation model. It does not replace current Recommended Services UI,
 * export, or Mermaid behavior.
 */

(function attachCloudShiftHybridServices(global) {
  const CATEGORY_KEYS = Object.freeze(['compute', 'database', 'cache', 'storage', 'networking', 'security', 'analytics']);

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

  function createEmptyResult() {
    return {
      compute: [],
      database: [],
      storage: [],
      cache: [],
      networking: [],
      security: [],
      analytics: [],
      rationale: []
    };
  }

  function normalizeServiceName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function serviceAliases(name) {
    const normalized = normalizeServiceName(name);
    const aliases = new Set([normalized]);
    if (normalized.includes('compute engine')) aliases.add('compute engine');
    if (normalized.includes('cloud sql')) aliases.add('cloud sql');
    if (normalized.includes('cloud storage')) aliases.add('cloud storage');
    if (normalized.includes('global https load balancer')) aliases.add('global https load balancer');
    if (normalized.includes('cloud cdn')) aliases.add('cloud cdn');
    if (normalized.includes('cloud armor')) aliases.add('cloud armor');
    if (normalized.includes('secret manager')) aliases.add('secret manager');
    if (normalized.includes('gke')) aliases.add('gke');
    if (normalized.includes('cloud run')) aliases.add('cloud run');
    if (normalized.includes('bigquery')) aliases.add('bigquery');
    if (normalized.includes('dataflow')) aliases.add('dataflow');
    if (normalized.includes('memorystore')) aliases.add('memorystore');
    return aliases;
  }

  function serviceExists(result, name) {
    const targetAliases = serviceAliases(name);
    return CATEGORY_KEYS.some(category =>
      result[category].some(service => {
        const existingAliases = serviceAliases(service.name);
        return Array.from(targetAliases).some(alias => existingAliases.has(alias));
      })
    );
  }

  function addService(result, category, name, rationale, source = 'Hybrid') {
    if (!CATEGORY_KEYS.includes(category) || !name || serviceExists(result, name)) return;
    const service = { name, rationale, source };
    result[category].push(service);
    result.rationale.push(`${name}: ${rationale}`);
  }

  function mapLegacyCategory(category, name) {
    const lowerCategory = String(category || '').toLowerCase();
    const lowerName = String(name || '').toLowerCase();
    if (lowerName.includes('bigquery') || lowerName.includes('dataflow') || lowerName.includes('vertex ai')) return 'analytics';
    if (lowerName.includes('memorystore')) return 'cache';
    if (lowerCategory === 'compute') return 'compute';
    if (lowerCategory === 'database') return 'database';
    if (lowerCategory === 'cache') return 'cache';
    if (lowerCategory === 'storage') return 'storage';
    if (lowerCategory === 'networking') return 'networking';
    if (lowerCategory === 'security') return 'security';
    return 'compute';
  }

  function addExistingServices(result, recommendation) {
    const services = Array.isArray(recommendation?.services) ? recommendation.services : [];
    services.forEach(service => {
      const category = mapLegacyCategory(service.category, service.name);
      const displayName = /Compute Engine.*Managed Instance Groups/i.test(String(service.name || ''))
        ? 'Compute Engine MIG'
        : service.name;
      addService(result, category, displayName, service.rationale || 'Preserved from the existing recommendation.', 'Existing Recommendation');
    });
  }

  function hasPlatform(hybridRecommendation, platform) {
    return hybridRecommendation?.primaryPlatform === platform
      || normalizeList(hybridRecommendation?.supportingPlatforms).includes(platform);
  }

  function hasAnyWorkload(workloads, values) {
    return values.some(value => workloads.includes(value));
  }

  function hasAnyCharacteristic(characteristics, values) {
    return values.some(value => characteristics.includes(value));
  }

  function hasStrongGkeSignal(workloads, characteristics, hybridRecommendation) {
    return hasAnyCharacteristic(characteristics, ['microservices'])
      || (hybridRecommendation?.primaryPlatform === 'GKE'
        && hasAnyCharacteristic(characteristics, ['microservices']));
  }

  function getRecommendedDatabaseService(recommendation) {
    return Array.isArray(recommendation?.services)
      ? recommendation.services.find(service => ['Database', 'Storage'].includes(String(service.category)) && /Cloud SQL|Firestore|Spanner|BigQuery/i.test(String(service.name)))
      : null;
  }

  function hasServiceInCategory(result, category, tokens) {
    const services = Array.isArray(result[category]) ? result[category] : [];
    return services.some(service => tokens.some(token => String(service.name || '').toLowerCase().includes(token.toLowerCase())));
  }

  function shouldAddCloudArmor({ workloads, characteristics, challenges, accessPattern, recoveryTier }) {
    const explicitSecuritySignal = hasAnyWorkload(workloads, ['transactional-platform'])
      || hasAnyCharacteristic(characteristics, ['public-facing'])
      || challenges.includes('sec-compliance')
      || challenges.includes('ddos-waf');
    const publicResilientEdge = accessPattern === 'public'
      && ['tier-1', 'tier-2'].includes(recoveryTier)
      && !challenges.includes('budget-opt');
    return explicitSecuritySignal || publicResilientEdge;
  }

  function generateHybridServices(inputs = {}, recommendation = {}, hybridRecommendation = null) {
    const result = createEmptyResult();
    addExistingServices(result, recommendation);

    const workloads = normalizeWorkloadProfiles(inputs.workloads || recommendation.workloads);
    const characteristics = normalizeCharacteristicProfiles(inputs.characteristics || recommendation.characteristics, workloads);
    const challenges = normalizeList(inputs.challenges || recommendation.challenges);
    const trafficPattern = String(inputs.trafficPattern || recommendation.trafficPattern || 'dynamic');
    const accessPattern = String(inputs.accessPattern || recommendation.accessPattern || 'public');
    const recoveryTier = String(inputs.recoveryTier || recommendation.recoveryTier || 'tier-2');
    const dataTransfer = Math.max(0, Number(inputs.dataTransfer ?? recommendation.dataTransfer) || 0);
    const expectedUsers = Math.max(0, Number(inputs.expectedUsers ?? recommendation.expectedUsers) || 0);
    const platforms = normalizeList([
      hybridRecommendation?.primaryPlatform,
      ...normalizeList(hybridRecommendation?.supportingPlatforms)
    ]);
    const modernizationSummary = hybridRecommendation?.modernizationSummary || {};
    const isSegmented = hybridRecommendation?.segmentedArchitecture === true || hybridRecommendation?.recommendationMode === 'Hybrid Segmented';

    if (hasPlatform(hybridRecommendation, 'Compute Engine') || hasAnyWorkload(workloads, ['enterprise-app'])) {
      addService(
        result,
        'compute',
        'Compute Engine MIG',
        'Provides runtime compatibility for enterprise business applications and migration-sensitive workloads in the hybrid estate.'
      );
    }

    if (hasPlatform(hybridRecommendation, 'Cloud Run') || hasAnyWorkload(workloads, ['web-portal', 'api-backend', 'transactional-platform'])) {
      addService(
        result,
        'compute',
        'Cloud Run',
        'Supports stateless web, API, and modernization candidates with managed container autoscaling.'
      );
    }

    if (hasStrongGkeSignal(workloads, characteristics, hybridRecommendation)) {
      addService(
        result,
        'compute',
        'GKE Standard',
        'Supports Kubernetes-required or multi-service container workloads that need orchestration controls.'
      );
    }

    if (hasPlatform(hybridRecommendation, 'BigQuery') || hasAnyWorkload(workloads, ['data-analytics'])) {
      addService(
        result,
        'analytics',
        'BigQuery',
        'Provides the analytical warehouse target for reporting, BI, and data modernization workloads.'
      );
    }

    if (hasAnyWorkload(workloads, ['data-analytics']) || hasAnyCharacteristic(characteristics, ['batch'])) {
      addService(
        result,
        'analytics',
        'Dataflow',
        'Supports batch or streaming transformation pipelines feeding analytical platforms.'
      );
    }

    if (hasPlatform(hybridRecommendation, 'Cloud Storage')
      || hasAnyWorkload(workloads, ['enterprise-app', 'media-streaming', 'web-portal', 'data-analytics', 'ai-ml-platform', 'transactional-platform'])
      || modernizationSummary.modernizationCandidates > 0) {
      addService(
        result,
        'storage',
        'Cloud Storage',
        'Provides shared object storage for documents, static assets, analytical staging, and modernization artifacts.'
      );
    }

    const recommendedDatabase = getRecommendedDatabaseService(recommendation);
    if (recommendedDatabase) {
      addService(
        result,
        'database',
        recommendedDatabase.name,
        recommendedDatabase.rationale || 'Preserves the database tier selected by the base architecture recommendation.'
      );
    }

    if (hasAnyWorkload(workloads, ['transactional-platform', 'enterprise-app'])
      && !hasServiceInCategory(result, 'database', ['Cloud SQL', 'Spanner'])) {
      const missionCriticalTransactional = recoveryTier === 'tier-1' && expectedUsers >= 1000000;
      addService(
        result,
        'database',
        missionCriticalTransactional ? 'Cloud Spanner' : 'Cloud SQL for PostgreSQL (HA)',
        missionCriticalTransactional
          ? 'Supports globally consistent, mission-critical transactional data where scale and recovery requirements justify Spanner.'
          : 'Provides resilient transactional persistence for enterprise and e-commerce workloads without treating cache or analytics storage as the primary system of record.'
      );
    }

    if (isSegmented && hasAnyWorkload(workloads, ['data-analytics']) && !hasServiceInCategory(result, 'analytics', ['BigQuery'])) {
      addService(result, 'analytics', 'BigQuery', 'Separates analytical reporting and BI workloads from transactional application databases.');
    }

    const hasStaticContentDelivery = ['static', 'mixed', 'video'].includes(trafficPattern);
    const isPublicFacing = hasAnyCharacteristic(characteristics, ['public-facing']);
    const needsCdn = hasAnyWorkload(workloads, ['media-streaming'])
      || dataTransfer >= 2000
      || (hasAnyWorkload(workloads, ['transactional-platform']) && isPublicFacing && dataTransfer >= 2000)
      || (hasAnyWorkload(workloads, ['web-portal']) && hasStaticContentDelivery && dataTransfer >= 2000)
      || ((challenges.includes('perf-bottleneck') || challenges.includes('scale-issue')) && isPublicFacing && hasStaticContentDelivery)
      || challenges.includes('global-content-acceleration')
      || challenges.includes('cdn-acceleration');
    if (needsCdn && accessPattern !== 'internal') {
      addService(
        result,
        'networking',
        'Cloud CDN',
        'Reduces origin load and improves delivery performance for cacheable public content. Final cost impact depends on cache hit ratio, traffic geography, and egress patterns.'
      );
    }

    const hasPublicIngress = accessPattern !== 'internal' && (needsCdn || hasAnyCharacteristic(characteristics, ['public-facing']) || hasAnyWorkload(workloads, ['web-portal', 'api-backend', 'transactional-platform']));
    if (hasPublicIngress) {
      addService(
        result,
        'networking',
        'Global HTTPS Load Balancer',
        'Provides global HTTPS ingress and routing across hybrid application backends.'
      );
    }

    const requiresCloudVpn = challenges.includes('hybrid-conn')
      || challenges.includes('on-prem-integration')
      || challenges.includes('datacenter-connectivity')
      || challenges.includes('site-to-site-private-networking');
    const requiresPrivateServiceConnect = challenges.includes('private-service-consumption')
      || challenges.includes('private-google-api-access')
      || challenges.includes('private-service-publishing')
      || challenges.includes('multi-project-private-service');

    if (requiresCloudVpn) {
      addService(
        result,
        'networking',
        'Cloud VPN',
        'Provides site-to-site private connectivity between Google Cloud VPC networks and on-premises or datacenter environments.'
      );
    }

    if (requiresPrivateServiceConnect) {
      addService(
        result,
        'networking',
        'Private Service Connect',
        'Provides private service consumption, publishing, or Google API access across VPC and multi-project service architectures.'
      );
    }

    if (accessPattern !== 'internal' && shouldAddCloudArmor({ workloads, characteristics, challenges, accessPattern, recoveryTier })) {
      addService(
        result,
        'security',
        'Cloud Armor WAF',
        'Protects public-facing application entry points with edge WAF and DDoS controls.'
      );
    }

    if (recommendation?.securityDecisions?.secretManager || hasPlatform(hybridRecommendation, 'Cloud Run') || hasPlatform(hybridRecommendation, 'GKE')) {
      addService(
        result,
        'security',
        'Secret Manager',
        'Supports runtime secret injection for managed container and API workloads where credentials are required.'
      );
    }

    return result;
  }

  const api = Object.freeze({
    generateHybridServices
  });

  global.CloudShiftHybridServices = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
