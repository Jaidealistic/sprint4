# Maestro: A Flow-First Document Review Workspace

**Problem Statement Addressed:** Problem 2: Working at Volume
**User Persona:** Maya, a high-volume paralegal working under intense time pressure.

## 1. Core Philosophy: Empathy for the User at Volume

When a paralegal is faced with anonymizing 200 case files before the end of the day, a standard "point-and-click" interface fails. At high volumes, cognitive fatigue and mechanical friction are the primary enemies. 

I realized that for Maya, **speed is a requirement, but safety is paramount**. She will abandon a tool if it slows her down, but she will be fired if she leaks PII. 

Maestro is engineered around a single guiding principle: **Keep the user in a state of high-speed flow, and build systemic safety nets that catch the edge cases.**

---

## 2. What Maestro Built (and Why)

### Risk-Based Triage (Not a Flat List)
A flat list of 200 documents induces immediate cognitive overload. Maestro features an ingestion engine that automatically buckets documents into **Needs Attention**, **Quick Review**, and **Ready**. 
* **Reasoning:** Maya can apply her peak mental energy to the high-risk documents first, and breeze through the "Ready" bucket at the end of the day.

### Keyboard-First, Optimistic UI
Every time Maya has to reach for her mouse, she loses seconds. Every time she waits for a loading spinner, she loses momentum.
* **Implementation:** The core review loop is entirely keyboard-driven (`J`/`K` to navigate, `A`/`R` to redact or keep, `Shift+A` to bulk-resolve). When she makes a decision, the UI updates instantly. The API request is dispatched silently in the background. 
* **Reasoning:** Optimistic state management removes mechanical latency. The application operates at the speed of her thought.

### Deep Forgiveness (Undo Stack)
High velocity guarantees occasional mistakes. 
* **Implementation:** Maestro includes an instant, 20-deep undo stack (`Ctrl+Z`) tied directly to the optimistic UI.
* **Reasoning:** A tool that punishes mistakes (or requires 3 clicks to reverse them) forces the user to slow down. Instant forgiveness encourages speed.

### Smart Clustering
Reviewing the same name 15 times in a single document is a waste of human capital.
* **Implementation:** The backend clusters identical entities. A single decision in the Right Sidebar resolves all matching instances across the entire document instantly.

### The "End-of-Day" Safety Net and True Redaction
Visual CSS redactions (drawing a black box over HTML text) are sufficient for a demo, but a massive legal liability in production if the PDF metadata remains intact.
* **Implementation:** Maestro's export pipeline uses PyMuPDF to **physically scrub the underlying text layer** and **strip all hidden PDF metadata**. 
* **Partial Exports:** If 199 files are clean and 1 is pending, the export does not fail. It successfully exports the 199 safe files and flags the remaining 1. The dashboard provides absolute visibility into exactly what is leaving the system alongside a generated `manifest.json` and a full `audit_log.csv`.

---

## 3. What Was Deliberately Left Out (and Why)

With AI capable of writing endless boilerplate, I explicitly chose to omit features that look good on a feature list but fail to serve Maya’s actual constraints.

1. **No Authentication or Multi-User Collaboration**
   * *Why:* The prompt specifies a local, single-player workflow. Adding JWTs, role-based access control (RBAC), and collaborative conflict resolution adds immense architectural complexity that solves a problem Maya doesn't currently have. Maestro is optimized for local, single-tenant speed.

2. **No WebSockets or SSE for State Sync**
   * *Why:* While WebSockets are standard for real-time chat, for a local batch-processing tool, a lightweight batch-polling endpoint (`/api/status/batch`) is vastly superior. It handles dropped connections gracefully, consumes minimal memory, and maintains a unidirectional data flow that is drastically easier to debug and maintain.

3. **No "Confirm Action" Dialogs**
   * *Why:* "Are you sure?" popups are the enemy of flow. I traded confirmation dialogs for an instant Undo stack. Maestro trusts the user, but provides a safety net.

4. **No Heavy Styling or "Gamification"**
   * *Why:* I stripped out heavy colors, borders, and shadows in favor of a stark, minimal, low-contrast aesthetic (inspired by tools like Linear). Over an 8-hour shift, high-contrast UI elements cause visual fatigue. The document text is the only thing that matters, and the UI gets entirely out of the way.

5. **No Fuzzy/Semantic Entity Matching (For Auto-Redaction)**
   * *Why:* While LLMs are great at semantic matching, legal redaction requires exact, deterministic bounds. I chose strict substring matching and offset tracking over "smart" semantic replacement to guarantee that the system never accidentally alters the surrounding legal text of the document.

---

## 4. Engineering Fundamentals

I treated this codebase as a system a teammate would need to maintain tomorrow morning.
* **Separation of Concerns:** Clear boundary between the React UI layer and the FastAPI backend. State is managed deterministically via a `SessionContext`.
* **Portability & Persistence:** By relying on `SQLite` (via SQLModel) and `localStorage`, the application requires zero external infrastructure (no Redis, no Postgres). It can be spun up on any paralegal's machine instantly.
* **OS-Level Robustness:** I intentionally configured the backend deployment and Vite proxying to eliminate zombie processes and locked ports (a notorious issue with Uvicorn hot-reloading on Windows), demonstrating an understanding of deployment realities beyond just writing application logic.
