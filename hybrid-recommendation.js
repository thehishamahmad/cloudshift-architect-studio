/**
 * CloudShift Architect Studio - Hybrid Recommendation Model (v3.2 Stage 5)
 *
 * Internal bridge model between the v3.1.1 single-platform recommendation and
 * v3.2 hybrid platform strategy. This file is safe to call in parallel and does
 * not mutate or replace generateRecommendation().
 */

(function attachCloudShiftHybridRecommendation(global) {
  const APP_PLATFORMS = Object.freeze(['Cloud Run', 'GKE', 'Compute Engine']);

  function getPlatformScore(platformScores, platform) {
    return Math.max(0, Number(platformScores?.[platform]) || 0);
  }

  function sortedScores(platformScores = {}) {
    return Object.entries(platformScores)
      .map(([platform, score]) => ({ platform, score: Math.max(0, Number(score) || 0) }))
      .sort((a, b) => b.score - a.score);
  }

  function uniqueList(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function normalizeWorkloadProfiles(value) {
    const normalizer = global.CloudShiftWorkloadProfiles?.normalize;
    if (typeof normalizer === 'function') return normalizer(value);
    return uniqueList(Array.isArray(value) ? value : []);
  }

  function isSegmentedArchitecture(inputs = {}) {
    const workloads = normalizeWorkloadProfiles(inputs.workloads);
    const mixedSignals = ['web-portal', 'api-backend', 'enterprise-app', 'transactional-platform', 'data-analytics']
      .filter(workload => workloads.includes(workload));
    return workloads.length >= 3 || mixedSignals.length >= 3;
  }

  function buildLegacyRecommendationSnapshot(baseRecommendation) {
    if (!baseRecommendation) return null;
    return {
      projectName: baseRecommendation.projectName || '',
      platform: baseRecommendation.workloadSizing?.platform || '',
      tier: baseRecommendation.workloadSizing?.tier || '',
      architecturePattern: baseRecommendation.execSummary?.pattern || '',
      serviceCount: Array.isArray(baseRecommendation.services) ? baseRecommendation.services.length : 0,
      mermaidAvailable: typeof baseRecommendation.mermaid === 'string' && baseRecommendation.mermaid.trim().length > 0
    };
  }

  function buildFallbackModel(inputs, baseRecommendation) {
    const legacyPlatform = baseRecommendation?.workloadSizing?.platform || baseRecommendation?.services?.find?.(service => service.category === 'Compute')?.name || 'Assessment Required';
    return {
      architectureProfile: legacyPlatform === 'Assessment Required' ? 'Assessment Required' : `${legacyPlatform} Recommendation`,
      primaryPlatform: legacyPlatform,
      supportingPlatforms: [],
      primaryReason: 'Hybrid strategy engines are unavailable, so the model is preserving the existing single-platform recommendation.',
      supportingReason: 'No supporting platform strategy was calculated.',
      platformScores: {},
      modernizationSummary: {},
      recommendationMode: 'Single Platform Compatible',
      confidence: inputs && Object.keys(inputs).length > 0 ? 'Medium' : 'Low',
      legacyRecommendation: buildLegacyRecommendationSnapshot(baseRecommendation)
    };
  }

  function buildArchitectureProfile(primaryPlatform, platformScores) {
    const computeEngineScore = getPlatformScore(platformScores, 'Compute Engine');
    const cloudRunScore = getPlatformScore(platformScores, 'Cloud Run');
    const gkeScore = getPlatformScore(platformScores, 'GKE');
    const bigQueryScore = getPlatformScore(platformScores, 'BigQuery');
    const hasAppPlatform = APP_PLATFORMS.some(platform => getPlatformScore(platformScores, platform) > 0);

    let profile = `${primaryPlatform} Strategy`;
    if (computeEngineScore > 0 && cloudRunScore > 0) {
      profile = 'Hybrid VM + Serverless';
    } else if (computeEngineScore > 0 && gkeScore > 0) {
      profile = 'Hybrid VM + Kubernetes';
    } else if (primaryPlatform === 'Cloud Run' && computeEngineScore === 0) {
      profile = 'Serverless Application Platform';
    } else if (primaryPlatform === 'GKE' && computeEngineScore === 0) {
      profile = 'Kubernetes Application Platform';
    } else if (primaryPlatform === 'Compute Engine' && cloudRunScore === 0 && gkeScore === 0) {
      profile = 'VM-Based Rehost / Retain';
    }

    if (bigQueryScore > 0 && hasAppPlatform) {
      profile += ' + Data & Analytics Modernization';
    }

    return profile;
  }

  function buildConfidence(platformScores, inputs) {
    const ranked = sortedScores(platformScores).filter(item => item.score > 0);
    if (ranked.length === 0) return 'Low';
    const workloadCount = Array.isArray(inputs?.workloads) ? inputs.workloads.length : 0;
    const characteristicCount = Array.isArray(inputs?.characteristics) ? inputs.characteristics.length : 0;
    if (workloadCount === 0 && characteristicCount === 0) return 'Low';

    const primaryScore = ranked[0].score;
    const secondaryScore = ranked[1]?.score || 0;
    if (primaryScore < 10) return 'Low';
    if (primaryScore - secondaryScore > 15) return 'High';
    if (primaryScore - secondaryScore <= 10) return 'Medium';
    return 'Medium';
  }

  function buildPrimaryReason(primaryPlatform, affinityResult, baseRecommendation) {
    const primaryReasons = Array.isArray(affinityResult.reasoning)
      ? affinityResult.reasoning.filter(item => item.platform === primaryPlatform).slice(0, 2).map(item => item.reason)
      : [];
    if (primaryReasons.length > 0) return primaryReasons.join(' ');
    if (baseRecommendation?.workloadSizing?.justification) return baseRecommendation.workloadSizing.justification;
    return `${primaryPlatform} has the strongest affinity based on the selected workload and characteristic signals.`;
  }

  function buildSupportingReason(supportingPlatforms, modernizationResult) {
    const modernizationSummary = modernizationResult?.summary || {};
    if (supportingPlatforms.length === 0) {
      return modernizationSummary.totalOpportunities > 0
        ? 'Modernization opportunities exist, but no additional platform scored strongly enough to be listed as supporting.'
        : 'No supporting platform opportunities were identified from the selected inputs.';
    }

    const modernizationCount = modernizationSummary.modernizationCandidates || 0;
    const retainCount = modernizationSummary.retainOnVm || 0;
    const modernizationText = modernizationCount > 0
      ? `${modernizationCount} modernization candidate${modernizationCount === 1 ? '' : 's'}`
      : 'modernization opportunities';
    const retainText = retainCount > 0
      ? ` and ${retainCount} retain/rehost signal${retainCount === 1 ? '' : 's'}`
      : '';
    return `Supporting platforms (${supportingPlatforms.join(', ')}) align to ${modernizationText}${retainText} across the selected application landscape.`;
  }

  function buildHybridRecommendation(inputs = {}, baseRecommendation = null) {
    const calculateAffinity = global.CloudShiftPlatformAffinity?.calculatePlatformAffinity;
    const generateModernization = global.CloudShiftModernization?.generateModernizationOpportunities;

    if (typeof calculateAffinity !== 'function' || typeof generateModernization !== 'function') {
      return buildFallbackModel(inputs, baseRecommendation);
    }

    let affinityResult;
    let modernizationResult;
    try {
      affinityResult = calculateAffinity(inputs || {});
      modernizationResult = generateModernization(inputs || {});
    } catch (error) {
      return buildFallbackModel(inputs, baseRecommendation);
    }

    const platformScores = affinityResult.platformScores || {};
    const primaryPlatform = affinityResult.primaryPlatform || baseRecommendation?.workloadSizing?.platform || 'Assessment Required';
    const supportingPlatforms = uniqueList(affinityResult.supportingPlatforms)
      .filter(platform => getPlatformScore(platformScores, platform) > 0);
    const hasHybridSignals = supportingPlatforms.length > 0;

    const segmented = isSegmentedArchitecture(inputs);
    const segmentedSupportingPlatforms = uniqueList([
      ...supportingPlatforms,
      ...(['Cloud Run', 'Compute Engine', 'BigQuery', 'Cloud Storage'].filter(platform => getPlatformScore(platformScores, platform) > 0))
    ]).filter(platform => platform !== primaryPlatform || segmented);

    return {
      architectureProfile: segmented ? 'Hybrid Segmented Architecture' : buildArchitectureProfile(primaryPlatform, platformScores),
      primaryPlatform: segmented ? 'Hybrid segmented sizing' : primaryPlatform,
      supportingPlatforms: segmented ? segmentedSupportingPlatforms : supportingPlatforms,
      primaryReason: segmented
        ? 'The selected application landscape contains multiple workload categories, so sizing is segmented by workload lane instead of forcing one runtime platform across the estate.'
        : buildPrimaryReason(primaryPlatform, affinityResult, baseRecommendation),
      supportingReason: segmented
        ? 'Web, API, enterprise, transactional, and analytics workloads are sized independently so each lane can use the platform pattern that best fits its operating model.'
        : buildSupportingReason(supportingPlatforms, modernizationResult),
      platformScores,
      modernizationSummary: modernizationResult.summary || {},
      recommendationMode: segmented ? 'Hybrid Segmented' : hasHybridSignals ? 'Hybrid' : 'Single Platform Compatible',
      confidence: buildConfidence(platformScores, inputs),
      segmentedArchitecture: segmented,
      legacyRecommendation: buildLegacyRecommendationSnapshot(baseRecommendation)
    };
  }

  const api = Object.freeze({
    buildHybridRecommendation
  });

  global.CloudShiftHybridRecommendation = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
