# CloudShift Architect Studio

Enterprise Cloud Architecture Assessment, Workload Sizing, Security, Resiliency, and Migration Planning Platform for Google Cloud.

CloudShift Architect Studio is a rules-driven assessment platform designed to help Solution Architects, Presales Engineers, Cloud Consultants, and Enterprise Architects rapidly evaluate workloads and generate architecture recommendations for Google Cloud.

The platform transforms business, technical, operational, and resiliency requirements into a structured cloud architecture blueprint, including compute platform selection, workload sizing, security recommendations, disaster recovery guidance, and architecture visualization.

---

## Key Capabilities

### Architecture Assessment Engine

Analyze workload requirements and automatically generate:

* Architecture recommendations
* Service selection
* Security controls
* Recovery and disaster recovery design
* Operational guidance

---

### Workload Sizing Engine (v3.1)

Automatically determines the most suitable compute platform and provides presales-level sizing guidance for:

* Cloud Run
* Google Kubernetes Engine (GKE)
* Compute Engine

Sizing outputs include:

* Compute sizing
* Memory recommendations
* Autoscaling guidance
* High availability considerations
* Platform-specific deployment recommendations

---

### Industry-Aware Recommendations

CloudShift adapts recommendations based on workload type and industry requirements.

Supported sectors include:

* Government
* GLC / Public Sector
* Finance / Banking
* Healthcare
* Education
* Utilities
* Manufacturing
* Telecommunications
* Retail / E-Commerce
* Technology / SaaS
* Oil & Gas
* Media & Streaming

---

### Recovery & Disaster Recovery Engine

Automatically generates:

* Recovery Time Objective (RTO)
* Recovery Point Objective (RPO)
* Backup retention strategies
* High availability guidance
* Disaster recovery recommendations

Supported recovery profiles:

* Tier 1 – Mission Critical
* Tier 2 – Production Resilient
* Tier 3 – Standard Production
* Tier 4 – Cost Optimized

---

### Security Recommendation Engine

Generates contextual security recommendations based on workload characteristics and business requirements.

Examples include:

* Cloud Armor
* Secret Manager
* Cloud KMS (CMEK)
* Identity-Aware Proxy (IAP)
* VPC Service Controls

---

### Architecture Visualization

Automatically generates:

* Layered architecture diagrams
* Service topology diagrams
* Security architecture views

Using Mermaid-based diagram generation.

---

### Report Generation

Generate architecture assessment reports including:

* Executive Summary
* Architecture Overview
* Workload Sizing Recommendations
* Recovery & DR Strategy
* Security Recommendations
* Cost Optimization Guidance
* Architecture Topology Diagram

Export format:

* Markdown

---

## Current Architecture Flow

Assessment Inputs

↓

Rules Engine

↓

Compute Platform Selection

↓

Workload Sizing Engine

↓

Security & Compliance Engine

↓

Recovery & DR Engine

↓

Architecture Recommendation

↓

Mermaid Topology Generation

↓

Markdown Report Export

---

## Supported Compute Platforms

### Cloud Run

Recommended for:

* Stateless applications
* Containerized workloads
* APIs
* Event-driven applications
* Cloud-native platforms

### Google Kubernetes Engine (GKE)

Recommended for:

* Microservices platforms
* Kubernetes-native environments
* Multi-service container ecosystems

### Compute Engine

Recommended for:

* Legacy applications
* VM-based workloads
* Lift-and-shift migrations
* Infrastructure-dependent systems

---

## Technology Stack

* HTML5
* CSS3
* Vanilla JavaScript
* Mermaid.js

No backend services.

No databases.

No external APIs.

No AI model dependencies.

All assessment logic executes locally in the browser.

---

## Current Version

### v3.1.1

Highlights:

* Workload Sizing Engine
* Cloud Run sizing
* GKE sizing
* Compute Engine sizing
* Industry-aware recommendations
* Architecture consistency validation
* Security recommendation engine
* Recovery & disaster recovery planning
* Mermaid topology generation
* Markdown report export

---

## Roadmap

### v3.2 – Migration Assessment Engine

Planned capabilities:

* On-Premises to GCP assessment
* Azure to GCP assessment
* AWS to GCP assessment
* AliCloud to GCP assessment

Outputs:

* Migration complexity assessment
* Service mapping
* Migration strategy recommendations
* Modernization opportunities

---

## Author

Hisham Ahmad

Google Cloud Solution Architect

Cloud Architecture | Presales Engineering | Cloud Modernization | Workload Assessment
