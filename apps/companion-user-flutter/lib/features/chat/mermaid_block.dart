import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app/sven_tokens.dart';

/// Renders a Mermaid diagram inside a constrained WebView.
///
/// Falls back to raw source code display if the diagram fails to render
/// or the WebView takes too long.
class MermaidBlock extends StatefulWidget {
  const MermaidBlock({
    super.key,
    required this.source,
    required this.tokens,
    required this.cinematic,
  });

  final String source;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<MermaidBlock> createState() => _MermaidBlockState();
}

class _MermaidBlockState extends State<MermaidBlock> {
  late final WebViewController _controller;
  double _contentHeight = 200; // initial estimate
  bool _loaded = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    final bgColor = widget.cinematic ? '#0D1117' : '#FFFFFF';
    final textColor = widget.cinematic ? '#E6EDF3' : '#1F2328';
    final primaryHex = _colorToHex(widget.tokens.primary);

    final html = _buildHtml(
      source: widget.source,
      bgColor: bgColor,
      textColor: textColor,
      primaryColor: primaryHex,
    );

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(
          widget.cinematic ? const Color(0xFF0D1117) : Colors.white)
      ..addJavaScriptChannel(
        'FlutterBridge',
        onMessageReceived: (message) {
          if (!mounted) return;
          final data = jsonDecode(message.message) as Map<String, dynamic>;
          if (data['type'] == 'rendered') {
            final h = (data['height'] as num?)?.toDouble() ?? 200;
            setState(() {
              _contentHeight = h.clamp(60, 800);
              _loaded = true;
            });
          } else if (data['type'] == 'error') {
            setState(() => _failed = true);
          }
        },
      )
      ..loadHtmlString(html);

    // Timeout fallback — if nothing renders in 8 seconds, show raw code
    Future.delayed(const Duration(seconds: 8), () {
      if (mounted && !_loaded && !_failed) {
        setState(() => _failed = true);
      }
    });
  }

  String _colorToHex(Color c) {
    return '#${(c.r * 255).round().clamp(0, 255).toRadixString(16).padLeft(2, '0')}'
        '${(c.g * 255).round().clamp(0, 255).toRadixString(16).padLeft(2, '0')}'
        '${(c.b * 255).round().clamp(0, 255).toRadixString(16).padLeft(2, '0')}';
  }

  void _copySource() {
    Clipboard.setData(ClipboardData(text: widget.source));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Mermaid source copied'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final cinematic = widget.cinematic;

    if (_failed) {
      return _fallbackCodeBlock();
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: cinematic
            ? const Color(0xFF0D1117)
            : tokens.onSurface.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border: cinematic
            ? Border.all(color: tokens.frame)
            : Border.all(color: tokens.onSurface.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: cinematic
                  ? Colors.white.withValues(alpha: 0.04)
                  : tokens.onSurface.withValues(alpha: 0.03),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(10),
                topRight: Radius.circular(10),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.account_tree_rounded,
                    size: 14, color: tokens.primary.withValues(alpha: 0.7)),
                const SizedBox(width: 6),
                Text(
                  'Mermaid Diagram',
                  style: TextStyle(
                    fontSize: 11,
                    color: cinematic
                        ? tokens.primary.withValues(alpha: 0.7)
                        : tokens.onSurface.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: _copySource,
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.copy_rounded,
                              size: 13,
                              color: tokens.onSurface.withValues(alpha: 0.45)),
                          const SizedBox(width: 4),
                          Text(
                            'Copy',
                            style: TextStyle(
                              fontSize: 11,
                              color: tokens.onSurface.withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // WebView or loading skeleton
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            height: _contentHeight,
            clipBehavior: Clip.antiAlias,
            decoration: const BoxDecoration(
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(10),
                bottomRight: Radius.circular(10),
              ),
            ),
            child: Stack(
              children: [
                WebViewWidget(controller: _controller),
                if (!_loaded)
                  Positioned.fill(
                    child: Container(
                      color: cinematic ? const Color(0xFF0D1117) : Colors.white,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation(
                                    tokens.primary.withValues(alpha: 0.5)),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Rendering diagram…',
                              style: TextStyle(
                                fontSize: 11,
                                color: tokens.onSurface.withValues(alpha: 0.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _fallbackCodeBlock() {
    final tokens = widget.tokens;
    final cinematic = widget.cinematic;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: cinematic
            ? const Color(0xFF0D1117)
            : tokens.onSurface.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border: cinematic
            ? Border.all(color: tokens.frame)
            : Border.all(color: tokens.onSurface.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: cinematic
                  ? Colors.white.withValues(alpha: 0.04)
                  : tokens.onSurface.withValues(alpha: 0.03),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(10),
                topRight: Radius.circular(10),
              ),
            ),
            child: Row(
              children: [
                Text(
                  'mermaid',
                  style: TextStyle(
                    fontSize: 11,
                    color: cinematic
                        ? tokens.primary.withValues(alpha: 0.7)
                        : tokens.onSurface.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: _copySource,
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.copy_rounded,
                              size: 13,
                              color: tokens.onSurface.withValues(alpha: 0.45)),
                          const SizedBox(width: 4),
                          Text(
                            'Copy',
                            style: TextStyle(
                              fontSize: 11,
                              color: tokens.onSurface.withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: SelectableText(
              widget.source,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 13,
                height: 1.5,
                color: cinematic
                    ? const Color(0xFFE6EDF3)
                    : tokens.onSurface.withValues(alpha: 0.85),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _buildHtml({
    required String source,
    required String bgColor,
    required String textColor,
    required String primaryColor,
  }) {
    // Escape the mermaid source for safe embedding in JS
    final escaped = source
        .replaceAll('\\', '\\\\')
        .replaceAll('`', '\\`')
        .replaceAll('\$', '\\\$');

    return '''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: $bgColor;
    color: $textColor;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12px;
    overflow: hidden;
  }
  #diagram { width: 100%; text-align: center; }
  #diagram svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<div id="diagram"></div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({
    startOnLoad: false,
    theme: '${bgColor == '#0D1117' ? 'dark' : 'default'}',
    themeVariables: {
      primaryColor: '$primaryColor',
      fontSize: '14px',
    },
    securityLevel: 'loose',
  });

  (async () => {
    try {
      const source = `$escaped`;
      const { svg } = await mermaid.render('mermaid-output', source);
      document.getElementById('diagram').innerHTML = svg;
      // Measure rendered height and report back
      requestAnimationFrame(() => {
        const h = document.getElementById('diagram').scrollHeight + 24;
        FlutterBridge.postMessage(JSON.stringify({ type: 'rendered', height: h }));
      });
    } catch (e) {
      FlutterBridge.postMessage(JSON.stringify({ type: 'error', message: e.message || String(e) }));
    }
  })();
</script>
</body>
</html>''';
  }
}
