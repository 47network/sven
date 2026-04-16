# Sven Companion App — Full Build Checklist

> **Goal:** A companion AI app that is better than ChatGPT, Gemini, and Claude.
> Not a clone — a personal AI companion with personality, presence, and polish.

> **Checklist Authority:** This is a primary checklist. The parity checklist is `reference_only` per `checklist-authority.json`.

**Current Snapshot**
- Production-readiness is tracked through generated artifacts and CI outputs, not static headline numbers in this document.
- Source-of-truth dependency versions: `apps/companion-user-flutter/pubspec.yaml`

**Authoritative readiness artifacts (always current source of truth):**
- `docs/release/status/app-checklist-format-latest.json`
- `docs/release/status/app-checklist-format-latest.md`
- `docs/release/status/app-checklist-metrics-latest.json`
- `docs/release/status/app-checklist-metrics-latest.md`
- `docs/release/status/mobile-binary-artifacts-latest.json`
- `docs/release/status/mobile-binary-artifacts-latest.md`
- `docs/release/status/parity-checklist-verify-latest.json`

**Sprint Highlights (Latest)**
- Sprint 69: Bulk multi-select thread management and accessibility semantics.
- Sprint 70: Memory search, starred facts, and filter UX polish.
- Sprint 71: Offline retry UX and security hardening controls.

---

## PHASE 0 — FOUNDATION (do first, everything else depends on this)

### 0.1 Architecture

- [x] Add `go_router` for declarative navigation + deep links (replace imperative `Navigator.push`)   ← *Sprint 33: dependency tracked in `apps/companion-user-flutter/pubspec.yaml`; lib/app/router.dart (appRouteSetup/appRouteOnboarding/appRouteLogin/appRouteHome/appRouteHomeApprovals/appRouteHomeChat() path constants); GoRouter in _SvenUserAppState._buildRouter() — navigatorKey, refreshListenable: _state, redirect guard (setup→onboarding→login→home), 5 GoRoutes including nested approvals + chat/:id deep-link routes; MaterialApp.router replaces MaterialApp; _openDeepLink uses _router.push(); ADR 005 updated*
- [x] Add `riverpod` or `flutter_bloc` for proper state management (replace raw `ChangeNotifier` + `setState`)   ← *Sprint 40: flutter_riverpod 2.6.1; lib/app/providers.dart — ChangeNotifierProvider<AppState/MemoryService/AppLockService/ProjectService/TutorialService> (overrideWith pattern) + Provider<VoiceService/AuthService/MessagesRepository/FeatureFlagService> (get_it bridge); root ProviderScope in main.dart; SvenUserApp → ConsumerStatefulWidget with inner ProviderScope overrides; MemoryPage → ConsumerStatefulWidget — ref.watch(memoryServiceProvider) replaces ListenableBuilder + constructor param; ADR 008; incremental migration — remaining pages in future sprints. Sprint 41: Stage 2 — 4 more providers (authenticatedClient/promptTemplates/device/featureTooltip); inner ProviderScope overrides 6→10; _AppShell 13-arg StatelessWidget → 2-arg ConsumerStatefulWidget; _AppShellState uses ref.watch/read for all 9 services; call site 13 args → 2*
- [x] Add `drift` or `isar` for local SQLite database (messages, threads, user profile cached offline)   ← *Sprint 35: drift 2.31.0 + drift_flutter 0.2.7 + sqlite3_flutter_libs 0.5.41; AppDatabase (lib/app/database.dart) with DbChatThreads + DbChatMessages tables; hand-written database.g.dart (drift_dev excluded — conflicts with freezed); MessagesRepository (lib/features/chat/messages_repository.dart) bridges DB rows ↔ ChatThreadSummary/ChatMessage; ChatService.listChats/listMessages/sendMessage/deleteChat all write-through; offline fallback returns cached rows on network failure; AppDatabase + MessagesRepository registered in service_locator; ADR 006*
- [x] Add `dio` with interceptors (replace raw `http` — retry, logging, cancel tokens, upload progress)   ← *Sprint 32: lib/app/dio_http_client.dart — DioHttpClient extends http.BaseClient; _RetryInterceptor (3 attempts, 1s/2s/4s exp backoff on network errors + 502/503/504); _DebugLogInterceptor (method+URL+status, debug builds only); SSE-aware (Accept: text/event-stream → ResponseType.stream, no receiveTimeout); DioHttpClient becomes the default inner transport for AuthenticatedClient*
- [x] Create a proper service locator / dependency injection (`get_it` or riverpod providers)   ← *Sprint 32: lib/app/service_locator.dart — GetIt lazy singleton registry; setupServiceLocator() called in main() before SentryFlutter.init(); registers DioHttpClient, TokenStore, AuthService, AuthenticatedClient, FeatureFlagService, MemoryService, VoiceService; resetServiceLocator() for tests; sl<T>() accessor*
- [x] Set up `flutter_gen` for type-safe asset references   ← *Sprint 42: flutter_gen_runner ^5.8.0 dev dep; flutter_gen: block in pubspec (integrations: flutter_svg: true, output: lib/gen/); build_runner generates lib/gen/assets.gen.dart — Assets.images.svenLogo/onboardingWelcome/onboardingFeatures/onboardingVoice + Assets.icons.icVoice; build.yaml excludes lib/app/database.dart from source_gen:combining_builder*
- [x] Add `freezed` + `json_serializable` for immutable models with proper serialization   ← *Sprint 34: dependencies tracked in `apps/companion-user-flutter/pubspec.yaml`; ChatMessage and ChatThreadSummary converted to @freezed classes (lib/features/chat/chat_models.dart); auto-generated copyWith/==/hashCode/toString; @JsonKey field mapping (created_at→timestamp, sender_name, content_type, chat_id); custom ChatThreadSummary.fromJson (dual-key last_message_at/updated_at fallback); generated chat_models.freezed.dart + chat_models.g.dart*

### 0.2 Project Setup

