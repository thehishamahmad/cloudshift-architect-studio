/**
 * CloudShift Architect Studio - Heuristics Rules Engine (Version 3.3)
 * Fully rules-driven combinatorics engine mapping customer challenges, workload profiles,
 * characteristics, traffic parameters, recovery tiers, sizing tiers, and retention rules to Google Cloud assessments.
 */

const DEFAULT_DEPLOYMENT_REGION = Object.freeze({
  id: 'asia-southeast1',
  name: 'Singapore',
  label: 'Singapore (asia-southeast1)'
});

const workloadProfileAliases = Object.freeze({
  'web-app': 'web-portal',
  'gov-portal': 'web-portal',
  'citizen-portal': 'web-portal',
  lms: 'web-portal',
  cms: 'web-portal',
  'api-services': 'api-backend',
  'mobile-backend': 'api-backend',
  erp: 'enterprise-app',
  crm: 'enterprise-app',
  dms: 'enterprise-app',
  ecomm: 'transactional-platform',
  analytics: 'data-analytics',
  dwh: 'data-analytics',
  'bi-platform': 'data-analytics',
  dashboard: 'data-analytics',
  'ai-platform': 'ai-ml-platform',
  'ml-platform': 'ai-ml-platform',
  iot: 'iot-event-platform',
  streaming: 'media-streaming'
});

function normalizeWorkloadProfiles(values = []) {
  const normalized = Array.isArray(values)
    ? values.map(value => workloadProfileAliases[value] || value).filter(Boolean)
    : [];
  return Array.from(new Set(normalized));
}

window.CloudShiftWorkloadProfiles = Object.freeze({
  aliases: workloadProfileAliases,
  normalize: normalizeWorkloadProfiles
});

const supportedCharacteristicProfiles = Object.freeze([
  'stateless',
  'stateful',
  'microservices',
  'event-driven',
  'realtime',
  'batch'
]);

const characteristicLabelsMap = Object.freeze({
  stateless: 'Stateless',
  stateful: 'Stateful',
  microservices: 'Microservices',
  'event-driven': 'Event-Driven',
  realtime: 'Real-Time Processing',
  batch: 'Batch Processing'
});

function normalizeCharacteristicProfiles(values = [], workloads = []) {
  const rawValues = Array.isArray(values) ? values.filter(Boolean).map(String) : [];
  const workloadValues = normalizeWorkloadProfiles(workloads);
  const normalized = [];
  const add = value => {
    if (supportedCharacteristicProfiles.includes(value) && !normalized.includes(value)) normalized.push(value);
  };

  rawValues.forEach(value => {
    if (supportedCharacteristicProfiles.includes(value)) {
      add(value);
    } else if (value === 'containerized' && (workloadValues.includes('web-portal') || workloadValues.includes('api-backend'))) {
      add('stateless');
    } else if (value === 'kubernetes-required' && rawValues.includes('microservices')) {
      add('microservices');
    }
  });

  return normalized;
}

window.CloudShiftCharacteristics = Object.freeze({
  supported: supportedCharacteristicProfiles,
  labels: characteristicLabelsMap,
  normalize: normalizeCharacteristicProfiles
});

