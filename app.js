/**
 * CloudShift Architect Studio - Front-end App Controller (Version 3.1.1)
 * Coordinates inputs, workload sizing, local history, Mermaid rendering, and
 * Markdown downloads for the architecture assessment platform.
 */

// --- DOM Elements ---
const form = document.getElementById('architect-form');
const btnGenerate = document.getElementById('btn-generate');
const btnQuickStart = document.getElementById('btn-quick-start');
const btnCopyMermaid = document.getElementById('btn-copy-mermaid');
const btnExportMarkdown = document.getElementById('btn-export-markdown');
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
const sizingPlatform = document.getElementById('sizing-platform');
const sizingTier = document.getElementById('sizing-tier');
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

function replaceProjectNameForMarkdown(value, projectName) {
  return String(value ?? '').split(String(projectName ?? '')).join(escapeMarkdownText(projectName));
}

function appendStaticLabeledText(element, value) {
  const match = String(value ?? '').match(/^\*\*([^*]+):\*\*\s*(.*)$/);
  if (!match) {
    element.textContent = value;
    return;
  }

  const label = document.createElement('strong');
  label.textContent = `${match[1]}:`;
  element.append(label, document.createTextNode(` ${match[2]}`));
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
  const budget = document.querySelector('input[name="budget"]:checked').value;

  // Multi-selects (Checkboxes)
  const challenges = getCheckedValues('challenges');
  const workloads = getCheckedValues('workloads');
  const characteristics = getCheckedValues('characteristics');

  // Traffic, Access, Recovery & Growth
  const accessPattern = document.getElementById('input-access-pattern').value;
  const trafficPattern = document.getElementById('input-traffic-pattern').value;
  const expectedUsers = getNonNegativeNumber('input-expected-users', 50000);
  const peakConcurrencyOverride = getOptionalNonNegativeNumber('input-peak-concurrency');
  const dataTransfer = getNonNegativeNumber('input-data-transfer', 2500);
  const recoveryTier = document.getElementById('input-recovery-tier').value;
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
    budget,
    challenges,
    workloads,
    characteristics,
    accessPattern,
    trafficPattern,
    expectedUsers,
    peakConcurrencyOverride,
    dataTransfer,
    recoveryTier,
    dailyChangeRate,
    retainDaily,
    retainWeekly,
    retainMonthly,
    retainYearly
  };
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
    currentRecommendation = recommendation;

    // Save to history
    if (storage) {
      storage.saveToHistory(recommendation);
      renderHistory();
    }

    // Populate UI
    populateDashboard(recommendation);

    // Switch views
    viewLoading.style.display = 'none';
    viewDashboard.style.display = 'flex';

    // Reset to first tab
    const firstTabBtn = document.querySelector('.tab-btn[data-tab="tab-overview"]');
    if (firstTabBtn) {
      switchTab(firstTabBtn, 'tab-overview');
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

  // Set radios
  const budgetRadio = document.querySelector(`input[name="budget"][value="${inputs.budget}"]`);
  if (budgetRadio) budgetRadio.checked = true;

  // Set Checkboxes
  syncCheckboxes('input[name="challenges"]', inputs.challenges);
  syncCheckboxes('input[name="workloads"]', inputs.workloads);
  syncCheckboxes('input[name="characteristics"]', inputs.characteristics);

  // Set Traffic, Access & Recovery fields
  document.getElementById('input-access-pattern').value = inputs.accessPattern;
  document.getElementById('input-traffic-pattern').value = inputs.trafficPattern;
  document.getElementById('input-expected-users').value = inputs.expectedUsers;
  document.getElementById('input-peak-concurrency').value = inputs.peakConcurrencyOverride ?? '';
  document.getElementById('input-data-transfer').value = inputs.dataTransfer;
  document.getElementById('input-recovery-tier').value = inputs.recoveryTier;
  document.getElementById('input-daily-change-rate').value = inputs.dailyChangeRate;
  
  // Set Retentions
  document.getElementById('retain-daily').value = inputs.retainDaily;
  document.getElementById('retain-weekly').value = inputs.retainWeekly;
  document.getElementById('retain-monthly').value = inputs.retainMonthly;
  document.getElementById('retain-yearly').value = inputs.retainYearly;
}

