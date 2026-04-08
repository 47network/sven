# Gemma 4 On-Device Integration Specification

> Technical specification for integrating Google Gemma 4 into Sven companion apps.
> Part of Batch 6 of the Sven Evolution Roadmap.
> Created: 2026-04-08

---

## 1. Overview

Gemma 4 enables Sven to run AI inference directly on user devices — phones, tablets,
desktops — without requiring cloud connectivity. This makes every Sven installation
independently intelligent while preserving the ability to escalate to cloud when needed.

**Core principle**: Local-first, cloud-enhanced, never cloud-dependent.

---

## 2. Model Selection per Platform

| Platform | App | Model | Effective Params | Context | Audio | Vision |
|----------|-----|-------|-----------------|---------|-------|--------|
| Android / iOS | Flutter companion | Gemma 4 E2B | 2B active | 128K | ✅ Native | ✅ Native |
| Desktop (macOS/Windows/Linux) | Tauri companion | Gemma 4 E4B | 4B active | 128K | ✅ Native | ✅ Native |
| Server (VM5/VM9) | Sven backend | Gemma 4 26B MoE | 3.8B active | 256K | Via adapter | ✅ |
| Server (fine-tune target) | Sven backend | Gemma 4 31B Dense | 31B | 256K | Via adapter | ✅ |

All models: Apache 2.0 licensed, GGUF format available.

---

## 3. Integration Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Companion App                          │
│                                                          │
│  ┌────────────┐   ┌──────────────┐   ┌───────────────┐  │
│  │ Module      │   │ Inference    │   │ Local Memory  │  │
│  │ Manager     │   │ Engine       │   │ (Drift/SQLite)│  │
│  │             │   │              │   │               │  │
│  │ • Download  │   │ • E2B/E4B    │   │ • Quantum     │  │
│  │ • Install   │──▶│ • GGUF       │──▶│   fade decay  │  │
│  │ • Update    │   │ • llama.cpp  │   │ • Knowledge   │  │
│  │ • Remove    │   │ • LiteRT-LM  │   │   graph sync  │  │
│  └────────────┘   └──────┬───────┘   └───────────────┘  │
│                          │                               │
│                    ┌─────▼─────┐                         │
│                    │  Smart    │                          │
│                    │  Router   │                          │
│                    └─────┬─────┘                          │
│                          │                               │
│         ┌────────────────┼────────────────┐              │
│         ▼                ▼                ▼              │
│    Local Only      Cloud Escalate    Offline Mode        │
│    (simple tasks)  (complex tasks)   (no connection)     │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Sven Server │
                    │ (LiteLLM)   │
                    │ 26B/31B     │
                    └─────────────┘
```

### Smart Routing Logic

```
1. Receive user request
2. Classify complexity:
   - SIMPLE: factual Q&A, short text, basic commands → LOCAL
   - MEDIUM: multi-step reasoning, image analysis → LOCAL (try) → CLOUD (if timeout/low confidence)
   - COMPLEX: long-form generation, fine-tuning, multi-modal synthesis → CLOUD
3. Check connectivity:
   - ONLINE: route per classification
   - OFFLINE: all requests → LOCAL (best effort with available modules)
4. Check user preference:
   - "Always local" → force LOCAL regardless of complexity
   - "Always cloud" → force CLOUD (skip local inference)
   - "Smart" (default) → use routing logic above
