/**
 * CloudShift Architect Studio - Heuristics Rules Engine (Version 3.1.1)
 * Fully rules-driven combinatorics engine mapping customer challenges, workload profiles,
 * characteristics, traffic parameters, recovery tiers, sizing tiers, and retention rules to Google Cloud assessments.
 */

const DEFAULT_DEPLOYMENT_REGION = Object.freeze({
  id: 'asia-southeast1',
  name: 'Singapore',
  label: 'Singapore (asia-southeast1)'
});

function buildWorkloadSizing({ workloads, characteristics, expectedUsers, peakConcurrencyOverride, recoveryTier, trafficPattern }) {
  const normalizedExpectedUsers = Math.max(0, Number(expectedUsers) || 0);
  const hasLegacyVMDependency = characteristics.includes('legacy-vm-dependency');
  const isLegacyOrVM = characteristics.includes('legacy') || characteristics.includes('vm-based');
  const isKubernetesRequired = characteristics.includes('kubernetes-required');
  const isMicroservices = characteristics.includes('microservices');
  const isStateful = characteristics.includes('stateful');
  const isContainerized = characteristics.includes('containerized');
  const isStateless = characteristics.includes('stateless');
  const isEventDriven = characteristics.includes('event-driven');
  const isApiWorkload = workloads.includes('api-services') || trafficPattern === 'api';

  const sizingTiers = ['Small', 'Medium', 'Large', 'Enterprise'];
  let tierIndex = 0;
  if (normalizedExpectedUsers >= 100000) tierIndex = 3;
  else if (normalizedExpectedUsers >= 10000) tierIndex = 2;
  else if (normalizedExpectedUsers >= 1000) tierIndex = 1;

  const isTrafficIntensive = ['api', 'video'].includes(trafficPattern) || characteristics.includes('realtime');
  const parsedPeakOverride = peakConcurrencyOverride === null || peakConcurrencyOverride === undefined || peakConcurrencyOverride === ''
    ? Number.NaN
    : Number(peakConcurrencyOverride);
  const hasPeakOverride = Number.isFinite(parsedPeakOverride) && parsedPeakOverride >= 0;
  const autoPeakConcurrency = Math.ceil(normalizedExpectedUsers * (isTrafficIntensive ? 0.05 : 0.02));
  const peakConcurrencyEstimate = hasPeakOverride ? Math.floor(parsedPeakOverride) : autoPeakConcurrency;
  const peakConcurrencySource = hasPeakOverride ? 'Manual override' : 'Conservative auto-estimate from MAU';
  let peakTierIndex = 0;
  if (peakConcurrencyEstimate >= 2500) peakTierIndex = 3;
  else if (peakConcurrencyEstimate >= 500) peakTierIndex = 2;
  else if (peakConcurrencyEstimate >= 20) peakTierIndex = 1;
  tierIndex = Math.max(tierIndex, peakTierIndex);
  if (hasLegacyVMDependency || isKubernetesRequired || isMicroservices) tierIndex = Math.max(tierIndex, 1);
  const tier = sizingTiers[tierIndex];

  let platform = 'Cloud Run';
  let justification = 'Managed serverless compute is the best presales fit for a workload without VM or Kubernetes dependencies.';

  if (hasLegacyVMDependency) {
    platform = 'Compute Engine';
    justification = 'An explicit Legacy VM Dependency requires Compute Engine to preserve the workload runtime, operating system, and VM-level dependencies.';
  } else if (isKubernetesRequired) {
    platform = 'GKE';
    justification = 'An explicit Kubernetes requirement needs cluster-level orchestration, scheduling, and workload controls.';
  } else if (isMicroservices) {
    platform = 'GKE';
    justification = 'A microservices or multi-service platform benefits from shared Kubernetes orchestration and independent service scaling.';
  } else if (isLegacyOrVM) {
    platform = 'Compute Engine';
    justification = 'Legacy or VM-dependent runtime requirements favor infrastructure-compatible Compute Engine instances.';
  } else if (isStateful && isContainerized) {
    platform = 'GKE';
    justification = 'The stateful container workload needs persistent workload orchestration and lifecycle controls provided by GKE.';
  } else if (isStateful) {
    platform = 'Compute Engine';
    justification = 'A stateful, non-container workload is better aligned to VM-based runtime and persistence controls.';
  } else if (isContainerized && (isStateless || isEventDriven || isApiWorkload)) {
    platform = 'Cloud Run';
    justification = 'The stateless, container-ready workload can use request-driven autoscaling with low operational overhead.';
  }

  let architectureService = '';
  let architectureRationale = '';
  let guidance = [];

  if (platform === 'Cloud Run') {
    const cpuTiers = ['1 vCPU', '2 vCPU', '4 vCPU', '8 vCPU'];
    const memoryTiers = ['512 MiB - 1 GiB', '2 - 4 GiB', '4 - 8 GiB', '16 - 32 GiB'];
    const maxInstances = ['10', '25', '75', '200'];
    const concurrency = trafficPattern === 'api' || characteristics.includes('realtime') ? '40 requests per instance' : '80 requests per instance';
    const minInstances = recoveryTier === 'tier-1' ? `2 minimum instances in ${DEFAULT_DEPLOYMENT_REGION.name}` : recoveryTier === 'tier-2' ? '2' : tier === 'Small' ? '0' : '1';
    architectureService = 'Cloud Run';
    architectureRationale = `${justification} The ${tier.toLowerCase()} sizing tier uses managed instance autoscaling without cluster administration.`;
    guidance = [
      { label: 'Recommended vCPU Tier', value: cpuTiers[tierIndex] },
      { label: 'Recommended Memory Tier', value: memoryTiers[tierIndex] },
      { label: 'Min Instances', value: minInstances },
      { label: 'Max Instances', value: maxInstances[tierIndex] },
      { label: 'Concurrency Recommendation', value: concurrency },
      { label: 'Autoscaling Recommendation', value: 'Scale on request concurrency, with maximum-instance guardrails and load-test validation.' }
    ];
  } else if (platform === 'GKE') {
    const nodeTiers = ['e2-standard-4', 'e2-standard-8', 'n2-standard-8', 'n2-standard-16'];
    const minNodes = recoveryTier === 'tier-1' ? `3 across ${DEFAULT_DEPLOYMENT_REGION.name} zones` : recoveryTier === 'tier-2' ? '3' : ['2', '2', '3', '4'][tierIndex];
    const maxNodes = ['4', '8', '15', '30'];
    architectureService = 'GKE Standard (Autoscaling Cluster)';
    architectureRationale = `${justification} The ${tier.toLowerCase()} sizing tier uses autoscaling Standard node pools for predictable orchestration controls.`;
    guidance = [
      { label: 'Recommended Node Tier', value: nodeTiers[tierIndex] },
      { label: 'Node Pool Configuration', value: tierIndex >= 2 ? 'Dedicated system and application node pools across multiple zones' : 'Single autoscaling application node pool across multiple zones' },
      { label: 'Min Nodes', value: minNodes },
      { label: 'Max Nodes', value: maxNodes[tierIndex] },
      { label: 'Autoscaling Recommendation', value: 'Enable Cluster Autoscaler and Horizontal Pod Autoscaling; validate pod requests through load testing.' },
      { label: 'Kubernetes Justification', value: justification }
    ];
  } else {
    const vmTiers = ['e2-standard-2', 'n2-standard-4', 'n2-standard-8', 'n2-standard-16'];
    const profiles = ['2 vCPU / 8 GB RAM', '4 vCPU / 16 GB RAM', '8 vCPU / 32 GB RAM', '16 vCPU / 64 GB RAM'];
    const vmCounts = ['1-2 VMs', '2-3 VMs', '3-6 VMs', '6-12 VMs'];
    if (recoveryTier === 'tier-1') architectureService = 'Compute Engine (Regional Managed Instance Groups)';
    else if (hasLegacyVMDependency) architectureService = 'Compute Engine (Managed Instance Groups)';
    else if (recoveryTier === 'tier-2' || tierIndex >= 2) architectureService = 'Compute Engine (Managed Instance Groups)';
    else architectureService = 'Compute Engine (Single VM)';
    architectureRationale = `${justification} The ${tier.toLowerCase()} sizing tier preserves VM runtime compatibility while allowing staged validation.`;
    guidance = [
      { label: 'Recommended VM Tier', value: vmTiers[tierIndex] },
      { label: 'vCPU / RAM Profile', value: profiles[tierIndex] },
      { label: 'Recommended VM Count', value: recoveryTier === 'tier-1' ? `${vmCounts[tierIndex]} across ${DEFAULT_DEPLOYMENT_REGION.name} zones` : recoveryTier === 'tier-2' ? `${vmCounts[tierIndex]} across at least two ${DEFAULT_DEPLOYMENT_REGION.name} zones` : vmCounts[tierIndex] },
      { label: 'High Availability Recommendation', value: recoveryTier === 'tier-1' || recoveryTier === 'tier-2' ? `Regional managed instance group distributed across ${DEFAULT_DEPLOYMENT_REGION.name} zones` : 'Consider multi-zone deployment and regional load balancing when higher availability objectives are required.' },
      { label: 'Lift-and-Shift Considerations', value: 'Validate OS licensing, startup dependencies, disk performance, health checks, and session-state handling before migration.' }
    ];
  }

  guidance.unshift(
    { label: 'Primary Deployment Region', value: DEFAULT_DEPLOYMENT_REGION.label },
    { label: 'Peak Concurrency Estimate', value: `${peakConcurrencyEstimate.toLocaleString()} users (${peakConcurrencySource})` }
  );

  return {
    platform,
    tier,
    peakConcurrencyEstimate,
    peakConcurrencySource,
    justification,
    architectureService,
    architectureRationale,
    guidance
  };
}

