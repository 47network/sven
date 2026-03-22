import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════
// FeatureTooltipService — tracks first-use discovery tooltips
// ═══════════════════════════════════════════════════════════════════════════

/// Identifiers for every tip that can be shown once.
enum FeatureTip {
  fabNewChat,
  voiceInput,
  quickActions,
  settingsGear,
  swipeToReply,
  personalityPicker,
}

class FeatureTooltipService extends ChangeNotifier {
  FeatureTooltipService() {
    _load();
  }

  static const _prefix = 'sven.tooltips.seen.';

  final Set<FeatureTip> _seen = {};
  bool _loaded = false;

  bool get loaded => _loaded;

  /// Returns true if the tip has NOT been shown yet.
  bool shouldShow(FeatureTip tip) => _loaded && !_seen.contains(tip);

  /// Mark a tip as seen so it never shows again.
  Future<void> markSeen(FeatureTip tip) async {
    if (_seen.contains(tip)) return;
    _seen.add(tip);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefix${tip.name}', true);
  }

  /// Reset all tips (useful for testing / onboarding replay).
  Future<void> resetAll() async {
    _seen.clear();
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    for (final tip in FeatureTip.values) {
      await prefs.remove('$_prefix${tip.name}');
    }
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    for (final tip in FeatureTip.values) {
      if (prefs.getBool('$_prefix${tip.name}') == true) {
        _seen.add(tip);
      }
    }
    _loaded = true;
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SvenFeatureTooltip — animated tooltip overlay for first-use discovery
// ═══════════════════════════════════════════════════════════════════════════

/// Wraps a child widget and shows a one-time tooltip the first time
/// the child is rendered (if [service.shouldShow(tip)] is true).
class SvenFeatureTooltip extends StatefulWidget {
  const SvenFeatureTooltip({
    super.key,
    required this.tip,
    required this.service,
    required this.message,
    required this.child,
    this.preferBelow = true,
    this.tokens, // ignore: library_private_types_in_public_api
  });

  final FeatureTip tip;
  final FeatureTooltipService service;
  final String message;
  final Widget child;
  final bool preferBelow;
  // ignore: library_private_types_in_public_api
  final _TooltipColors? tokens;

  @override
  // ignore: library_private_types_in_public_api
  State<SvenFeatureTooltip> createState() => _SvenFeatureTooltipState();
}

class _TooltipColors {
  const _TooltipColors({
    required this.background,
    required this.text,
    required this.border,
  });
  final Color background;
  final Color text;
  final Color border;
}

class _SvenFeatureTooltipState extends State<SvenFeatureTooltip>
    with SingleTickerProviderStateMixin {
  OverlayEntry? _entry;
  late final AnimationController _fadeCtrl;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
  }

  @override
  void dispose() {
    _dismiss();
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _maybeShow() {
    if (!widget.service.shouldShow(widget.tip)) return;
    if (!mounted) return;

    _entry = OverlayEntry(builder: (_) => _buildOverlay());
    Overlay.of(context).insert(_entry!);
    _fadeCtrl.forward();
    widget.service.markSeen(widget.tip);

    // Auto-dismiss after 4 seconds
    Future.delayed(const Duration(seconds: 4), _dismiss);
  }

  void _dismiss() {
    if (_entry == null) return;
    _fadeCtrl.reverse().then((_) {
      _entry?.remove();
      _entry = null;
    });
  }

  Widget _buildOverlay() {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached) return const SizedBox.shrink();
    final pos = box.localToGlobal(Offset.zero);
    final size = box.size;

    final below = widget.preferBelow;
    final top = below ? pos.dy + size.height + 8 : null;
    final bottom =
        below ? null : MediaQuery.of(context).size.height - pos.dy + 8;

    return Positioned(
      top: top,
      bottom: bottom,
      left: pos.dx.clamp(16.0, MediaQuery.of(context).size.width - 260),
      child: FadeTransition(
        opacity: _fadeCtrl,
        child: GestureDetector(
          onTap: _dismiss,
          child: Material(
            color: Colors.transparent,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 240),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: widget.tokens?.background ?? const Color(0xFF1A1E2E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: widget.tokens?.border ??
                      const Color(0xFF3B82F6).withValues(alpha: 0.3),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.auto_awesome_rounded,
                      size: 16,
                      color: widget.tokens?.text ?? const Color(0xFF93C5FD)),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      widget.message,
                      style: TextStyle(
                        color: widget.tokens?.text ?? const Color(0xFFE2E8F0),
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
