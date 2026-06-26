/**
 * CloudShift Architect Studio - Hybrid Mermaid Generator (v3.2 Stage 7)
 *
 * Generates readable hybrid topology diagrams from the v3.2 hybrid
 * recommendation and hybrid service layers. The existing v3.1.1 Mermaid output
 * remains the fallback when this helper cannot produce a diagram.
 */

(function attachCloudShiftHybridMermaid(global) {
  function serviceNames(bucket) {
    return Array.isArray(bucket) ? bucket.map(service => String(service.name || '')) : [];
  }

  function hasService(hybridServices, bucket, token) {
    return serviceNames(hybridServices?.[bucket]).some(name => name.toLowerCase().includes(token.toLowerCase()));
  }

  function findServiceName(hybridServices, bucket, tokens) {
    const names = serviceNames(hybridServices?.[bucket]);
    return names.find(name => tokens.some(token => name.toLowerCase().includes(token.toLowerCase()))) || '';
  }

  function hasAnyWorkload(inputs, values) {
    const workloads = normalizeWorkloadProfiles(inputs?.workloads);
    return values.some(value => workloads.includes(value));
  }

  function normalizeWorkloadProfiles(value) {
    const normalizer = global.CloudShiftWorkloadProfiles?.normalize;
    if (typeof normalizer === 'function') return normalizer(value);
    const normalized = Array.isArray(value) ? value.filter(Boolean) : [];
    return Array.from(new Set(normalized));
  }

  function hasAnyCharacteristic(inputs, values) {
    const workloads = normalizeWorkloadProfiles(inputs?.workloads);
    const normalizer = global.CloudShiftCharacteristics?.normalize;
    const characteristics = typeof normalizer === 'function'
      ? normalizer(inputs?.characteristics, workloads)
      : Array.isArray(inputs?.characteristics) ? inputs.characteristics : [];
    return values.some(value => characteristics.includes(value));
  }

  function addNode(nodes, id, definition) {
    if (!nodes.has(id)) nodes.set(id, definition);
  }

  function addEdge(edges, from, to, label = '') {
    const edge = label ? `  ${from} -->|${label}| ${to}` : `  ${from} --> ${to}`;
    if (!edges.includes(edge)) edges.push(edge);
  }

  function buildClassDefs() {
    return [
      '  classDef client fill:#e8f0fe,stroke:#1a73e8,stroke-width:2px,color:#1a73e8;',
      '  classDef gateway fill:#e6f4ea,stroke:#34a853,stroke-width:2px,color:#34a853;',
      '  classDef compute fill:#fef7e0,stroke:#fbbc04,stroke-width:2px,color:#b06000;',
      '  classDef storage fill:#fce8e6,stroke:#ea4335,stroke-width:2px,color:#c5221f;',
      '  classDef sec fill:#f3e8fd,stroke:#a142f4,stroke-width:2px,color:#8ab4f8;',
      '  classDef data fill:#e8f5e9,stroke:#0f9d58,stroke-width:2px,color:#137333;'
    ].join('\n');
  }

  function getDatabaseNodeDefinition(hybridServices) {
    const databaseName = findServiceName(hybridServices, 'database', ['Firestore', 'Cloud SQL', 'Spanner']);
    if (/firestore/i.test(databaseName)) return 'Database[(Cloud Firestore NoSQL)]:::storage';
    if (/cloud sql/i.test(databaseName) && /\bHA\b|High Availability/i.test(databaseName)) return 'Database[(Cloud SQL HA)]:::storage';
    if (/cloud sql/i.test(databaseName)) return 'Database[(Cloud SQL)]:::storage';
    if (/spanner/i.test(databaseName)) return 'Database[(Cloud Spanner)]:::storage';
    return 'Database[(Managed Database)]:::storage';
  }

  function getLoadBalancerNodeDefinition(hybridServices) {
    const loadBalancerName = findServiceName(hybridServices, 'networking', ['Load Balancer']);
    if (/internal/i.test(loadBalancerName)) return 'GCLB[Internal HTTPS Load Balancer]:::gateway';
    if (/regional/i.test(loadBalancerName)) return 'GCLB[Regional HTTPS Load Balancer]:::gateway';
    return 'GCLB[Global HTTPS Load Balancer]:::gateway';
  }

  function generateHybridMermaidDiagram(inputs = {}, recommendation = {}, hybridRecommendation = null, hybridServices = null) {
    if (!hybridRecommendation || !hybridServices) return recommendation?.mermaid || '';

    const publicNodes = new Map();
    const corporateNodes = new Map();
    const networkNodes = new Map();
    const appNodes = new Map();
    const dataNodes = new Map();
    const edges = [];

    const includeCloudRun = hasService(hybridServices, 'compute', 'Cloud Run');
    const includeCompute = hasService(hybridServices, 'compute', 'Compute Engine');
    const includeGke = hasService(hybridServices, 'compute', 'GKE')
      && (hybridRecommendation.primaryPlatform === 'GKE'
        || hasAnyCharacteristic(inputs, ['microservices']));
    const includeBigQuery = hasService(hybridServices, 'analytics', 'BigQuery');
    const includeDataflow = hasService(hybridServices, 'analytics', 'Dataflow');
    const includeStorage = hasService(hybridServices, 'storage', 'Cloud Storage');
    const includeCache = hasService(hybridServices, 'cache', 'Memorystore') || hasService(hybridServices, 'database', 'Memorystore');
    const includeFilestore = hasService(hybridServices, 'storage', 'Filestore');
    const includeDatabase = hasService(hybridServices, 'database', 'Cloud SQL')
      || hasService(hybridServices, 'database', 'Firestore')
      || hasService(hybridServices, 'database', 'Spanner');
    const includeCdn = hasService(hybridServices, 'networking', 'Cloud CDN');
    const includeLoadBalancer = hasService(hybridServices, 'networking', 'Load Balancer');
    const includeCloudVpn = hasService(hybridServices, 'networking', 'Cloud VPN');
    const includePrivateServiceConnect = hasService(hybridServices, 'networking', 'Private Service Connect');
    const includeArmor = hasService(hybridServices, 'security', 'Cloud Armor');
    const includePubSub = hasAnyWorkload(inputs, ['iot-event-platform']) || (includeDataflow && includeCloudRun);

    if (!includeCloudRun && !includeCompute && !includeGke && !includeBigQuery && !includeStorage) {
      return recommendation?.mermaid || '';
    }

    const hasPublicFacing = hasAnyCharacteristic(inputs, ['public-facing']) || inputs?.accessPattern === 'public' || inputs?.accessPattern === 'hybrid';
    const hasInternalAccess = hasAnyCharacteristic(inputs, ['internal-only']) || inputs?.accessPattern === 'internal' || inputs?.accessPattern === 'hybrid';
    const mixedAccess = hasPublicFacing && hasInternalAccess;
    if (hasPublicFacing) addNode(publicNodes, 'PublicUser', 'PublicUser([Public Users]):::client');
    if (hasInternalAccess) addNode(corporateNodes, 'InternalUser', 'InternalUser([Corporate / Internal Users]):::client');
    if (includeArmor) addNode(networkNodes, 'Armor', 'Armor[Cloud Armor WAF]:::sec');
    if (includeLoadBalancer || includeCdn || includeArmor) addNode(networkNodes, 'GCLB', getLoadBalancerNodeDefinition(hybridServices));
    if (includeCdn) addNode(networkNodes, 'CDN', 'CDN[Cloud CDN Cache]:::gateway');
    if (includeCloudVpn) addNode(networkNodes, 'VPN', 'VPN[Cloud VPN Gateway]:::gateway');
    if (includePrivateServiceConnect) addNode(networkNodes, 'PSC', 'PSC[Private Service Connect]:::gateway');
    if (includeCloudRun) addNode(appNodes, 'CloudRun', 'CloudRun["Cloud Run Services<br/>Web / Portal + API / Mobile Backend"]:::compute');
    if (includeCompute) addNode(appNodes, 'Compute', 'Compute["Compute Engine MIG<br/>Enterprise Business Application"]:::compute');
    if (includeGke) addNode(appNodes, 'GKE', 'GKE[GKE Standard Cluster]:::compute');
    if (includePubSub) addNode(appNodes, 'PubSub', 'PubSub[Pub/Sub Events]:::gateway');
    if (includeDataflow) addNode(appNodes, 'Dataflow', 'Dataflow[Dataflow Pipelines]:::compute');
    if (includeDatabase) addNode(dataNodes, 'Database', getDatabaseNodeDefinition(hybridServices));
    if (includeCache) addNode(dataNodes, 'Cache', 'Cache[(Memorystore Redis Cache)]:::storage');
    if (includeStorage) addNode(dataNodes, 'Storage', 'Storage[(Cloud Storage)]:::storage');
    if (includeFilestore) addNode(dataNodes, 'File', 'File[(Filestore NFS Mount)]:::storage');
    if (includeBigQuery) addNode(dataNodes, 'BigQuery', 'BigQuery[(BigQuery DWH)]:::data');

    const primaryUserNode = hasPublicFacing ? 'PublicUser' : 'InternalUser';
    let ingressNode = networkNodes.has('GCLB') ? 'GCLB' : primaryUserNode;
    if (includeArmor && networkNodes.has('GCLB')) {
      addEdge(edges, primaryUserNode, 'Armor');
      addEdge(edges, 'Armor', 'GCLB');
    } else if (networkNodes.has('GCLB')) {
      addEdge(edges, primaryUserNode, 'GCLB');
    }
    if (includeCdn && networkNodes.has('GCLB')) {
      addEdge(edges, 'GCLB', 'CDN');
    }
    if (includeCloudVpn) {
      if (mixedAccess) addEdge(edges, 'InternalUser', 'VPN');
      addEdge(edges, 'VPN', networkNodes.has('GCLB') ? 'GCLB' : ingressNode);
    }
    if (includePrivateServiceConnect) {
      if (mixedAccess) addEdge(edges, 'InternalUser', 'PSC');
      addEdge(edges, 'PSC', networkNodes.has('GCLB') ? 'GCLB' : ingressNode);
    }

    if (appNodes.has('CloudRun')) addEdge(edges, ingressNode, 'CloudRun', 'Web/API lane');
    if (appNodes.has('Compute')) addEdge(edges, ingressNode, 'Compute', 'Enterprise lane');
    if (appNodes.has('GKE')) addEdge(edges, ingressNode, 'GKE', 'Container orchestration lane');
    if (mixedAccess) {
      if (appNodes.has('Compute')) addEdge(edges, 'InternalUser', 'Compute');
      else if (appNodes.has('CloudRun')) addEdge(edges, 'InternalUser', 'CloudRun');
      else if (appNodes.has('GKE')) addEdge(edges, 'InternalUser', 'GKE');
    }

    if (includeCloudRun) {
      if (includeDatabase) addEdge(edges, 'CloudRun', 'Database');
      if (includeStorage) addEdge(edges, 'CloudRun', 'Storage');
      if (includeCache) addEdge(edges, 'CloudRun', 'Cache');
      if (includePubSub) addEdge(edges, 'CloudRun', 'PubSub');
    }
    if (includeCompute) {
      if (includeDatabase) addEdge(edges, 'Compute', 'Database');
      if (includeStorage) addEdge(edges, 'Compute', 'Storage');
      if (includeCache) addEdge(edges, 'Compute', 'Cache');
      if (includeFilestore) addEdge(edges, 'Compute', 'File');
    }
    if (includeGke) {
      if (includeDatabase) addEdge(edges, 'GKE', 'Database');
      if (includeStorage) addEdge(edges, 'GKE', 'Storage');
      if (includePubSub) addEdge(edges, 'GKE', 'PubSub');
    }
    if (includePubSub && includeDataflow) addEdge(edges, 'PubSub', 'Dataflow');
    if (includeStorage && includeDataflow) addEdge(edges, 'Storage', 'Dataflow');
    if (includeDataflow && includeBigQuery) addEdge(edges, 'Dataflow', 'BigQuery');
    if (includeStorage && includeBigQuery) addEdge(edges, 'Storage', 'BigQuery');

    const layoutEdges = [];
    if (dataNodes.has('Database') && dataNodes.has('Cache')) layoutEdges.push('  Database ~~~ Cache');
    if (dataNodes.has('Storage') && dataNodes.has('File')) layoutEdges.push('  Storage ~~~ File');

    let mermaid = 'flowchart TB\n';
    mermaid += '  %% Styling classes\n';
    mermaid += `${buildClassDefs()}\n\n`;
    mermaid += '  subgraph MainFlow [" "]\n';
    mermaid += '    direction LR\n';
    if (publicNodes.size > 0) {
      mermaid += '  subgraph PublicAccess ["Client Access - Public"]\n';
      mermaid += '    direction TB\n';
      publicNodes.forEach(definition => { mermaid += `    ${definition}\n`; });
      mermaid += '  end\n\n';
    }
    if (corporateNodes.size > 0) {
      mermaid += '  subgraph CorporateAccess ["Client Access - Corporate"]\n';
      mermaid += '    direction TB\n';
      corporateNodes.forEach(definition => { mermaid += `    ${definition}\n`; });
      mermaid += '  end\n\n';
    }
    if (networkNodes.size > 0) {
      mermaid += '  subgraph Network ["Edge Protection"]\n';
      mermaid += '    direction TB\n';
      networkNodes.forEach(definition => { mermaid += `    ${definition}\n`; });
      mermaid += '  end\n\n';
    }
    mermaid += '  subgraph App ["Application Services"]\n';
    mermaid += '    direction TB\n';
    appNodes.forEach(definition => { mermaid += `    ${definition}\n`; });
    mermaid += '  end\n\n';
    mermaid += '  subgraph Data ["Data Platform"]\n';
    mermaid += '    direction LR\n';
    dataNodes.forEach(definition => { mermaid += `    ${definition}\n`; });
    mermaid += '  end\n\n';
    mermaid += '  end\n\n';
    mermaid += '  style MainFlow fill:transparent,stroke:transparent,color:transparent;\n\n';
    mermaid += '  %% Hybrid topology flows\n';
    if (layoutEdges.length) mermaid += `${layoutEdges.join('\n')}\n`;
    mermaid += `${edges.join('\n')}\n`;

    return mermaid;
  }

  const api = Object.freeze({
    generateHybridMermaidDiagram
  });

  global.CloudShiftHybridMermaid = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