function validateArchitectureConsistency({
  workloadSizing,
  services,
  execSummary,
  summary,
  recoveryDR,
  securityRecs,
  costRecs,
  assumptions,
  risks,
  activeNodes,
  securityDecisions
}) {
  const warnings = [];
  const warn = message => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const serviceNames = services.map(service => service.name);
  const computeService = services.find(service => service.category === 'Compute');
  const databaseService = services.find(service => service.category === 'Database');
  const recommendationText = [
    computeService?.name,
    computeService?.rationale,
    workloadSizing.justification,
    ...workloadSizing.guidance.flatMap(item => [item.label, item.value]),
    ...execSummary.benefits,
    summary,
    recoveryDR,
    ...securityRecs,
    ...costRecs,
    ...assumptions,
    ...risks
  ].filter(Boolean).join(' ');
  const computeNodeText = [activeNodes.Compute, activeNodes.ComputeA, activeNodes.ComputeB].filter(Boolean).join(' ');

  if (workloadSizing.platform === 'GKE' && /scale(?:s| down)?[- ]to[- ]zero|passive compute bills/i.test(recommendationText)) {
    warn('GKE Standard recommendation contains scale-to-zero language.');
  }
  if (databaseService?.name.includes('Firestore') && costRecs.some(item => /Cloud SQL|Scheduled Database Outage/i.test(item))) {
    warn('Firestore recommendation contains Cloud SQL shutdown guidance.');
  }
  if (workloadSizing.platform === 'Cloud Run' && /Managed Instance Group|\bMIG\b/i.test(recommendationText)) {
    warn('Cloud Run recommendation contains Managed Instance Group guidance.');
  }
  if (workloadSizing.platform === 'Compute Engine' && /Kubernetes autoscaler|Cluster Autoscaler|Horizontal Pod|node pool/i.test(recommendationText)) {
    warn('Compute Engine recommendation contains Kubernetes autoscaling or node-pool guidance.');
  }
  if (workloadSizing.platform === 'Compute Engine' && workloadSizing.guidance.some(item => /Node Pool|Min Nodes|Max Nodes|Kubernetes/i.test(item.label))) {
    warn('Compute Engine workload sizing contains GKE node-pool fields.');
  }
  if (workloadSizing.platform === 'Cloud Run' && workloadSizing.guidance.some(item => /VM Count|VM Tier|vCPU \/ RAM/i.test(item.label))) {
    warn('Cloud Run workload sizing contains VM sizing fields.');
  }

  const expectedComputeToken = workloadSizing.platform === 'GKE' ? 'GKE' : workloadSizing.platform;
  if (!computeService?.name.includes(expectedComputeToken)) warn('Selected compute service does not match workloadSizing.platform.');
  if (!computeNodeText.includes(expectedComputeToken)) warn('Recommended compute platform is missing from Mermaid topology.');
  for (const otherPlatform of ['Cloud Run', 'GKE', 'Compute Engine'].filter(item => item !== workloadSizing.platform)) {
    if (computeNodeText.includes(otherPlatform)) warn(`Mermaid topology contains unselected compute platform: ${otherPlatform}.`);
  }

  if (databaseService?.name.includes('Firestore') && !activeNodes.Database?.includes('Firestore')) warn('Firestore is missing from Mermaid topology.');
  if (databaseService?.name.includes('Cloud SQL') && !activeNodes.Database?.includes('Cloud SQL')) warn('Cloud SQL is missing from Mermaid topology.');
  if (databaseService?.name === 'Cloud Spanner' && !activeNodes.Database?.includes('Spanner')) warn('Cloud Spanner is missing from Mermaid topology.');
  if (databaseService?.name === 'BigQuery' && !activeNodes.BigQuery) warn('BigQuery is missing from Mermaid topology.');
  if (databaseService?.name === 'Vertex AI Vector Search' && !activeNodes.VectorDB) warn('Vertex AI Vector Search is missing from Mermaid topology.');
  if (!databaseService?.name.includes('Cloud SQL') && activeNodes.Database?.includes('Cloud SQL')) warn('Mermaid topology contains Cloud SQL without a Cloud SQL recommendation.');
  if (!databaseService?.name.includes('Firestore') && activeNodes.Database?.includes('Firestore')) warn('Mermaid topology contains Firestore without a Firestore recommendation.');

  if (Boolean(activeNodes.Armor) !== securityDecisions.cloudArmor) warn('Cloud Armor topology does not match the security decision.');
  if (Boolean(activeNodes.IAP) !== securityDecisions.identityAwareProxy) warn('IAP topology does not match the security decision.');
  if (Boolean(activeNodes.SecMgr) !== securityDecisions.secretManager) warn('Secret Manager topology does not match the security decision.');
  if (Boolean(activeNodes.Cache) !== serviceNames.some(name => name.includes('Memorystore'))) warn('Memorystore topology does not match recommended services.');
  if (Boolean(activeNodes.File) !== serviceNames.some(name => name.includes('Filestore'))) warn('Filestore topology does not match recommended services.');
  if (Boolean(activeNodes.Dataflow) !== serviceNames.some(name => name.includes('Dataflow'))) warn('Dataflow topology does not match recommended services.');
  if (Boolean(activeNodes.VertexAI) !== serviceNames.some(name => name.includes('Vertex AI Pipelines'))) warn('Vertex AI topology does not match recommended services.');
  if (activeNodes.NAT && !serviceNames.some(name => name.includes('Cloud NAT'))) warn('Mermaid topology contains Cloud NAT without a recommendation.');

  return warnings;
}