// --- Populate Dashboard Outputs ---
function populateDashboard(rec) {
  // 1. Populate Executive Summary
  execOutcome.textContent = rec.execSummary.businessOutcome;
  execPattern.textContent = rec.execSummary.pattern;
  execScale.textContent = rec.execSummary.scale;
  execAvailability.textContent = rec.execSummary.availabilityTarget;

  execBenefits.innerHTML = '';
  rec.execSummary.benefits.forEach(benefit => {
    const li = document.createElement('li');
    li.textContent = benefit;
    execBenefits.appendChild(li);
  });

  // 2. Workload Sizing Recommendation
  sizingPlatform.textContent = rec.workloadSizing.platform;
  sizingTier.textContent = `${rec.workloadSizing.tier} sizing tier`;
  sizingJustification.textContent = rec.workloadSizing.justification;
  sizingGuidance.replaceChildren();
  rec.workloadSizing.guidance.forEach(item => {
    const container = document.createElement('div');
    container.className = 'sizing-guidance-item';
    const term = document.createElement('dt');
    term.textContent = item.label;
    const description = document.createElement('dd');
    description.textContent = item.value;
    container.append(term, description);
    sizingGuidance.appendChild(container);
  });

  // 3. Core Narrative Summary
  outputSummary.textContent = rec.summary;

  // 4. Services List
  outputServicesList.innerHTML = '';
  rec.services.forEach(svc => {
    const card = document.createElement('div');
    card.className = 'service-item-card';

    const catClass = svc.category.toLowerCase();
    const iconBox = document.createElement('div');
    iconBox.className = `service-icon-box ${catClass}`;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', svc.icon);
    icon.style.width = '22px';
    icon.style.height = '22px';
    iconBox.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'service-info';
    const nameRow = document.createElement('div');
    nameRow.className = 'service-name-row';
    const name = document.createElement('span');
    name.className = 'service-name';
    name.textContent = svc.name;
    const category = document.createElement('span');
    category.className = `service-category ${catClass}`;
    category.textContent = svc.category;
    nameRow.append(name, category);
    const rationale = document.createElement('p');
    rationale.className = 'service-description';
    rationale.textContent = svc.rationale;
    info.append(nameRow, rationale);
    card.append(iconBox, info);
    outputServicesList.appendChild(card);
  });

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
      <span>No critical architecture risks identified. The system aligns well with standard GCP guidelines.</span>
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

// --- Export Markdown Document Helper (FEATURE 3 / PHASE 5 & 7) ---
function exportMarkdownDocument() {
  if (!currentRecommendation) return;

  const rec = currentRecommendation;
  
  // Construct formatted Markdown file contents
  const safeProjectName = escapeMarkdownText(rec.projectName);
  let md = `# Cloud Architecture Assessment: ${safeProjectName}\n\n`;
  md += `* **Target Workloads:** ${rec.workloadList}\n`;
  md += `* **Industry Sector:** ${rec.industryLabel}\n`;
  md += `* **Primary Deployment Region:** ${rec.deploymentRegion.label}\n`;
  md += `* **Target Scalability:** ${rec.execSummary.scale}\n`;
  md += `* **Peak Concurrency Estimate:** ${rec.workloadSizing.peakConcurrencyEstimate.toLocaleString()} users (${rec.workloadSizing.peakConcurrencySource})\n`;
  md += `* **Resiliency Target:** ${rec.execSummary.availabilityTarget}\n\n`;
  md += `*Generated by CloudShift Architect Studio v3.1.1*\n\n`;
  md += `---\n\n`;

  // 1. Executive Summary
  md += `# Executive Summary\n\n`;
  md += `### Business Outcome\n${replaceProjectNameForMarkdown(rec.execSummary.businessOutcome, rec.projectName)}\n\n`;
  md += `### Recommended Architecture Pattern\n${rec.execSummary.pattern}\n\n`;
  md += `### Expected Business Benefits\n`;
  rec.execSummary.benefits.forEach(benefit => {
    md += `* ${benefit}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 2. Architecture Summary
  md += `# Architecture Summary\n\n`;
  md += `${replaceProjectNameForMarkdown(rec.summary, rec.projectName)}\n\n`;
  md += `---\n\n`;

  // 3. Workload Sizing Recommendation
  md += `# Workload Sizing Recommendation\n\n`;
  md += `* **Recommended Platform:** ${rec.workloadSizing.platform}\n`;
  md += `* **Presales Sizing Tier:** ${rec.workloadSizing.tier}\n\n`;
  md += `### Recommendation Justification\n${rec.workloadSizing.justification}\n\n`;
  md += `### Sizing Guidance\n`;
  rec.workloadSizing.guidance.forEach(item => {
    md += `* **${item.label}:** ${item.value}\n`;
  });
  md += `\n---\n\n`;

  // 4. Recommended Services
  md += `# Recommended Services\n\n`;
  md += `| Category | Google Cloud Service | Deployment Rationale |\n`;
  md += `| :--- | :--- | :--- |\n`;
  rec.services.forEach(svc => {
    md += `| **${svc.category}** | ${svc.name} | ${svc.rationale} |\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 5. Recovery & Disaster Recovery Design
  md += `# Recovery & Disaster Recovery Design\n\n`;
  md += `* **Target Recovery Time Objective (RTO):** ${rec.rtoValue}\n`;
  md += `* **Target Recovery Point Objective (RPO):** ${rec.rpoValue}\n\n`;
  md += `${rec.recoveryDR}\n\n`;
  md += `---\n\n`;

  // 5. Backup Strategy
  md += `# Backup Strategy\n\n`;
  rec.backupStrategy.forEach(item => {
    const cleanItem = item.replace(/\*\*/g, '');
    md += `* ${cleanItem}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 6. Security Recommendations
  md += `# Security Recommendations\n\n`;
  rec.securityRecs.forEach(sec => {
    const cleanSec = sec.replace(/\*\*/g, '');
    md += `* ${cleanSec}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 7. Cost Optimization Recommendations
  md += `# Cost Optimization Recommendations\n\n`;
  rec.costRecs.forEach(cost => {
    const cleanCost = cost.replace(/\*\*/g, '');
    md += `* ${cleanCost}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 8. Assumptions
  md += `# Assumptions\n\n`;
  rec.assumptions.forEach(assump => {
    md += `* ${assump}\n`;
  });
  md += `\n`;
  md += `---\n\n`;

  // 9. Risks
  md += `# Risks & Mitigations\n\n`;
  if (rec.risks.length === 0) {
    md += `* No critical architectural risks identified.\n`;
  } else {
    rec.risks.forEach(risk => {
      const cleanRisk = risk.replace(/\*\*/g, '');
      md += `* ${cleanRisk}\n`;
    });
  }
  md += `\n\n`;
  md += `---\n\n`;

  // Appendix: Mermaid Code
  md += `## Appendix: Service Topology Diagram\n\n`;
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

    const budgetLabel = item.budget.toUpperCase();
    const availLabel = item.recoveryTier === 'tier-1' ? 'Mission Critical' : item.recoveryTier === 'tier-2' ? 'Resilient' : 'Standard';

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
    details.textContent = `${item.workloadList} | ${availLabel} | Budget: ${budgetLabel}`;
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
