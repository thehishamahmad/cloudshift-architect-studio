/**
 * CloudShift AI Architect - Heuristics Rules Engine (Version 1.2)
 * Fully rules-driven combinatorics engine mapping customer challenges, workload profiles,
 * characteristics, traffic parameters, recovery tiers, and retention rules to Google Cloud assessments.
 */

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
    concurrentUsers = 1000,
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
  const isMultiRegion = recoveryTier === 'tier-1';
  const isHighSecurity = challenges.includes('sec-compliance') || challenges.includes('ddos-waf') || industry === 'Finance' || industry === 'Healthcare' || industry === 'Government' || industry === 'GLC';
  const isStrictSecurity = challenges.includes('sec-compliance') && (industry === 'Finance' || industry === 'Government' || industry === 'Healthcare');
  const isLowBudget = budget === 'low';
  const isHighBudget = budget === 'high';
  
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
    'citizen-portal': 'Citizen Portal',
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
  const scaleLabel = scaleLabels[users] || '10,000 - 100,000 MAU';

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
  let computeService = { category: 'Compute', name: '', rationale: '', icon: 'cpu' };
  
  const isLegacyOrVM = characteristics.includes('legacy') || characteristics.includes('vm-based');
  const isContainerized = characteristics.includes('containerized');
  const isEventDriven = characteristics.includes('event-driven');

  if (isLegacyOrVM) {
    if (isHighBudget || isHighAvailability || workloads.includes('erp') || workloads.includes('crm')) {
      computeService.name = 'Compute Engine (Managed Instance Groups)';
      computeService.rationale = 'Deploys autoscaling, load-balanced pools of VM instances across zones. Features automated health-check repairs suitable for stateful legacy workloads.';
    } else {
      computeService.name = 'Compute Engine (Single VM)';
      computeService.rationale = 'Standard virtual machine instance. Best for monolithic, VM-based applications with low scale or dev/test profiles.';
    }
  } else if (isContainerized) {
    if (isLowBudget && recoveryTier === 'tier-4') {
      computeService.name = 'Cloud Run';
      computeService.rationale = 'Serverless container orchestration. Eliminates idle hosting fees by scaling down to zero when requests stop.';
    } else if (isHighBudget || recoveryTier === 'tier-1' || recoveryTier === 'tier-2') {
      computeService.name = 'GKE Standard (Autoscaling Cluster)';
      computeService.rationale = 'Enterprise Kubernetes cluster with fine-grained node pool configurations, active auto-scaling, and support for high-density container mesh networks.';
    } else {
      computeService.name = 'GKE Autopilot';
      computeService.rationale = 'Hands-off Google-managed GKE cluster. Automatically sizes nodes based on container pod requests, maximizing operational simplicity.';
    }
  } else if (isEventDriven && isLowBudget) {
    computeService.name = 'Cloud Functions (Serverless)';
    computeService.rationale = 'Lightweight microservice runtimes that execute on demand in response to pub/sub messages or HTTP requests.';
  } else {
    // Fallback
    computeService.name = 'Cloud Run';
    computeService.rationale = 'Serverless runtime to deploy stateless web apps and APIs with minimal cluster management.';
  }
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
    if (isHighBudget && isMultiRegion) {
      dbService.name = 'Cloud Spanner';
      dbService.rationale = 'Globally-distributed relational database. Satisfies strict ACID consistency across geographic regions with 99.999% SLA uptime.';
    } else if (isHighAvailability) {
      dbService.name = 'Cloud SQL for PostgreSQL (HA)';
      dbService.rationale = 'Managed relational database set up with synchronous replication to a standby instance in a different availability zone.';
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
  
  if (workloads.includes('streaming') || workloads.includes('lms')) {
    storageService.name = 'Cloud Storage (Multi-Regional)';
    storageService.rationale = 'Highly durable object storage replicated across multiple regions, optimized for streaming media and static files.';
  } else if (isMultiRegion) {
    storageService.name = 'Cloud Storage (Multi-Regional)';
    storageService.rationale = 'Geographically redundant object storage. Prevents local region downtime and improves download speeds globally.';
  } else if (isHighAvailability) {
    storageService.name = 'Cloud Storage (Dual-Region)';
    storageService.rationale = 'Object storage bucket mirrored across two distinct regions (e.g., us-central1 and us-east1) for high resiliency.';
  } else {
    storageService.name = 'Cloud Storage (Regional)';
    storageService.rationale = 'Cost-effective object bucket located in a single region, perfect for local backups, audit logs, and temp files.';
  }
  services.push(storageService);

  if (characteristics.includes('stateful') && isLegacyOrVM) {
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

  if (isInternalOnly) {
    netService.name = 'Private Service Connect & Cloud VPN';
    netService.rationale = 'Enables secure local access to cloud APIs and compute nodes, establishing an IPsec VPN tunnel directly to your remote office.';
  } else if (isMultiRegion || workloads.includes('streaming') || trafficPattern === 'video') {
    netService.name = 'Global HTTPS Load Balancer & Cloud CDN';
    netService.rationale = 'Routes global user requests to the closest healthy compute node, caching static files at global Edge locations to reduce latency.';
  } else if (challenges.includes('ddos-waf') || isHighAvailability) {
    netService.name = 'Global HTTPS Load Balancer';
    netService.rationale = 'Edge routing proxy with unified SSL termination, redirecting requests dynamically across zonal compute backends.';
  } else {
    netService.name = 'Regional HTTPS Load Balancer';
    netService.rationale = 'Balances application traffic across container groups or VMs within a single target region.';
  }
  services.push(netService);

  if (isHybridAccess || challenges.includes('hybrid-conn')) {
    services.push({
      category: 'Networking',
      name: 'Cloud VPN / Interconnect',
      rationale: 'Configures secure enterprise connectivity linking VPC networks back to corporate environments via IPsec or Dedicated Fiber links.',
      icon: 'globe'
    });
  }

  // --- SECURITY TIER ---
  let secService = { category: 'Security', name: '', rationale: '', icon: 'shield' };
  
  if (isStrictSecurity || workloads.includes('gov-portal') || workloads.includes('citizen-portal')) {
    secService.name = 'VPC Service Controls & Cloud KMS (CMEK) & IAP';
    secService.rationale = 'Strict data security posture: KMS encrypts assets with customer-managed keys, IAP checks credentials, and VPC-SC prevents leakage.';
  } else if (isHighSecurity) {
    secService.name = 'Cloud Armor WAF & Secret Manager';
    secService.rationale = 'Cloud Armor filters Layer 7 attacks and DDoS waves, while Secret Manager safely injects API tokens and database keys at runtime.';
  } else {
    secService.name = 'IAM Roles & Service Accounts';
    secService.rationale = 'Enforces baseline authentication and limits program credentials to minimum access roles.';
  }
  services.push(secService);

  // 3. Generate Executive Summary (PHASE 7)
  let businessOutcome = `Establish a secure, resilient, and optimized Google Cloud architecture blueprint for the **${projectName}** platform. `;
  businessOutcome += `By integrating workloads (${workloadList}) under an industry sector aligned to ${industryLabel}, the platform is engineered to support up to ${scaleLabel} while maintaining SLA compliance.`;

  let pattern = '';
  if (isLegacyOrVM) {
    pattern = 'VM-based MIG Architecture with Cloud SQL HA and Cloud VPN Hybrid Link';
  } else if (workloads.includes('analytics') || workloads.includes('dwh')) {
    pattern = 'Serverless Data Ingestion Lake with Dataflow pipeline and BigQuery analytics';
  } else if (isLowBudget) {
    pattern = 'Serverless Containerized Scale-to-Zero Blueprint (Cloud Run + Firestore)';
  } else {
    pattern = `${computeService.name} container cluster integrated with ${dbService.name} and global load balancers.`;
  }

  const benefits = [];
  if (isLowBudget) {
    benefits.push('Cost Optimization: Resource runtimes scale down to zero when idle, eliminating passive compute bills.');
  } else {
    benefits.push('High Resilience: Multi-zone redundancy ensures continuous user session operations during zone outages.');
  }

  if (challenges.includes('legacy-mod')) {
    benefits.push('Migration Alignment: Supports VM-based workloads with MIG scaling rules, accelerating time-to-market.');
  } else {
    benefits.push('Modernization: Relies on managed container clusters to eliminate OS configuration and patch management.');
  }

  if (isHighSecurity) {
    benefits.push('Compliance & WAF: Restricts network entry points via Cloud Armor and secures database columns with KMS encryption.');
  }

  if (challenges.includes('perf-bottleneck')) {
    benefits.push('Performance Acceleration: Integrated caching and edge-CDN configurations reduce database query bottlenecks.');
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
  summary += `It coordinates inputs from workload profile (${workloadList}) and characteristics (${characteristics.join(', ') || 'Stateless, Containerized'}). `;
  
  if (isLegacyOrVM) {
    summary += `Because the profile contains VM-Based or Legacy parameters, the runtime uses ${computeService.name} with auto-healing and manual migration paths. Relational databases are managed via Cloud SQL in High Availability mode to safeguard records.`;
  } else if (workloads.includes('analytics') || workloads.includes('dwh')) {
    summary += `Pipes ingestion data streams directly into Cloud Storage, parsing events via Dataflow pipelines. Results are loaded into BigQuery for sub-second business intelligence dashboards.`;
  } else if (isLowBudget) {
    summary += `Designed as a serverless static structure. Stateless container code runs on Cloud Run, routing documents to Cloud Firestore to minimize ongoing infrastructure costs.`;
  } else {
    summary += `Utilizes enterprise container orchestration via ${computeService.name} inside a private VPC network. The data layer uses a transactional ${dbService.name} with synchronous replication to standalone backup nodes.`;
  }

  // Industry-specific summaries
  if (industry === 'Finance') {
    summary += ` Strong relational consistency and strict compliance are enforced to meet financial audit requirements.`;
  } else if (industry === 'Healthcare') {
    summary += ` Secure customer-managed keys (CMEK) and audit trails are enabled across all storage blocks to comply with HIPAA guidelines.`;
  } else if (industry === 'Government' || industry === 'GLC') {
    summary += ` Strictly isolated network boundaries and Identity-Aware Proxy guards protect citizen information from public exfiltration vectors.`;
  }

  // 5. Recovery & DR Design (PHASE 5 & 7)
  let recoveryDR = '';
  let rtoValue = '';
  let rpoValue = '';

  if (recoveryTier === 'tier-1') {
    rtoValue = '< 15 Min';
    rpoValue = '< 1 Min';
    recoveryDR = `Designed for mission-critical operations. The architecture deploys multi-region active-active compute groups (GKE clusters in separate regions). Relational database transactions run on Cloud Spanner to ensure real-time global consistency and avoid regional failover data loss. A Global Load Balancer performs sub-second health checks and instantly redirects traffic on regional outages.`;
  } else if (recoveryTier === 'tier-2') {
    rtoValue = '< 2 Hours';
    rpoValue = '< 15 Min';
    recoveryDR = `Designed for high regional resiliency. Serves compute nodes across two separate availability zones in a single region (e.g. us-central1-a and us-central1-b). Databases run in High Availability (HA) mode with synchronous block-level replication, automatically promoting the standby replica in the second zone if the primary database crashes.`;
  } else if (recoveryTier === 'tier-3') {
    rtoValue = '< 8 Hours';
    rpoValue = '< 4 Hours';
    recoveryDR = `Designed for standard production. Deploys compute and database instances within a single region. The application relies on automated database snapshots replicated to a secondary region. In the event of a disaster, manual or scripted IaC (Terraform) templates must redeploy the compute cluster and restore the database from snapshots.`;
  } else {
    rtoValue = '< 24 Hours';
    rpoValue = '< 24 Hours';
    recoveryDR = `Cost-optimized recovery. Utilizes serverless Cloud Run compute which has no zonal standby costs. DR recovery relies on restoring the latest daily database snapshot to a newly created database instance. This tier tolerates cold-start database restoration delays to minimize baseline expenses.`;
  }

  // 6. Backup Strategy (PHASE 5 & 7)
  const backupStrategy = [
    `**Backup Retention Policy:** Retain daily backups for **${retainDaily} days** in Cloud Storage (Standard class).`,
    `**Weekly Archive:** Replicate weekly snapshots for **${retainWeekly} weeks** in Cloud Storage (Nearline class) using automated Lifecycle policies.`,
    `**Long-Term Archive:** Retain monthly backups for **${retainMonthly} months** in Coldline storage, and yearly backups for **${retainYearly} years** in Archive class to meet compliance guidelines.`,
    `**Estimated Backup Data:** Daily data change rate of ${dailyChangeRate}% on a baseline traffic footprint implies daily incremental backup volumes averaging **${(dataTransfer * dailyChangeRate / 100).toFixed(1)} GB**.`
  ];

  if (challenges.includes('manual-backup')) {
    backupStrategy.push('**Automated Backup Protection:** Automate SQL and Object storage snapshot schedules using Cloud Backup and DR, replacing manual operator cron scripts to eliminate risk.');
  } else {
    backupStrategy.push('**Scheduled Snapshots:** Standard automated database snapshots and bucket versioning rules are enabled by default.');
  }

  // 7. Security Recommendations
  const securityRecs = [];
  if (isStrictSecurity || workloads.includes('gov-portal') || workloads.includes('citizen-portal')) {
    securityRecs.push('**VPC Service Controls:** Sets secure boundaries around databases and storage APIs to block compromised compute nodes from exfiltrating data to external addresses.');
    securityRecs.push('**Identity-Aware Proxy (IAP):** Mandates zero-trust user validation against Identity provider groups before routing traffic to private network endpoints.');
    securityRecs.push('**Customer-Managed Encryption Keys (CMEK):** Mandates that all disks, databases, and storage blocks be encrypted using custom keys managed inside Cloud KMS.');
  } else if (isHighSecurity) {
    securityRecs.push('**Cloud Armor WAF Rules:** Configures WAF security filters to intercept SQL injection attacks, cross-site scripting (XSS), and Layer 7 HTTP flood scripts.');
    securityRecs.push('**Secret Manager Credentials:** Restricts database passwords, keys, and API tokens from code repos, injecting them dynamically at runtime.');
  } else {
    securityRecs.push('**Dedicated Service Accounts:** Assigns distinct IAM identities to each microservice with minimal permissions instead of using the default editor service account.');
  }

  if (challenges.includes('ddos-waf')) {
    securityRecs.push('**Cloud Armor Edge Shielding:** Enforces rate-limiting policies at the load balancer level to drop DDoS traffic waves before they consume backend compute.');
  }

  if (industry === 'Healthcare') {
    securityRecs.push('**HIPAA Data Access Logging:** Enables Data Access Audit logs across Cloud SQL and Cloud Storage to record all reads and writes on user health folders.');
  } else if (industry === 'Finance') {
    securityRecs.push('**PCI-DSS Subnet Segmentation:** Isolates payment transaction APIs inside private VPC subnets with ingress firewalls routing through Cloud NAT gateways.');
  }
  
  securityRecs.push('**SSL/TLS 1.3 Transport Protection:** Restricts Load Balancer listener profiles to reject outdated cipher configurations under TLS 1.2.');

  // 8. Cost Optimization Recommendations
  const costRecs = [];
  if (isLowBudget || challenges.includes('budget-opt')) {
    if (isContainerized) {
      costRecs.push('**Serverless Scale-to-Zero:** Configures Cloud Run concurrency thresholds to shut down inactive container instances during idle periods, stopping resource bills.');
    }
    costRecs.push('**Scheduled Database Outage:** Auto-schedules non-production Cloud SQL instances to shut down during nights and weekends, reducing idle DB hours by ~60%.');
  } else {
    if (computeService.name.includes('GKE')) {
      costRecs.push('**GKE Horizontal Pod Autoscaling (HPA):** Scales pod counts dynamically according to CPU/memory limits, ensuring you do not over-provision node VMs.');
    }
    costRecs.push('**Committed Use Discounts (CUDs):** Recommends purchasing 1-year or 3-year resource commitments for baseline compute cluster nodes, yielding up to 37% savings.');
  }

  if (challenges.includes('budget-opt')) {
    costRecs.push('**Cloud Storage Lifecycle Trimming:** Sets strict lifecycle deletion rules on raw scratch folders and temp tables to avoid paying for orphaned blocks.');
  }

  costRecs.push('**GCS Lifecycle Rules:** Establishes policies in Cloud Storage to automatically transition raw log files to Nearline or Archive classes after 30 days.');

  // 9. Assumptions
  const assumptions = [
    `Assumed workload scale behaves proportionally to the selected user range (${scaleLabel}).`,
    `Assumed data residency laws permit storage of primary datasets in Google Cloud public zones.`,
    `Assumed access patterns (${accessPattern}) and traffic profiles (${trafficPattern}) represent steady-state operations.`
  ];
  
  if (isLegacyOrVM) {
    assumptions.push('Assumed the enterprise possesses the necessary VM licenses (e.g. Windows/SUSE) for Compute Engine migration.');
  }

  // 10. Risks
  const risks = [];
  if (recoveryTier === 'tier-4' || recoveryTier === 'tier-3') {
    risks.push('**Single Point of Failure (SPOF):** Running single-zone database or compute nodes represents a SPOF. Zonal maintenance or outages will cause service downtime.');
  }
  if (!isHighSecurity && !isStrictSecurity) {
    risks.push('**WAF Exposure (No DDoS Shielding):** Without Cloud Armor WAF, the application endpoints are exposed to Layer 7 exploits and malicious crawler scripting.');
  }
  if (dbService.name === 'Cloud Spanner') {
    risks.push('**Database Base Billing Overhead:** Cloud Spanner imposes high baseline costs. Database instances must be monitored closely to prevent them from dominating monthly cloud invoices.');
  }
  if (challenges.includes('scale-issue') && isLegacyOrVM) {
    risks.push('**Legacy VM Autoscaling Lag:** VM instances in MIGs can take minutes to boot and compile, which might lead to packet drop during rapid traffic surges compared to lightweight containers.');
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
  if (isInternalOnly) {
    activeNodes.GCLB = 'GCLB[Private Service Connect Endpoints]:::gateway';
    activeNodes.VPN = 'VPN[Cloud VPN Gateway]:::gateway';
  } else if (netService.name.includes('Global')) {
    activeNodes.GCLB = 'GCLB[Global HTTPS Load Balancer]:::gateway';
    if (netService.name.includes('CDN')) {
      activeNodes.CDN = 'CDN[Cloud CDN Cache]:::gateway';
    }
  } else if (netService.name.includes('Regional')) {
    activeNodes.GCLB = 'GCLB[Regional HTTPS Load Balancer]:::gateway';
  } else {
    activeNodes.GCLB = 'GCLB[VPC Gateway / Cloud DNS]:::gateway';
  }

  if (isHybridAccess || challenges.includes('hybrid-conn')) {
    activeNodes.VPN = 'VPN[Cloud VPN / Interconnect]:::gateway';
  }

  // Populate Security Layer
  if (isHighSecurity || isStrictSecurity || workloads.includes('gov-portal')) {
    activeNodes.Armor = 'Armor[Cloud Armor WAF]:::sec';
    activeNodes.SecMgr = 'SecMgr[Secret Manager]:::sec';
  }
  if (isStrictSecurity || workloads.includes('gov-portal')) {
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
  if (computeService.name.includes('GKE Standard') && isMultiRegion) {
    activeNodes.ComputeA = 'ComputeA[GKE Cluster: Region A]:::compute';
    activeNodes.ComputeB = 'ComputeB[GKE Cluster: Region B]:::compute';
  } else if (computeService.name.includes('GKE Autopilot')) {
    activeNodes.Compute = 'Compute[GKE Autopilot Cluster]:::compute';
  } else if (computeService.name.includes('GKE Standard')) {
    activeNodes.Compute = 'Compute[GKE Standard Cluster]:::compute';
  } else if (computeService.name.includes('Managed Instance Groups')) {
    activeNodes.Compute = 'Compute[Compute Engine MIG]:::compute';
  } else if (computeService.name.includes('Single VM')) {
    activeNodes.Compute = 'Compute[Compute Engine VM]:::compute';
  } else if (computeService.name.includes('Cloud Functions')) {
    activeNodes.Compute = 'Compute[Cloud Functions]:::compute';
  } else {
    activeNodes.Compute = 'Compute[Cloud Run Containers]:::compute';
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
  if (characteristics.includes('stateful') && isLegacyOrVM) {
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
    concurrentUsers,
    dataTransfer,
    recoveryTier,
    dailyChangeRate,
    retainDaily,
    retainWeekly,
    retainMonthly,
    retainYearly,
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
    mermaid
  };
}

// Expose globally
window.generateRecommendation = generateRecommendation;