```

---

## 4. Module System

### 4.1 Auto-Download System

Unlike Google's AI Edge Gallery (which requires manual individual downloads), Sven
automates this:

1. **Platform detection**: On first launch, detect device capabilities (RAM, storage,
   GPU/NPU, platform)
2. **Module recommendation**: Suggest optimal module set based on device specs
3. **Permission request**: Ask user before downloading (storage permission, data usage
   disclosure)
4. **Background download**: Download modules in background with progress UI
5. **Integrity verification**: Checksum validation of downloaded model files
6. **Auto-update**: Check for module updates periodically (opt-in)

### 4.2 Available Modules

| Module ID | Name | Size (approx) | Description | Gemma 4 Feature |
|-----------|------|---------------|-------------|-----------------|
| `agentic` | Agentic Workflow | ~1.5 GB | Function calling, tool use, task planning, autonomous multi-step execution | Native function calling + structured JSON output |
| `multimodal` | Multimodal Reasoning | ~2.0 GB | Image understanding, OCR, chart reading, visual Q&A, document analysis | Vision processing (variable resolution) |
| `language` | Language Pack | ~0.5 GB | 140+ languages, translation, multilingual chat, cultural context | Native multilingual training |
| `finetune` | Fine-Tuning Engine | ~0.8 GB | Custom model adaptation for user-specific tasks, LoRA support | Local QLoRA/LoRA fine-tuning |
| `audioscribe` | Audio Scribe | ~1.2 GB | Local speech-to-text. ~30 second processing for meetings, voice notes, lectures | Native audio input (E2B/E4B) |
| `agentskills` | Agent Skills | ~1.0 GB | Autonomous task execution, app navigation, workflow automation | Agentic workflows |
| `promptlab` | Prompt Lab | ~0.3 GB | Prompt engineering tools, structured output generation, JSON templating | System instructions + structured JSON |
| `mobileactions` | Mobile Actions | ~1.5 GB | Device control through Sven. Navigate apps, complete tasks, automate phone workflows — what Sven should do flawlessly | App navigation + function calling |

### 4.3 Module Dependencies

```
audioscribe   → (standalone)
language      → (standalone)
promptlab     → (standalone)
multimodal    → (standalone)
agentic       → promptlab (structured output needed for tool calls)
agentskills   → agentic (skills need function calling)
mobileactions → agentskills + multimodal (needs skills + screen understanding)
finetune      → (standalone, but benefits from all other modules)
```

### 4.4 Settings UI

```
┌─────────────────────────────────────────┐
│ 🧠 On-Device AI                    [ON] │
├─────────────────────────────────────────┤
│                                         │
│ Model: Gemma 4 E2B         [Change ▼]  │
│ Status: Active (3 modules loaded)       │
│ Storage: 4.2 GB / 128 GB used          │
│ Inference speed: ~45 tokens/sec         │
│                                         │
│ ─── Installed Modules ───               │
│ ✅ Agentic Workflow      1.5 GB  [⋯]  │
│ ✅ Audio Scribe          1.2 GB  [⋯]  │
│ ✅ Language Pack          0.5 GB  [⋯]  │
│                                         │
│ ─── Available Modules ───               │
│ ☐ Multimodal Reasoning   2.0 GB  [↓]  │
│ ☐ Mobile Actions         1.5 GB  [↓]  │
│ ☐ Agent Skills           1.0 GB  [↓]  │
│ ☐ Prompt Lab             0.3 GB  [↓]  │
│ ☐ Fine-Tuning Engine     0.8 GB  [↓]  │
│                                         │
│ ─── Routing ───                         │
│ Mode: [Smart ▼] (Local + Cloud)         │
│ ○ Always Local  ○ Always Cloud          │
│ ● Smart (recommended)                   │
│                                         │
│ ─── Privacy ───                         │
│ Community participation: [OFF ▼]        │
│ ○ OFF (fully local, no sharing)         │
│ ○ Read-only (consume, don't post)       │
│ ○ Contribute (share with community)     │
│                                         │
│ [Check for Updates]  [Clear All Models] │
└─────────────────────────────────────────┘
```

---

## 5. Platform-Specific Implementation

### 5.1 Flutter (Mobile — Android / iOS)

**Runtime**: Google AI Edge SDK (LiteRT-LM)

```dart
// Module manager integration point
class GemmaModuleManager {
  // Platform-adaptive model loading
  Future<void> downloadModule(GemmaModule module);
  Future<void> removeModule(GemmaModule module);
  Future<List<GemmaModule>> getInstalledModules();
  Future<List<GemmaModule>> getAvailableModules();
  Future<DeviceCapabilities> detectCapabilities();
  Future<List<GemmaModule>> getRecommendedModules();
}

// Inference engine
class GemmaInferenceEngine {
  // Stream-based for real-time UX
  Stream<String> generate(String prompt, {GemmaModule? module});
  Future<double> getConfidence(String response);
  Future<bool> isModuleLoaded(String moduleId);
}

// Smart router
class SmartRouter {
  // Route to local or cloud based on complexity + connectivity
  Future<RouterDecision> route(UserRequest request);
}
```

**Key considerations**:
- Background model loading (don't block UI)
- Battery-conscious inference (throttle on low battery)
- Thermal management (reduce inference speed if device overheating)
- Storage management (warn before filling device)
- iOS App Store compliance: on-device models don't require Apple review for updates

### 5.2 Tauri (Desktop — macOS / Windows / Linux)

**Runtime**: llama.cpp via Rust bindings OR local Ollama sidecar

```rust
// Rust-side inference (Tauri command)
#[tauri::command]
async fn generate_local(prompt: &str, module: &str) -> Result<String, Error> {
    let engine = GemmaEngine::get_or_init()?;
    engine.generate(prompt, module).await
}

// Module management
#[tauri::command]
async fn download_module(module_id: &str) -> Result<DownloadProgress, Error> {
    let manager = ModuleManager::get()?;
    manager.download(module_id).await
}
```

**Key considerations**:
- Desktop has more RAM/storage — can run E4B (larger model)
- GPU acceleration via CUDA (NVIDIA), ROCm (AMD), Metal (Apple Silicon)
- Ollama sidecar option: if user already has Ollama installed, use it instead of bundled
- Auto-detect existing local models (Ollama, LM Studio) and offer to use them

---

## 6. Offline Mode

When device has no internet connection:

1. All installed modules remain fully functional
2. Smart router forces all requests to LOCAL
3. UI shows "Offline Mode — Running on {model name}"
4. Memory continues to be stored locally (syncs when back online)
5. Community bridge queues contributions (sent when reconnected, if user consented)
6. Key use cases:
   - **Travel**: New country, no data plan — Sven still fully works
   - **Privacy**: User doesn't want any cloud processing
   - **Speed**: Local inference is faster than round-trip to cloud
   - **Disaster**: Internet outage — Sven is unaffected

---

## 7. Image Processing Pipeline (Local-First)

```
User takes/shares photo
        │
        ▼
┌─────────────────┐
│ Multimodal       │
│ Module (local)   │
│                  │
│ • OCR            │
│ • Object detect  │
│ • Scene describe │
│ • Chart read     │
│ • Document parse │
└────────┬────────┘
         │
    Confidence check
         │
    ┌────┴────┐
    │ ≥ 0.8   │ → Return local result
    │ < 0.8   │ → Escalate to server (if online + user permits)
    └─────────┘
```

---

## 8. Audio Scribe (Local Processing)

- **Processing time**: ~30 seconds for typical voice note
- **No cloud dependency**: fully local, fully private
- **Use cases**: meeting transcription, voice notes, lecture capture, voice commands
- **Languages**: 140+ via Gemma 4 native language support
- **Integration**: replaces or augments existing `faster-whisper` service for on-device use
- **Output**: structured text with timestamps, speaker diarization (future)

---

## 9. Mobile Actions (Device Control)

Gemma 4's native agentic capabilities enable Sven to control the device:

- Navigate between apps
- Fill forms
- Send messages
- Manage settings
- Take screenshots and understand what's on screen
- Execute multi-step workflows ("book me a restaurant for 7pm")

**This is what Sven should do flawlessly.** The Mobile Actions module combines:
- Multimodal reasoning (understanding what's on screen)
- Agentic workflow (planning multi-step actions)
- Function calling (executing device APIs)

**Safety**: All device actions require explicit user confirmation for:
- Purchases or payments
- Sending messages to contacts
- Changing system settings
- Installing/uninstalling apps
- Accessing sensitive data (photos, contacts, location)

---

## 10. Model Agnosticism

Gemma 4 is the **default**, not a lock-in:

```
┌─────────────────────────────┐
│     Inference Abstraction   │
│                             │
│  ┌───────────────────────┐  │
│  │ Model Slot            │  │
│  │                       │  │
│  │ Default: Gemma 4      │  │
│  │ Alt: Any GGUF model   │  │
│  │ Alt: User's Ollama    │  │
│  │ Alt: LM Studio models │  │
│  └───────────────────────┘  │
│                             │
│  Standardized API:          │
│  • generate(prompt) → text  │
│  • embed(text) → vector     │
│  • transcribe(audio) → text │
│  • describe(image) → text   │
└─────────────────────────────┘
```

User can bring their own GGUF model and slot it in. The module system adapts.

---

## 11. Privacy Guarantees

1. On-device inference NEVER sends prompts/responses to Google or any third party
2. Model weights are downloaded once and run locally — no "phone home"
3. No telemetry from inference (prompt content, response content, usage patterns)
4. Community participation is separate and explicitly opt-in (OFF by default)
5. User can audit what data leaves the device (settings → privacy → data log)
6. Model updates are checksum-verified and don't include tracking
7. GDPR Article 5(1)(a): lawfulness, fairness, transparency — all enforced

---

## 12. Documentation & Website

- Suite page: `sven.systems/ai` — overview of on-device AI capabilities
- Setup guide: per-platform installation and module download walkthrough
- Module catalog: descriptions, sizes, capabilities, platform compatibility
- API reference: local inference API for developers building on Sven
- Privacy policy update: document on-device processing guarantees
- FAQ: common questions about storage, battery, offline mode, model updates
