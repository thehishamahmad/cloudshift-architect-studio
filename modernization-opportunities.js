/**
 * CloudShift Architect Studio - Modernization Opportunities Engine (v3.2 Stage 2)
 *
 * Isolated per-workload mapping layer for future hybrid architecture assessment.
 * This script does not invoke or replace the v3.1.1 recommendation engine.
 */

(function attachCloudShiftModernization(global) {
  const WORKLOAD_LABELS = Object.freeze({
    'web-portal': 'Web / Portal Application',
    'api-backend': 'API / Mobile Backend',
    'enterprise-app': 'Enterprise Business Application',
    'transactional-platform': 'E-Commerce / Transactional Platform',
    'data-analytics': 'Data & Analytics Platform',
    'ai-ml-platform': 'AI / ML Platform',
    'iot-event-platform': 'IoT / Event-Driven Platform',
    'media-streaming': 'Media / Streaming Platform'
  });

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

  function titleizeSignal(signal) {
    return String(signal || 'Unknown Workload')
      .split('-')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function buildOpportunity({
    workload,
    currentSignal,
    signalType,
    recommendedPlatform,
    recommendationType,
    rationale,
    effort,
    priority
  }) {
    return {
      workload,
      currentSignal,
      signalType,
      recommendedPlatform,
      recommendationType,
      rationale,
      effort,
      priority
    };
  }

  function mapWorkloadOpportunity(signal, context) {
    const workload = WORKLOAD_LABELS[signal] || titleizeSignal(signal);

    switch (signal) {
      case 'web-portal':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Cloud Run',
          recommendationType: 'Modernize',
          rationale: 'Web and portal workloads are strong candidates for Cloud Run when stateless and container-ready.',
          effort: 'Low',
          priority: 'High'
        });
      case 'api-backend':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Cloud Run',
          recommendationType: 'Modernize',
          rationale: 'API services can modernize to managed containers with request-driven autoscaling.',
          effort: 'Low',
          priority: 'High'
        });
      case 'enterprise-app':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Compute Engine',
          recommendationType: 'Assess',
          rationale: 'Core enterprise systems often need VM compatibility, licensing validation, and staged modernization.',
          effort: 'Medium',
          priority: 'Medium'
        });
      case 'data-analytics':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'BigQuery',
          recommendationType: 'Modernize',
          rationale: 'Analytical workloads are strong candidates for BigQuery-based warehouse modernization.',
          effort: 'Medium',
          priority: 'High'
        });
      case 'ai-ml-platform':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'BigQuery + Cloud Storage',
          recommendationType: 'Modernize',
          rationale: 'AI and ML workloads benefit from managed analytical datasets plus model and artifact storage.',
          effort: 'Medium',
          priority: 'Medium'
        });
      case 'transactional-platform':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Cloud Run + Cloud CDN',
          recommendationType: 'Modernize',
          rationale: 'E-commerce front ends and APIs can use Cloud Run while cacheable assets are accelerated through Cloud CDN.',
          effort: 'Medium',
          priority: 'High'
        });
      case 'iot-event-platform':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Pub/Sub + Cloud Run',
          recommendationType: 'Modernize',
          rationale: 'IoT event ingestion aligns to asynchronous messaging with Cloud Run consumers for lightweight processing.',
          effort: 'Medium',
          priority: 'Medium'
        });
      case 'media-streaming':
        return buildOpportunity({
          workload,
          currentSignal: signal,
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Cloud Storage + Cloud CDN',
          recommendationType: 'Modernize',
          rationale: 'Media, static, and learning content can be stored in Cloud Storage and accelerated with Cloud CDN.',
          effort: 'Low',
          priority: 'High'
        });
      default:
        return buildOpportunity({
          workload,
          currentSignal: signal || 'unknown',
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Assessment Required',
          recommendationType: 'Assess',
          rationale: 'No specific modernization rule is defined for this workload yet; retain a neutral assessment recommendation.',
          effort: 'Unknown',
          priority: 'Low'
        });
    }
  }

  function buildCharacteristicOpportunities(characteristics) {
    const hasCharacteristic = value => characteristics.includes(value);
    const opportunities = [];

    if (hasCharacteristic('stateless')) {
      opportunities.push(buildOpportunity({
        workload: 'Stateless Runtime Pattern',
        currentSignal: 'stateless',
        signalType: 'Characteristic Signal',
        recommendedPlatform: hasCharacteristic('microservices') ? 'GKE or Cloud Run' : 'Cloud Run',
        recommendationType: 'Modernize',
        rationale: hasCharacteristic('microservices')
          ? 'Stateless multi-service workloads may justify orchestration when service ownership and deployment complexity require it.'
          : 'Stateless workloads can modernize to Cloud Run with low operational overhead.',
        effort: hasCharacteristic('microservices') ? 'Medium' : 'Low',
        priority: 'High'
      }));
    }

    if (hasCharacteristic('microservices')) {
      opportunities.push(buildOpportunity({
        workload: 'Microservices Platform',
        currentSignal: 'microservices',
        signalType: 'Characteristic Signal',
        recommendedPlatform: 'GKE',
        recommendationType: 'Assess',
        rationale: 'Microservices may justify GKE when orchestration, service isolation, and release governance are confirmed during discovery.',
        effort: 'Medium',
        priority: 'Medium'
      }));
    }

    if (hasCharacteristic('batch')) {
      opportunities.push(buildOpportunity({
        workload: 'Batch Processing',
        currentSignal: 'batch',
        signalType: 'Characteristic Signal',
        recommendedPlatform: 'Cloud Run Jobs',
        recommendationType: 'Modernize',
        rationale: 'Batch tasks can be assessed for Cloud Run Jobs, Dataflow, or scheduled compute depending on runtime and data movement patterns.',
        effort: 'Medium',
        priority: 'Medium'
      }));
    }

    if (hasCharacteristic('public-facing')) {
      opportunities.push(buildOpportunity({
        workload: 'Public-Facing Entry Point',
        currentSignal: 'public-facing',
        signalType: 'Characteristic Signal',
        recommendedPlatform: 'Cloud CDN + Cloud Armor',
        recommendationType: 'Enhance',
        rationale: 'Public-facing workloads should be assessed for edge caching and application-layer protection.',
        effort: 'Low',
        priority: 'Medium'
      }));
    }

    if (hasCharacteristic('internal-only')) {
      opportunities.push(buildOpportunity({
        workload: 'Internal Access Path',
        currentSignal: 'internal-only',
        signalType: 'Characteristic Signal',
        recommendedPlatform: 'Identity-aware access controls',
        recommendationType: 'Enhance',
        rationale: 'Internal access signals should be assessed for identity-aware access and private connectivity patterns.',
        effort: 'Medium',
        priority: 'Medium'
      }));
    }

    return opportunities;
  }

  function summarizeOpportunities(opportunities) {
    return {
      totalOpportunities: opportunities.length,
      quickWins: opportunities.filter(item => item.effort === 'Low' && item.priority === 'High').length,
      modernizationCandidates: opportunities.filter(item => item.recommendationType === 'Modernize').length,
      retainOnVm: opportunities.filter(item => item.recommendedPlatform.includes('Compute Engine') || item.recommendationType.includes('Retain')).length,
      workloadOpportunities: opportunities.filter(item => item.signalType === 'Workload Opportunity').length,
      characteristicSignals: opportunities.filter(item => item.signalType === 'Characteristic Signal').length
    };
  }

  function hasUniqueCharacteristicRationale(characteristicOpportunity, workloadOpportunities) {
    if (characteristicOpportunity.signalType !== 'Characteristic Signal') return true;
    if (!characteristicOpportunity.recommendedPlatform.includes('Cloud Run')) return true;
    const hasCloudRunWorkloadModernization = workloadOpportunities.some(item =>
      item.signalType === 'Workload Opportunity'
      && item.recommendedPlatform.includes('Cloud Run')
      && item.recommendationType === 'Modernize'
    );
    if (!hasCloudRunWorkloadModernization) return true;
    return /GKE|Jobs|batch|orchestration|multi-service|scheduled/i.test(characteristicOpportunity.rationale)
      || /GKE|Jobs/i.test(characteristicOpportunity.recommendedPlatform);
  }

  function generateModernizationOpportunities(inputs = {}) {
    const workloads = normalizeWorkloadProfiles(inputs.workloads);
    const characteristics = normalizeCharacteristicProfiles(inputs.characteristics, workloads);
    const hasCharacteristic = value => characteristics.includes(value);
    const reasoning = [];

    const workloadOpportunities = workloads.length > 0
      ? workloads.map(signal => mapWorkloadOpportunity(signal, { hasCharacteristic }))
      : [buildOpportunity({
          workload: 'Application Landscape',
          currentSignal: 'none',
          signalType: 'Workload Opportunity',
          recommendedPlatform: 'Assessment Required',
          recommendationType: 'Assess',
          rationale: 'No workload profiles were provided, so modernization opportunities require discovery input.',
          effort: 'Unknown',
          priority: 'Low'
        })];

    const characteristicOpportunities = buildCharacteristicOpportunities(characteristics);
    const filteredCharacteristicOpportunities = characteristicOpportunities.filter(item =>
      hasUniqueCharacteristicRationale(item, workloadOpportunities)
    );
    const opportunities = workloadOpportunities.concat(filteredCharacteristicOpportunities);

    opportunities.forEach(item => {
      reasoning.push({
        signal: item.currentSignal,
        signalType: item.signalType,
        recommendedPlatform: item.recommendedPlatform,
        reason: item.rationale
      });
    });

    return {
      opportunities,
      summary: summarizeOpportunities(opportunities),
      reasoning
    };
  }

  function debugModernizationOpportunities(inputs = {}) {
    const result = generateModernizationOpportunities(inputs);
    if (global.console && typeof global.console.table === 'function') {
      global.console.table(result.opportunities);
      global.console.debug('CloudShift Modernization summary:', result.summary);
      global.console.debug('CloudShift Modernization reasoning:', result.reasoning);
    } else if (global.console && typeof global.console.debug === 'function') {
      global.console.debug('CloudShift Modernization result:', result);
    }
    return result;
  }

  const api = Object.freeze({
    generateModernizationOpportunities,
    debugModernizationOpportunities
  });

  global.CloudShiftModernization = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