function generateRecommendation(inputs) {
  const {
    projectName,
    industry,
    users,
    budget,
    challenges = [],
    workloads = [],
    characteristics = [],
    accessPattern = 'public',
    trafficPattern = 'dynamic',
    expectedUsers = 50000,
    peakConcurrencyOverride = null,
    dataTransfer = 2500,
    recoveryTier = 'tier-2',
    dailyChangeRate = 5,
    retainDaily = 14,
    retainWeekly = 4,
    retainMonthly = 12,
    retainYearly = 1
  } = inputs;

  // 1. Resolve architectural parameters
  const isHighAvailability = ['tier-1', 'tier-2'].includes(recoveryTier);
  const normalizedExpectedUsers = Math.max(0, Number(expectedUsers) || 0);
  const normalizedDataTransfer = Math.max(0, Number(dataTransfer) || 0);
  const isLargeAudience = normalizedExpectedUsers >= 100000;
  const isHighTransfer = normalizedDataTransfer >= 10000;
  const isVeryHighTransfer = normalizedDataTransfer >= 50000;
  const isPublicSector = industry === 'Government' || industry === 'GLC';
  const isRegulatedIndustry = industry === 'Finance' || industry === 'Healthcare';
  const hasPublicSectorWorkload = workloads.includes('gov-portal') || workloads.includes('citizen-portal');
  const hasExplicitSecurityRequirement = challenges.includes('sec-compliance');
  const hasExplicitDataSensitivity = characteristics.includes('sensitive-data')
    || challenges.includes('sensitive-data')
    || characteristics.includes('regulated-data')
    || challenges.includes('regulated-data');
  const hasDataExfiltrationRisk = challenges.includes('data-exfiltration')
    || characteristics.includes('data-exfiltration')
    || challenges.includes('exfiltration-risk')
    || characteristics.includes('exfiltration-risk');
  const hasCredentialRequirement = characteristics.includes('sensitive-credentials')
    || challenges.includes('sensitive-credentials')
    || characteristics.includes('application-secrets')
    || challenges.includes('application-secrets')
    || characteristics.includes('api-key-management')
    || challenges.includes('api-key-management');
  const hasPaymentWorkload = workloads.includes('ecomm')
    || workloads.includes('payment-platform')
    || workloads.includes('payments')
    || characteristics.includes('payment-platform')
    || characteristics.includes('card-transactions')
    || characteristics.includes('payment-processing')
    || challenges.includes('payment-platform')
    || challenges.includes('card-transactions')
    || challenges.includes('payment-processing');
  const isHighSecurity = hasExplicitSecurityRequirement || challenges.includes('ddos-waf') || isRegulatedIndustry || isPublicSector;
  const isStrictSecurity = hasExplicitSecurityRequirement && (isRegulatedIndustry || isPublicSector);
  const recommendsCloudArmor = isHighSecurity || isStrictSecurity || hasPublicSectorWorkload;
  const tier1PublicSectorCitizenWorkload = recoveryTier === 'tier-1' && isPublicSector && hasPublicSectorWorkload;
  const shouldDeployAdvancedGovernmentControls = isPublicSector
    && hasPublicSectorWorkload
    && isHighAvailability
    && (hasExplicitSecurityRequirement || hasExplicitDataSensitivity);
  const recommendsCloudKms = hasExplicitSecurityRequirement
    || hasExplicitDataSensitivity
    || (isHighAvailability && isRegulatedIndustry)
    || tier1PublicSectorCitizenWorkload
    || shouldDeployAdvancedGovernmentControls;
  const recommendsVpcServiceControls = hasDataExfiltrationRisk
    || hasExplicitSecurityRequirement
    || shouldDeployAdvancedGovernmentControls
    || (isHighAvailability && hasExplicitDataSensitivity && (isPublicSector || isRegulatedIndustry));
  const isLowBudget = budget === 'low';
  const normalizedRetainMonthly = Math.max(0, Number(retainMonthly) || 0);
  const normalizedRetainYearly = Math.max(0, Number(retainYearly) || 0);
  
  // Workloads helper
  const workloadLabelsMap = {
    'web-app': 'Web Application',
    'mobile-backend': 'Mobile Backend',
    'api-services': 'API Services',
    'lms': 'LMS Platform',
    'erp': 'ERP System',
    'crm': 'CRM System',
    'dms': 'Document Management System',
    'gov-portal': 'Government Portal',
    'citizen-portal': industry === 'Education' ? 'Student Portal' : 'Citizen Portal',
    'ecomm': 'E-Commerce Platform',
    'analytics': 'Data Analytics Platform',
    'dwh': 'Data Warehouse',
    'ai-platform': 'AI Platform',
    'ml-platform': 'Machine Learning Platform',
    'iot': 'IoT Platform',
    'streaming': 'Media Streaming Platform',
    'dashboard': 'Internal Dashboard',
    'bi-platform': 'Business Intelligence Platform',
    'cms': 'Content Management System'
  };
  const activeWorkloads = workloads.map(w => workloadLabelsMap[w] || w);
  const workloadList = activeWorkloads.join(', ') || 'Web Application';

  const industryLabelsMap = {
    'Tech': 'Technology / SaaS',
    'Finance': 'Finance / Banking',
    'Healthcare': 'Healthcare / Life Sciences',
    'Retail': 'Retail / E-Commerce',
    'Gaming': 'Gaming / Entertainment',
    'Media': 'Media / Streaming',
    'Education': 'Education',
    'Government': 'Government',
    'GLC': 'GLC / Public Sector',
    'Manufacturing': 'Manufacturing',
    'Utilities': 'Utilities',
    'OilGas': 'Oil & Gas',
    'Telecommunications': 'Telecommunications',
    'Transportation': 'Transportation & Logistics',
    'Insurance': 'Insurance',
    'Property': 'Property & Construction'
  };
  const industryLabel = industryLabelsMap[industry] || 'Technology / SaaS';

  const scaleLabels = {
    'under-1k': '< 1,000 MAU',
    '1k-10k': '1,000 - 10,000 MAU',
    '10k-100k': '10,000 - 100,000 MAU',
    '100k-1m': '100,000 - 1M MAU',
    'over-1m': '1M+ MAU (Global scale)'
  };
  let scaleLabel = scaleLabels[users] || '10,000 - 100,000 MAU';
  if (normalizedExpectedUsers > 0) {
    if (normalizedExpectedUsers < 1000) scaleLabel = '< 1,000 MAU';
    else if (normalizedExpectedUsers < 10000) scaleLabel = '1,000 - 10,000 MAU';
    else if (normalizedExpectedUsers < 100000) scaleLabel = '10,000 - 100,000 MAU';
    else if (normalizedExpectedUsers < 1000000) scaleLabel = '100,000 - 1M MAU';
    else scaleLabel = '1M+ MAU (Global scale)';
  }

  const slaLabels = {
    'tier-1': '99.999% SLA (Tier 1 Mission Critical)',
    'tier-2': '99.99% SLA (Tier 2 Production Resilient)',
    'tier-3': '99.9% SLA (Tier 3 Standard Production)',
    'tier-4': '99.0% SLA (Tier 4 Cost Optimized)'
  };
  const slaLabel = slaLabels[recoveryTier] || '99.99% SLA (Tier 2 Production Resilient)';

  // 2. Rules-Driven Service Recommendations (PHASE 6 & 7)
  const services = [];

  // --- COMPUTE TIER ---
  const isLegacyOrVM = characteristics.includes('legacy-vm-dependency') || characteristics.includes('legacy') || characteristics.includes('vm-based');
  const workloadSizing = buildWorkloadSizing({ workloads, characteristics, expectedUsers, peakConcurrencyOverride, recoveryTier, trafficPattern });
  const hasApiIntegrations = workloads.includes('api-services') || trafficPattern === 'api';
  const complianceTierJustifiesRuntimeSecrets = isHighAvailability
    && (hasExplicitSecurityRequirement || hasExplicitDataSensitivity || isRegulatedIndustry || shouldDeployAdvancedGovernmentControls);
  const recommendsSecretManager = workloadSizing.platform !== 'Compute Engine'
    || hasCredentialRequirement
    || hasExplicitSecurityRequirement
    || (hasApiIntegrations && complianceTierJustifiesRuntimeSecrets);
  const isInternalOrAdminWorkload = accessPattern === 'internal'
    || characteristics.includes('internal-only')
    || workloads.includes('dashboard');
  const requiresRestrictedCorporateAccess = accessPattern === 'hybrid';
  const requiresZeroTrustAccess = characteristics.includes('zero-trust') || challenges.includes('zero-trust');
  const recommendsIAP = isInternalOrAdminWorkload
    || requiresRestrictedCorporateAccess
    || requiresZeroTrustAccess
    || hasExplicitSecurityRequirement;
  const securityDecisions = {
    cloudArmor: recommendsCloudArmor,
    secretManager: recommendsSecretManager,
    identityAwareProxy: recommendsIAP
  };
  const computeService = {
    category: 'Compute',
    name: workloadSizing.architectureService,
    rationale: workloadSizing.architectureRationale,
    icon: 'cpu'
  };
  services.push(computeService);

  // Special analytics compute
  if (workloads.includes('analytics') || workloads.includes('dwh')) {
    services.push({
      category: 'Compute',
      name: 'Dataflow',
      rationale: 'Serverless batch and streaming data processing pipeline. Handles ETL imports and dynamic aggregation workloads dynamically.',
      icon: 'cpu'
    });
  }

  // Special AI compute
  if (workloads.includes('ai-platform') || workloads.includes('ml-platform') || characteristics.includes('ai-enabled')) {
    services.push({
      category: 'Compute',
      name: 'Vertex AI Pipelines',
      rationale: 'MLOps workflow coordinator. Automates machine learning model retraining, evaluating metrics, and registry cataloging.',
      icon: 'cpu'
    });
  }

  // --- DATABASE TIER ---
  let dbService = { category: 'Database', name: '', rationale: '', icon: 'database' };
  const isRelational = workloads.includes('erp') || workloads.includes('crm') || workloads.includes('gov-portal') || workloads.includes('citizen-portal') || workloads.includes('ecomm');
  
  if (workloads.includes('dwh') || workloads.includes('analytics')) {
    dbService.name = 'BigQuery';
    dbService.rationale = 'Serverless, highly scalable analytical data warehouse. Executes SQL queries on petabytes in seconds, separating compute and storage bills.';
  } else if (workloads.includes('ai-platform') || workloads.includes('ml-platform')) {
    dbService.name = 'Vertex AI Vector Search';
    dbService.rationale = 'High-performance vector similarity search engine, enabling real-time semantic matches and context injection for RAG models.';
  } else if (isRelational || industry === 'Finance') {
    if (isHighAvailability) {
      dbService.name = 'Cloud SQL for PostgreSQL (HA)';
      dbService.rationale = `Managed relational database with synchronous replication to a standby zone within ${DEFAULT_DEPLOYMENT_REGION.id}.`;
    } else {
      dbService.name = 'Cloud SQL for PostgreSQL (Single Zone)';
      dbService.rationale = 'Cost-optimized PostgreSQL instance. Provides automated backups and patches, suitable for basic transactional workloads.';
    }
  } else {
    // NoSQL defaults
    if (isLowBudget) {
      dbService.name = 'Cloud Firestore';
      dbService.rationale = 'Serverless NoSQL database. Offers automatic scaling, visual document schemas, and offline client SDK synchronization.';
    } else {
      dbService.name = isHighAvailability ? 'Cloud SQL for PostgreSQL (HA)' : 'Cloud SQL for PostgreSQL';
      dbService.rationale = isHighAvailability 
        ? 'Relational PostgreSQL with secondary zone synchronous replicas to guard transaction records against single datacenter failovers.' 
        : 'Standard relational instance with point-in-time recovery to maintain baseline databases.';
    }
  }
  services.push(dbService);

  // Add Memorystore for caching if Performance Bottleneck challenge is selected
  if (challenges.includes('perf-bottleneck')) {
    services.push({
      category: 'Database',
      name: 'Memorystore for Redis',
      rationale: 'In-memory caching layer. Dramatically reduces database reads and improves page-load times for static application components.',
      icon: 'database'
    });
  }

  // --- STORAGE TIER ---
  let storageService = { category: 'Storage', name: '', rationale: '', icon: 'hard-drive' };
  
  if (workloads.includes('streaming') || workloads.includes('lms') || isHighTransfer) {
    storageService.name = 'Cloud Storage (Regional Standard)';
    storageService.rationale = `Uses Standard-class storage in ${DEFAULT_DEPLOYMENT_REGION.id} for frequently accessed content of approximately ${normalizedDataTransfer.toLocaleString()} GB/month.`;
  } else if (normalizedDataTransfer < 500) {
    storageService.name = 'Cloud Storage (Regional Autoclass)';
    storageService.rationale = 'A regional bucket with Autoclass can move infrequently accessed objects to lower-cost storage classes for this low-transfer profile.';
  } else {
    storageService.name = 'Cloud Storage (Regional Standard)';
    storageService.rationale = `Standard-class regional storage supports active production objects within ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  }
  services.push(storageService);

  if (characteristics.includes('stateful') && workloadSizing.platform === 'Compute Engine') {
    services.push({
      category: 'Storage',
      name: 'Filestore',
      rationale: 'Fully managed network attached storage (NAS) providing shared NFS mount volumes for stateful VM clusters.',
      icon: 'hard-drive'
    });
  }

  // --- NETWORKING TIER ---
  let netService = { category: 'Networking', name: '', rationale: '', icon: 'globe' };
  const isHybridAccess = accessPattern === 'hybrid';
  const isInternalOnly = accessPattern === 'internal';

  const shouldUseCdn = !isInternalOnly && (isHighTransfer || workloads.includes('streaming') || trafficPattern === 'video' || trafficPattern === 'static' || trafficPattern === 'mixed');

  if (isInternalOnly) {
    netService.name = 'Private Service Connect & Cloud VPN';
    netService.rationale = `Enables secure corporate access to cloud APIs and compute nodes deployed in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  } else if (shouldUseCdn) {
    netService.name = 'Global HTTPS Load Balancer & Cloud CDN';
    netService.rationale = `Routes global requests to healthy compute and caches eligible content at the edge, reducing origin load and transfer cost for ${normalizedDataTransfer.toLocaleString()} GB/month.`;
  } else if (recommendsCloudArmor || challenges.includes('ddos-waf') || isHighAvailability) {
    netService.name = 'Global HTTPS Load Balancer';
    netService.rationale = `Edge routing proxy with unified SSL termination for zonal compute backends in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  } else {
    netService.name = 'Regional HTTPS Load Balancer';
    netService.rationale = `Balances application traffic across container groups or VMs in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  }
  services.push(netService);
  const recommendsCloudCdn = netService.name.includes('Cloud CDN');

  if (isHybridAccess || challenges.includes('hybrid-conn')) {
    services.push({
      category: 'Networking',
      name: 'Cloud VPN / Interconnect',
      rationale: 'Configures secure enterprise connectivity linking VPC networks back to corporate environments via IPsec or Dedicated Fiber links.',
      icon: 'globe'
    });
  }

  // --- SECURITY TIER ---
  if (securityDecisions.cloudArmor) {
    services.push({
      category: 'Security',
      name: 'Cloud Armor WAF',
      rationale: 'Cloud Armor filters Layer 7 attacks and DDoS waves before requests reach application backends.',
      icon: 'shield'
    });
  }

  if (recommendsVpcServiceControls) {
    const vpcServiceControlsRationale = shouldDeployAdvancedGovernmentControls
      ? 'Creates managed API boundaries for regulated citizen data workloads where sensitivity and recovery tier justify stronger exfiltration controls.'
      : 'Creates secure boundaries around managed service APIs to reduce data exfiltration risk.';
    services.push({
      category: 'Security',
      name: 'VPC Service Controls',
      rationale: vpcServiceControlsRationale,
      icon: 'shield'
    });
  }

  if (recommendsCloudKms) {
    const cloudKmsRationale = tier1PublicSectorCitizenWorkload
      ? 'Encrypts mission-critical citizen-facing data with customer-managed keys to align with Tier 1 public-sector recovery and governance expectations.'
      : 'Encrypts regulated databases, disks, and storage blocks with customer-managed keys.';
    services.push({
      category: 'Security',
      name: 'Cloud KMS (CMEK)',
      rationale: cloudKmsRationale,
      icon: 'shield'
    });
  }

  if (securityDecisions.secretManager) {
    services.push({
      category: 'Security',
      name: 'Secret Manager',
      rationale: 'Provides controlled runtime access to application credentials and API keys.',
      icon: 'shield'
    });
  }

  if (securityDecisions.identityAwareProxy) {
    services.push({
      category: 'Security',
      name: 'Identity-Aware Proxy (IAP)',
      rationale: 'Restricts internal, corporate, or zero-trust application access through identity and context-aware policies.',
      icon: 'shield'
    });
  }

  if (!securityDecisions.cloudArmor && !recommendsVpcServiceControls && !recommendsCloudKms && !securityDecisions.secretManager && !securityDecisions.identityAwareProxy) {
    services.push({
      category: 'Security',
      name: 'IAM Roles & Service Accounts',
      rationale: 'Enforces baseline authentication and limits program credentials to minimum access roles.',
      icon: 'shield'
    });
  }

  services.forEach(service => {
    if (!service.rationale.includes(DEFAULT_DEPLOYMENT_REGION.id)) {
      service.rationale += ` Primary deployment region: ${DEFAULT_DEPLOYMENT_REGION.label}.`;
    }
  });

  // 3. Generate Executive Summary (PHASE 7)
  let businessOutcome = `Establish a secure, resilient, and optimized Google Cloud architecture blueprint for the **${projectName}** platform. `;
  businessOutcome += `By integrating workloads (${workloadList}) under an industry sector aligned to ${industryLabel}, the platform is engineered to support up to ${scaleLabel} in ${DEFAULT_DEPLOYMENT_REGION.label} while aligning with the selected availability and recovery objectives.`;

  let pattern = '';
  if (workloads.includes('analytics') || workloads.includes('dwh')) {
    pattern = 'Serverless Data Ingestion Lake with Dataflow pipeline and BigQuery analytics';
  } else {
    pattern = `${computeService.name} with ${dbService.name}, ${netService.name}, and ${storageService.name}.`;
  }

  const benefits = [];
  if (workloadSizing.platform === 'Cloud Run' && isLowBudget) {
    benefits.push('Cost Optimization: Resource runtimes scale down to zero when idle, eliminating passive compute bills.');
  } else if (workloadSizing.platform === 'GKE') {
    benefits.push('Controlled Elasticity: GKE Standard keeps minimum node capacity provisioned while pod and node autoscaling add capacity above that baseline.');
  } else if (workloadSizing.platform === 'Compute Engine') {
    benefits.push('Predictable Capacity: Managed VM capacity provides a stable runtime baseline with autoscaling available above the minimum instance count.');
  } else {
    benefits.push('High Resilience: Multi-zone redundancy ensures continuous user session operations during zone outages.');
  }

  if (challenges.includes('legacy-mod') && workloadSizing.platform === 'Compute Engine') {
    benefits.push('Migration Alignment: Supports VM-based workloads with MIG scaling rules, accelerating time-to-market.');
  } else if (workloadSizing.platform === 'Compute Engine') {
    benefits.push('Runtime Compatibility: Preserves VM-level operating system and application dependencies while enabling managed scaling controls.');
  } else if (workloadSizing.platform === 'GKE') {
    benefits.push('Modernization: Uses managed Kubernetes clusters to standardize container orchestration and reduce direct OS management.');
  } else {
    benefits.push('Modernization: Uses managed serverless containers to eliminate cluster and operating-system administration.');
  }

  if (securityDecisions.cloudArmor && recommendsCloudKms) {
    benefits.push('Compliance Controls: Restricts network entry points via Cloud Armor and protects regulated data with Cloud KMS customer-managed keys.');
  } else if (securityDecisions.cloudArmor) {
    benefits.push('WAF Protection: Restricts network entry points through Cloud Armor filtering and rate-limiting controls.');
  } else if (recommendsCloudKms) {
    benefits.push('Encryption Control: Protects regulated data with Cloud KMS customer-managed keys.');
  }

  if (challenges.includes('perf-bottleneck')) {
    benefits.push(recommendsCloudCdn
      ? 'Performance Acceleration: Integrated caching and Cloud CDN configurations reduce origin and database query pressure.'
      : 'Performance Acceleration: Managed caching reduces repeated database reads without adding an edge caching dependency.');
  }

  const execSummary = {
    businessOutcome,
    scale: scaleLabel,
    availabilityTarget: slaLabel,
    pattern,
    benefits
  };

  // 4. Generate Architecture Summary
  let summary = `This rules-driven architecture is tailored for **${projectName}**, aligned to **${industryLabel}** sector compliance. `;
  summary += `The primary deployment region is **${DEFAULT_DEPLOYMENT_REGION.label}**. It coordinates inputs from workload profile (${workloadList}) and characteristics (${characteristics.join(', ') || 'Stateless, Containerized'}). `;
  
  if (workloads.includes('analytics') || workloads.includes('dwh')) {
    summary += `Pipes ingestion data streams directly into Cloud Storage, parsing events via Dataflow pipelines. Results are loaded into BigQuery for sub-second business intelligence dashboards.`;
  } else {
    summary += `The application tier uses ${computeService.name}. The data layer uses ${dbService.name}, object data uses ${storageService.name}, and ingress is provided by ${netService.name}.`;
  }

  // Industry-specific summaries
  if (industry === 'Finance') {
    summary += ` Strong relational consistency and strict compliance are enforced to meet financial audit requirements.`;
  } else if (industry === 'Healthcare') {
    summary += recommendsCloudKms
      ? ` Secure customer-managed keys (CMEK) and audit trails are enabled across regulated storage blocks to support HIPAA-aligned controls.`
      : ` Audit logging and least-privilege service access support healthcare data governance for this assessment.`;
  } else if (industry === 'Government' || industry === 'GLC') {
    const publicControls = [
      securityDecisions.cloudArmor ? 'Cloud Armor WAF filtering' : null,
      recommendsVpcServiceControls ? 'VPC Service Controls boundaries' : null,
      recommendsCloudKms ? 'Cloud KMS customer-managed keys' : null,
      securityDecisions.identityAwareProxy ? 'Identity-Aware Proxy access gates' : null
    ].filter(Boolean).join(', ');
    summary += publicControls
      ? ` Public-sector controls include ${publicControls} to protect regulated citizen information.`
      : ` Public-sector controls focus on least-privilege service access and auditability for regulated citizen information.`;
  }

  // 5. Recovery & DR Design (PHASE 5 & 7)
  let recoveryDR = '';
  let rtoValue = '';
  let rpoValue = '';

  if (recoveryTier === 'tier-1') {
    rtoValue = '< 1 Hour';
    rpoValue = '< 15 Minutes';
    const computeDR = workloadSizing.platform === 'GKE'
      ? `${computeService.name} distributes nodes across availability zones in ${DEFAULT_DEPLOYMENT_REGION.id}.`
      : workloadSizing.platform === 'Cloud Run'
        ? `${computeService.name} uses Google-managed zonal redundancy in ${DEFAULT_DEPLOYMENT_REGION.id}.`
        : `${computeService.name} distributes managed VM capacity across availability zones in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
    recoveryDR = `Designed for mission-critical operations in ${DEFAULT_DEPLOYMENT_REGION.label}. ${computeDR} ${dbService.name} uses its highest supported in-region availability configuration, and ${netService.name} performs health-based failover across zonal backends. Recovery targets must be validated through scheduled failover exercises.`;
  } else if (recoveryTier === 'tier-2') {
    rtoValue = '< 4 Hours';
    rpoValue = '< 1 Hour';
    const computeDR = workloadSizing.platform === 'Cloud Run'
      ? `${computeService.name} uses Google-managed regional redundancy with at least two warm instances.`
      : workloadSizing.platform === 'GKE'
        ? `${computeService.name} distributes its node pool across multiple zones.`
        : `${computeService.name} distributes VM instances across multiple zones with auto-healing.`;
    recoveryDR = `Designed for high resiliency in ${DEFAULT_DEPLOYMENT_REGION.label}. ${computeDR} Databases use in-region High Availability with synchronous zonal replication and automated standby promotion. Recovery procedures and application startup dependencies must be tested regularly.`;
  } else if (recoveryTier === 'tier-3') {
    rtoValue = '< 24 Hours';
    rpoValue = '< 24 Hours';
    const computeDR = workloadSizing.platform === 'Cloud Run'
      ? `${computeService.name} is redeployed from the same immutable container image.`
      : workloadSizing.platform === 'GKE'
        ? `${computeService.name} is reconstructed from declarative cluster and workload manifests.`
        : `${computeService.name} is restored from instance templates and machine images.`;
    recoveryDR = `Designed for standard production in ${DEFAULT_DEPLOYMENT_REGION.label}. ${computeDR} Automated database snapshots remain in the selected region, with scripted infrastructure restoration used for service recovery.`;
  } else {
    rtoValue = 'Best Effort';
    rpoValue = 'Daily Backup';
    const computeDR = workloadSizing.platform === 'Cloud Run'
      ? `${computeService.name} can scale to zero and be redeployed from its container image.`
      : workloadSizing.platform === 'GKE'
        ? `${computeService.name} is rebuilt from cluster manifests without a warm standby cluster.`
        : `${computeService.name} is recovered from an instance template or machine image without warm standby capacity.`;
    recoveryDR = `Cost-optimized recovery in ${DEFAULT_DEPLOYMENT_REGION.label}. ${computeDR} Database recovery relies on the latest daily snapshot in the selected region, accepting cold restoration delays to minimize baseline expense.`;
  }

  // 6. Backup Strategy (PHASE 5 & 7)
  const longTermArchive = (() => {
    if (normalizedRetainMonthly === 0 && normalizedRetainYearly === 0) {
      return '**Long-Term Archive:** Monthly and yearly archive retention are not enabled for this assessment.';
    }
    const formatRetention = (value, singular, plural) => `${value} ${value === 1 ? singular : plural}`;
    const retentionParts = [];
    if (normalizedRetainMonthly > 0) retentionParts.push(`monthly backups for **${formatRetention(normalizedRetainMonthly, 'month', 'months')}** in Coldline storage`);
    if (normalizedRetainYearly > 0) retentionParts.push(`yearly backups for **${formatRetention(normalizedRetainYearly, 'year', 'years')}** in Archive class`);
    return `**Long-Term Archive:** Retain ${retentionParts.join(' and ')} for long-term recovery objectives.`;
  })();

  const backupStrategy = [
    `**Backup Retention Policy:** Retain daily backups for **${retainDaily} days** in Cloud Storage (Standard class).`,
    `**Weekly Archive:** Replicate weekly snapshots for **${retainWeekly} weeks** in Cloud Storage (Nearline class) using automated Lifecycle policies.`,
    longTermArchive,
    `**Estimated Backup Data:** Daily data change rate of ${dailyChangeRate}% on a baseline traffic footprint implies daily incremental backup volumes averaging **${(normalizedDataTransfer * dailyChangeRate / 100).toFixed(1)} GB**.`
  ];

  if (challenges.includes('manual-backup')) {
    backupStrategy.push('**Automated Backup Protection:** Automate SQL and Object storage snapshot schedules using Cloud Backup and DR, replacing manual operator cron scripts to eliminate risk.');
  } else {
    backupStrategy.push('**Scheduled Snapshots:** Standard automated database snapshots and bucket versioning rules are enabled by default.');
  }

  // 7. Security Recommendations
  const securityRecs = [];
  if (recommendsVpcServiceControls) {
    securityRecs.push(shouldDeployAdvancedGovernmentControls
      ? '**VPC Service Controls:** Creates managed API boundaries for regulated citizen data because the workload sensitivity and recovery tier justify stronger exfiltration controls.'
      : '**VPC Service Controls:** Sets secure boundaries around databases and storage APIs to block compromised compute nodes from exfiltrating data to external addresses.');
  }

  if (recommendsCloudKms) {
    securityRecs.push('**Customer-Managed Encryption Keys (CMEK):** Mandates that all disks, databases, and storage blocks be encrypted using custom keys managed inside Cloud KMS.');
  }

  if (securityDecisions.cloudArmor) {
    securityRecs.push('**Cloud Armor WAF Rules:** Configures WAF security filters to intercept SQL injection attacks, cross-site scripting (XSS), and Layer 7 HTTP flood scripts.');
  }

  if (!recommendsVpcServiceControls && !recommendsCloudKms && !securityDecisions.cloudArmor) {
    securityRecs.push('**Dedicated Service Accounts:** Assigns distinct IAM identities to each microservice with minimal permissions instead of using the default editor service account.');
  }

  if (securityDecisions.secretManager) {
    securityRecs.push('**Secret Manager Credentials:** Restricts passwords, API keys, and tokens from source code, injecting them through workload identities at runtime.');
  }

  if (securityDecisions.identityAwareProxy) {
    securityRecs.push('**Identity-Aware Proxy (IAP):** Restricts internal, corporate, or zero-trust application access using identity and context-aware policies.');
  }

  if (challenges.includes('ddos-waf')) {
    securityRecs.push('**Cloud Armor Edge Shielding:** Enforces rate-limiting policies at the load balancer level to drop DDoS traffic waves before they consume backend compute.');
  }

  if (industry === 'Healthcare') {
    securityRecs.push(`**HIPAA Data Access Logging:** Enables Data Access Audit logs across ${dbService.name} and Cloud Storage to record access to protected health data.`);
  } else if (industry === 'Finance') {
    securityRecs.push(hasPaymentWorkload
      ? '**PCI-DSS Subnet Segmentation:** Isolates payment transaction APIs inside private VPC subnets with ingress firewalls routing through Cloud NAT gateways.'
      : '**Regulated Workload Segmentation:** Isolates sensitive financial application components inside private VPC subnets with least-privilege ingress and egress controls.');
  } else if (isPublicSector && (!recommendsCloudKms || !recommendsVpcServiceControls)) {
    const optionalControls = [
      !recommendsCloudKms ? 'Cloud KMS (CMEK)' : null,
      !recommendsVpcServiceControls ? 'VPC Service Controls' : null
    ].filter(Boolean).join(' and ');
    securityRecs.push(`**Optional Future Enhancement:** Evaluate ${optionalControls} during a later hardening phase if data sensitivity, audit requirements, or recovery tier increase.`);
  }
  
  securityRecs.push('**SSL/TLS 1.3 Transport Protection:** Restricts Load Balancer listener profiles to reject outdated cipher configurations under TLS 1.2.');

  // 8. Cost Optimization Recommendations
  const costRecs = [];
  const recommendsCloudSQL = dbService.name.includes('Cloud SQL');
  const recommendsFirestore = dbService.name.includes('Firestore');
  if (isLowBudget || challenges.includes('budget-opt')) {
    if (workloadSizing.platform === 'Cloud Run') {
      costRecs.push('**Serverless Scale-to-Zero:** Configures Cloud Run concurrency thresholds to shut down inactive container instances during idle periods, stopping resource bills.');
    } else if (workloadSizing.platform === 'GKE') {
      costRecs.push('**GKE Baseline Capacity:** Keep the minimum node pool deliberately small; Cluster Autoscaler and HPA add nodes and pods only above that provisioned baseline.');
    } else {
      costRecs.push('**Compute Engine Rightsizing:** Review VM CPU and memory telemetry, then rightsize the managed instance group while preserving the required minimum instance count.');
    }
    if (recommendsCloudSQL) {
      costRecs.push('**Scheduled Database Outage:** Auto-schedules non-production Cloud SQL instances to shut down during nights and weekends, reducing idle database hours.');
    }
  } else {
    if (computeService.name.includes('GKE')) {
      costRecs.push('**GKE Baseline and Autoscaling:** Maintain the recommended minimum nodes, then use Horizontal Pod Autoscaling and Cluster Autoscaler for demand above that baseline.');
      costRecs.push('**GKE Committed Use Discounts:** Consider commitments only for stable baseline node capacity after utilization is validated.');
    } else if (workloadSizing.platform === 'Compute Engine') {
      costRecs.push('**Compute Engine Commitments:** Consider resource commitments for stable baseline VM capacity after utilization is validated.');
    } else {
      costRecs.push('**Cloud Run Request Efficiency:** Tune CPU allocation, memory, and request concurrency from observed runtime telemetry.');
    }
  }

  if (recommendsFirestore) {
    costRecs.push('**Firestore Usage Optimization:** Optimize read/write patterns and index design, monitor document growth, and control high-frequency polling.');
  }

  if (challenges.includes('budget-opt')) {
    costRecs.push('**Cloud Storage Lifecycle Trimming:** Sets strict lifecycle deletion rules on raw scratch folders and temp tables to avoid paying for orphaned blocks.');
  }

  costRecs.push('**GCS Lifecycle Rules:** Establishes policies in Cloud Storage to automatically transition raw log files to Nearline or Archive classes after 30 days.');

  if (isHighTransfer) {
    costRecs.push(recommendsCloudCdn
      ? `**Network Egress Controls:** At approximately ${normalizedDataTransfer.toLocaleString()} GB/month, use Cloud CDN cache policies, compression, and billing alerts to control internet egress.`
      : `**Network Egress Controls:** At approximately ${normalizedDataTransfer.toLocaleString()} GB/month, use compression, route controls, and billing alerts to control internet egress.`);
  }

  // 9. Assumptions
  const sizingNotes = [
    `Sizing baseline: ${normalizedExpectedUsers.toLocaleString()} expected monthly users with a ${trafficPattern} traffic pattern.`,
    `Peak concurrency: ${workloadSizing.peakConcurrencyEstimate.toLocaleString()} users (${workloadSizing.peakConcurrencySource.toLowerCase()}).`,
    `Presales compute tier: ${workloadSizing.tier}, with ${workloadSizing.platform} selected as the single recommended platform.`,
    isLargeAudience
      ? 'Sizing posture: a large audience requires autoscaling, quota review, and load-test validation before production.'
      : 'Sizing posture: begin with the recommended tier and tune it from load tests and production telemetry.',
    `Transfer baseline: ${normalizedDataTransfer.toLocaleString()} GB/month${isHighTransfer && recommendsCloudCdn ? ', so Cloud CDN caching and egress monitoring are recommended.' : isHighTransfer ? ', so egress monitoring and compression controls are recommended.' : ', suitable for standard transfer monitoring.'}`
  ];
  const assumptions = [
    `Primary deployment region: ${DEFAULT_DEPLOYMENT_REGION.label}.`,
    `Assumed workload scale behaves proportionally to the explicit capacity estimate (${scaleLabel}).`,
    `Assumed data residency laws permit storage of primary datasets in Google Cloud public zones.`,
    `Assumed access patterns (${accessPattern}) and traffic profiles (${trafficPattern}) represent steady-state operations.`,
    ...sizingNotes
  ];
  
  if (isLegacyOrVM) {
    assumptions.push('Assumed the enterprise possesses the necessary VM licenses (e.g. Windows/SUSE) for Compute Engine migration.');
  }

  // 10. Risks
  const risks = [];
  if (recoveryTier === 'tier-4' || recoveryTier === 'tier-3') {
    risks.push('**Single Point of Failure (SPOF):** Running single-zone database or compute nodes represents a SPOF. Zonal maintenance or outages will cause service downtime.');
  }
  if (!recommendsCloudArmor) {
    risks.push('**WAF Exposure (No DDoS Shielding):** Without Cloud Armor WAF, the application endpoints are exposed to Layer 7 exploits and malicious crawler scripting.');
  }
  if (dbService.name === 'Cloud Spanner') {
    risks.push('**Database Base Billing Overhead:** Cloud Spanner imposes high baseline costs. Database instances must be monitored closely to prevent them from dominating monthly cloud invoices.');
  }
  if (challenges.includes('scale-issue') && workloadSizing.platform === 'Compute Engine') {
    risks.push('**Legacy VM Autoscaling Lag:** VM instances in MIGs can take minutes to boot and compile, which might lead to packet drop during rapid traffic surges compared to lightweight containers.');
  }
  if (isLargeAudience) {
    risks.push(`**Capacity Validation:** The expected audience of ${normalizedExpectedUsers.toLocaleString()} monthly users requires load testing; compute, database connection, and quota limits may otherwise become bottlenecks.`);
  }
  if (isVeryHighTransfer) {
    risks.push(recommendsCloudCdn
      ? `**High Network Egress Cost:** Approximately ${normalizedDataTransfer.toLocaleString()} GB/month can create material egress charges if Cloud CDN cache-hit ratios and traffic destinations are not monitored.`
      : `**High Network Egress Cost:** Approximately ${normalizedDataTransfer.toLocaleString()} GB/month can create material egress charges if compression, routing, and traffic destinations are not monitored.`);
  }

  // 11. Generate Layered Mermaid Graph (FEATURE 4)
  const activeNodes = {
    // Users Layer
    User: 'User([User Clients / Browser]):::client',
    // Security Layer
    Armor: null,
    IAP: null,
    SecMgr: null,
    // Network Layer
    GCLB: null,
    NAT: null,
    CDN: null,
    VPN: null,
    // Application Layer
    Compute: null,
    ComputeA: null,
    ComputeB: null,
    Dataflow: null,
    VertexAI: null,
    // Data Layer
    Database: null,
    DBStandby: null,
    Storage: null,
    BigQuery: null,
    VectorDB: null,
    Cache: null,
    File: null
  };

  // Populate Ingress & Networks
  if (netService.name.includes('Global')) {
    activeNodes.GCLB = 'GCLB[Global HTTPS Load Balancer]:::gateway';
    if (netService.name.includes('CDN')) {
      activeNodes.CDN = 'CDN[Cloud CDN Cache]:::gateway';
    }
    if (isInternalOnly) {
      activeNodes.VPN = 'VPN[Private Service Connect]:::gateway';
    }
  } else if (isInternalOnly) {
    activeNodes.GCLB = 'GCLB[Private Service Connect Endpoints]:::gateway';
    activeNodes.VPN = 'VPN[Cloud VPN Gateway]:::gateway';
  } else if (netService.name.includes('Regional')) {
    activeNodes.GCLB = 'GCLB[Regional HTTPS Load Balancer]:::gateway';
  } else {
    activeNodes.GCLB = 'GCLB[VPC Gateway / Cloud DNS]:::gateway';
  }

  if (isHybridAccess || challenges.includes('hybrid-conn')) {
    activeNodes.VPN = 'VPN[Cloud VPN / Interconnect]:::gateway';
  }

  // Populate Security Layer
  if (securityDecisions.cloudArmor) {
    activeNodes.Armor = 'Armor[Cloud Armor WAF]:::sec';
  }
  if (securityDecisions.secretManager) {
    activeNodes.SecMgr = 'SecMgr[Secret Manager]:::sec';
  }
  if (securityDecisions.identityAwareProxy) {
    activeNodes.IAP = 'IAP[Identity-Aware Proxy]:::sec';
  }

  // Populate Application Layer
  if (workloads.includes('analytics')) {
    activeNodes.Dataflow = 'Dataflow[Dataflow Pipelines]:::compute';
  }
  if (workloads.includes('ai-platform') || workloads.includes('ml-platform')) {
    activeNodes.VertexAI = 'VertexAI[Vertex AI Workspaces]:::compute';
  }

  // Main Compute node
  if (workloadSizing.platform === 'GKE') {
    activeNodes.Compute = 'Compute[GKE Standard Cluster]:::compute';
  } else if (workloadSizing.platform === 'Cloud Run') {
    activeNodes.Compute = 'Compute[Cloud Run Containers]:::compute';
  } else if (computeService.name.includes('Managed Instance Groups')) {
    activeNodes.Compute = 'Compute[Compute Engine MIG]:::compute';
  } else {
    activeNodes.Compute = 'Compute[Compute Engine VM]:::compute';
  }

  // Populate Data Layer
  activeNodes.Storage = 'Storage[(Cloud Storage Bucket)]:::storage';
  if (workloads.includes('analytics') || workloads.includes('dwh')) {
    activeNodes.BigQuery = 'BigQuery[(BigQuery DWH)]:::storage';
  }
  if (workloads.includes('ai-platform') || workloads.includes('ml-platform')) {
    activeNodes.VectorDB = 'VectorDB[(Vertex AI Vector Search)]:::storage';
  }

  if (challenges.includes('perf-bottleneck')) {
    activeNodes.Cache = 'Cache[(Memorystore Redis Cache)]:::storage';
  }
  if (characteristics.includes('stateful') && workloadSizing.platform === 'Compute Engine') {
    activeNodes.File = 'File[(Filestore NFS Mount)]:::storage';
  }

  // DB selection
  if (dbService.name === 'Cloud Spanner') {
    activeNodes.Database = 'Database[(Cloud Spanner Global Relational DB)]:::storage';
  } else if (dbService.name.includes('HA')) {
    activeNodes.Database = 'Database[(Cloud SQL Primary DB)]:::storage';
    activeNodes.DBStandby = 'DBStandby[(Cloud SQL Standby Zone)]:::storage';
  } else if (dbService.name.includes('Firestore')) {
    activeNodes.Database = 'Database[(Cloud Firestore NoSQL)]:::storage';
  } else if (dbService.name.includes('Cloud SQL')) {
    activeNodes.Database = 'Database[(Cloud SQL Single Zone)]:::storage';
  }

  // Compile Mermaid Graph
  let mermaid = 'graph TD\n';
  mermaid += '  %% Styling classes\n';
  mermaid += '  classDef client fill:#e8f0fe,stroke:#1a73e8,stroke-width:2px,color:#1a73e8;\n';
  mermaid += '  classDef gateway fill:#e6f4ea,stroke:#34a853,stroke-width:2px,color:#34a853;\n';
  mermaid += '  classDef compute fill:#fef7e0,stroke:#fbbc04,stroke-width:2px,color:#b06000;\n';
  mermaid += '  classDef storage fill:#fce8e6,stroke:#ea4335,stroke-width:2px,color:#c5221f;\n';
  mermaid += '  classDef sec fill:#f3e8fd,stroke:#a142f4,stroke-width:2px,color:#8ab4f8;\n\n';

  // Subgraph 1: Users
  mermaid += '  subgraph Users ["Users & Clients"]\n';
  mermaid += `    ${activeNodes.User}\n`;
  mermaid += '  end\n\n';

  // Subgraph 2: Security
  if (activeNodes.Armor || activeNodes.IAP || activeNodes.SecMgr) {
    mermaid += '  subgraph Security ["Security Layer"]\n';
    if (activeNodes.Armor) mermaid += `    ${activeNodes.Armor}\n`;
    if (activeNodes.IAP) mermaid += `    ${activeNodes.IAP}\n`;
    if (activeNodes.SecMgr) mermaid += `    ${activeNodes.SecMgr}\n`;
    mermaid += '  end\n\n';
  }

  // Subgraph 3: Network
  mermaid += '  subgraph Network ["Network Layer"]\n';
  mermaid += `    ${activeNodes.GCLB}\n`;
  if (activeNodes.CDN) mermaid += `    ${activeNodes.CDN}\n`;
  if (activeNodes.NAT) mermaid += `    ${activeNodes.NAT}\n`;
  if (activeNodes.VPN) mermaid += `    ${activeNodes.VPN}\n`;
  mermaid += '  end\n\n';

  // Subgraph 4: Application
  mermaid += '  subgraph App ["Application Layer"]\n';
  if (activeNodes.Compute) mermaid += `    ${activeNodes.Compute}\n`;
  if (activeNodes.ComputeA) mermaid += `    ${activeNodes.ComputeA}\n`;
  if (activeNodes.ComputeB) mermaid += `    ${activeNodes.ComputeB}\n`;
  if (activeNodes.Dataflow) mermaid += `    ${activeNodes.Dataflow}\n`;
  if (activeNodes.VertexAI) mermaid += `    ${activeNodes.VertexAI}\n`;
  mermaid += '  end\n\n';

  // Subgraph 5: Data
  mermaid += '  subgraph Data ["Data & Storage Layer"]\n';
  if (activeNodes.Database) mermaid += `    ${activeNodes.Database}\n`;
  if (activeNodes.DBStandby) mermaid += `    ${activeNodes.DBStandby}\n`;
  if (activeNodes.Storage) mermaid += `    ${activeNodes.Storage}\n`;
  if (activeNodes.BigQuery) mermaid += `    ${activeNodes.BigQuery}\n`;
  if (activeNodes.VectorDB) mermaid += `    ${activeNodes.VectorDB}\n`;
  if (activeNodes.Cache) mermaid += `    ${activeNodes.Cache}\n`;
  if (activeNodes.File) mermaid += `    ${activeNodes.File}\n`;
  mermaid += '  end\n\n';

  // Connections
  mermaid += '  %% Ingress flows\n';
  if (isInternalOnly && activeNodes.VPN) {
    mermaid += '  User --> VPN\n';
    mermaid += '  VPN --> GCLB\n';
  } else {
    mermaid += '  User --> GCLB\n';
    if (activeNodes.VPN) {
      mermaid += '  VPN --> GCLB\n';
    }
  }

  if (activeNodes.CDN) {
    mermaid += '  GCLB --> CDN\n';
  }

  let nextHop = 'GCLB';
  if (activeNodes.Armor) {
    mermaid += `  ${nextHop} --> Armor\n`;
    nextHop = 'Armor';
  }
  if (activeNodes.IAP) {
    mermaid += `  ${nextHop} --> IAP\n`;
    nextHop = 'IAP';
  }

  // App targets
  if (activeNodes.ComputeA && activeNodes.ComputeB) {
    mermaid += `  ${nextHop} --> ComputeA\n`;
    mermaid += `  ${nextHop} --> ComputeB\n`;
  } else if (activeNodes.Compute) {
    mermaid += `  ${nextHop} --> Compute\n`;
  } else if (activeNodes.Dataflow) {
    mermaid += `  ${nextHop} --> Dataflow\n`;
  } else if (activeNodes.VertexAI) {
    mermaid += `  ${nextHop} --> VertexAI\n`;
  }

  // App to Data/Storage
  if (activeNodes.ComputeA && activeNodes.ComputeB) {
    if (activeNodes.Database) {
      mermaid += '  ComputeA --> Database\n';
      mermaid += '  ComputeB --> Database\n';
    }
    mermaid += '  ComputeA --> Storage\n';
    mermaid += '  ComputeB --> Storage\n';
  } else if (activeNodes.Compute) {
    if (activeNodes.Database) mermaid += '  Compute --> Database\n';
    if (activeNodes.Storage) mermaid += '  Compute --> Storage\n';
    if (activeNodes.BigQuery) mermaid += '  Compute --> BigQuery\n';
    if (activeNodes.VectorDB) mermaid += '  Compute --> VectorDB\n';
    if (activeNodes.Cache) {
      mermaid += '  Compute --> Cache\n';
      if (activeNodes.Database) mermaid += '  Cache -.->|Write Through| Database\n';
    }
    if (activeNodes.File) {
      mermaid += '  Compute --> File\n';
    }
  } else if (activeNodes.Dataflow) {
    if (activeNodes.BigQuery) mermaid += '  Dataflow --> BigQuery\n';
    if (activeNodes.Storage) mermaid += '  Dataflow --> Storage\n';
  } else if (activeNodes.VertexAI) {
    if (activeNodes.VectorDB) mermaid += '  VertexAI --> VectorDB\n';
    if (activeNodes.Storage) mermaid += '  VertexAI --> Storage\n';
  }

  if (activeNodes.DBStandby) {
    mermaid += '  Database -.->|Sync Replication| DBStandby\n';
  }

  if (activeNodes.SecMgr) {
    if (activeNodes.ComputeA && activeNodes.ComputeB) {
      mermaid += '  SecMgr -.->|Fetch Secrets| ComputeA\n';
      mermaid += '  SecMgr -.->|Fetch Secrets| ComputeB\n';
    } else if (activeNodes.Compute) {
      mermaid += '  SecMgr -.->|Fetch Secrets| Compute\n';
    }
  }

  const consistencyWarnings = validateArchitectureConsistency({
    workloadSizing,
    services,
    execSummary,
    summary,
    recoveryDR,
    securityRecs,
    costRecs,
    assumptions,
    risks,
    activeNodes,
    securityDecisions
  });

  return {
    projectName,
    industry,
    industryLabel,
    users,
    budget,
    challenges,
    workloads,
    workloadList,
    characteristics,
    accessPattern,
    trafficPattern,
    expectedUsers,
    deploymentRegion: DEFAULT_DEPLOYMENT_REGION,
    peakConcurrencyOverride,
    dataTransfer,
    recoveryTier,
    dailyChangeRate,
    retainDaily,
    retainWeekly,
    retainMonthly,
    retainYearly,
    sizingNotes,
    workloadSizing,
    securityDecisions,
    services,
    summary,
    execSummary,
    recoveryDR,
    rtoValue,
    rpoValue,
    backupStrategy,
    securityRecs,
    costRecs,
    assumptions,
    risks,
    mermaid,
    consistencyWarnings
  };
}

// Expose globally
window.generateRecommendation = generateRecommendation;