function buildWorkloadSizing({ workloads, characteristics, challenges = [], expectedUsers, peakConcurrencyOverride, recoveryTier, trafficPattern }) {
  const normalizedExpectedUsers = Math.max(0, Number(expectedUsers) || 0);
  const isEnterpriseWorkload = workloads.includes('enterprise-app');
  const isLegacyModernization = challenges.includes('legacy-mod');
  const hasLegacyVMDependency = characteristics.includes('legacy-vm-dependency') || characteristics.includes('vm-based') || isLegacyModernization;
  const isMicroservices = characteristics.includes('microservices');
  const isStateful = characteristics.includes('stateful');
  const isStateless = characteristics.includes('stateless');
  const isEventDriven = characteristics.includes('event-driven');
  const isApiWorkload = workloads.includes('api-backend') || trafficPattern === 'api';

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
  if (isEnterpriseWorkload || isMicroservices) tierIndex = Math.max(tierIndex, 1);
  const tier = sizingTiers[tierIndex];

  let platform = 'Cloud Run';
  let justification = 'Managed serverless compute is the best fit for a workload without VM or Kubernetes dependencies.';

  if (isMicroservices) {
    platform = 'GKE';
    justification = 'A microservices or multi-service platform benefits from shared Kubernetes orchestration and independent service scaling.';
  } else if (isEnterpriseWorkload || isLegacyModernization) {
    platform = 'Compute Engine';
    justification = 'Enterprise business applications often need runtime compatibility, integration validation, and controlled migration sequencing on Compute Engine.';
  } else if (isStateful) {
    platform = 'Compute Engine';
    justification = 'A stateful workload is better aligned to VM-based runtime and persistence controls unless later discovery confirms a managed service fit.';
  } else if (isStateless || isEventDriven || isApiWorkload) {
    platform = 'Cloud Run';
    justification = 'The stateless or event-driven workload can use request-driven autoscaling with low operational overhead.';
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

function buildIndicativeSizingProfiles({ workloads = [], characteristics = [], workloadSizing }) {
  const profiles = [];
  const hasCharacteristic = value => characteristics.includes(value);
  const addProfile = (signal, workload, assumption, indicativeSizing, proposedOptions, rationale) => {
    if (profiles.some(profile => profile.signal === signal)) return;
    profiles.push({ signal, workload, assumption, indicativeSizing, proposedOptions, rationale });
  };

  workloads.forEach(workload => {
    switch (workload) {
      case 'web-portal':
        addProfile(
          workload,
          'Web / Portal Application',
          'Stateless or lightly stateful web tier with moderate user concurrency.',
          '2-4 vCPU, 4-16 GB RAM, and 100-500 GB storage where persistent content is required.',
          'Cloud Run, GKE, or Compute Engine depending on runtime and operational constraints.',
          'Suitable for scalable front-end, portal, or web application hosting with managed ingress and controlled deployment cycles.'
        );
        break;
      case 'api-backend':
        addProfile(
          workload,
          'API / Mobile Backend',
          'Stateless API tier with variable request volume and dependency on downstream services.',
          '1-4 vCPU and 2-8 GB RAM per service, scaled horizontally based on request concurrency.',
          hasCharacteristic('microservices') ? 'GKE or Cloud Run.' : 'Cloud Run or GKE.',
          'Suitable for autoscaling API workloads where deployment frequency, security controls, and latency targets need to be balanced.'
        );
        break;
      case 'enterprise-app':
        addProfile(
          workload,
          'Enterprise Business Application',
          'VM-oriented enterprise workload with operating system, runtime, integration, or licensing dependencies.',
          '4-8 vCPU, 16-32 GB RAM, and 300 GB-2 TB storage depending on application data, document volume, and retention needs.',
          'Compute Engine first, with managed database and object storage services; modernization path can be assessed after migration stabilization.',
          'Suitable for applications that require OS-level control, compatibility validation, or phased rehosting before deeper modernization.'
        );
        break;
      case 'data-analytics':
        addProfile(
          workload,
          'Data & Analytics Platform',
          'Analytical workload with batch ingestion, reporting, and aggregated query patterns.',
          'Storage-led sizing based on data volume; processing typically ranges from 2-8 vCPU equivalent for pipelines before warehouse execution.',
          'BigQuery, Dataflow, and Cloud Storage.',
          'Suitable for governed reporting, data consolidation, and analytics modernization without managing database servers.'
        );
        break;
      case 'transactional-platform':
        addProfile(
          workload,
          'E-Commerce / Transactional Platform',
          'Public-facing transactional workload with variable traffic, caching opportunities, and relational data needs.',
          '2-8 vCPU, 8-32 GB RAM across application services, plus managed relational database capacity sized from transaction volume.',
          'Cloud Run or GKE for services, Cloud SQL for transactions, Cloud CDN and Cloud Armor for edge protection.',
          'Suitable for controlled scale, protected public ingress, and faster release cycles across storefront and API components.'
        );
        break;
      case 'iot-event-platform':
        addProfile(
          workload,
          'IoT / Event-Driven Platform',
          'Event-driven ingestion workload with bursty device telemetry and asynchronous processing.',
          '2-8 vCPU equivalent for ingestion and processing workers, with storage sized from message volume and retention period.',
          'Pub/Sub, Cloud Run, Dataflow, BigQuery, and Cloud Storage.',
          'Suitable for decoupled telemetry ingestion, scalable processing, and analytics-ready data pipelines.'
        );
        break;
      case 'media-streaming':
        addProfile(
          workload,
          'Media / Streaming Platform',
          'Read-heavy public content workload with high transfer volume and cacheable assets.',
          'Origin compute varies by application tier; storage and egress planning should assume 1 TB+ active content for production media libraries.',
          'Cloud Storage, Cloud CDN, Global HTTPS Load Balancer, and Cloud Armor.',
          'Suitable for reducing origin load, improving user experience, and controlling bandwidth exposure.'
        );
        break;
      case 'ai-ml-platform':
        addProfile(
          workload,
          'AI / ML Platform',
          'Model development or inference workload with data preparation, pipeline orchestration, and governance needs.',
          'Sizing depends on model type; start with managed pipeline orchestration and validate GPU/CPU needs during discovery.',
          'Vertex AI, BigQuery, Cloud Storage, and managed pipelines.',
          'Suitable for governed model operations, repeatable experimentation, and controlled production rollout.'
        );
        break;
      default:
        addProfile(
          workload,
          'Selected Workload',
          'Business workload selected for architecture assessment with final sizing pending detailed discovery.',
          'Indicative sizing should be validated from CPU, memory, storage, transaction, and dependency data.',
          workloadSizing?.architectureService || workloadSizing?.platform || 'Google Cloud managed services based on discovery findings.',
          'Suitable service placement should be confirmed through application inventory, performance baselining, and migration planning.'
        );
    }
  });

  if (characteristics.includes('batch')) {
    addProfile(
      'batch',
      'Batch Processing',
      'Scheduled or event-driven processing workload with isolated job execution windows.',
      '2-8 vCPU and 8-32 GB RAM depending on job size, runtime duration, and parallelism.',
      'Cloud Run Jobs, GKE Jobs, or Compute Engine.',
      'Suitable for isolated, scheduled, or event-driven processing that can scale independently from user-facing services.'
    );
  }

  if (profiles.length === 0) {
    addProfile(
      'default',
      'General Application Workload',
      'Default application profile based on common web or service hosting patterns.',
      '1-4 vCPU, 2-8 GB RAM, and storage sized after application inventory.',
      workloadSizing?.architectureService || workloadSizing?.platform || 'Cloud Run, GKE, or Compute Engine based on runtime requirements.',
      'Suitable as an initial planning baseline until detailed discovery validates production resource requirements.'
    );
  }

  return profiles;
}

function formatListWithAnd(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function getChallengeNarrative(challenges = []) {
  const narrativeByChallenge = {
    'budget-opt': {
      label: 'Budget Optimization',
      focus: 'cost control and resource efficiency',
      outcome: 'This assessment prioritizes cost-controlled cloud adoption through managed, request-driven services, lifecycle automation, and governance controls that reduce idle capacity without losing a practical production baseline.',
      impact: 'FinOps readiness, telemetry-driven right-sizing, and lower operational waste.',
      benefits: [
        'Cost Control: Managed services and lifecycle policies reduce idle spend while preserving capacity for real demand.',
        'Reduced Platform Burden: Request-driven runtime services limit infrastructure administration and help teams focus on service delivery.',
        'Usage-Based Scaling: Autoscaling and capacity guardrails align spend with observed demand instead of fixed overprovisioning.'
      ],
      risks: [
        '**Cost Headroom Trade-Off:** Over-optimizing for cost may reduce performance headroom if traffic patterns or peak concurrency are underestimated.',
        '**Lifecycle Governance:** Lifecycle rules must be reviewed to avoid premature archival or deletion of required operational, audit, or customer data.'
      ]
    },
    'ha-req': {
      label: 'High Availability Requirement',
      focus: 'service continuity and production resilience',
      outcome: 'This assessment prioritizes service continuity by aligning the application and data layers to resilient managed services, reducing exposure to zonal disruption, and strengthening the operating baseline for production workloads.',
      impact: 'reduced downtime exposure, improved recovery readiness, and more stable production operations.',
      benefits: [
        'Service Continuity: Managed resilient services reduce exposure to zonal incidents and planned maintenance disruption.',
        'Reduced Downtime Exposure: Multi-zone and health-check driven patterns improve application availability during infrastructure events.',
        'Recovery Readiness: Backup, failover, and operating assumptions are tied to the selected RTO and RPO target.'
      ],
      risks: [
        '**Application HA Readiness:** HA design depends on application readiness for stateless scaling, health checks, session handling, and failover behavior.',
        '**Database Failover Validation:** Database failover must be tested to confirm application reconnection behavior and acceptable recovery time.'
      ]
    },
    'sec-compliance': {
      label: 'Security / Compliance Concern',
      focus: 'security governance and regulated workload protection',
      outcome: 'This assessment prioritizes governed security controls for regulated workloads, combining layered ingress protection, controlled access, encryption governance, auditability, and clear ownership of compliance-sensitive services.',
      impact: 'reduced compliance risk, stronger governance, and clearer accountability for sensitive workloads.',
      benefits: [
        'Security Governance: Layered controls improve auditability and reduce unmanaged exposure across public and managed service entry points.',
        'Reduced Compliance Risk: Encryption, access control, and logging recommendations align cloud operations with regulated workload expectations.',
        'Controlled Access: Identity and service-level controls help limit administrative and runtime access to authorized users and services.'
      ],
      risks: [
        '**Compliance Validation:** Final compliance posture requires review against customer policies, regulatory obligations, and confirmed data classification.',
        '**Security Operating Model:** Controls such as CMEK, VPC Service Controls, and IAP require governance ownership, key management processes, and operational readiness.'
      ]
    },
    'dr-concern': {
      label: 'DR / Recovery Concern',
      focus: 'restore readiness and recovery governance',
      outcome: 'This assessment prioritizes recovery confidence by aligning backup design, retention posture, and restore expectations to the selected RTO and RPO objectives.',
      impact: 'validated restore readiness, stronger retention governance, and clearer recovery accountability.',
      benefits: [
        'Restore Readiness: Recovery assumptions are tied to backup frequency, restore testing, and operational recovery procedures.',
        'Retention Governance: Backup retention is positioned around audit, legal, and operational recovery needs.',
        'Operational Recovery Confidence: RTO and RPO expectations are made explicit for leadership and technical validation.'
      ],
      risks: [
        '**Restore Testing Dependency:** RTO and RPO targets must be validated through restore testing, not assumed from service configuration alone.',
        '**Retention Alignment:** Backup retention must be confirmed against legal, audit, and operational recovery requirements.'
      ]
    },
    'perf-bottleneck': {
      label: 'Performance Bottleneck',
      focus: 'responsiveness and bottleneck isolation',
      outcome: 'This assessment prioritizes workload responsiveness by separating scalable application capacity from data, cache, and ingress concerns so performance constraints can be isolated and measured.',
      impact: 'better request handling, lower latency exposure, and clearer performance remediation priorities.',
      benefits: [
        'Improved Responsiveness: Managed scaling and caching options reduce pressure on application and data tiers during traffic peaks.',
        'Bottleneck Isolation: The target design separates compute, data, and edge concerns so performance issues can be measured more clearly.',
        'Autoscaling Efficiency: Capacity recommendations can be tuned from telemetry instead of fixed infrastructure assumptions.'
      ],
      risks: [
        '**Telemetry Dependency:** Performance improvement depends on identifying actual bottlenecks through telemetry, profiling, and transaction tracing.',
        '**Non-Infrastructure Bottlenecks:** Scaling infrastructure alone may not resolve code-level, database, or integration constraints.'
      ]
    },
    'scale-issue': {
      label: 'Scalability Issue',
      focus: 'elastic scaling and growth readiness',
      outcome: 'This assessment prioritizes elastic growth by aligning the runtime, ingress, and data services to demand patterns that can scale without unnecessary platform complexity.',
      impact: 'improved demand handling, concurrency control, and readiness for audience growth.',
      benefits: [
        'Elastic Capacity: Managed scaling patterns support higher demand without permanently carrying peak infrastructure.',
        'Growth Readiness: The architecture can expand from the sizing baseline as usage evidence and telemetry mature.',
        'Concurrency Control: Peak concurrency assumptions are surfaced so compute and quota limits can be validated before production.'
      ],
      risks: [
        '**Autoscaling Validation:** Autoscaling assumptions must be validated through load testing and concurrency analysis.',
        '**Downstream Constraints:** Downstream systems may become bottlenecks even if the application layer scales successfully.'
      ]
    },
    'hybrid-conn': {
      label: 'Hybrid Connectivity Requirement',
      focus: 'secure integration and staged migration',
      outcome: 'This assessment prioritizes controlled hybrid operations by preserving private connectivity options, reducing integration risk, and supporting staged migration from existing environments.',
      impact: 'safer integration, better network control, and a clearer migration path for dependent systems.',
      benefits: [
        'Private Connectivity: Hybrid network controls reduce dependency on public integration paths for enterprise systems.',
        'Staged Migration: Connectivity choices allow workloads to move in phases while dependencies remain reachable.',
        'Network Control: Routing and access assumptions become explicit for security and operations teams.'
      ],
      risks: [
        '**Network Dependency Mapping:** Hybrid success depends on confirming routing, firewall, DNS, and dependency paths before migration.',
        '**Cutover Coordination:** Staged migration may require parallel operations and careful cutover planning to avoid service disruption.'
      ]
    },
    'legacy-mod': {
      label: 'Legacy App Modernization',
      focus: 'compatibility preservation and staged modernization',
      outcome: 'This assessment prioritizes migration readiness by preserving compatibility for VM-oriented workloads first, then creating a controlled path for modernization after stabilization.',
      impact: 'lower migration risk, clearer sequencing, and reduced disruption to legacy application operations.',
      benefits: [
        'Migration Sequencing: Rehost-first patterns reduce immediate transformation risk for legacy applications.',
        'Compatibility Preservation: VM-oriented workloads can retain OS, runtime, and licensing assumptions during the first migration phase.',
        'Modernization Readiness: The landing zone makes later refactoring decisions easier once telemetry and dependencies are understood.'
      ],
      risks: [
        '**Dependency Discovery:** Legacy applications may depend on undocumented integrations, file paths, jobs, or licensing constraints.',
        '**Modernization Timing:** Rehosting can preserve compatibility, but deeper modernization still requires later application assessment.'
      ]
    },
    'data-analytics': {
      label: 'Data Analytics Requirement',
      focus: 'governed analytics and reporting readiness',
      outcome: 'This assessment prioritizes governed data consolidation by aligning storage, processing, and analytics services to reporting and decision-support needs.',
      impact: 'faster insight generation, scalable query performance, and stronger data governance.',
      benefits: [
        'Reporting Readiness: Managed analytics services support curated datasets for operational and executive reporting.',
        'Governed Analytics: Data landing and transformation patterns improve control over lineage, access, and retention.',
        'Scalable Query Platform: Analytical workloads can scale independently from transactional systems.'
      ],
      risks: [
        '**Data Quality Dependency:** Analytics value depends on source data quality, ownership, and transformation rules.',
        '**Governance Alignment:** Data classification, retention, and access policies must be confirmed before production analytics rollout.'
      ]
    },
    'ai-genai': {
      label: 'AI / GenAI Requirement',
      focus: 'AI readiness and governed experimentation',
      outcome: 'This assessment prioritizes AI readiness by establishing a governed data and platform foundation for secure experimentation and future production model enablement.',
      impact: 'safer AI experimentation, stronger data governance, and a clearer path from prototype to production.',
      benefits: [
        'AI Readiness: Data and platform services create the foundation for governed model experimentation.',
        'Secure Experimentation: Access, logging, and data controls reduce risk during early AI adoption.',
        'Production Roadmap: The architecture separates foundational services from later model and application integration decisions.'
      ],
      risks: [
        '**Data Readiness:** AI outcomes depend on data quality, consent, classification, and access governance.',
        '**Model Governance:** Production AI requires model monitoring, approval workflows, and responsible-use controls beyond platform setup.'
      ]
    },
    'ddos-waf': {
      label: 'DDoS / WAF Concern',
      focus: 'edge protection and public threat reduction',
      outcome: 'This assessment prioritizes public ingress protection by placing policy-based filtering, rate controls, and managed edge services in front of internet-facing workloads.',
      impact: 'reduced public attack exposure and clearer security operations for web entry points.',
      benefits: [
        'Edge Protection: Cloud Armor policies reduce exposure to Layer 7 attacks and abusive traffic patterns.',
        'Ingress Governance: Centralized load balancing and WAF controls make public entry points easier to govern.',
        'Threat Response Readiness: Security teams gain clearer policy levers for blocking and rate-limiting hostile traffic.'
      ],
      risks: [
        '**Policy Tuning:** WAF policies require tuning to reduce false positives and protect legitimate customer traffic.',
        '**Threat Monitoring:** Edge controls must be paired with logging and operational review to remain effective.'
      ]
    },
    'manual-backup': {
      label: 'Manual Backup Process',
      focus: 'backup automation and retention control',
      outcome: 'This assessment prioritizes backup reliability by replacing manual recovery assumptions with automated schedules, retention controls, and restore validation expectations.',
      impact: 'lower operational risk, clearer retention ownership, and more repeatable recovery operations.',
      benefits: [
        'Backup Reliability: Automated backup schedules reduce dependency on manual operator routines.',
        'Retention Control: Defined retention windows improve auditability and recovery planning.',
        'Operational Recovery Confidence: Restore assumptions become testable instead of informal.'
      ],
      risks: [
        '**Backup Process Transition:** Moving from manual to automated backup requires ownership, monitoring, and exception handling.',
        '**Restore Validation:** Backup success does not guarantee recoverability unless restore testing is performed.'
      ]
    }
  };

  const priority = [
    'budget-opt',
    'ha-req',
    'sec-compliance',
    'dr-concern',
    'perf-bottleneck',
    'scale-issue',
    'hybrid-conn',
    'legacy-mod',
    'data-analytics',
    'ai-genai',
    'ddos-waf',
    'manual-backup'
  ];
  const selected = priority.filter(value => challenges.includes(value));
  const primaryKey = selected[0];
  const fallback = {
    label: 'Architecture Readiness',
    focus: 'migration readiness and governed cloud adoption',
    outcome: 'This assessment establishes a governed cloud architecture direction using managed services, explicit recovery objectives, and indicative sizing assumptions that can be validated during detailed discovery.',
    impact: 'reduced delivery uncertainty, clearer governance, and a practical route into Google Cloud.',
    benefits: [
      'Migration Readiness: The proposed baseline gives teams a structured starting point for cloud adoption and discovery validation.',
      'Operational Clarity: Service choices, assumptions, and risks are made visible for architecture and stakeholder review.',
      'Governance Alignment: Recovery, security, and deployment assumptions are documented before implementation planning.'
    ],
    risks: []
  };

  const primary = primaryKey ? narrativeByChallenge[primaryKey] : fallback;
  const selectedNarratives = selected.map(value => narrativeByChallenge[value]).filter(Boolean);
  const benefits = [];
  const risks = [];
  [...(primary.benefits || []), ...selectedNarratives.flatMap(item => item.benefits || [])].forEach(item => {
    if (item && !benefits.includes(item)) benefits.push(item);
  });
  selectedNarratives.flatMap(item => item.risks || []).forEach(item => {
    if (item && !risks.includes(item)) risks.push(item);
  });

  return {
    ...primary,
    selectedLabels: selectedNarratives.map(item => item.label),
    benefits,
    risks
  };
}

function buildStrategicBusinessBenefits({ challenges = [], workloadSizing, securityDecisions = {}, recommendsCloudKms = false, recommendsCloudCdn = false, isHighAvailability = false, hasHybridEstate = false }) {
  const selected = new Set(challenges);
  const categories = [];
  const addCategory = (key, text) => {
    if (!categories.some(item => item.key === key)) categories.push({ key, text });
  };

  if (selected.has('ha-req') || selected.has('dr-concern') || selected.has('manual-backup') || isHighAvailability) {
    addCategory('resilience', 'Business Resilience: Improves availability and recovery readiness through resilient managed services, explicit recovery targets, and clearer restore ownership.');
  }

  if (selected.has('perf-bottleneck') || selected.has('scale-issue')) {
    addCategory('performance', 'Performance & Scalability: Supports demand growth through elastic scaling, bottleneck isolation, and clearer separation between application and data tiers.');
  }

  if (selected.has('sec-compliance') || selected.has('ddos-waf') || securityDecisions.cloudArmor || recommendsCloudKms || securityDecisions.identityAwareProxy) {
    addCategory('security', 'Security & Compliance: Strengthens regulated workload protection through layered access, encryption governance, and edge security controls.');
  }

  if (selected.has('budget-opt')) {
    addCategory('cost', 'Cost & Governance: Improves cost visibility and governance through telemetry-driven right-sizing, lifecycle controls, and usage-aware scaling.');
  }

  if (selected.has('legacy-mod') || selected.has('manual-backup') || hasHybridEstate || ['Cloud Run', 'GKE'].includes(workloadSizing?.platform)) {
    addCategory('operations', 'Operational Efficiency: Reduces infrastructure management effort by using managed services, automation, and clearer operational ownership.');
  }

  if (categories.length === 0) {
    addCategory('operations', 'Operational Efficiency: Establishes a clearer cloud operating model using managed services, explicit ownership, and telemetry-driven validation.');
    addCategory('resilience', 'Business Resilience: Aligns availability and recovery assumptions to the selected production objectives.');
  }

  const priority = ['resilience', 'performance', 'security', 'operations', 'cost'];
  return categories
    .sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key))
    .slice(0, 5)
    .map(item => item.text);
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
  if (activeNodes.IAP && !securityDecisions.identityAwareProxy) warn('IAP topology appears without an IAP recommendation.');
  if (Boolean(activeNodes.SecMgr) !== securityDecisions.secretManager) warn('Secret Manager topology does not match the security decision.');
  if (Boolean(activeNodes.Cache) !== serviceNames.some(name => name.includes('Memorystore'))) warn('Memorystore topology does not match recommended services.');
  if (Boolean(activeNodes.File) !== serviceNames.some(name => name.includes('Filestore'))) warn('Filestore topology does not match recommended services.');
  if (Boolean(activeNodes.Dataflow) !== serviceNames.some(name => name.includes('Dataflow'))) warn('Dataflow topology does not match recommended services.');
  if (Boolean(activeNodes.VertexAI) !== serviceNames.some(name => name.includes('Vertex AI Pipelines'))) warn('Vertex AI topology does not match recommended services.');
  if (activeNodes.NAT?.includes('Cloud NAT') && !serviceNames.some(name => name.includes('Cloud NAT'))) warn('Mermaid topology contains Cloud NAT without a recommendation.');
  if (activeNodes.NAT?.includes('Private Service Connect') && !serviceNames.some(name => name.includes('Private Service Connect'))) warn('Mermaid topology contains Private Service Connect without a recommendation.');
  if (activeNodes.VPN && !serviceNames.some(name => name.includes('Cloud VPN'))) warn('Mermaid topology contains Cloud VPN without a recommendation.');

  return warnings;
}

function generateRecommendation(inputs) {
  const {
    projectName,
    industry,
    users,
    challenges = [],
    workloads: rawWorkloads = [],
    characteristics: rawCharacteristics = [],
    accessPattern = 'public',
    trafficPattern = 'dynamic',
    expectedUsers = 50000,
    peakConcurrencyOverride = null,
    dataTransfer = 2500,
    recoveryTier = 'tier-2',
    productionDataSize = 500,
    dailyChangeRate = 5,
    retainDaily = 14,
    retainWeekly = 4,
    retainMonthly = 12,
    retainYearly = 1
  } = inputs;
  const workloads = normalizeWorkloadProfiles(rawWorkloads);
  const characteristics = normalizeCharacteristicProfiles(rawCharacteristics, workloads);

  // 1. Resolve architectural parameters
  const isHighAvailability = ['tier-1', 'tier-2'].includes(recoveryTier);
  const normalizedExpectedUsers = Math.max(0, Number(expectedUsers) || 0);
  const normalizedDataTransfer = Math.max(0, Number(dataTransfer) || 0);
  const normalizedProductionDataSize = Math.max(0, Number(productionDataSize) || 0);
  const isLargeAudience = normalizedExpectedUsers >= 100000;
  const isHighTransfer = normalizedDataTransfer >= 10000;
  const isVeryHighTransfer = normalizedDataTransfer >= 50000;
  const isPublicSector = industry === 'Government' || industry === 'GLC';
  const isRegulatedIndustry = industry === 'Finance' || industry === 'Healthcare';
  const hasExplicitSecurityRequirement = challenges.includes('sec-compliance');
  const hasPublicSectorWorkload = isPublicSector && workloads.includes('web-portal') && hasExplicitSecurityRequirement;
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
  const hasPaymentWorkload = workloads.includes('transactional-platform')
    || workloads.includes('payment-platform')
    || workloads.includes('payments')
    || characteristics.includes('payment-platform')
    || characteristics.includes('card-transactions')
    || characteristics.includes('payment-processing')
    || challenges.includes('payment-platform')
    || challenges.includes('card-transactions')
    || challenges.includes('payment-processing');
  const hasExplicitEdgeProtectionNeed = challenges.includes('ddos-waf')
    || characteristics.includes('public-facing')
    || workloads.includes('transactional-platform');
  const isBudgetOptimizationOnly = challenges.includes('budget-opt') && challenges.length === 1;
  const isHighSecurity = hasExplicitSecurityRequirement
    || challenges.includes('ddos-waf')
    || (isRegulatedIndustry && !isBudgetOptimizationOnly)
    || (isPublicSector && hasExplicitEdgeProtectionNeed && !isBudgetOptimizationOnly);
  const isStrictSecurity = hasExplicitSecurityRequirement && (isRegulatedIndustry || isPublicSector);
  const recommendsCloudArmor = hasExplicitSecurityRequirement
    || challenges.includes('ddos-waf')
    || workloads.includes('transactional-platform')
    || hasPublicSectorWorkload
    || (characteristics.includes('public-facing') && !isBudgetOptimizationOnly && (isHighAvailability || isRegulatedIndustry || isPublicSector));
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
  const isBudgetOptimization = challenges.includes('budget-opt');
  const normalizedRetainMonthly = Math.max(0, Number(retainMonthly) || 0);
  const normalizedRetainYearly = Math.max(0, Number(retainYearly) || 0);
  
  // Workloads helper
  const workloadLabelsMap = {
    'web-portal': 'Web / Portal Application',
    'api-backend': 'API / Mobile Backend',
    'enterprise-app': 'Enterprise Business Application',
    'transactional-platform': 'E-Commerce / Transactional Platform',
    'data-analytics': 'Data & Analytics Platform',
    'ai-ml-platform': 'AI / ML Platform',
    'iot-event-platform': 'IoT / Event-Driven Platform',
    'media-streaming': 'Media / Streaming Platform'
  };
  const activeWorkloads = workloads.map(w => workloadLabelsMap[w] || w);
  const workloadList = activeWorkloads.join(', ') || 'Web Application';
  const characteristicList = characteristics
    .map(value => characteristicLabelsMap[value] || value)
    .join(', ') || 'Stateless';

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
  const isLegacyOrVM = workloads.includes('enterprise-app') || challenges.includes('legacy-mod');
  const workloadSizing = buildWorkloadSizing({ workloads, characteristics, challenges, expectedUsers, peakConcurrencyOverride, recoveryTier, trafficPattern });
  workloadSizing.disclaimer = 'This sizing is based on typical workload patterns for the selected workload profile. Actual production sizing should be validated during detailed discovery, performance analysis, and migration planning.';
  workloadSizing.indicativeProfiles = buildIndicativeSizingProfiles({ workloads, characteristics, workloadSizing });
  const hasApiIntegrations = workloads.includes('api-backend') || trafficPattern === 'api';
  const complianceTierJustifiesRuntimeSecrets = isHighAvailability
    && (hasExplicitSecurityRequirement || hasExplicitDataSensitivity || isRegulatedIndustry || shouldDeployAdvancedGovernmentControls);
  const recommendsSecretManager = workloadSizing.platform !== 'Compute Engine'
    || hasCredentialRequirement
    || hasExplicitSecurityRequirement
    || (hasApiIntegrations && complianceTierJustifiesRuntimeSecrets);
  const hasPublicFacingCharacteristic = characteristics.includes('public-facing');
  const hasInternalOnlyCharacteristic = characteristics.includes('internal-only');
  const isInternalOrAdminWorkload = hasInternalOnlyCharacteristic
    || (accessPattern === 'internal' && !hasPublicFacingCharacteristic);
  const requiresRestrictedCorporateAccess = accessPattern === 'hybrid' && !hasPublicFacingCharacteristic;
  const requiresZeroTrustAccess = hasExplicitSecurityRequirement;
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
  if (workloads.includes('data-analytics')) {
    services.push({
      category: 'Compute',
      name: 'Dataflow',
      rationale: 'Serverless batch and streaming data processing pipeline. Handles ETL imports and dynamic aggregation workloads dynamically.',
      icon: 'cpu'
    });
  }

  // Special AI compute
  if (workloads.includes('ai-ml-platform')) {
    services.push({
      category: 'Compute',
      name: 'Vertex AI Pipelines',
      rationale: 'MLOps workflow coordinator. Automates machine learning model retraining, evaluating metrics, and registry cataloging.',
      icon: 'cpu'
    });
  }

  // --- DATABASE TIER ---
  let dbService = { category: 'Database', name: '', rationale: '', icon: 'database' };
  const isRelational = workloads.includes('enterprise-app')
    || workloads.includes('transactional-platform');
  const hasCriticalDatabaseSignal = isPublicSector
    || isRegulatedIndustry
    || hasPublicSectorWorkload
    || workloads.includes('enterprise-app')
    || challenges.includes('ha-req')
    || challenges.includes('dr-concern');
  const isCostOptimizedDatabaseProfile = recoveryTier === 'tier-4' || isBudgetOptimization;
  const shouldUseHighlyAvailableDatabase = isHighAvailability
    || (hasCriticalDatabaseSignal && !isCostOptimizedDatabaseProfile);
  
  if (workloads.includes('data-analytics')) {
    dbService.name = 'BigQuery';
    dbService.rationale = 'Serverless, highly scalable analytical data warehouse. Executes SQL queries on petabytes in seconds, separating compute and storage bills.';
  } else if (workloads.includes('ai-ml-platform')) {
    dbService.name = 'Vertex AI Vector Search';
    dbService.rationale = 'High-performance vector similarity search engine, enabling real-time semantic matches and context injection for RAG models.';
  } else if (isRelational || industry === 'Finance') {
    if (shouldUseHighlyAvailableDatabase) {
      dbService.name = 'Cloud SQL for PostgreSQL (HA)';
      dbService.rationale = `Managed relational database with synchronous replication to a standby zone within ${DEFAULT_DEPLOYMENT_REGION.id}.`;
    } else {
      dbService.name = 'Cloud SQL for PostgreSQL (Single Zone)';
      dbService.rationale = 'Cost-optimized PostgreSQL instance. Provides automated backups and patches, suitable for basic transactional workloads.';
    }
  } else {
    // NoSQL defaults
    if (isBudgetOptimization || isBudgetOptimizationOnly) {
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
  
  if (workloads.includes('media-streaming') || isHighTransfer) {
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
  const isPublicFacing = characteristics.includes('public-facing');
  const isInternalCharacteristic = characteristics.includes('internal-only');
  const hasMixedAccessSignals = isPublicFacing && isInternalCharacteristic;
  const effectiveAccessPattern = hasMixedAccessSignals
    ? 'mixed'
    : isPublicFacing
      ? 'public-facing'
      : isInternalCharacteristic
        ? 'internal-only'
        : accessPattern;
  const isInternalOnly = effectiveAccessPattern === 'internal-only' || (accessPattern === 'internal' && !isPublicFacing);

  const hasStaticContentDelivery = ['static', 'mixed', 'video'].includes(trafficPattern);
  const hasHighCdnTransfer = normalizedDataTransfer >= 2000;
  const hasExplicitCdnRequirement = challenges.includes('global-content-acceleration') || challenges.includes('cdn-acceleration');
  const hasPerformanceStaticDeliveryNeed = (challenges.includes('perf-bottleneck') || challenges.includes('scale-issue'))
    && isPublicFacing
    && hasStaticContentDelivery;
  const shouldUseCdn = !isInternalOnly && (
    workloads.includes('media-streaming')
    || hasHighCdnTransfer
    || (workloads.includes('transactional-platform') && isPublicFacing && normalizedDataTransfer >= 2000)
    || (workloads.includes('web-portal') && hasStaticContentDelivery && normalizedDataTransfer >= 2000)
    || hasPerformanceStaticDeliveryNeed
    || hasExplicitCdnRequirement
  );
  const requiresCloudVpn = challenges.includes('hybrid-conn')
    || challenges.includes('on-prem-integration')
    || challenges.includes('datacenter-connectivity')
    || challenges.includes('site-to-site-private-networking');
  const requiresPrivateServiceConnect = challenges.includes('private-service-consumption')
    || challenges.includes('private-google-api-access')
    || challenges.includes('private-service-publishing')
    || challenges.includes('multi-project-private-service');
  const needsInternalLoadBalancer = isInternalOnly
    && !isBudgetOptimization
    && (isHighAvailability || characteristics.includes('microservices') || workloads.includes('enterprise-app') || workloads.includes('transactional-platform'));
  const needsPublicLoadBalancer = !isInternalOnly
    && (shouldUseCdn || recommendsCloudArmor || challenges.includes('ddos-waf') || isHighAvailability || isPublicFacing);

  if (needsInternalLoadBalancer) {
    netService.name = 'Internal HTTPS Load Balancer';
    netService.rationale = `Routes private corporate application traffic to cloud workloads deployed in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  } else if (shouldUseCdn) {
    netService.name = 'Global HTTPS Load Balancer & Cloud CDN';
    netService.rationale = `Global HTTPS Load Balancer routes requests to healthy backends, while Cloud CDN reduces origin load and improves delivery performance for cacheable content. Final cost impact depends on cache hit ratio, traffic geography, and egress patterns for ${normalizedDataTransfer.toLocaleString()} GB/month.`;
  } else if (needsPublicLoadBalancer) {
    netService.name = 'Global HTTPS Load Balancer';
    netService.rationale = `Edge routing proxy with unified SSL termination for zonal compute backends in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  } else if (!isInternalOnly) {
    netService.name = 'Regional HTTPS Load Balancer';
    netService.rationale = `Balances application traffic across container groups or VMs in ${DEFAULT_DEPLOYMENT_REGION.id}.`;
  }
  if (netService.name) services.push(netService);
  const recommendsCloudCdn = netService.name.includes('Cloud CDN');

  if (requiresCloudVpn) {
    services.push({
      category: 'Networking',
      name: 'Cloud VPN',
      rationale: 'Provides site-to-site private connectivity between Google Cloud VPC networks and on-premises or datacenter environments.',
      icon: 'globe'
    });
  }

  if (requiresPrivateServiceConnect) {
    services.push({
      category: 'Networking',
      name: 'Private Service Connect',
      rationale: 'Provides private service consumption, publishing, or Google API access across VPC and multi-project service architectures.',
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

  let pattern = '';
  if (workloads.includes('data-analytics')) {
    pattern = 'Serverless Data Ingestion Lake with Dataflow pipeline and BigQuery analytics';
  } else {
    const accessServiceName = securityDecisions.identityAwareProxy && !netService.name
      ? 'Identity-Aware Proxy (IAP)'
      : netService.name || null;
    const patternServices = [dbService.name, accessServiceName, storageService.name].filter(Boolean);
    pattern = `${computeService.name} with ${formatListWithAnd(patternServices)}.`;
  }

  // 3. Generate Executive Summary (PHASE 7)
  const challengeNarrative = getChallengeNarrative(challenges);
  const challengeLabel = challengeNarrative.selectedLabels.length
    ? formatListWithAnd(challengeNarrative.selectedLabels)
    : challengeNarrative.label;
  let businessOutcome = `${projectName} is assessed for ${industryLabel} ${challengeNarrative.focus} across ${workloadList}. `;
  businessOutcome += `${challengeNarrative.outcome} The proposed architecture pattern (${pattern.replace(/\.$/, '')}) supports ${scaleLabel} from ${DEFAULT_DEPLOYMENT_REGION.label} and links the selected ${challengeLabel} priority to ${challengeNarrative.impact}`;

  const benefits = [...challengeNarrative.benefits];

  const addBenefit = benefit => {
    if (!benefit || benefits.includes(benefit)) return;
    const label = benefit.split(':')[0];
    if (label && benefits.some(existing => existing.split(':')[0] === label)) return;
    benefits.push(benefit);
  };

  if (workloadSizing.platform === 'Cloud Run') {
    addBenefit('Reduced Platform Burden: Serverless containers remove cluster and operating-system administration from the delivery path.');
  } else if (workloadSizing.platform === 'GKE') {
    addBenefit('Delivery Governance: Managed Kubernetes standardizes container operations and supports coordinated release control across service teams.');
  } else if (workloadSizing.platform === 'Compute Engine') {
    addBenefit(challenges.includes('legacy-mod')
      ? 'Migration Sequencing: VM-based workloads can be rehosted first, reducing migration risk before deeper modernization decisions are made.'
      : 'Operational Continuity: Existing operating system and application dependencies are retained while the platform gains managed scaling and recovery controls.');
  }

  if (securityDecisions.cloudArmor && recommendsCloudKms) {
    addBenefit('Security Governance: Cloud Armor narrows public attack exposure while Cloud KMS provides stronger control over regulated data encryption.');
  } else if (securityDecisions.cloudArmor) {
    addBenefit('Edge Protection: Cloud Armor adds policy-based filtering and rate controls at the application entry point.');
  } else if (recommendsCloudKms) {
    addBenefit('Encryption Governance: Cloud KMS supports stronger stewardship over sensitive or regulated data assets.');
  }

  if (challenges.includes('perf-bottleneck')) {
    addBenefit(recommendsCloudCdn
      ? 'Performance Headroom: Integrated caching and CDN controls reduce origin pressure and improve responsiveness during traffic peaks.'
      : 'Performance Headroom: Managed caching reduces repeated database reads without adding unnecessary edge components.');
  }

  const strategicBenefits = buildStrategicBusinessBenefits({
    challenges,
    workloadSizing,
    securityDecisions,
    recommendsCloudKms,
    recommendsCloudCdn,
    isHighAvailability,
    hasHybridEstate: workloads.length >= 3 || workloads.includes('enterprise-app')
  });

  const execSummary = {
    businessOutcome,
    scale: scaleLabel,
    availabilityTarget: slaLabel,
    pattern,
    benefits: strategicBenefits
  };

  // 4. Generate Architecture Summary
  let summary = `The proposal positions ${projectName} on Google Cloud with architecture choices aligned to ${industryLabel} operating, governance, and resilience needs. `;
  summary += `The primary deployment region is ${DEFAULT_DEPLOYMENT_REGION.label}, with service choices shaped by the selected workload profile (${workloadList}) and architecture characteristics (${characteristicList}). `;
  
  if (workloads.includes('data-analytics')) {
    summary += `Data ingestion lands in Cloud Storage, transformation is handled through Dataflow, and curated datasets are served from BigQuery for governed reporting and executive analytics.`;
  } else {
    const accessSummary = securityDecisions.identityAwareProxy && !netService.name
      ? 'access is controlled through Identity-Aware Proxy'
      : netService.name
        ? `ingress is controlled through ${netService.name}`
        : 'access is controlled through the selected application runtime without an additional load-balancing layer';
    summary += `The application tier uses ${computeService.name}, the data layer uses ${dbService.name}, object storage is placed on ${storageService.name}, and ${accessSummary}.`;
  }

  // Industry-specific summaries
  if (industry === 'Finance') {
    summary += ` The design prioritizes auditability, segmentation, and reliable transactional processing for regulated financial workloads.`;
  } else if (industry === 'Healthcare') {
    summary += recommendsCloudKms
      ? ` Customer-managed encryption and audit trails strengthen governance for sensitive healthcare records.`
      : ` Audit logging and least-privilege service access provide a practical governance baseline for healthcare data handling.`;
  } else if (industry === 'Government' || industry === 'GLC') {
    const publicControls = [
      securityDecisions.cloudArmor ? 'Cloud Armor WAF filtering' : null,
      recommendsVpcServiceControls ? 'VPC Service Controls boundaries' : null,
      recommendsCloudKms ? 'Cloud KMS customer-managed keys' : null,
      securityDecisions.identityAwareProxy ? 'Identity-Aware Proxy access gates' : null
    ].filter(Boolean);
    summary += publicControls
      ? ` Public-sector governance is reinforced through ${formatListWithAnd(publicControls)}. Together, these controls reduce public attack exposure and strengthen protection for regulated workloads.`
      : ` Public-sector governance focuses on least-privilege service access, auditability, and controlled recovery readiness.`;
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
    const networkDR = netService.name
      ? netService.name.includes('Cloud CDN')
        ? 'Global HTTPS Load Balancer performs health-based routing across available backends. Cloud CDN, when enabled, improves cacheable content delivery and reduces origin load.'
        : `${netService.name} performs health-based routing across available backends.`
      : 'Access control is kept minimal and should be validated through application-level recovery testing.';
    recoveryDR = `Designed for mission-critical operations in ${DEFAULT_DEPLOYMENT_REGION.label}. ${computeDR} ${dbService.name} uses its highest supported in-region availability configuration, and ${networkDR} Recovery targets must be validated through scheduled failover exercises.`;
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
      return '**Long-Term Archive:** Long-term monthly and yearly archive retention is not enabled in this assessment, keeping storage commitments aligned to the selected cost and recovery posture.';
    }
    const formatRetention = (value, singular, plural) => `${value} ${value === 1 ? singular : plural}`;
    const retentionParts = [];
    if (normalizedRetainMonthly > 0) retentionParts.push(`monthly backups for ${formatRetention(normalizedRetainMonthly, 'month', 'months')} in Coldline storage`);
    if (normalizedRetainYearly > 0) retentionParts.push(`yearly backups for ${formatRetention(normalizedRetainYearly, 'year', 'years')} in Archive class`);
    return `**Long-Term Archive:** Retain ${retentionParts.join(' and ')} to support audit, recovery, and governance expectations without overextending hot-storage cost.`;
  })();
  const estimatedIncrementalBackupGb = normalizedProductionDataSize * dailyChangeRate / 100;
  const estimatedBackupDataNote = normalizedProductionDataSize > 0
    ? `**Estimated Backup Data:** Based on ${normalizedProductionDataSize.toLocaleString()} GB of estimated production data and a ${dailyChangeRate}% daily change rate, the expected incremental backup data is approximately ${estimatedIncrementalBackupGb.toFixed(1)} GB per day, pending validation during discovery.`
    : '**Estimated Backup Data:** Backup capacity sizing requires an estimated production data size and should be completed during detailed discovery.';

  const backupStrategy = [
    `**Backup Retention Policy:** Retain daily recovery points for ${retainDaily} days using managed storage controls so operational recovery remains predictable.`,
    `**Weekly Archive:** Replicate weekly snapshots for ${retainWeekly} weeks into lower-cost storage through lifecycle automation.`,
    longTermArchive,
    estimatedBackupDataNote
  ];

  if (challenges.includes('manual-backup')) {
    backupStrategy.push('**Automated Backup Protection:** Replace manual backup activity with scheduled database and object-storage protection to reduce operational risk and improve recovery confidence.');
  } else {
    backupStrategy.push('**Scheduled Snapshots:** Maintain automated database snapshots and bucket versioning as the baseline control for recoverability.');
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
  if (isBudgetOptimization) {
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
  const accessAssumption = accessPattern === 'hybrid'
    ? 'Access Pattern: Hybrid access is assumed to support both public internet users and authenticated corporate/internal users.'
    : `Access Pattern: ${effectiveAccessPattern === 'mixed' ? 'Mixed public-facing and internal/corporate access requires confirmation before final ingress design.' : effectiveAccessPattern === 'public-facing' ? 'Public-facing access is assumed for internet users.' : effectiveAccessPattern === 'internal-only' ? 'Internal-only or corporate access is assumed.' : `${accessPattern} access is assumed.`} Traffic profile is ${trafficPattern}.`;
  const assumptions = [
    `Deployment Region: Primary deployment is assumed in ${DEFAULT_DEPLOYMENT_REGION.label}, subject to customer data residency and service availability confirmation.`,
    `Workload Scale: The assessment uses ${scaleLabel} and ${normalizedExpectedUsers.toLocaleString()} expected monthly users as the current planning baseline.`,
    accessAssumption,
    normalizedProductionDataSize > 0
      ? `Production Data Size: Backup and retention sizing uses the provided ${normalizedProductionDataSize.toLocaleString()} GB production data estimate and should be validated during discovery.`
      : 'Production Data Size: Backup capacity sizing requires a confirmed production data estimate during detailed discovery.',
    `Recovery / Retention Inputs: Recovery tier, ${dailyChangeRate}% daily change rate, and retention windows are treated as planning inputs until validated against operational recovery requirements.`,
    'Sizing Basis: Recommended workload sizing is indicative and should be refined through detailed discovery, performance testing, and production telemetry.'
  ];
  const sizingNotes = [
    `Workload scale: ${normalizedExpectedUsers.toLocaleString()} expected monthly users (${scaleLabel}).`,
    `Peak concurrency estimate: ${workloadSizing.peakConcurrencyEstimate.toLocaleString()} users (${workloadSizing.peakConcurrencySource.toLowerCase()}).`,
    `Recommended compute tier: ${workloadSizing.tier}.`,
    `Transfer baseline: ${normalizedDataTransfer.toLocaleString()} GB/month.`
  ];

  // 10. Risks
  const isPublicAccess = accessPattern !== 'internal';
  const isLikelyPublicWorkload = isPublicAccess || characteristics.includes('public-facing') || workloads.some(workload => [
    'web-portal',
    'api-backend',
    'transactional-platform'
  ].includes(workload));
  const risks = [
    '**Architecture Validation:** Proposed sizing, autoscaling behavior, concurrency assumptions, and quota needs should be validated through detailed discovery, load testing, and production telemetry.',
    '**Application Readiness:** Application dependencies, runtime constraints, licensing, session handling, and failover behavior should be confirmed before implementation planning.',
    '**Data Governance:** Data residency, classification, retention, and compliance obligations should be confirmed with the customer before production design sign-off.'
  ];
  const addConsideration = item => {
    if (item && !risks.includes(item) && risks.length < 6) risks.push(item);
  };
  if (recommendsCloudArmor || recommendsCloudKms || recommendsVpcServiceControls || securityDecisions.identityAwareProxy || challenges.includes('sec-compliance') || challenges.includes('ddos-waf')) {
    addConsideration('**Security Operations:** WAF policy tuning, encryption-key ownership, access governance, and security monitoring responsibilities should be confirmed before production rollout.');
  }
  if (isHighAvailability || challenges.includes('dr-concern') || challenges.includes('manual-backup') || recoveryTier === 'tier-1' || recoveryTier === 'tier-2') {
    addConsideration('**Recovery Validation:** Backup restore testing, database failover behavior, RTO/RPO targets, and recovery runbooks should be validated through scheduled exercises.');
  }
  if (challenges.includes('perf-bottleneck') || challenges.includes('scale-issue')) {
    addConsideration('**Performance Bottleneck Review:** Code-level constraints, database tuning, downstream systems, and integration dependencies should be reviewed alongside infrastructure scaling.');
  }
  if (hasMixedAccessSignals) {
    addConsideration('**Access Model Clarification:** Public and internal access paths should be confirmed so ingress controls can be finalized without overcomplicating the design.');
  }
  const hasSingleVmCompute = computeService.name.includes('Single VM');
  const hasSingleZoneDatabase = /Single Zone/i.test(dbService.name) || (dbService.name.includes('Cloud SQL') && !/HA|High Availability/i.test(dbService.name));
  const hasExplicitSingleZoneDeployment = /single-zone|single zone/i.test(`${computeService.name} ${computeService.rationale} ${dbService.name} ${dbService.rationale}`);
  if (hasSingleVmCompute || hasSingleZoneDatabase || hasExplicitSingleZoneDeployment) {
    addConsideration('**Availability Posture:** Single-zone components should be reviewed against the selected availability target before production deployment.');
  } else if (recoveryTier === 'tier-4') {
    addConsideration('**Recovery Posture:** Cost-optimized recovery accepts longer restoration time and reduced redundancy compared with higher availability tiers.');
  }
  if (!recommendsCloudArmor && isLikelyPublicWorkload) {
    addConsideration('**Edge Protection Review:** WAF and DDoS protection should be revisited if public threat exposure or compliance expectations increase.');
  }
  if (dbService.name === 'Cloud Spanner') {
    addConsideration('**Cost Governance:** Database baseline cost and utilization should be monitored so the selected service remains aligned with business value.');
  }
  if (challenges.includes('scale-issue') && workloadSizing.platform === 'Compute Engine') {
    addConsideration('**Performance Bottleneck Review:** VM startup behavior and downstream dependencies should be tested against expected traffic surges.');
  }
  if (isLargeAudience) {
    addConsideration('**Architecture Validation:** Audience scale, database connections, and quota limits should be validated through representative load testing.');
  }
  if (isVeryHighTransfer) {
    addConsideration('**Cost Governance:** High data transfer volumes should be monitored for cache efficiency, traffic geography, and egress behavior.');
  }

  // 11. Generate Layered Mermaid Graph (FEATURE 4)
  const activeNodes = {
    // Users Layer
    User: isInternalOnly ? 'User([Corporate / Internal Users]):::client' : 'User([User Clients / Browser]):::client',
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
  const recommendsCloudVpn = services.some(service => service.name === 'Cloud VPN');
  const recommendsPrivateServiceConnect = services.some(service => service.name === 'Private Service Connect');
  if (netService.name.includes('Global')) {
    activeNodes.GCLB = 'GCLB[Global HTTPS Load Balancer]:::gateway';
    if (netService.name.includes('CDN')) {
      activeNodes.CDN = 'CDN[Cloud CDN Cache]:::gateway';
    }
  } else if (netService.name.includes('Internal')) {
    activeNodes.GCLB = 'GCLB[Internal HTTPS Load Balancer]:::gateway';
  } else if (isInternalOnly) {
    activeNodes.GCLB = null;
  } else if (netService.name.includes('Regional')) {
    activeNodes.GCLB = 'GCLB[Regional HTTPS Load Balancer]:::gateway';
  } else if (netService.name) {
    activeNodes.GCLB = 'GCLB[VPC Gateway / Cloud DNS]:::gateway';
  }

  if (recommendsCloudVpn) {
    activeNodes.VPN = 'VPN[Cloud VPN Gateway]:::gateway';
  }
  if (recommendsPrivateServiceConnect) {
    activeNodes.NAT = 'NAT[Private Service Connect]:::gateway';
  }

  // Populate Security Layer
  if (securityDecisions.cloudArmor) {
    activeNodes.Armor = 'Armor[Cloud Armor WAF]:::sec';
  }
  if (securityDecisions.secretManager) {
    activeNodes.SecMgr = 'SecMgr[Secret Manager]:::sec';
  }
  // IAP remains a recommended governance control, but the customer-facing
  // topology focuses on application traffic and runtime dependencies.

  // Populate Application Layer
  if (workloads.includes('data-analytics')) {
    activeNodes.Dataflow = 'Dataflow[Dataflow Pipelines]:::compute';
  }
  if (workloads.includes('ai-ml-platform')) {
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
  if (workloads.includes('data-analytics')) {
    activeNodes.BigQuery = 'BigQuery[(BigQuery DWH)]:::storage';
  }
  if (workloads.includes('ai-ml-platform')) {
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
  if (activeNodes.GCLB || activeNodes.CDN || activeNodes.NAT || activeNodes.VPN) {
    mermaid += '  subgraph Network ["Network Layer"]\n';
    if (activeNodes.GCLB) mermaid += `    ${activeNodes.GCLB}\n`;
    if (activeNodes.CDN) mermaid += `    ${activeNodes.CDN}\n`;
    if (activeNodes.NAT) mermaid += `    ${activeNodes.NAT}\n`;
    if (activeNodes.VPN) mermaid += `    ${activeNodes.VPN}\n`;
    mermaid += '  end\n\n';
  }

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
  if (isInternalOnly && activeNodes.VPN && activeNodes.GCLB) {
    mermaid += '  User --> VPN\n';
    mermaid += '  VPN --> GCLB\n';
  } else if (activeNodes.GCLB) {
    mermaid += '  User --> GCLB\n';
    if (activeNodes.VPN) {
      mermaid += '  VPN --> GCLB\n';
    }
  } else if (activeNodes.Compute) {
    mermaid += '  User --> Compute\n';
  }

  if (activeNodes.CDN && activeNodes.GCLB) {
    mermaid += '  GCLB --> CDN\n';
  }

  let nextHop = activeNodes.GCLB ? 'GCLB' : 'User';
  if (activeNodes.Armor) {
    mermaid += `  ${nextHop} --> Armor\n`;
    nextHop = 'Armor';
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
      mermaid += '  ComputeA -.->|reads secrets| SecMgr\n';
      mermaid += '  ComputeB -.->|reads secrets| SecMgr\n';
    } else if (activeNodes.Compute) {
      mermaid += '  Compute -.->|reads secrets| SecMgr\n';
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
    productionDataSize: normalizedProductionDataSize,
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