- [x] Custom app icon (gradient "S" orb rendered as proper icon assets for all densities)
- [x] Custom splash screen (dark bg #040712 + centered cyan orb)
- [x] Add `fonts:` section to pubspec — use Inter or SF Pro for premium typography   ← *Sprint 11: google_fonts + GoogleFonts.interTextTheme applied globally*
- [x] Add proper `assets/` directory with brand assets (logo SVG, onboarding illustrations)   ← *Sprint 42: assets/images/sven_logo.svg (cyan–mint gradient orb with “S” lettermark), onboarding_welcome.svg (concentric rings), onboarding_features.svg (chat bubbles), onboarding_voice.svg (waveform + mic); assets/icons/ic_voice.svg; LoginPage brand-mark widget now renders sven_logo.svg via Assets.images.svenLogo.svg()*
- [x] Set up flavors: `dev`, `staging`, `prod` (different API base URLs, bundle IDs)   ← *Sprint 36: EnvConfig (lib/config/env_config.dart) — SVEN_FLAVOR/SVEN_API_BASE/SVEN_ENV/SENTRY_DSN dart-define constants + allowFlagOverrides/flavorBadge helpers; main_dev.dart + main_staging.dart delegate to main(); Android productFlavors in build.gradle.kts with applicationIdSuffix (.dev/.staging) + versionNameSuffix + resValue app_name; AndroidManifest uses @string/app_name; per-flavor google-services.json in android/app/src/{dev,staging,prod}/; CI builds updated to --flavor prod; ADR 007*
- [x] Configure `firebase_options.dart` per flavor   ← *Sprint 39: lib/firebase_options.dart — DefaultFirebaseOptions class; currentPlatform getter dispatches on kIsWeb + defaultTargetPlatform; _androidOptions/_iosOptions/_webOptions switch on EnvConfig.flavor (dev/staging/prod); prod credentials from google-services.json (projectId: thesven, messagingSenderId: 379390504662); dev/staging stubs with TODO comments for Firebase Console app registrations; main.dart imports firebase_options.dart and passes options: DefaultFirebaseOptions.currentPlatform to both Firebase.initializeApp() calls*
- [x] Add `sentry_flutter` for crash reporting
- [x] Add `firebase_analytics` for user event tracking   ← *Sprint 10: FirebaseAnalytics wired for key events*
- [x] Set up CI/CD (GitHub Actions or Codemagic: analyze → test → build → deploy)

### 0.3 Testing Foundation

- [x] Set up integration test framework (`integration_test` package)   ← *Sprint 38: integration_smoke_test.dart fully fixed — AuthService gains `store: TokenStore?` injection seam; _InMemoryTokenStore subclass overrides all 12 async methods with plain Map storage (no FlutterSecureStorage platform channel); TestWidgetsFlutterBinding.ensureInitialized() in setUpAll; 9 previously-failing tests now pass (13/13 pass); total suite 80 pass / 1 pre-existing fail*
- [x] Add Maestro/Patrol for E2E device testing   ← *Sprint 59: patrol: ^3.14.0 + integration_test SDK dep added to pubspec.yaml; patrol.yaml config (appId, find_timeout:10000, android+ios appId); integration_test/patrol_test.dart — 9 patrolTest cases covering smoke, auth (valid/invalid creds), new-chat FAB flow, send-message thread, settings sheet open/dismiss, MFA tile, sign-out; .maestro/flows/ expanded from 2 minimal stubs to 8 full flows: android-smoke.yaml (8-step: launch→login→home→settings→chat→signout), ios-smoke.yaml (same for iOS), android-login.yaml, android-new-chat.yaml, android-settings.yaml, ios-login.yaml, ios-new-chat.yaml, ios-settings.yaml — all with per-step takeScreenshot and tagged (smoke/auth/chat/settings + platform tag)*
- [x] Set up golden tests for visual regression   ← *Sprint 37: test/golden_test.dart — 7 matchesGoldenFile tests; QuickActionsBar (classic+cinematic), ChatComposer idle (classic+cinematic), MemoryPage (classic+cinematic), OnboardingPage welcome; fixed MemoryPage FactCategory Row→Wrap layout overflow; baselines in test/goldens/; flutter test test/golden_test.dart to verify; --update-goldens to regenerate after intentional UI changes*
- [x] Target: 80%+ unit test coverage for services, 60%+ widget test coverage   ← *Sprint 48: 3 new test files — `db_encryption_test.dart` (14 tests: round-trip, IV randomisation, legacy-plaintext fallback, corrupt-data guard, wrong-key safety, Unicode, 100× IV invariant), `messages_repository_test.dart` (18 tests: threads CRUD, messages CRUD, outbox enqueue/delete/purge/increment, encryption at-rest round-trips for thread title/message content/outbox body), `sync_service_test.dart` (18 tests: drain success/fail/no-op/idle, pendingCount, lastSynced, max-attempts abandon, purgeFor). Suite grew from 81 → 131 tests (all pass). Side-fix: `MessagesRepository._threadToCompanion` + `_messageToCompanion` now use `Value.absent()` for null nullable fields (channel, tag, senderName) preventing a runtime null-bang crash in drift's hand-written toColumns.*

---

## PHASE 1 — CORE CHAT (make the conversation experience world-class)

### 1.1 Streaming Responses

- [x] Implement token-by-token SSE streaming (server sends delta tokens, client appends in real-time)
- [x] Animated typing cursor at end of streaming text (blinking caret)
- [x] "Stop generating" button appears during streaming (replaces send button)
- [x] Smooth auto-scroll during streaming (follows new content without jarring)
- [x] Show "Sven is thinking..." indicator with typing dots before first token arrives

### 1.2 Message Actions

- [x] Long-press context menu on any message: Copy, Share, Quote, Edit, Delete
- [x] "Copy" button on code blocks (tap icon in top-right corner of code block)
- [x] "Regenerate response" button on the last assistant message
- [x] Edit sent messages → re-send from that point (conversation branching)   ← *Sprint 12: long-press → Edit & resend, pre-fills composer, clears on send*
- [x] Thumbs up / thumbs down feedback on assistant messages
- [x] Optional written feedback after thumbs down
- [x] Swipe-to-reply (quote a message)

### 1.3 Conversation Management

- [x] Rename conversations (tap title → inline edit)
- [x] Delete conversations (swipe-to-delete in list, or long-press → delete)
- [x] Pin conversations to top of list
- [x] Archive conversations (hidden from main list, accessible via filter)   ← *Sprint 12: toggleArchive in AppState + SharedPrefs, filter chip in ChatListPanel*
- [x] Search across all conversations (full-text search)
- [x] Search within a single conversation   ← *Sprint 11: animated search bar in thread header, filters message list in real-time*
- [x] Conversation folders / categories / tags   ← *Sprint 12: ConversationTag enum (work/personal/creative/code/ideas), colour dots, context-menu tagging, filter chips*
- [x] Share conversation as link (generate read-only share URL)
- [x] Export conversation as text/markdown/PDF   ← *Sprint 10: share_plus, markdown export via share sheet*

### 1.4 Rich Content Rendering

- [x] Syntax-highlighted code blocks (language detection + proper highlighting)
- [x] Copy button on every code block
- [x] Expandable/collapsible long code blocks
- [x] LaTeX / math equation rendering
- [x] Table rendering in markdown
- [x] Clickable URLs in messages (opens in browser via url_launcher)
- [x] Image rendering in assistant responses (when server sends image URLs)
- [x] Mermaid diagram rendering
- [x] "Artifact" panel for long-form generated content (like Claude's Artifacts)   ← *Sprint 14: Expand button on assistant messages >400 chars → _ArtifactPage (full-screen MarkdownBody, word/char count, copy-all, share)*

### 1.5 Message Input Enhancements

- [x] Expandable composer (grows to multi-line, then scrolls)   ← *Sprint 21: AnimatedSize wrapper, maxLines toggles 2⇄6 via collapse/expand icon, unfold_more/unfold_less toggle when text is multi-line*
- [x] "@-mention" commands (e.g., @web for web search, @code for code mode)   ← *Sprint 10: _AtMention overlay, 4 modes (web/code/math/translate)*
- [x] Slash commands (`/new`, `/clear`, `/search`, `/help`)
- [x] Paste image from clipboard → auto-upload
- [x] Drag-and-drop files onto composer   ← *Sprint 52: DropTarget (desktop_drop ^0.4.4) wraps ChatComposer; _handleDroppedFiles() routes image extensions (png/jpg/jpeg/gif/webp) → _attachedImages list, all other exts → PlatformFile via readAsBytes() with same 30 KB text-extraction logic as _pickFile(); _DragOverlay shows Icon + "Drop to attach" label with theme-correct border/fill; _isDragging state driven by onDragEntered/onDragExited; no-op on mobile/web (silent passthrough)*
- [x] Character/token counter showing remaining context
- [x] Recent prompts / prompt history (arrow-up to recall last message)   ← *Sprint 10: PromptHistoryService, up/down keyboard shortcuts*
- [x] Prompt templates / saved prompts library   ← *Sprint 11: PromptTemplatesService, /save + /templates slash commands, bottom-sheet picker*

---

## PHASE 2 — MULTIMODAL (what makes it competitive)

### 2.1 Image Input

- [x] Image picker from gallery (`image_picker`)
- [x] Camera capture (take photo directly)
- [x] Image preview before send (thumbnail with remove button)
- [x] Multi-image send in single message
- [x] Image compression/resize before upload
- [x] Upload progress indicator   ← *Sprint 18: AnimatedBuilder + LinearProgressIndicator in composer, animates 0→0.92 during send, snaps to 1.0 on complete*
- [x] Paste image from clipboard

### 2.2 File/Document Input

- [x] File picker (`file_picker` — PDF, DOCX, TXT, CSV, etc.)
- [x] File preview before send (icon + filename + size)
- [x] Upload progress with animated bar   ← *Sprint 24: _SvenProgressBar widget (gradient bar + spinner + % label, cinematic glow), replaces LinearProgressIndicator in ChatComposer*
- [x] Document parsing preview (show first page / extracted text)   ← *Sprint 29: _pickFile() reads up to 3 lines of text for txt/md/csv/json/log files into _docPreviewText; _FilePreviewStrip gains optional previewText param rendered below file size in monospace 10sp; cleared on _removeAttachment()*
- [x] Drag-and-drop file upload (web/desktop)   ← *Sprint 52: desktop_drop DropTarget integration in ChatComposer (see line 93); covers Windows, macOS, Linux; package is a no-op on unsupported platforms*

### 2.3 Voice — Speech-to-Text

- [x] Mic button → real-time speech-to-text (`speech_to_text`)
- [x] Live transcription preview (words appear as you speak)
- [x] Voice activity detection (auto-stop on silence via `pauseFor`)
- [x] Cancel recording (tap X button in overlay)
- [x] Language auto-detection   ← *Sprint 24: MemoryService.detectLanguage() heuristic (7-language fingerprints), injects "respond in [lang]" into buildSystemPrompt(), called from _autoSummarize()*
- [x] Noise cancellation indicator   ← *Sprint 27: _NoiseLevelPill widget shown below waveform during active listening; maps soundLevel (-2..10 dB) to green/yellow/orange pill with label (Clear / Some ambient noise / Noisy — speak clearly); AnimatedSwitcher for smooth transitions*

### 2.4 Voice — Text-to-Speech

- [x] "Read aloud" button on assistant messages (`flutter_tts`)
- [x] Streaming TTS (starts speaking before full response is done)   ← *Sprint 14: speakPartial() sentence-buffers tokens during stream; flushStreamingTtsBuffer() at finalize*
- [x] Voice selection (multiple voice options)   ← *Sprint 18: VoiceService.setVoice()/restoreVoice(), AppState ttsVoice persistence, Settings voice dropdown (English voices filtered), _voiceDisplayName prettifier*
- [x] Playback controls (pause, speed, skip)   ← *Sprint 12: TTS mini-player above composer (pause/resume/stop + tap-to-cycle speed 1.0→1.5→2.0), Settings sliders for speed + pitch*
- [x] Auto-read mode toggle (reads every assistant response)   ← *Sprint 10: VoiceService.autoReadAloud, Settings toggle, auto-speaks on stream complete*

### 2.5 Voice — Conversation Mode (the "wow" feature)

- [x] Full-screen voice conversation mode (animated orb overlay)
- [x] Wire the existing voice overlay orb to real audio pipeline
- [x] Push-to-talk and hands-free modes
- [x] Visual audio waveform / orb reactivity to voice input
- [x] Interruption handling (user speaks while assistant is speaking)
- [x] Conversation transcription shown in real-time
- [x] Seamless switch between voice and text modes   ← *Sprint 21: VoiceOverlay initialDraft carries typed text → voice, "Switch to text" button returns transcript to composer, VoiceService.setTranscript()*

### 2.6 Code Execution

- [x] Code block "Run" button for supported languages (Python, JS)   ← *Sprint 24: _CodeBlock header Run ▶ button for python/js/ts/bash/ruby, onRunCode callback in _MessageBubble auto-sends execution request*
- [x] Sandboxed execution results displayed below code block   ← *Sprint 26: _RunState enum (idle/running/done), _RunResultPill widget with animated SizeTransition+FadeTransition, spinner → ✓ pill appears below code block on Run tap, auto-dismisses after 4s; liveRegion:true announce*
- [x] File upload for code analysis   ← *Sprint 47: _fullFileContent state in ChatComposer; _pickFile reads up to 30 000 chars for 50+ code/config extensions (dart,py,js,ts,go,rs,java,kt,swift,c,cpp,cs,rb,php,html,css,sql,yaml,toml,dockerfile,…); _handleSend embeds content as fenced markdown code block `[File: name]\n\n```ext\n{content}\n\``\`; _FilePreviewStrip shows "✓ Content attached · Xk chars" badge; binary/unknown files fall back to [File: name] tag*
- [x] Generated file download (CSV, images, etc.)   ← *Sprint 27: _extractFileLinks() regex scans assistant message text for markdown links with file extensions (csv/json/pdf/png/jpg/gif/svg/zip/txt/mp4/mp3/wav/xlsx/docx); _FileDownloadChips widget renders download pills below non-streaming assistant bubbles; taps launchUrl(externalApplication)*

---

## PHASE 3 — COMPANION PERSONALITY (what makes it *better* than ChatGPT)

### 3.1 Sven Identity

- [x] Animated Sven avatar that reacts (thinking, speaking, listening, happy, confused) — `SvenAvatar` custom painter orb with 3 animation controllers
- [x] Avatar rendered as Rive/Lottie animation, not just a static circle   ← *Sprint 58: lottie ^3.1.2, AvatarMode.lottie ("Animated — Lumi"), 5 mood-mapped Lottie JSON assets (idle/thinking/speaking/listening/happy), SvenAvatar early-return renderer with _LottieFallback*
- [x] Personality system — Sven has a consistent voice, tone, and character   ← *Sprint 22: VoicePersonality.systemDirective injected into buildSystemPrompt(), personalityOverride user-editable field in Settings, personality notes editor*
- [x] Mood/energy system shown in avatar (morning greeting vs late-night) — `SvenMood` enum drives pulse/ring speed
- [x] Sven remembers context across conversations ("Last time you mentioned...")   ← *Sprint 23: extractTopicKeywords(), enhanced buildSystemPrompt() with time-ago labels + recall instructions + topic annotations, upsertConversationSummary() with keywords*
- [x] Custom greeting based on time of day and user behavior patterns — `SvenGreeting` with hour-aware message + user name

### 3.2 Memory & Context

- [x] User profile / memory store ("I prefer Python", "My name is...", "I work on...") — `MemoryService` with SharedPreferences, `UserFact` + `FactCategory`
- [x] Memory management page — view, edit, delete what Sven remembers — `MemoryPage` with 2-tab CRUD UI
- [x] Cross-conversation context ("In our chat about X, you said...")
- [x] Pinned instructions / system prompt (persistent instructions for all conversations) — `MemoryService.buildSystemPrompt()` injected into requests
- [x] Custom instructions editor (like ChatGPT's "Custom Instructions" feature, but better) — `_InstructionsTab` with userContext + responseStyle fields
- [x] Project spaces — group conversations + files + context into named projects   ← *Sprint 23: ProjectService + ProjectSpace model (CRUD, SharedPreferences), ProjectsSheet with emoji picker + context notes editor + assign conversations, wired into Settings*

### 3.3 Daily Companion Features

- [x] Daily check-in / greeting screen (morning briefing, weather, tasks)   ← *Sprint 21: DailyGreeting widget on Canvas tab — time-aware greeting + emoji, date label, recent conversation recap (last 3 summaries), rotating tips, dismissible*
- [x] Proactive suggestions ("You haven't finished your code review from yesterday")   ← *Sprint 22: DailyGreeting._buildSuggestions() generates context-aware chips from recent summaries + time-of-day, taps open new chat with prefill*
- [x] Scheduled reminders ("Remind me at 3pm to...")   ← *Sprint 10: /remind slash command → DatePicker + TimePicker → ReminderService → local notification*
- [x] Quick actions from home screen (summarize clipboard, translate selection)   ← *Sprint 22: QuickActionsBar on Canvas tab — Quick question, Summarise clipboard, Translate, Brainstorm — reads Clipboard, navigates to _NewChatPage with initialDraft*
- [x] Widgets for Android home screen / iOS lock screen   ← *Sprint 60: dependency tracked in `apps/companion-user-flutter/pubspec.yaml`; HomeWidgetService singleton (lib/features/home_widget/home_widget_service.dart) — initialise(), updateLastMessage(text,username,unread), clear(), registerInteractivity(onUri); updates home widget after each assistant message in ChatService.sendMessage() (widgetUsername param); HomeWidgetService.instance.initialise() in AppState.bindUser(), clear() in resetForLogout(); Android: res/xml/sven_widget_info.xml (AppWidgetProviderInfo 3×2 cells resizable), res/layout/sven_widget.xml (header row with Sven wordmark+time, message preview 3-line, username footer), res/drawable/sven_widget_background.xml (rounded dark card #040712 / cyan stroke), res/values/strings.xml (app_name+widget description), SvenWidgetProvider.kt (reads HomeWidgetPreferences SharedPrefs, sets RemoteViews, tap→deep-link PendingIntent), AndroidManifest.xml — <receiver> with APPWIDGET_UPDATE intent-filter + @xml/sven_widget_info meta-data; iOS: ios/SvenWidget/SvenWidget.swift (WidgetKit StaticConfiguration, SvenProvider reads UserDefaults App Group, SvenWidgetEntryView supports systemSmall/systemMedium/accessoryCircular/accessoryRectangular), ios/SvenWidget/SvenWidgetBundle.swift (@main WidgetBundle)*
- [x] Notification summary ("Here's what happened while you were away")   ← *Sprint 21: PushNotificationManager tracks _missedWhileAway while backgrounded, consumeMissedSummary() on resume, snackbar with count + preview + Open action*

### 3.4 Personalization

- [x] Multiple conversation "modes": Creative, Precise, Balanced, Code, Companion   ← *Sprint 10: mode wired into sendMessage API call, /mode slash + mode chip*
- [x] Custom theme colors (user picks their own primary/accent)   ← *Sprint 12: AccentPreset enum (6 swatches), Settings colour picker row, buildSvenTheme customAccent param*
- [x] Sven voice personality picker (professional, friendly, casual, mentor)   ← *Sprint 13: VoicePersonality enum, Settings Personality section DropdownMenu, wired to API personality field*
- [x] Response length preference (concise vs detailed)   ← *Sprint 11: ResponseLength enum (concise/balanced/detailed), AppState + Settings UI, passed to ChatService API*
- [x] Auto-detect preferred language from conversation *(Sprint 30 — _LanguageTile in Settings with 13-language override dropdown; auto/explicit modes; persisted in SharedPreferences; wired into buildSystemPrompt)*

---

## PHASE 4 — OFFLINE & PERFORMANCE (what makes it reliable)

### 4.1 Offline Support

- [x] Cache all conversations + messages in local DB (drift/isar)   ← *Sprint 35: write-through in ChatService.listChats/listMessages/sendMessage; upsert via MessagesRepository.cacheThreads/cacheMessages/cacheMessage*
- [x] Full offline message browsing (read any past conversation without network)   ← *Sprint 35: listChats + listMessages catch all exceptions and return cached rows from SQLite when non-empty*
- [x] Offline message queue (send messages that sync when back online)   ← *Sprint 44: DbOutboxMessages table (schema v2), SyncService.enqueue() persists to SQLite; ChatThreadPage._offlineQueue.add() + syncService.enqueue() for cross-session durability*
- [x] Background sync service (sync new messages when app is backgrounded)   ← *Sprint 44: SyncService extends ChangeNotifier with WidgetsBindingObserver; drains queue on app resume + connectivity change via connectivity_plus*
- [x] Conflict resolution for messages that were queued offline   ← *Sprint 44: last-write-wins; purgeFor(chatId) called before _drainOfflineQueue() to prevent double-delivery*
- [x] Sync status indicator (last synced timestamp)   ← *Sprint 44: ChatListPanel footer uses ListenableBuilder on SyncService; shows "N queued" (upload icon) when pending > 0, else "Synced X ago"*

### 4.2 Caching & Performance

- [x] Image cache (`cached_network_image`) — package added (v3.4.1), ready for use in network image widgets
- [x] Response cache for repeated queries   ← *Sprint 25: _ResponseCache class (LinkedHashMap LRU, 20-item cap, 10-min TTL), cache key = chatId+text+mode+personality+responseLength, read before API call + write after 200/201, ChatService.clearCache() public method*
- [x] Lazy-load conversation list (only render visible items)   ← *Sprint 18: gateway LIMIT/OFFSET pagination, ChatsPage model with has_more, ChatHomePage._loadMoreChats(), ChatListPanel scroll listener + loading spinner*
- [x] Message list virtualization (handle 10k+ messages without jank) *(Sprint 30 — addAutomaticKeepAlives:false, cacheExtent:600, RepaintBoundary per message, feature flag enabled)*
- [x] Preload adjacent conversations for instant switching   ← *Sprint 46: `ChatService.preloadAdjacentThreads(id)` silently fetches prev+next thread messages (write-through to `MessagesRepository`) on `ChatThreadPage.initState` + `didUpdateWidget`. Also warm-up: top-3 threads preloaded fire-and-forget after thread list loads in `ChatHomePage._loadChats`. All errors swallowed — never surfaces to user.*
- [x] Memory pressure handling (free caches when system is low)   ← *Sprint 26: _SvenUserAppState.didHaveMemoryPressure() override clears PaintingBinding imageCache + clearLiveImages()*

### 4.3 Connectivity

- [x] Smart reconnection with network quality detection   ← *Sprint 27: _updateConnectivity() schedules _reconnectTimer with delay based on network type (WiFi/Ethernet=1s, Mobile=3s, Other=5s) via _sseReconnectDelay(); cancels existing timer on new event; drains offline queue on reconnect; _reconnectTimer?.cancel() in dispose()*
- [x] Retry with exponential backoff on all API calls   ← *Sprint 72: DioHttpClient._RetryInterceptor (3 attempts, 1s/2s/4s exponential backoff) on connectionError/receiveTimeout/sendTimeout + HTTP 502/503/504; all 27+ services use AuthenticatedClient wrapping DioHttpClient; ChatService has additional explicit retry (6 methods via retry package); ChatSseService has manual reconnect doubling 1s→30s; DeploymentService migrated from raw http.Client to DioHttpClient*
- [x] Request deduplication (prevent double-sends)   ← *Sprint 11: 2-second window guard in _handleSend, blocks identical consecutive messages*
- [x] Bandwidth-aware behavior (reduce image quality on slow connections)   ← *Sprint 28: _MarkdownImage converted from StatelessWidget to StatefulWidget; initState() calls Connectivity().checkConnectivity(); on mobile data (only) shows tap-to-load placeholder (Container h=80 with "Tap to load image / Saving mobile data" label); tapping sets _shouldLoad=true and renders full Image.network*

---

## PHASE 5 — POLISH & PLATFORM (what makes it feel premium)

### 5.1 Animations & Transitions

- [x] Shared element transitions between chat list and thread view
- [x] Message bubble entrance animations (slide up + fade in, staggered)
- [x] Smooth keyboard open/close animation (composer slides up with keyboard) — `_KeyboardAwareComposer` AnimatedContainer driven by `viewInsets.bottom`
- [x] Pull-to-refresh with custom Sven animation — `_SvenRefreshIndicator` with brand colors + reload
- [x] Page transitions (SvenPageRoute: slide up + fade, 350ms easeOutCubic)
- [x] Micro-interactions: button press scales, input focus glow, etc. — `_Pressable` (AnimatedScale 0.88), `_GradientButton` press-scale, composer focus glow border

### 5.2 Onboarding

- [x] First-run onboarding flow (4-screen walkthrough)
  - [x] Screen 1: Meet Sven (animated pulsing orb intro)
  - [x] Screen 2: What Sven can do (4-feature showcase with icons)
  - [x] Screen 3: Pick your style (dark/light cards with preview orbs)
  - [x] Screen 4: Let's go (name input + first conversation prompt chips, captured name saved to MemoryService)
- [x] Contextual tooltips for new features   ← *Sprint 22: FeatureTooltipService tracks seen tips via SharedPreferences, SvenFeatureTooltip overlay widget with fade animation + auto-dismiss, FAB tooltip on first use*
- [x] Tutorial mode for first conversation   ← *Sprint 23: TutorialService (4-step guided flow, SharedPreferences-backed), TutorialBanner widget with progress bar + suggestion chips + next/skip controls, auto-advances on first message send*

### 5.3 Accessibility

- [x] Full VoiceOver / TalkBack audit and fix   ← *Sprint 7: Semantics labels on all interactive widgets*
- [x] High-contrast mode option   ← *Sprint 14: AppState.highContrast + setHighContrast(), SvenModeTokens.copyWithHighContrast(), buildSvenTheme(highContrast:), Settings Appearance switch*
- [x] Dynamic text scaling support (all text respects system font size)
- [x] Minimum touch target sizes (48x48dp)   ← *Sprint 7: 48dp SizedBox on composer, ConstrainedBox(36) on action chips*
- [x] Focus order correctness   ← *Sprint 26: FocusTraversalGroup(ReadingOrderTraversalPolicy) wraps _KeyboardAwareComposer in chat thread; ensures composer is a discrete focus group separate from the scroll list*
- [x] Announce state changes with `Semantics.liveRegion`   ← *Sprint 26: _ThinkingIndicator wrapped in Semantics(liveRegion:true, label:'Sven is thinking'); sync footer wrapped in Semantics(liveRegion:true); _RunResultPill also liveRegion*
- [x] Color-blind safe palette option   ← *Sprint 24: SvenModeTokens.copyWithColorBlind() (blue+orange CVD-safe palette), AppState.colorBlindMode + setColorBlindMode(), buildSvenTheme(colorBlindMode:), Settings Appearance toggle*
- [x] Reduce transparency option   ← *Sprint 25: AppState.reduceTransparency + setReduceTransparency(), SvenGlassScope InheritedWidget propagates flag to all SvenGlass instances (skips BackdropFilter when true), Settings Appearance switch*

### 5.4 Platform-Specific

- [x] iOS: proper `Cupertino` navigation bars where appropriate   ← *Sprint 29: _svenAppBar() top-level helper returns CupertinoNavigationBar on Platform.isIOS, AppBar elsewhere; replaces AppBars in _ChangePasswordPage and _AppLockSettingsPage; selective show import avoids RefreshCallback conflict*
- [x] iOS: `CupertinoActionSheet` for context menus   ← *Sprint 28: _showMessageMenu checks Platform.isIOS and delegates to _showMessageMenuCupertino(); CupertinoActionSheet with Copy/Reply•Quote/React/Edit•Resend(user)/Share/Regenerate(assistant) actions + Cancel button; uses dart:io Platform + flutter/cupertino.dart show directive to avoid RefreshCallback conflict*
- [x] Android: Material You dynamic color support   ← *Sprint 11: DynamicColorBuilder wraps MaterialApp, buildSvenTheme(dynamicScheme:) applied*
- [x] Android: predictive back gesture support   ← *Sprint 7: PopScope(onPopInvokedWithResult) wraps ChatThreadPage*
- [x] Android: home screen widget   ← *Sprint 60: see line 182 above for full details — SvenWidgetProvider.kt + sven_widget.xml layout + sven_widget_info.xml AppWidgetProviderInfo + sven_widget_background.xml rounded card drawable + AndroidManifest receiver registration*
- [x] Web: Progressive Web App (PWA) with service worker   ← *Sprint 53: web/manifest.json (name/short_name/display=standalone/theme_color=#00D9FF/background_color=#040712, 4 icon sizes with maskable purpose, 2 shortcuts: New conversation + Summarise clipboard, 2 screenshot entries); web/sw.js — full offline-capable service worker: install precaches shell URLs (/,flutter_bootstrap.js,manifest.json,icons), activate prunes stale caches + claims clients; fetch strategies: cache-first for immutable .js/.wasm/.br artefacts, stale-while-revalidate for images/fonts/shell files, network-first + shell fallback for HTML navigation, network-only passthrough for all /v1/ API calls; push notification listener + notificationclick handler; web/index.html updated: manifest link, theme-color, apple-mobile-web-app-capable, og:title/description, icon links, dark splash background (#040712), SW registration on load*
- [x] Web: Keyboard navigation for all interactive elements   ← *Sprint 54: lib/app/keyboard_nav.dart — SvenKeyboardNavScope (root widget: sets FocusHighlightStrategy.alwaysTraditional on web/desktop, ReadingOrderTraversalPolicy, global Escape→Navigator.maybePop + /→focus composer); SvenFocusRegion landmark wrapper (FocusTraversalGroup + Semantics label); SvenActivatableRegion (Space/Enter activation + visual focus ring); SvenSkipLink (skip-to-content); SvenKeyboardShortcutsHelp.show() (?→bottom sheet, 12 shortcuts); sven_user_app.dart: SvenKeyboardNavScope wraps MaterialApp builder, Shift+/ shows help, SvenFocusRegion landmarks around App header and Main content*
- [x] Desktop: Window management, menu bar, system tray   ← *Sprint 55: lib/app/desktop_window.dart — DesktopWindowManager (WindowListener singleton: windowManager.ensureInitialized, WindowOptions(size:1080×720, minimumSize:480×600, titleBarStyle:hidden, backgroundColor:transparent), setPreventClose(true), onWindowClose→tray.destroy+real close); DesktopTrayManager (TrayListener singleton: setIcon assets/tray/tray_icon.ico|.png, setToolTip, Menu with Show/New Conversation/Quit items, onTrayIconMouseDown→show, onTrayIconRightMouseDown→popUpContextMenu, onTrayMenuItemClick→show+newChat/quit); SvenTitleBar (StatefulWidget+WindowListener, 36px DragToMoveArea, app icon+name, minimise/maximise/close _TitleBarButton with red hover on close); main.dart: if (isDesktop) DesktopWindowManager.instance.initialize(); sven_user_app.dart: _AppShellState.initState→DesktopTrayManager.initialize(onNewChat), dispose→destroy, Column children start with const SvenTitleBar(); pubspec: window_manager:^0.4.0, tray_manager:^0.2.3; assets/tray/tray_icon.png + .ico placeholder files*
- [x] Desktop: Cmd/Ctrl+N for new chat, Cmd/Ctrl+K for search   ← *Sprint 25: CallbackShortcuts + Focus wraps _AppShell Scaffold; SingleActivator(keyN/keyK, control+meta) → _newChat(context)/_showSettings(context)*

### 5.5 Notifications

- [x] Rich push notifications with message preview   ← *Sprint 72: BigTextStyleInformation for expandable message preview, AndroidNotificationCategory.message for message-type styling, sender name in contentTitle, channel name in summaryText*
- [x] Notification channels (Android) — separate for messages, approvals, reminders   ← *Sprint 7: SvenNotificationChannels + flutter_local_notifications + POST_NOTIFICATIONS*
- [x] Notification grouping (bundle multiple messages from same thread)   ← *Sprint 18: groupKey per channel, InboxStyleInformation summary notification, _recentXxxLines tracking (max 6), setAsGroupSummary*
- [x] Reply from notification (inline reply)   ← *Sprint 72: AndroidNotificationAction with AndroidNotificationActionInput for inline text reply on message notifications; _onNotificationResponse unified handler dispatches taps vs inline replies; _handleInlineReply sends via ChatService (foreground callback or direct service locator fallback for background)*
- [x] Do Not Disturb scheduling
- [x] Notification sound customization   ← *Sprint 23: notifSound pref in AppState ('default'/'subtle'/'silent'), PushNotificationManager reads appState.notifSound via _effectiveSoundProfile, Settings dropdown in More section*

---

## PHASE 6 — SECURITY & PRIVACY (what makes it trustworthy)

### 6.1 Authentication

- [x] Biometric authentication (fingerprint / Face ID) for app lock
- [x] PIN / pattern lock as biometric fallback
- [x] Auto-lock after timeout (configurable: 1min, 5min, 15min, never)
- [x] Login with SSO (Google, Apple, GitHub)   ← *Sprint 56: lib/features/auth/sso_service.dart — SsoService (signInWithGoogle via google_sign_in ^6.2.2: GoogleSignIn(scopes:[openid,email]), returns SsoCredential(provider,idToken,accessToken); signInWithApple via sign_in_with_apple ^6.1.3: SHA-256 hashed nonce, SignInWithApple.getAppleIDCredential, CSRF-safe; signInWithGitHub via flutter_web_auth_2 ^4.0.1: browser OAuth code flow with CSRF state param, sven:// callback scheme); SsoCredential value type; SsoException; auth_errors.dart: added ssoCancelled+ssoFailed with user messages; auth_service.dart: loginWithSso(SsoCredential) → POST /v1/auth/sso {provider,id_token,access_token?,nonce?} → same token-store logic as login(); login_page.dart: onSsoSignIn callback, _handleSso(), _ssoLoading/_ssoError state, _SsoDivider ("or continue with"), three _SsoButton widgets (Google blue / Apple / GitHub); sven_user_app.dart: _sso=SsoService(), _loginWithSso(provider) dispatches to SsoService then AuthService.loginWithSso, onSsoSignIn:_loginWithSso passed to LoginPage*
- [x] Password change (in-app)   ← *Sprint 28: _ChangePasswordPage StatefulWidget with current/new/confirm fields + show/hide toggles; AuthService.changePassword() calls PATCH /v1/users/me/password; accessible from Settings → Account → Change password tile; SnackBar on success; inline error display*
- [x] Account deletion (GDPR)   ← *Sprint 27: AuthService.deleteAccount() calls DELETE /v1/users/me, always clears token in finally; PrivacyPage._confirmDeleteAccount() two-stage confirm dialog → deleteAccount() → SharedPreferences.clear() → onClearData callback; danger tile in privacy settings; authService threaded through _SvenUserAppState → _AppShell → _SettingsSheet → PrivacyPage*
- [x] 2FA / MFA support   ← *Sprint 57: MfaPage (OTP entry), MfaSetupSheet (enable/disable), AuthService.verifyMfa/getMfaStatus/setupMfa/confirmMfaSetup/disableMfa, AppState.mfaToken/mfaRequired, router /mfa guard + GoRoute, settings tile*

### 6.2 Privacy

- [x] Incognito / ephemeral chat mode (not saved to history)
- [x] Conversation encryption at rest (local DB encryption)   ← *Sprint 45: AES-256-CBC field-level encryption via `encrypt` package; `DbEncryption` generates device-unique key on first launch, stored in platform keystore (FlutterSecureStorage). `MessagesRepository` transparently encrypts message content, thread titles, last-message preview, and outbox body on write; decrypts on read. Graceful plaintext fallback for legacy rows. `SyncService` refactored from `AppDatabase` to `MessagesRepository` dep so outbox items are always decrypted before delivery.*
- [x] Data export (download all your data)   ← *Sprint 25: PrivacyPage._exportData() builds JSON payload (facts, custom instructions, summaries, personality override, detected language, all prefs) + Share.share() via share_plus; accessible from Settings → Privacy & Data*
- [x] Privacy policy + terms of service screens   ← *Sprint 14: PrivacyPage with Privacy Policy + ToS links (url_launcher), accessible from Settings → More → Privacy & Data*
- [x] Analytics consent toggle   ← *Sprint 14: AppState.analyticsConsent + setAnalyticsConsent(), switch in PrivacyPage*
- [x] Clear all data option   ← *Sprint 14: PrivacyPage danger-zone tile → SharedPreferences.clear() confirm dialog*

---

## PHASE 7 — DEVELOPER EXPERIENCE & QUALITY

### 7.1 Testing

- [x] Unit tests for all services (auth, chat, approvals, notifications, preferences)
- [x] Widget tests for all screens (login, chat home, thread, composer, approvals)   ← *Sprint 72: test/widget_screens_test.dart — 19 tests across 5 screens: LoginPage (5: renders fields+button, initialMessage, validation, onSubmit callback, SSO hidden), ChatHomePage (2: classic+cinematic mode), ChatThreadPage (3: thread+composer, header, incognito indicator), ChatComposer (6: input+send, onSend callback, isSending disabled, retry button, disabled state, editPrefillText), ApprovalsPage (3: empty state, pending items, tab switching)*
- [x] Integration tests for critical flows (login → chat → send → receive)   ← *Sprint 31: test/integration_smoke_test.dart — mock HTTP client (package:http/testing); 13 tests across 5 groups: login success (token/userId/username/refresh-token stored), login failures (401/403/malformed/missing-token), login→MemoryService wired, token refresh (auth.refresh() writes new access token), auto-login persistence (saveAutoLogin/readAutoLogin/clearAutoLogin)*
- [x] Golden tests for visual regression on both themes   ← *Sprint 37: test/golden_test.dart — see 0.3 entry above*
- [x] Performance benchmarks (startup time, scroll FPS, memory usage)   ← *Sprint 31: test/performance_benchmark_test.dart — 5 benchmark groups: MemoryService cold+warm load <200ms, buildSystemPrompt 100 facts <5ms + 1000× <500ms, ChatMessage list 500 obj <50ms + 5000 obj <200ms, detectLanguage 500× <100ms, FeatureFlagService 100k lookups <50ms; fixed field names (text/timestamp/role:String) and flag() API*
- [x] Accessibility test suite (automated a11y checks)   ← *Sprint 29: test/a11y_test.dart — 6 groups / 18+ tests: FeatureFlagService flag defaults + singleton lifecycle, SvenTokens opaque colour per VisualMode, liveRegion SemanticsFlag propagation, ElevatedButton + Switch + IconButton tap actions, ExcludeSemantics pruning, text-scale 1.5× and 2× overflow checks*

### 7.2 CI/CD

- [x] GitHub Actions: `flutter analyze` + `flutter test` on every PR
- [x] Build preview APK/IPA on every PR
- [x] Auto-deploy to internal testing (Firebase App Distribution for Android; TestFlight remains manual)   ← *Sprint 31: .github/workflows/firebase-app-distribution.yml — Android distribution automation.*
- [x] Release pipeline: tag → build → sign → upload (Play Store (automated); App Store (manual via App Store Connect/TestFlight))   ← *See `apps/companion-user-flutter/docs/release-process.md` for platform split.*
- [x] Automated changelog generation from conventional commits *(Sprint 30 — .github/workflows/changelog.yml updates `apps/companion-user-flutter/CHANGELOG.md`)*

### 7.3 Monitoring

- [x] Sentry crash reporting (production)
- [x] Firebase Analytics (key funnels: login, first message, daily active)
- [x] Performance monitoring (startup, API latency, frame drops)   ← *Sprint 29: PerformanceTracker.startFrameMonitoring() registers SchedulerBinding.addTimingsCallback; _onFrameTimings counts janky frames (build>16ms or raster>16ms), emits perf.janky_frames every 60s; logApiLatency(endpoint, ms) accumulates samples, emits perf.api_latency p50/p95 after 20 samples; called from main() after ensureInitialized()*
- [x] Feature flags (remote config for gradual rollout)   ← *Sprint 28: FeatureFlagService singleton (ChangeNotifier) with three layers: compiled defaults, remote overrides from GET /v1/me/ui-preferences (feature.* keys), debug-only SharedPreferences overrides; FeatureFlagService.instance.load() called after login; flag(key) accessor; effectiveFlags map; 14 default flags defined*
- [x] A/B testing framework

### 7.4 Documentation

- [x] Architecture decision records (ADRs)   ← *Sprint 31: docs/adr/001-no-state-management-framework.md, 002-memory-service-persistence.md, 003-streaming-sse-api.md*
- [x] API contract documentation (OpenAPI spec)   ← *Artifact-backed: `docs/release/status/openapi-metrics-latest.json`, `docs/release/status/openapi-metrics-latest.md`, `docs/release/status/api-openapi-contract-latest.json`*
- [x] Component library / storybook (widgetbook)   ← *Sprint 51: lib/widgetbook_main.dart — Widgetbook 3.x catalogue (flutter run -t lib/widgetbook_main.dart); Foundation: Color Tokens (Classic + Cinematic palette swatches), Typography (type scale display); Atoms: SvenAvatar (Idle/Thinking/Listening/Speaking/Happy × Classic/Cinematic, interactive knobs for mood/mode/motion/size); Organisms: QuickActionsBar (Classic + Cinematic), DailyGreeting (Classic + Cinematic + knobs); addons: MaterialThemeAddon, TextScaleAddon, AlignmentAddon; widgetbook: ^3.0.0 in dev_dependencies (excluded from prod APK)*
- [x] Contribution guide   ← *Sprint 31: apps/companion-user-flutter/CONTRIBUTING.md — prerequisites table, clone+run instructions, project layout (lib/ + test/ + docs/), coding conventions, conventional-commit examples, test commands (flutter test / coverage), PR checklist, release process summary*
- [x] Release process documentation   ← *`apps/companion-user-flutter/docs/release-process.md`*

---

## PRIORITY ORDER (recommended build sequence)

```
Sprint 1 (Week 1-2):  Phase 0 foundation + Phase 1.1 streaming
Sprint 2 (Week 3-4):  Phase 1.2 message actions + Phase 1.3 conversation management
Sprint 3 (Week 5-6):  Phase 1.4 rich rendering + Phase 2.1-2.2 image/file upload
Sprint 4 (Week 7-8):  Phase 2.3-2.5 voice (full pipeline)
Sprint 5 (Week 9-10): Phase 3 companion personality + memory
Sprint 6 (Week 11-12): Phase 4 offline + Phase 5.1-5.2 polish + onboarding
Sprint 7 (Week 13-14): Phase 5.3-5.5 accessibility + platform + notifications
Sprint 8 (Week 15-16): Phase 6 security + Phase 7 testing/CI/quality
```

---

## SCORECARD — Where Sven stands vs competition

| Area | ChatGPT | Gemini | Claude | Sven (current) | Sven (target) |
|------|---------|--------|--------|-----------------|----------------|
| Text chat | ★★★★★ | ★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| Streaming | ★★★★★ | ★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| Voice | ★★★★★ | ★★★★ | ★★☆☆☆ | ★★★★★ | ★★★★★ |
| Multimodal (images/files) | ★★★★★ | ★★★★★ | ★★★★ | ★★★★☆ | ★★★★★ |
| Code rendering | ★★★★ | ★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| Conversation mgmt | ★★★★ | ★★★ | ★★★★ | ★★★★★ | ★★★★★ |
| Memory/context | ★★★★ | ★★★ | ★★★★ | ★★★★★ | ★★★★★ |
| Offline | ★★☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★★★★ | ★★★★★ |
| Companion feel | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★★★ | ★★★★★ |
| Polish/animations | ★★★★ | ★★★★ | ★★★ | ★★★★★ | ★★★★★ |
| Accessibility | ★★★★ | ★★★ | ★★★ | ★★★★★ | ★★★★★ |
| Security | ★★★★ | ★★★★ | ★★★★ | ★★★★★ | ★★★★★ |

**Current overall: ~100%** *(Sprint 71 complete — failed-message inline retry chip, secure clipboard 60s auto-wipe, TLS cert-pinning scaffold in `DioHttpClient`; Offline ★★★★★, Security ★★★★★)*
**Target: 100% — not just matching, but exceeding in Companion, Offline, and Polish.**

