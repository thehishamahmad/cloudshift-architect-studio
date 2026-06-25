/**
 * CloudShift Architect Studio - Front-end App Controller (Version 3.2 RC)
 * Coordinates inputs, workload sizing, local history, Mermaid rendering, and
 * Markdown downloads for the architecture assessment platform.
 */

// --- DOM Elements ---
const form = document.getElementById('architect-form');
const btnGenerate = document.getElementById('btn-generate');
const btnQuickStart = document.getElementById('btn-quick-start');
const btnCopyMermaid = document.getElementById('btn-copy-mermaid');
const btnExportMarkdown = document.getElementById('btn-export-markdown');
const btnExportPdf = document.getElementById('btn-export-pdf');
const historyContainer = document.getElementById('history-container');

// Views
const viewEmpty = document.getElementById('view-empty');
const viewLoading = document.getElementById('view-loading');
const viewDashboard = document.getElementById('view-dashboard');
const loadingMessage = document.getElementById('loading-message');

// Outputs: Executive Summary
const execOutcome = document.getElementById('exec-outcome');
const execPattern = document.getElementById('exec-pattern');
const execScale = document.getElementById('exec-scale');
const execAvailability = document.getElementById('exec-availability');
const execBenefits = document.getElementById('exec-benefits');

// Outputs: Core Details
const outputSummary = document.getElementById('output-summary');
const outputServicesList = document.getElementById('output-services-list');
const outputAssumptions = document.getElementById('output-assumptions');
const outputRisks = document.getElementById('output-risks');
const outputSecurity = document.getElementById('output-security');
const outputCost = document.getElementById('output-cost');
const outputMermaidRaw = document.getElementById('output-mermaid-raw');
// Outputs: Workload Sizing (Version 3.1)
const customerDiscoverySummary = document.getElementById('customer-discovery-summary');
const assessmentAssumptionSummary = document.getElementById('assessment-assumption-summary');
const sizingPlatform = document.getElementById('sizing-platform');
const sizingTier = document.getElementById('sizing-tier');
const sizingDisclaimer = document.getElementById('sizing-disclaimer');
const sizingJustification = document.getElementById('sizing-justification');
const sizingGuidance = document.getElementById('sizing-guidance');

// Outputs: Recovery & DR
const rtoValue = document.getElementById('rto-value');
const rpoValue = document.getElementById('rpo-value');
const outputDRDesign = document.getElementById('output-dr-design');
const outputBackupStrategy = document.getElementById('output-backup-strategy');

// Active Recommendations Cache
let currentRecommendation = null;

// Helpers to access globally-exposed scripts
const getRecommendationEngine = () => window.generateRecommendation;
const getStorageManager = () => window.GCPStorage;
const getHybridRecommendationEngine = () => window.CloudShiftHybridRecommendation?.buildHybridRecommendation;
const getHybridServicesEngine = () => window.CloudShiftHybridServices?.generateHybridServices;
const getHybridMermaidEngine = () => window.CloudShiftHybridMermaid?.generateHybridMermaidDiagram;

// Escape text that may be consumed by HTML-aware formats such as Markdown.
// Dynamic dashboard content is rendered with textContent instead of innerHTML.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeMarkdownText(value) {
  return escapeHtml(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_[\]{}()#+\-.!|])/g, '\\$1');
}

function sentenceCaseAfterStops(value) {
  return String(value ?? '').replace(/([.!?]\s+)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function appendMarkdownBoldText(element, value) {
  element.replaceChildren();
  const text = sentenceCaseAfterStops(value);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach(part => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      element.appendChild(strong);
    } else {
      element.appendChild(document.createTextNode(part));
    }
  });
}

function markdownBoldToHtml(value) {
  return escapeHtml(sentenceCaseAfterStops(value)).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function replaceProjectNameForMarkdown(value, projectName) {
  return markdownBoldToHtml(String(value ?? '').split(String(projectName ?? '')).join(escapeMarkdownText(projectName)));
}

function appendStaticLabeledText(element, value) {
  appendMarkdownBoldText(element, value);
}

// Helper to get checked values from checkbox groups
function getCheckedValues(name) {
  const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
  return Array.from(checked).map(cb => cb.value);
}

// Helper to set checked state on checkbox groups
function syncCheckboxes(selector, activeValues = []) {
  const checkboxes = document.querySelectorAll(selector);
  checkboxes.forEach(cb => {
    cb.checked = activeValues.includes(cb.value);
  });
}

function getNonNegativeNumber(id, fallback) {
  const value = Number.parseInt(document.getElementById(id).value, 10);
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function getOptionalNonNegativeNumber(id) {
  const rawValue = document.getElementById(id).value.trim();
  if (rawValue === '') return null;
  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function normalizeWorkloadProfiles(values) {
  const normalizer = window.CloudShiftWorkloadProfiles?.normalize;
  if (typeof normalizer === 'function') return normalizer(values);
  return Array.isArray(values) ? Array.from(new Set(values.filter(Boolean))) : [];
}

function normalizeCharacteristicProfiles(values, workloads) {
  const normalizer = window.CloudShiftCharacteristics?.normalize;
  if (typeof normalizer === 'function') return normalizer(values, workloads);
  return Array.isArray(values) ? Array.from(new Set(values.filter(Boolean))) : [];
}

const challengeLabels = Object.freeze({
  'budget-opt': 'Budget Optimization',
  'perf-bottleneck': 'Performance Bottleneck',
  'scale-issue': 'Scalability Issue',
  'ha-req': 'High Availability Requirement',
  'dr-concern': 'DR / Recovery Concern',
  'manual-backup': 'Manual Backup Process',
  'sec-compliance': 'Security / Compliance Concern',
  'ddos-waf': 'DDoS / WAF Concern',
  'hybrid-conn': 'Hybrid Connectivity Requirement',
  'legacy-mod': 'Legacy App Modernization'
});

const workloadLabels = Object.freeze({
  'web-portal': 'Web / Portal Application',
  'api-backend': 'API / Mobile Backend',
  'enterprise-app': 'Enterprise Business Application',
  'transactional-platform': 'E-Commerce / Transactional Platform',
  'data-analytics': 'Data & Analytics Platform',
  'ai-ml-platform': 'AI / ML Platform',
  'iot-event-platform': 'IoT / Event-Driven Platform',
  'media-streaming': 'Media / Streaming Platform'
});

const characteristicLabels = Object.freeze({
  stateless: 'Stateless',
  stateful: 'Stateful',
  containerized: 'Containerized',
  'legacy-app': 'Legacy Application',
  'vm-based': 'VM-Based',
  'event-driven': 'Event Driven',
  realtime: 'Real-Time Processing',
  batch: 'Batch Processing',
  'ai-ml': 'AI/ML Enabled',
  'public-facing': 'Public Facing',
  'internal-only': 'Internal Only',
  'zero-trust': 'Zero-Trust Access',
  'legacy-vm-dependency': 'Legacy VM Dependency',
  'kubernetes-required': 'Kubernetes Required',
  microservices: 'Microservices / Multi-Service Platform'
});

const accessPatternLabels = Object.freeze({
  public: 'Public Internet Users',
  internal: 'Internal Users Only',
  hybrid: 'Hybrid Access'
});

const trafficPatternLabels = Object.freeze({
  dynamic: 'Mostly Dynamic Application',
  static: 'Mostly Static Content',
  mixed: 'Mixed Workload',
  video: 'Video Streaming',
  api: 'API Intensive'
});

function listLabels(values, labels, fallback = 'Not specified') {
  const normalized = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!normalized.length) return fallback;
  return normalized.map(value => labels[value] || value).join(', ');
}

function renderDiscoverySummary(rec) {
  if (!customerDiscoverySummary) return;
  customerDiscoverySummary.replaceChildren();

  const items = [
    ['Industry Sector', rec.industryLabel || 'Technology / SaaS'],
    ['Customer Challenges', listLabels(rec.challenges, challengeLabels, 'No explicit customer challenges selected')],
    ['Workload Profile', rec.workloadList || listLabels(rec.workloads, workloadLabels)],
    ['Characteristics', listLabels(rec.characteristics, characteristicLabels, 'No additional characteristics selected')],
    ['Access Pattern', accessPatternLabels[rec.accessPattern] || rec.accessPattern || 'Public Internet Users'],
    ['Traffic Pattern', trafficPatternLabels[rec.trafficPattern] || rec.trafficPattern || 'Mostly Dynamic Application'],
    ['Target User Scale / Expected Users', `${rec.execSummary?.scale || 'Not specified'}${Number.isFinite(rec.expectedUsers) ? ` (${rec.expectedUsers.toLocaleString()} MAU)` : ''}`],
    ['Estimated Production Data Size', Number.isFinite(Number(rec.productionDataSize)) ? `${Math.max(0, Number(rec.productionDataSize)).toLocaleString()} GB` : 'Not specified'],
    ['Recovery Tier', rec.execSummary?.availabilityTarget || 'Not specified']
  ];

  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'discovery-summary-item';
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    item.append(term, description);
    customerDiscoverySummary.appendChild(item);
  });
}

