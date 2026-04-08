import 'package:flutter/material.dart';

import 'on_device_inference_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// InferencePage — model management UI for on-device Gemma 4 inference
//
// Shows installed models, available variants, download/install controls,
// performance stats, and privacy guarantee badge.
// ═══════════════════════════════════════════════════════════════════════════

class InferencePage extends StatefulWidget {
  const InferencePage({super.key, required this.inferenceService});

  final OnDeviceInferenceService inferenceService;

  @override
  State<InferencePage> createState() => _InferencePageState();
}

class _InferencePageState extends State<InferencePage> {
  OnDeviceInferenceService get _service => widget.inferenceService;

  @override
  void initState() {
    super.initState();
    _service.addListener(_rebuild);
    _service.fetchAvailableModules();
  }

  @override
  void dispose() {
    _service.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('On-Device AI')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildPrivacyBanner(isDark),
          const SizedBox(height: 16),
          _buildDeviceInfo(isDark),
          const SizedBox(height: 16),
          _buildModelSection(isDark),
          const SizedBox(height: 16),
          if (_service.installedModels.isNotEmpty) ...[
            _buildPerformanceSection(isDark),
            const SizedBox(height: 16),
          ],
          _buildSettingsSection(isDark),
          const SizedBox(height: 16),
          if (_service.availableModules.isNotEmpty) ...[
            _buildModulesSection(isDark),
          ],
        ],
      ),
    );
  }

  // ── Privacy banner ─────────────────────────────────────────────────────

  Widget _buildPrivacyBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF10b981).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFF10b981).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.shield, color: Color(0xFF10b981), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'On-device inference never sends data to external servers. '
              'Your prompts and responses stay on this device.',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white70 : Colors.black54,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Device info ────────────────────────────────────────────────────────

  Widget _buildDeviceInfo(bool isDark) {
    return _card(
      isDark,
      title: 'Device',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoRow('Supported', _service.isSupported ? 'Yes' : 'No', isDark),
          _infoRow(
            'Recommended model',
            _service.recommendedVariant.displayName,
            isDark,
          ),
          _infoRow(
            'Status',
            _service.state.name.toUpperCase(),
            isDark,
            valueColor: _stateColor(_service.state),
          ),
          if (_service.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                _service.error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  // ── Model management ──────────────────────────────────────────────────

  Widget _buildModelSection(bool isDark) {
    return _card(
      isDark,
      title: 'Models',
      child: Column(
        children: [
          // Installed models
          for (final model in _service.installedModels) ...[
            _modelTile(model, isDark),
            if (model != _service.installedModels.last)
              Divider(
                height: 1,
                color: isDark ? Colors.white12 : Colors.black12,
              ),
          ],

          // Available to install
          for (final variant in ModelVariant.values)
            if (!_service.installedModels
                .any((m) => m.variant == variant)) ...[
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  variant.displayName,
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.black45,
                  ),
                ),
                subtitle: Text(
                  '${_formatBytes(variant.estimatedSizeBytes)} · '
                  '${variant.contextWindow ~/ 1000}K context',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white38 : Colors.black26,
                  ),
                ),
                trailing: ElevatedButton(
                  onPressed: _service.state == InferenceState.downloading
                      ? null
                      : () => _service.installModel(variant),
                  child: const Text('Install'),
                ),
              ),
            ],
        ],
      ),
    );
  }

  Widget _modelTile(ModelProfile model, bool isDark) {
    final isActive = _service.activeModel?.id == model.id;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isActive
              ? const Color(0xFF3b82f6).withValues(alpha: 0.2)
              : (isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          isActive ? Icons.memory : Icons.download_done,
          size: 18,
          color: isActive ? const Color(0xFF3b82f6) : Colors.grey,
        ),
      ),
      title: Text(
        model.name,
        style: TextStyle(
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          color: isDark ? Colors.white : Colors.black87,
        ),
      ),
      subtitle: Text(
        '${model.sizeLabel} · ${model.capabilities.join(", ")}',
        style: TextStyle(
          fontSize: 12,
          color: isDark ? Colors.white54 : Colors.black45,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!isActive && model.status == ModelStatus.ready)
            IconButton(
              icon: const Icon(Icons.play_arrow, size: 20),
              onPressed: () => _service.loadModel(model.id),
              tooltip: 'Load',
            ),
          if (isActive)
            IconButton(
              icon: const Icon(Icons.stop, size: 20, color: Colors.orange),
              onPressed: _service.unloadModel,
              tooltip: 'Unload',
            ),
          IconButton(
            icon: Icon(Icons.delete_outline,
                size: 20, color: Colors.red.shade300),
            onPressed: () => _service.uninstallModel(model.id),
            tooltip: 'Remove',
          ),
        ],
      ),
    );
  }

  // ── Performance ────────────────────────────────────────────────────────

  Widget _buildPerformanceSection(bool isDark) {
    return _card(
      isDark,
      title: 'Performance',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoRow(
            'Total inferences',
            '${_service.totalInferences}',
            isDark,
          ),
          _infoRow(
            'Last inference',
            '${_service.lastInferenceMs.toStringAsFixed(0)} ms',
            isDark,
          ),
          _infoRow(
            'Avg tokens/sec',
            _service.avgTokensPerSecond > 0
                ? _service.avgTokensPerSecond.toStringAsFixed(1)
                : '—',
            isDark,
          ),
        ],
      ),
    );
  }

  // ── Settings ───────────────────────────────────────────────────────────

  Widget _buildSettingsSection(bool isDark) {
    return _card(
      isDark,
      title: 'Routing',
      child: Column(
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Prefer local inference',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            subtitle: Text(
              'Process short prompts on-device when a model is loaded',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
            value: _service.preferLocal,
            onChanged: _service.setPreferLocal,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Max local tokens: ${_service.maxLocalTokens}',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
              ),
            ],
          ),
          Slider(
            value: _service.maxLocalTokens.toDouble(),
            min: 128,
            max: 8192,
            divisions: 16,
            label: '${_service.maxLocalTokens}',
            onChanged: (v) => _service.setMaxLocalTokens(v.round()),
          ),
        ],
      ),
    );
  }

  // ── Modules ────────────────────────────────────────────────────────────

  Widget _buildModulesSection(bool isDark) {
    return _card(
      isDark,
      title: 'Modules',
      child: Column(
        children: _service.availableModules
            .map((m) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    m.name,
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  subtitle: Text(
                    m.description,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white54 : Colors.black45,
                    ),
                  ),
                  trailing: m.installed
                      ? const Icon(Icons.check_circle,
                          color: Color(0xFF10b981), size: 20)
                      : const Icon(Icons.cloud_download_outlined,
                          size: 20),
                ))
            .toList(),
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  Widget _card(bool isDark,
      {required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1e293b) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, bool isDark,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: valueColor ?? (isDark ? Colors.white : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Color _stateColor(InferenceState state) {
    switch (state) {
      case InferenceState.ready:
        return const Color(0xFF10b981);
      case InferenceState.inferring:
        return const Color(0xFF3b82f6);
      case InferenceState.downloading:
      case InferenceState.loading:
        return const Color(0xFFf59e0b);
      case InferenceState.error:
        return const Color(0xFFef4444);
      case InferenceState.idle:
        return Colors.grey;
    }
  }

  String _formatBytes(int bytes) {
    final gb = bytes / 1073741824;
    return gb >= 1.0
        ? '${gb.toStringAsFixed(1)} GB'
        : '${(bytes / 1048576).toStringAsFixed(0)} MB';
  }
}