function buildAssessmentAssumptionText(rec) {
  const challenges = listLabels(rec.challenges, challengeLabels, 'the selected business drivers').toLowerCase();
  const workloads = rec.workloadList || listLabels(rec.workloads, workloadLabels, 'the selected workload profile');
  const characteristics = listLabels(rec.characteristics, characteristicLabels, 'the selected architecture characteristics').toLowerCase();
  const access = accessPatternLabels[rec.accessPattern] || rec.accessPattern || 'Public Internet Users';
  const traffic = trafficPatternLabels[rec.trafficPattern] || rec.trafficPattern || 'Mostly Dynamic Application';
  const platform = rec.workloadSizing?.displayPlatform || rec.workloadSizing?.platform || 'the primary sizing platform';

  const productionDataText = Number.isFinite(Number(rec.productionDataSize)) && Number(rec.productionDataSize) > 0
    ? ` Backup sizing uses the provided ${Math.max(0, Number(rec.productionDataSize)).toLocaleString()} GB production data estimate and should be validated against actual database, document, upload, and object-storage footprints.`
    : ' Backup capacity sizing still requires an estimated production data size during detailed discovery.';

  const sizingPhrase = rec.hybridRecommendation?.segmentedArchitecture
    ? `a ${platform} model`
    : `an indicative ${platform} sizing baseline`;
  return `Based on the selected workload profile (${workloads}), customer challenges (${challenges}), and architecture characteristics (${characteristics}), this assessment derives ${sizingPhrase} using ${access.toLowerCase()} and ${traffic.toLowerCase()} assumptions. Since detailed CPU, memory, storage, operating system, dependency, and performance metrics are not yet available, sizing is derived from common deployment patterns and best practices observed in similar production environments.${productionDataText}`;
}

function renderAssessmentAssumptions(rec) {
  if (!assessmentAssumptionSummary) return;
  assessmentAssumptionSummary.textContent = buildAssessmentAssumptionText(rec);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Initial icons compile
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Load History
  renderHistory();

  // Bind Form Submit
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Bind Quick Start Button
  if (btnQuickStart) {
    btnQuickStart.addEventListener('click', () => {
      triggerGeneration();
    });
  }

  // Bind Tab Clicks
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      switchTab(btn, targetTabId);
    });
  });

  // Bind Copy Mermaid Button
  if (btnCopyMermaid) {
    btnCopyMermaid.addEventListener('click', copyMermaidCode);
  }

  // Bind Export Markdown Button
  if (btnExportMarkdown) {
    btnExportMarkdown.addEventListener('click', exportMarkdownDocument);
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', exportPdfDocument);
  }
});

// --- Tabs Controller ---
function switchTab(clickedBtn, targetTabId) {
  // Deactivate all tabs
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

  // Activate target
  clickedBtn.classList.add('active');
  const targetPane = document.getElementById(targetTabId);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // Special handling if switching to diagram to ensure redraw/scaling
  if (targetTabId === 'tab-topology' && currentRecommendation) {
    renderMermaidDiagram(currentRecommendation.mermaid);
  }
}

// --- Form Handling ---
function handleFormSubmit(e) {
  e.preventDefault();
  triggerGeneration();
}

function getFormInputs() {
  const projectName = document.getElementById('input-project-name').value.trim() || 'Un-named Project';
  const industry = document.getElementById('input-industry').value;
  const users = document.getElementById('input-users').value;

  // Multi-selects (Checkboxes)
  const challenges = getCheckedValues('challenges');
  const workloads = normalizeWorkloadProfiles(getCheckedValues('workloads'));
  const characteristics = normalizeCharacteristicProfiles(getCheckedValues('characteristics'), workloads);

  // Traffic, Access, Recovery & Growth
  const accessPattern = document.getElementById('input-access-pattern').value;
  const trafficPattern = document.getElementById('input-traffic-pattern').value;
  const expectedUsers = getNonNegativeNumber('input-expected-users', 50000);
  const peakConcurrencyOverride = getOptionalNonNegativeNumber('input-peak-concurrency');
  const dataTransfer = getNonNegativeNumber('input-data-transfer', 2500);
  const recoveryTier = document.getElementById('input-recovery-tier').value;
  const productionDataSize = getNonNegativeNumber('input-production-data-size', 500);
  const dailyChangeRate = Math.min(100, getNonNegativeNumber('input-daily-change-rate', 5));
  
  // Retentions
  const retainDaily = getNonNegativeNumber('retain-daily', 14);
  const retainWeekly = getNonNegativeNumber('retain-weekly', 4);
  const retainMonthly = getNonNegativeNumber('retain-monthly', 12);
  const retainYearly = getNonNegativeNumber('retain-yearly', 1);

  return {
    projectName,
    industry,
    users,
    challenges,
    workloads,
    characteristics,
    accessPattern,
    trafficPattern,
    expectedUsers,
    peakConcurrencyOverride,
    dataTransfer,
    recoveryTier,
    productionDataSize,
    dailyChangeRate,
    retainDaily,
    retainWeekly,
    retainMonthly,
    retainYearly
  };
}

function applyHybridMermaidIfAvailable(inputs, recommendation) {
  const buildHybridRecommendation = getHybridRecommendationEngine();
  const generateHybridServices = getHybridServicesEngine();

  if (!buildHybridRecommendation || !generateHybridServices) {
    return recommendation;
  }

  try {
    const hybridRecommendation = buildHybridRecommendation(inputs, recommendation);
    const hybridServices = generateHybridServices(inputs, recommendation, hybridRecommendation);
    recommendation.hybridRecommendation = hybridRecommendation;
    recommendation.hybridServices = hybridServices;
    applySegmentedDisplayModel(inputs, recommendation, hybridRecommendation);

    const generateHybridMermaidDiagram = getHybridMermaidEngine();
    if (!generateHybridMermaidDiagram) {
      return recommendation;
    }

    const hybridMermaid = generateHybridMermaidDiagram(inputs, recommendation, hybridRecommendation, hybridServices);

    if (typeof hybridMermaid === 'string' && hybridMermaid.trim()) {
      recommendation.legacyMermaid = recommendation.mermaid;
      recommendation.mermaid = hybridMermaid;
    }
  } catch (error) {
    console.warn('Hybrid Mermaid unavailable:', error);
  }

  return recommendation;
}

function createServiceCard({ name, rationale, category, icon }) {
  const card = document.createElement('div');
  card.className = 'service-item-card';

  const catClass = String(category || 'compute').toLowerCase();
  const iconBox = document.createElement('div');
  iconBox.className = `service-icon-box ${catClass}`;
  const iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide', icon || 'blocks');
  iconEl.style.width = '22px';
  iconEl.style.height = '22px';
  iconBox.appendChild(iconEl);

  const info = document.createElement('div');
  info.className = 'service-info';
  const nameRow = document.createElement('div');
  nameRow.className = 'service-name-row';
  const serviceName = document.createElement('span');
  serviceName.className = 'service-name';
  serviceName.textContent = name;
  const categoryBadge = document.createElement('span');
  categoryBadge.className = `service-category ${catClass}`;
  categoryBadge.textContent = category;
  nameRow.append(serviceName, categoryBadge);
  const description = document.createElement('p');
  description.className = 'service-description';
  description.textContent = rationale;
  info.append(nameRow, description);
  card.append(iconBox, info);

  return card;
}

const HYBRID_SERVICE_CATEGORIES = Object.freeze([
  { key: 'compute', label: 'Compute', icon: 'cpu' },
  { key: 'database', label: 'Database', icon: 'database' },
  { key: 'cache', label: 'Cache', icon: 'zap' },
  { key: 'storage', label: 'Storage', icon: 'hard-drive' },
  { key: 'networking', label: 'Networking', icon: 'network' },
  { key: 'security', label: 'Security', icon: 'shield-check' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-3' }
]);

function getRenderableHybridServices(rec) {
  const hybridServices = rec?.hybridServices;
  if (!hybridServices) return null;

  const categories = HYBRID_SERVICE_CATEGORIES
    .map(category => {
      const seen = new Set();
      const services = Array.isArray(hybridServices[category.key])
        ? hybridServices[category.key].filter(service => {
            const normalizedName = String(service?.name || '').trim().toLowerCase();
            if (!normalizedName || seen.has(normalizedName)) return false;
            seen.add(normalizedName);
            return true;
          })
        : [];
      return { ...category, services };
    })
    .filter(category => category.services.length > 0);

  return categories.length > 0 ? categories : null;
}

function renderLegacyServices(rec) {
  const services = Array.isArray(rec?.services) ? rec.services : [];
  services.forEach(svc => {
    outputServicesList.appendChild(createServiceCard({
      name: svc.name,
      rationale: svc.rationale,
      category: svc.category,
      icon: svc.icon
    }));
  });
}

function renderHybridServices(rec) {
  const categories = getRenderableHybridServices(rec);
  if (!categories) {
    renderLegacyServices(rec);
    return;
  }

  categories.forEach(category => {
    const group = document.createElement('section');
    group.className = 'hybrid-service-category';
    const heading = document.createElement('h4');
    heading.className = 'hybrid-service-category-title';
    heading.textContent = category.label;
    const list = document.createElement('div');
    list.className = 'hybrid-service-category-list';

    category.services.forEach(service => {
      list.appendChild(createServiceCard({
        name: service.name,
        rationale: service.rationale || 'Recommended by the hybrid service model for this workload mix.',
        category: category.label,
        icon: category.icon
      }));
    });

    group.append(heading, list);
    outputServicesList.appendChild(group);
  });
}

function buildSegmentedSizingLanes(inputs = {}) {
  const workloads = normalizeWorkloadProfiles(inputs.workloads);
  const characteristics = normalizeCharacteristicProfiles(inputs.characteristics, workloads);
  const hasMicroservices = characteristics.includes('microservices');
  const lanes = [];
  const addLane = (signal, workload, platform, reason, database = '') => {
    if (workloads.includes(signal)) lanes.push({ signal, workload, platform, reason, database });
  };

  addLane('web-portal', 'Web / Portal Application', 'Cloud Run', 'Stateless web front end and managed autoscaling.');
  addLane('api-backend', 'API / Mobile Backend', hasMicroservices ? 'GKE Standard' : 'Cloud Run', hasMicroservices ? 'Kubernetes-backed API orchestration for multi-service delivery.' : 'Request-driven API scale with managed container operations.');
  addLane('enterprise-app', 'Enterprise Business Application', 'Compute Engine MIG', 'Runtime compatibility and staged migration for enterprise application dependencies.');
  addLane('transactional-platform', 'E-Commerce / Transactional Platform', hasMicroservices ? 'GKE Standard or Cloud Run' : 'Cloud Run', 'Transactional workload with public ingress, resilience, and scale requirements.', 'Cloud SQL HA or Cloud Spanner depending on final scale and consistency needs.');
  addLane('data-analytics', 'Data & Analytics Platform', 'BigQuery + Dataflow + Cloud Storage', 'Analytics and reporting workload separation from transactional systems.');

  return lanes;
}

function formatReadableList(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function applySegmentedDisplayModel(inputs, recommendation, hybridRecommendation) {
  if (!hybridRecommendation?.segmentedArchitecture) return;

  const lanes = buildSegmentedSizingLanes(inputs);
  const workloads = normalizeWorkloadProfiles(inputs.workloads);
  const hasAnalyticsLane = workloads.includes('data-analytics')
    || Boolean(recommendation.hybridServices?.analytics?.some(service => /BigQuery|Dataflow/i.test(service.name || '')));
  const transactionalDatabase = recommendation.hybridServices?.database?.find(service => /Cloud SQL|Spanner/i.test(service.name || ''))?.name || 'Cloud SQL HA';
  const patternParts = [
    'Cloud Run for web/API workloads',
    'Compute Engine MIG for enterprise applications',
    `${transactionalDatabase.replace('Cloud SQL for PostgreSQL (HA)', 'Cloud SQL HA')} for transactional data`,
    'Cloud Storage for application objects'
  ];
  if (hasAnalyticsLane) {
    patternParts.push('BigQuery/Dataflow for analytics');
  }
  const segmentedPattern = `Hybrid segmented architecture with ${formatReadableList(patternParts)}.`;

  recommendation.segmentedSizingLanes = lanes;
  recommendation.execSummary.pattern = segmentedPattern;
  recommendation.execSummary.businessOutcome = String(recommendation.execSummary.businessOutcome || '').replace(
    /The proposed architecture pattern \(.*?\) supports/s,
    `The proposed architecture pattern (${recommendation.execSummary.pattern.replace(/\.$/, '')}) supports`
  );
  recommendation.workloadSizing.displayPlatform = 'Hybrid segmented sizing';
  recommendation.workloadSizing.displayTier = 'Segmented by workload lane';
  recommendation.workloadSizing.displayJustification = 'This assessment contains multiple workload categories, so sizing is split into application, enterprise, transactional, and analytics lanes instead of forcing one primary runtime across the full landscape.';
  const analyticsSentence = hasAnalyticsLane
    ? ' Analytics workloads are separated through Cloud Storage, Dataflow, and BigQuery.'
    : '';
  recommendation.summary = `The proposal positions ${recommendation.projectName} on Google Cloud using a hybrid segmented architecture aligned to ${recommendation.industryLabel} operating, governance, and resilience needs. The primary deployment region is ${recommendation.deploymentRegion?.label || 'Singapore (asia-southeast1)'}. Public web, API, and transactional application lanes use managed ingress, Cloud Run, and regulated edge controls where required; enterprise business applications retain runtime compatibility on Compute Engine MIG; transactional data is served through ${transactionalDatabase.replace('Cloud SQL for PostgreSQL (HA)', 'Cloud SQL HA')} according to final scale and consistency requirements; and application objects are stored in Cloud Storage.${analyticsSentence} This avoids forcing one runtime platform across workloads with different operating models.`;
}

// --- Dynamic Synthesis Pipeline ---
async function triggerGeneration(savedInputs = null) {
  const inputs = savedInputs || getFormInputs();

  // If loading from history, sync form controls
  if (savedInputs) {
    syncFormInputs(savedInputs);
  }

  // Hide dashboard/empty, show loading
  viewEmpty.style.display = 'none';
  viewDashboard.style.display = 'none';
  viewLoading.style.display = 'flex';

  // Premium loading animation loop
  const steps = [
    'Evaluating customer challenges...',
    'Analyzing workload profile combinations...',
    'Synthesizing architectural characteristics...',
    'Assessing recovery SLA targets...',
    'Configuring retention backups strategy...',
    'Constructing layered Mermaid diagram topology...'
  ];

  let stepIdx = 0;
  loadingMessage.textContent = steps[0];
  const intervalId = setInterval(() => {
    stepIdx++;
    if (stepIdx < steps.length) {
      loadingMessage.textContent = steps[stepIdx];
    }
  }, 350);

  // Short delay to simulate synthesis logic
  await new Promise(resolve => setTimeout(resolve, 1500));
  clearInterval(intervalId);

  try {
    const engine = getRecommendationEngine();
    const storage = getStorageManager();

    if (!engine) {
      throw new Error('Heuristics Rules Engine is not loaded.');
    }

    // Generate recommendation
    const recommendation = engine(inputs);
    applyHybridMermaidIfAvailable(inputs, recommendation);
    currentRecommendation = recommendation;

    // Save to history
    if (storage) {
      storage.saveToHistory(recommendation);
      renderHistory();
    }

    // Populate UI
    populateDashboard(recommendation, inputs);

    // Switch views
    viewLoading.style.display = 'none';
    viewDashboard.style.display = 'flex';

    // Reset to first tab
    const firstTabBtn = document.querySelector('.tab-btn[data-tab="tab-workload-sizing"]');
    if (firstTabBtn) {
      switchTab(firstTabBtn, 'tab-workload-sizing');
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error(error);
    clearInterval(intervalId);
    loadingMessage.textContent = `Error: ${error.message}`;
    setTimeout(() => {
      viewLoading.style.display = 'none';
      viewEmpty.style.display = 'flex';
    }, 2500);
  }
}

// Sync form fields with selected history item
function syncFormInputs(inputs) {
  document.getElementById('input-project-name').value = inputs.projectName;
  document.getElementById('input-industry').value = inputs.industry;
  document.getElementById('input-users').value = inputs.users;

  // Set Checkboxes
  syncCheckboxes('input[name="challenges"]', inputs.challenges);
  syncCheckboxes('input[name="workloads"]', normalizeWorkloadProfiles(inputs.workloads));
  syncCheckboxes('input[name="characteristics"]', normalizeCharacteristicProfiles(inputs.characteristics, inputs.workloads));

  // Set Traffic, Access & Recovery fields
  document.getElementById('input-access-pattern').value = inputs.accessPattern;
  document.getElementById('input-traffic-pattern').value = inputs.trafficPattern;
  document.getElementById('input-expected-users').value = inputs.expectedUsers;
  document.getElementById('input-peak-concurrency').value = inputs.peakConcurrencyOverride ?? '';
  document.getElementById('input-data-transfer').value = inputs.dataTransfer;
  document.getElementById('input-recovery-tier').value = inputs.recoveryTier;
  document.getElementById('input-production-data-size').value = Number.isFinite(Number(inputs.productionDataSize)) ? Math.max(0, Number(inputs.productionDataSize)) : 500;
  document.getElementById('input-daily-change-rate').value = inputs.dailyChangeRate;
  
  // Set Retentions
  document.getElementById('retain-daily').value = inputs.retainDaily;
  document.getElementById('retain-weekly').value = inputs.retainWeekly;
  document.getElementById('retain-monthly').value = inputs.retainMonthly;
  document.getElementById('retain-yearly').value = inputs.retainYearly;
}

// --- Populate Dashboard Outputs ---
function populateDashboard(rec, inputs = null) {
  // 1. Populate Executive Summary
  appendMarkdownBoldText(execOutcome, rec.execSummary.businessOutcome);
  execPattern.textContent = rec.execSummary.pattern;
  execScale.textContent = rec.execSummary.scale;
  execAvailability.textContent = rec.execSummary.availabilityTarget;

  execBenefits.innerHTML = '';
  rec.execSummary.benefits.forEach(benefit => {
    const li = document.createElement('li');
    li.textContent = benefit;
    execBenefits.appendChild(li);
  });

  // 2. Workload Sizing Discovery Flow
  renderDiscoverySummary(rec);
  renderAssessmentAssumptions(rec);

  // 3. Indicative Workload Sizing
  if (sizingDisclaimer) sizingDisclaimer.textContent = rec.workloadSizing.disclaimer || '';
  const isSegmentedSizing = Array.isArray(rec.segmentedSizingLanes) && rec.segmentedSizingLanes.length > 0;
  const sizingPlatformLabel = document.querySelector('.sizing-platform-card .sizing-label');
  if (sizingPlatformLabel) sizingPlatformLabel.textContent = isSegmentedSizing ? 'Sizing Approach' : 'Primary Sizing Platform';
  sizingPlatform.textContent = rec.workloadSizing.displayPlatform || rec.workloadSizing.platform;
  sizingTier.textContent = rec.workloadSizing.displayTier || `${rec.workloadSizing.tier} sizing tier`;
  sizingJustification.textContent = rec.workloadSizing.displayJustification || rec.workloadSizing.justification;
  sizingGuidance.replaceChildren();
  (rec.segmentedSizingLanes || []).forEach(lane => {
    const container = document.createElement('div');
    container.className = 'sizing-guidance-item sizing-lane-item';
    const term = document.createElement('dt');
    term.textContent = lane.workload;
    const description = document.createElement('dd');
    const detailList = document.createElement('ul');
    detailList.className = 'sizing-profile-details';
    [
      ['Recommended platform', lane.platform],
      ['Reason', lane.reason],
      lane.database ? ['Database', lane.database] : null
    ].filter(Boolean).forEach(([label, value]) => {
      const line = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = `${label}: `;
      line.append(strong, document.createTextNode(value));
      detailList.appendChild(line);
    });
    description.appendChild(detailList);
    container.append(term, description);
    sizingGuidance.appendChild(container);
  });
  if (!isSegmentedSizing) rec.workloadSizing.guidance.forEach(item => {
    const container = document.createElement('div');
    container.className = 'sizing-guidance-item';
    const term = document.createElement('dt');
    term.textContent = item.label;
    const description = document.createElement('dd');
    description.textContent = item.value;
    container.append(term, description);
    sizingGuidance.appendChild(container);
  });
  (rec.workloadSizing.indicativeProfiles || []).forEach(profile => {
    const container = document.createElement('div');
    container.className = 'sizing-guidance-item';
    const term = document.createElement('dt');
    term.textContent = profile.workload;
    const description = document.createElement('dd');
    const detailList = document.createElement('ul');
    detailList.className = 'sizing-profile-details';
    [
      ['Assumed workload characteristics', profile.assumption],
      ['Indicative CPU/RAM/storage range', profile.indicativeSizing]
    ].forEach(([label, value]) => {
      const line = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = `${label}: `;
      line.append(strong, document.createTextNode(value));
      detailList.appendChild(line);
    });
    description.appendChild(detailList);
    container.append(term, description);
    sizingGuidance.appendChild(container);
  });

  // 3. Core Narrative Summary
  appendMarkdownBoldText(outputSummary, rec.summary);

  // 4. Services List
  outputServicesList.innerHTML = '';
  renderHybridServices(rec);

  // 4. Assumptions
  outputAssumptions.innerHTML = '';
  rec.assumptions.forEach(assump => {
    const li = document.createElement('li');
    li.textContent = assump;
    outputAssumptions.appendChild(li);
  });

  // 5. Risks
  outputRisks.innerHTML = '';
  if (rec.risks.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'risk-item warning';
    placeholder.innerHTML = `
      <i data-lucide="check-circle" class="risk-item-icon" style="width: 16px; height: 16px; color:#27793d;"></i>
      <span>No additional deployment considerations were generated beyond the documented assumptions. Detailed discovery should still validate sizing, dependencies, and compliance requirements.</span>
    `;
    outputRisks.appendChild(placeholder);
  } else {
    rec.risks.forEach(risk => {
      const item = document.createElement('div');
      
      const isCritical = risk.includes('SPOF') || risk.includes('Vulnerability') || risk.includes('exceed') || risk.includes('Spike') || risk.includes('Lag');
      item.className = `risk-item ${isCritical ? 'danger' : 'warning'}`;
      
      const iconName = isCritical ? 'alert-octagon' : 'alert-triangle';
      
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', iconName);
      icon.className = 'risk-item-icon';
      icon.style.width = '16px';
      icon.style.height = '16px';
      const message = document.createElement('span');
      appendStaticLabeledText(message, risk);
      item.append(icon, message);
      outputRisks.appendChild(item);
    });
  }

  // 6. Security Recommendations
  outputSecurity.innerHTML = '';
  rec.securityRecs.forEach(sec => {
    const li = document.createElement('li');
    appendStaticLabeledText(li, sec);
    outputSecurity.appendChild(li);
  });

  // 7. Cost Recommendations
  outputCost.innerHTML = '';
  rec.costRecs.forEach(cost => {
    const li = document.createElement('li');
    appendStaticLabeledText(li, cost);
    outputCost.appendChild(li);
  });

  // Recovery & DR Design
  rtoValue.textContent = rec.rtoValue;
  rpoValue.textContent = rec.rpoValue;
  outputDRDesign.textContent = rec.recoveryDR;

  outputBackupStrategy.innerHTML = '';
  rec.backupStrategy.forEach(item => {
    const li = document.createElement('li');
    appendStaticLabeledText(li, item);
    outputBackupStrategy.appendChild(li);
  });

  // 9. Raw Mermaid Output
  outputMermaidRaw.textContent = rec.mermaid.trim();
}

// --- Mermaid Graph Renderer ---
async function renderMermaidDiagram(code) {
  const wrapper = document.querySelector('.diagram-wrapper');
  wrapper.replaceChildren();
  const graphEl = document.createElement('div');
  graphEl.className = 'mermaid';
  graphEl.id = 'mermaid-graph';
  graphEl.textContent = code;
  wrapper.appendChild(graphEl);

  if (window.mermaid) {
    try {
      await window.mermaid.run({
        nodes: [graphEl]
      });
    } catch (err) {
      console.error('Mermaid render error:', err);
      wrapper.replaceChildren();
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'color:var(--color-danger); padding:20px; text-align:center;';
      const errorIcon = document.createElement('i');
      errorIcon.setAttribute('data-lucide', 'alert-circle');
      errorIcon.style.cssText = 'width:32px; height:32px; margin-bottom:8px;';
      const errorMessage = document.createElement('p');
      errorMessage.textContent = `Failed to render graphic: ${err.message}`;
      errorBox.append(errorIcon, errorMessage);
      wrapper.appendChild(errorBox);
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// --- Copy Mermaid Helper ---
function copyMermaidCode() {
  if (!currentRecommendation) return;
  
  navigator.clipboard.writeText(currentRecommendation.mermaid)
    .then(() => {
      const originalText = btnCopyMermaid.innerHTML;
      btnCopyMermaid.innerHTML = `
        <i data-lucide="check" style="width: 14px; height: 14px;"></i>
        Copied!
      `;
      if (window.lucide) window.lucide.createIcons();
      
      setTimeout(() => {
        btnCopyMermaid.innerHTML = originalText;
        if (window.lucide) window.lucide.createIcons();
      }, 1500);
    })
    .catch(err => {
      console.error('Failed to copy to clipboard', err);
    });
}

function sanitizeMarkdownLine(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function escapeMarkdownTableCell(value) {
  return sanitizeMarkdownLine(value)
    .replace(/\|/g, '\\|');
}

function formatServiceRationaleForMarkdown(value) {
  const cleanValue = sanitizeMarkdownLine(value);
  const sentences = cleanValue.match(/[^.!?]+[.!?]+/g);
  const conciseValue = sentences?.length
    ? sentences.slice(0, 2).join(' ').trim()
    : cleanValue;
  return conciseValue.length > 260 ? `${conciseValue.slice(0, 257).trim()}...` : conciseValue;
}

function buildRecommendedServicesMarkdown(rec) {
  const hybridCategories = getRenderableHybridServices(rec);
  let section = `# Proposed GCP Services\n\n`;

  if (hybridCategories) {
    hybridCategories.forEach(category => {
      section += `## ${escapeMarkdownTableCell(category.label)}\n\n`;
      section += `| Google Cloud Service | Deployment Rationale |\n`;
      section += `| :--- | :--- |\n`;
      category.services.forEach(service => {
        section += `| ${escapeMarkdownTableCell(service.name)} | ${escapeMarkdownTableCell(formatServiceRationaleForMarkdown(service.rationale || 'Recommended by the hybrid service model for this workload mix.'))} |\n`;
      });
      section += `\n`;
    });
    section += `---\n\n`;
    return section;
  }

  section += `| Category | Google Cloud Service | Deployment Rationale |\n`;
  section += `| :--- | :--- | :--- |\n`;
  const legacyServices = Array.isArray(rec?.services) ? rec.services : [];
  legacyServices.forEach(svc => {
    section += `| <strong>${escapeMarkdownTableCell(svc.category)}</strong> | ${escapeMarkdownTableCell(svc.name)} | ${escapeMarkdownTableCell(formatServiceRationaleForMarkdown(svc.rationale))} |\n`;
  });
  section += `\n`;
  section += `---\n\n`;
  return section;
}

function buildCustomerDiscoveryMarkdown(rec) {
  const rows = [
    ['Industry Sector', rec.industryLabel || 'Technology / SaaS'],
    ['Customer Challenges', listLabels(rec.challenges, challengeLabels, 'No explicit customer challenges selected')],
    ['Workload Profile', rec.workloadList || listLabels(rec.workloads, workloadLabels)],
    ['Characteristics', listLabels(rec.characteristics, characteristicLabels, 'No additional characteristics selected')],
    ['Access Pattern', accessPatternLabels[rec.accessPattern] || rec.accessPattern || 'Public Internet Users'],
    ['Traffic Pattern', trafficPatternLabels[rec.trafficPattern] || rec.trafficPattern || 'Mostly Dynamic Application'],
    ['Target User Scale / Expected Users', `${rec.execSummary?.scale || 'Not specified'}${Number.isFinite(rec.expectedUsers) ? ` (${rec.expectedUsers.toLocaleString()} MAU)` : ''}`],
    ['Estimated Production Data Size', Number.isFinite(Number(rec.productionDataSize)) ? `${Math.max(0, Number(rec.productionDataSize)).toLocaleString()} GB` : 'Not specified'],
    ['Recovery Tier', rec.execSummary?.availabilityTarget || 'Not specified']
  ];

  let section = `# Customer Discovery Summary\n\n`;
  section += `| Discovery Area | Selected Input |\n`;
  section += `| :--- | :--- |\n`;
  rows.forEach(([label, value]) => {
    section += `| ${escapeMarkdownTableCell(label)} | ${escapeMarkdownTableCell(value)} |\n`;
  });
  section += `\n---\n\n`;
  return section;
}

// --- Export Markdown Document Helper (FEATURE 3 / PHASE 5 & 7) ---
function exportMarkdownDocument() {
  if (!currentRecommendation) return;

  const rec = currentRecommendation;
  
  // Construct formatted Markdown file contents
  const safeProjectName = escapeMarkdownText(rec.projectName);
  let md = `# Cloud Architecture Assessment: ${safeProjectName}\n\n`;
  md += `* <strong>Target Workloads:</strong> ${escapeHtml(rec.workloadList)}\n`;
  md += `* <strong>Industry Sector:</strong> ${escapeHtml(rec.industryLabel)}\n`;
  md += `* <strong>Primary Deployment Region:</strong> ${escapeHtml(rec.deploymentRegion.label)}\n`;
  md += `* <strong>Target Scalability:</strong> ${escapeHtml(rec.execSummary.scale)}\n`;
  md += `* <strong>Peak Concurrency Estimate:</strong> ${rec.workloadSizing.peakConcurrencyEstimate.toLocaleString()} users (${escapeHtml(rec.workloadSizing.peakConcurrencySource)})\n`;
  md += `* <strong>Resiliency Target:</strong> ${escapeHtml(rec.execSummary.availabilityTarget)}\n\n`;
  md += `*Generated by CloudShift Architect Studio v3.2 RC*\n\n`;
  md += `---\n\n`;

  // 1. Customer Discovery Summary
  md += buildCustomerDiscoveryMarkdown(rec);

  // 2. Assessment Assumptions
  md += `# Assessment Assumptions\n\n`;
  md += `${escapeHtml(buildAssessmentAssumptionText(rec))}\n\n`;
  md += `---\n\n`;

  // 3. Indicative Workload Sizing
  md += `# Indicative Workload Sizing\n\n`;
  md += `${escapeHtml(rec.workloadSizing.disclaimer || 'This sizing is indicative and should be validated during detailed discovery.')}\n\n`;
  const isSegmentedExport = Array.isArray(rec.segmentedSizingLanes) && rec.segmentedSizingLanes.length > 0;
  md += `* <strong>${isSegmentedExport ? 'Sizing Approach' : 'Primary Sizing Platform'}:</strong> ${escapeHtml(rec.workloadSizing.displayPlatform || rec.workloadSizing.platform)}\n`;
  md += `* <strong>${isSegmentedExport ? 'Sizing Mode' : 'Recommended Compute Tier'}:</strong> ${escapeHtml(rec.workloadSizing.displayTier || rec.workloadSizing.tier)}\n\n`;
  md += `### Recommendation Justification\n${escapeHtml(rec.workloadSizing.displayJustification || rec.workloadSizing.justification)}\n\n`;
  if (isSegmentedExport) {
    md += `### Per-Workload Sizing Lanes\n\n`;
    md += `| Workload Lane | Recommended Platform | Database | Reason |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    rec.segmentedSizingLanes.forEach(lane => {
      md += `| ${escapeMarkdownTableCell(lane.workload)} | ${escapeMarkdownTableCell(lane.platform)} | ${escapeMarkdownTableCell(lane.database || 'N/A')} | ${escapeMarkdownTableCell(lane.reason)} |\n`;
    });
    md += `\n`;
  } else {
    md += `### Sizing Guidance\n`;
    rec.workloadSizing.guidance.forEach(item => {
      md += `* <strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}\n`;
    });
  }
  md += `\n### Assumption-Based Workload Profiles\n\n`;
  md += `| Workload Profile | Assumed Characteristics | Indicative CPU/RAM/Storage |\n`;
  md += `| :--- | :--- | :--- |\n`;
  (rec.workloadSizing.indicativeProfiles || []).forEach(profile => {
    md += `| ${escapeMarkdownTableCell(profile.workload)} | ${escapeMarkdownTableCell(profile.assumption)} | ${escapeMarkdownTableCell(profile.indicativeSizing)} |\n`;
  });
  md += `\n---\n\n`;

  // 4. Executive Summary
  md += `# Executive Summary\n\n`;
  md += `### Business Outcome\n${replaceProjectNameForMarkdown(rec.execSummary.businessOutcome, rec.projectName)}\n\n`;
  md += `### Recommended Architecture Pattern\n${rec.execSummary.pattern}\n\n`;
  md += `### Expected Business Benefits\n`;
  rec.execSummary.benefits.forEach(benefit => {
    md += `* ${markdownBoldToHtml(benefit)}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 5. Architecture Summary
  md += `# Architecture Summary\n\n`;
  md += `${replaceProjectNameForMarkdown(rec.summary, rec.projectName)}\n\n`;
  md += `---\n\n`;

  // 6. Proposed GCP Services
  md += buildRecommendedServicesMarkdown(rec);

  // 7. Security & Governance
  md += `# Security & Governance\n\n`;
  rec.securityRecs.forEach(sec => {
    md += `* ${markdownBoldToHtml(sec)}\n`;
  });
  md += `---\n\n`;

  // 8. Backup Strategy & Retention
  md += `# Backup Strategy & Retention\n\n`;
  md += `* <strong>Target Recovery Time Objective (RTO):</strong> ${escapeHtml(rec.rtoValue)}\n`;
  md += `* <strong>Target Recovery Point Objective (RPO):</strong> ${escapeHtml(rec.rpoValue)}\n\n`;
  md += `${escapeHtml(rec.recoveryDR)}\n\n`;
  rec.backupStrategy.forEach(item => {
    md += `* ${markdownBoldToHtml(item)}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 9. Observability
  md += `# Observability\n\n`;
  md += `* <strong>Operations Visibility:</strong> Use Cloud Monitoring, Cloud Logging, audit logs, and alert policies to validate service health, backup completion, security events, and capacity trends after migration.\n`;
  md += `* <strong>Cost Governance:</strong> Track utilization and cost alerts so right-sizing, lifecycle policies, and egress controls can be refined with production telemetry.\n\n`;
  md += `### Cost Control Notes\n`;
  rec.costRecs.forEach(cost => {
    md += `* ${markdownBoldToHtml(cost)}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 10. Assessment Assumptions
  md += `# Assessment Assumptions\n\n`;
  md += `### Assumptions\n`;
  rec.assumptions.forEach(assump => {
    md += `* ${markdownBoldToHtml(assump)}\n`;
  });
  md += `\n### Deployment Considerations\n`;
  if (rec.risks.length === 0) {
    md += `* No additional deployment considerations were generated beyond the documented assumptions. Detailed discovery should still validate sizing, dependencies, and compliance requirements.\n`;
  } else {
    rec.risks.forEach(risk => {
      md += `* ${markdownBoldToHtml(risk)}\n`;
    });
  }
  md += `\n\n`;
  md += `---\n\n`;

  // 11. Visual Topology
  md += `# Visual Topology\n\n`;
  md += `\`\`\`mermaid\n`;
  md += `${rec.mermaid.trim()}\n`;
  md += `\`\`\`\n`;

  // Trigger download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const formattedName = rec.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  link.setAttribute('download', `${formattedName}_cloud_assessment.md`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatReportDate(date = new Date()) {
  return date.toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function pdfText(value) {
  return sentenceCaseAfterStops(String(value ?? '').replace(/\*\*/g, '').trim());
}

function createPdfElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function appendPdfRichText(parent, value, tag = 'p', className = 'pdf-copy') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.innerHTML = markdownBoldToHtml(value);
  parent.appendChild(element);
  return element;
}

function appendPdfTable(parent, columns, rows) {
  const table = createPdfElement('table', 'pdf-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columns.forEach(column => headerRow.appendChild(createPdfElement('th', null, column)));
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(value => {
      const td = document.createElement('td');
      td.textContent = pdfText(value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  parent.appendChild(table);
  return table;
}

function appendPdfBulletList(parent, items) {
  const list = createPdfElement('ul', 'pdf-bullet-list');
  (items || []).forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = markdownBoldToHtml(item);
    list.appendChild(li);
  });
  parent.appendChild(list);
  return list;
}

function createPdfPage(title, generatedDate, pageNumber, options = {}) {
  const page = createPdfElement('section', `pdf-page${options.cover ? ' pdf-cover-page' : ''}`);
  if (!options.cover && title) {
    const eyebrow = createPdfElement('div', 'pdf-section-eyebrow', options.eyebrow || 'Cloud Architecture Assessment');
    const heading = createPdfElement('h1', 'pdf-section-title', title);
    page.append(eyebrow, heading);
  }
  return page;
}

function getDiscoveryRows(rec) {
  return [
    ['Industry Sector', rec.industryLabel || 'Technology / SaaS'],
    ['Customer Challenges', listLabels(rec.challenges, challengeLabels, 'No explicit customer challenges selected')],
    ['Workload Profile', rec.workloadList || listLabels(rec.workloads, workloadLabels)],
    ['Characteristics', listLabels(rec.characteristics, characteristicLabels, 'No additional characteristics selected')],
    ['Access Pattern', accessPatternLabels[rec.accessPattern] || rec.accessPattern || 'Public Internet Users'],
    ['Traffic Pattern', trafficPatternLabels[rec.trafficPattern] || rec.trafficPattern || 'Mostly Dynamic Application'],
    ['Target User Scale / Expected Users', `${rec.execSummary?.scale || 'Not specified'}${Number.isFinite(rec.expectedUsers) ? ` (${rec.expectedUsers.toLocaleString()} MAU)` : ''}`],
    ['Estimated Production Data Size', Number.isFinite(Number(rec.productionDataSize)) ? `${Math.max(0, Number(rec.productionDataSize)).toLocaleString()} GB` : 'Not specified'],
    ['Recovery Tier', rec.execSummary?.availabilityTarget || 'Not specified']
  ];
}

function appendPdfServiceTables(parent, rec) {
  const hybridCategories = getRenderableHybridServices(rec);
  if (hybridCategories) {
    hybridCategories.forEach(category => {
      parent.appendChild(createPdfElement('h3', 'pdf-subsection-title', category.label));
      appendPdfTable(
        parent,
        ['Google Cloud Service', 'Deployment Rationale'],
        category.services.map(service => [
          service.name,
          formatServiceRationaleForMarkdown(service.rationale || 'Recommended by the hybrid service model for this workload mix.')
        ])
      );
    });
    return;
  }

  appendPdfTable(
    parent,
    ['Category', 'Google Cloud Service', 'Deployment Rationale'],
    (rec.services || []).map(service => [
      service.category,
      service.name,
      formatServiceRationaleForMarkdown(service.rationale)
    ])
  );
}

function appendPdfTopology(parent) {
  const renderedSvg = document.querySelector('#mermaid-graph svg');
  const topologyWrap = createPdfElement('div', 'pdf-topology-card');

  if (renderedSvg) {
    const clonedSvg = renderedSvg.cloneNode(true);
    clonedSvg.removeAttribute('height');
    clonedSvg.style.maxWidth = '100%';
    clonedSvg.style.height = 'auto';
    topologyWrap.appendChild(clonedSvg);
  } else {
    topologyWrap.appendChild(createPdfElement(
      'p',
      'pdf-muted',
      'Visual topology could not be rendered in the browser before export. Please open the Visual Topology tab and export again.'
    ));
  }

  parent.appendChild(topologyWrap);
}

function buildPdfReport(rec, generatedDate) {
  const report = createPdfElement('article', 'pdf-report');
  let pageNumber = 1;
  const targetWorkloads = rec.workloadList || listLabels(rec.workloads, workloadLabels, 'Not specified');

  const cover = createPdfPage(null, generatedDate, pageNumber++, { cover: true });
  const coverPanel = createPdfElement('div', 'pdf-cover-panel');
  coverPanel.appendChild(createPdfElement('div', 'pdf-brand-mark', 'CloudShift™'));
  coverPanel.appendChild(createPdfElement('p', 'pdf-cover-kicker', 'Professional Cloud Architecture Assessment'));
  coverPanel.appendChild(createPdfElement('h1', 'pdf-cover-title', 'Cloud Architecture Assessment'));
  coverPanel.appendChild(createPdfElement('p', 'pdf-cover-project', rec.projectName || 'Cloud Migration Proposal'));
  appendPdfTable(coverPanel, ['Assessment Attribute', 'Value'], [
    ['Industry Sector', rec.industryLabel || 'Not specified'],
    ['Primary Deployment Region', rec.deploymentRegion?.label || 'Singapore (asia-southeast1)'],
    ['Target Workload Profile', targetWorkloads],
    ['Recovery Tier', rec.execSummary?.availabilityTarget || 'Not specified'],
    ['Generated Date', generatedDate],
    ['Version', 'CloudShift Architect Studio v3.2 RC']
  ]);
  cover.appendChild(coverPanel);
  report.appendChild(cover);

  const toc = createPdfPage('Table of Contents', generatedDate, pageNumber++);
  const tocList = createPdfElement('ol', 'pdf-toc-list');
  [
    'Customer Discovery',
    'Workload Sizing',
    'Executive Summary',
    'Proposed Architecture',
    'Security & Governance',
    'Recovery & DR',
    'Observability',
    'Deployment Considerations',
    'Visual Topology'
  ].forEach(item => tocList.appendChild(createPdfElement('li', null, item)));
  toc.appendChild(tocList);
  report.appendChild(toc);

  const discovery = createPdfPage('Customer Discovery Summary', generatedDate, pageNumber++);
  appendPdfTable(discovery, ['Discovery Area', 'Selected Input'], getDiscoveryRows(rec));
  report.appendChild(discovery);

  const assessment = createPdfPage('Assessment Assumptions', generatedDate, pageNumber++);
  appendPdfRichText(assessment, buildAssessmentAssumptionText(rec));
  report.appendChild(assessment);

  const sizing = createPdfPage('Indicative Workload Sizing', generatedDate, pageNumber++);
  appendPdfRichText(sizing, rec.workloadSizing?.disclaimer || 'This sizing is indicative and should be validated during detailed discovery.');
  appendPdfTable(sizing, ['Sizing Attribute', 'Assessment Value'], [
    [Array.isArray(rec.segmentedSizingLanes) && rec.segmentedSizingLanes.length ? 'Sizing Approach' : 'Primary Sizing Platform', rec.workloadSizing?.displayPlatform || rec.workloadSizing?.platform || 'Not specified'],
    [Array.isArray(rec.segmentedSizingLanes) && rec.segmentedSizingLanes.length ? 'Sizing Mode' : 'Recommended Compute Tier', rec.workloadSizing?.displayTier || rec.workloadSizing?.tier || 'Not specified'],
    ['Peak Concurrency Estimate', Number.isFinite(rec.workloadSizing?.peakConcurrencyEstimate) ? `${rec.workloadSizing.peakConcurrencyEstimate.toLocaleString()} users (${rec.workloadSizing.peakConcurrencySource})` : 'Not specified']
  ]);
  appendPdfRichText(sizing, rec.workloadSizing?.displayJustification || rec.workloadSizing?.justification || '', 'p', 'pdf-callout');
  if (Array.isArray(rec.segmentedSizingLanes) && rec.segmentedSizingLanes.length > 0) {
    sizing.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Per-Workload Sizing Lanes'));
    appendPdfTable(sizing, ['Workload Lane', 'Recommended Platform', 'Database', 'Reason'], rec.segmentedSizingLanes.map(lane => [
      lane.workload,
      lane.platform,
      lane.database || 'N/A',
      lane.reason
    ]));
  } else if (Array.isArray(rec.workloadSizing?.guidance)) {
    sizing.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Sizing Guidance'));
    appendPdfTable(sizing, ['Guidance Area', 'Indicative Guidance'], rec.workloadSizing.guidance.map(item => [item.label, item.value]));
  }
  if (Array.isArray(rec.workloadSizing?.indicativeProfiles) && rec.workloadSizing.indicativeProfiles.length > 0) {
    sizing.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Assumption-Based Workload Profiles'));
    appendPdfTable(sizing, ['Workload Profile', 'Assumed Characteristics', 'Indicative CPU/RAM/Storage'], rec.workloadSizing.indicativeProfiles.map(profile => [
      profile.workload,
      profile.assumption,
      profile.indicativeSizing
    ]));
  }
  report.appendChild(sizing);

  const executive = createPdfPage('Executive Summary', generatedDate, pageNumber++);
  executive.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Business Outcome'));
  appendPdfRichText(executive, rec.execSummary?.businessOutcome || '');
  executive.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Expected Business Benefits'));
  appendPdfBulletList(executive, rec.execSummary?.benefits || []);
  report.appendChild(executive);

  const architecture = createPdfPage('Architecture Summary', generatedDate, pageNumber++);
  architecture.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Recommended Architecture Pattern'));
  appendPdfRichText(architecture, rec.execSummary?.pattern || '');
  architecture.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Architecture Narrative'));
  appendPdfRichText(architecture, rec.summary || '');
  report.appendChild(architecture);

  const services = createPdfPage('Proposed GCP Services', generatedDate, pageNumber++);
  appendPdfServiceTables(services, rec);
  report.appendChild(services);

  const security = createPdfPage('Security & Governance', generatedDate, pageNumber++);
  appendPdfBulletList(security, rec.securityRecs || []);
  report.appendChild(security);

  const recovery = createPdfPage('Backup Strategy & Retention', generatedDate, pageNumber++);
  appendPdfTable(recovery, ['Recovery Objective', 'Target'], [
    ['Target Recovery Time Objective (RTO)', rec.rtoValue || 'Not specified'],
    ['Target Recovery Point Objective (RPO)', rec.rpoValue || 'Not specified']
  ]);
  appendPdfRichText(recovery, rec.recoveryDR || '');
  appendPdfBulletList(recovery, rec.backupStrategy || []);
  report.appendChild(recovery);

  const observability = createPdfPage('Observability', generatedDate, pageNumber++);
  appendPdfBulletList(observability, [
    '**Operations Visibility:** Use Cloud Monitoring, Cloud Logging, audit logs, and alert policies to validate service health, backup completion, security events, and capacity trends after migration.',
    '**Cost Governance:** Track utilization and cost alerts so right-sizing, lifecycle policies, and egress controls can be refined with production telemetry.'
  ]);
  observability.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Cost Control Notes'));
  appendPdfBulletList(observability, rec.costRecs || []);
  report.appendChild(observability);

  const considerations = createPdfPage('Assessment Assumptions & Deployment Considerations', generatedDate, pageNumber++);
  considerations.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Assessment Assumptions'));
  appendPdfBulletList(considerations, rec.assumptions || []);
  considerations.appendChild(createPdfElement('h3', 'pdf-subsection-title', 'Deployment Considerations'));
  appendPdfBulletList(considerations, (rec.risks || []).length ? rec.risks : ['No additional deployment considerations were generated beyond the documented assumptions. Detailed discovery should still validate sizing, dependencies, and compliance requirements.']);
  report.appendChild(considerations);

  const topology = createPdfPage('Visual Topology', generatedDate, pageNumber++);
  appendPdfTopology(topology);
  report.appendChild(topology);

  const closing = createPdfPage('Closing Notes / Validation Disclaimer', generatedDate, pageNumber++);
  appendPdfRichText(closing, 'This assessment is based on the selected workload profile, customer challenges, traffic assumptions, recovery inputs, and estimated production data size provided during the initial assessment. Final architecture, sizing, recovery design, and security controls should be validated through detailed discovery, workload profiling, load testing, and production telemetry.');
  report.appendChild(closing);

  return report;
}

async function exportPdfDocument() {
  if (!currentRecommendation) return;

  if (!window.html2pdf) {
    alert('PDF export is still loading. Please try again in a moment.');
    return;
  }

  const rec = currentRecommendation;
  const originalContent = btnExportPdf ? btnExportPdf.innerHTML : '';
  if (btnExportPdf) {
    btnExportPdf.disabled = true;
    btnExportPdf.innerHTML = 'Generating PDF...';
  }

  let report = null;
  try {
    if (rec.mermaid) {
      await renderMermaidDiagram(rec.mermaid);
    }

    const generatedDate = formatReportDate();
    report = buildPdfReport(rec, generatedDate);
    document.body.appendChild(report);

    const formattedName = String(rec.projectName || 'cloudshift_assessment').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    await window.html2pdf()
      .set({
        margin: 0,
        filename: `${formattedName}_cloud_assessment.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        },
        jsPDF: {
          unit: 'pt',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: {
          mode: ['css', 'legacy']
        }
      })
      .from(report)
      .toPdf()
      .get('pdf')
      .then(pdf => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let page = 2; page <= totalPages; page += 1) {
          pdf.setPage(page);
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.line(43, 805, 552, 805);
          pdf.text('CloudShift Architect Studio v3.2 RC', 43, 824);
          pdf.text(`Page ${page}`, 292, 824, { align: 'center' });
          pdf.text(generatedDate, 552, 824, { align: 'right' });
        }
      })
      .save();
  } catch (err) {
    console.error('PDF export failed', err);
    alert(`PDF export failed: ${err.message}`);
  } finally {
    if (report) report.remove();
    if (btnExportPdf) {
      btnExportPdf.disabled = false;
      btnExportPdf.innerHTML = originalContent;
    }
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// --- Render History Lists ---
function renderHistory() {
  const storage = getStorageManager();
  if (!storage) return;

  const history = storage.getHistory();
  historyContainer.innerHTML = '';

  if (history.length === 0) {
    historyContainer.innerHTML = '<div class="empty-history">No saved assessments yet.</div>';
    return;
  }

  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.dataset.id = item.id;

    const availLabel = item.recoveryTier === 'tier-1' ? 'Mission Critical' : item.recoveryTier === 'tier-2' ? 'Resilient' : 'Standard';
    const challengeCount = Array.isArray(item.challenges) ? item.challenges.length : 0;
    const challengeLabel = challengeCount > 0 ? `${challengeCount} challenge${challengeCount === 1 ? '' : 's'}` : 'No challenges selected';

    const header = document.createElement('div');
    header.className = 'history-header';
    const title = document.createElement('span');
    title.className = 'history-title';
    title.title = item.projectName;
    title.textContent = item.projectName;
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = item.timestamp;
    header.append(title, time);

    const details = document.createElement('div');
    details.className = 'history-details';
    details.textContent = `${item.workloadList} | ${availLabel} | ${challengeLabel}`;
    const deleteButton = document.createElement('button');
    deleteButton.className = 'history-delete-btn';
    deleteButton.title = 'Delete Saved Assessment';
    const deleteIcon = document.createElement('i');
    deleteIcon.setAttribute('data-lucide', 'trash-2');
    deleteIcon.style.width = '13px';
    deleteIcon.style.height = '13px';
    deleteButton.appendChild(deleteIcon);
    card.append(header, details, deleteButton);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete-btn')) return;
      triggerGeneration(item);
    });

    const deleteBtn = card.querySelector('.history-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const updatedHistory = storage.deleteFromHistory(item.id);
      renderHistory();
      if (updatedHistory.length === 0) {
        viewDashboard.style.display = 'none';
        viewEmpty.style.display = 'flex';
      }
    });

    historyContainer.appendChild(card);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
