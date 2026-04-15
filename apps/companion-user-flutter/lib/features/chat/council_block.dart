import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';

// ═════════════════════════════════════════════════════════════════════════════
// A.5.2 — Council response accordion view (compact for mobile).
// Renders council deliberation results inline in the chat message bubble.
// Shows synthesis at top, with expandable sections for individual model
// opinions and peer reviews — optimized for mobile screen space.
// ═════════════════════════════════════════════════════════════════════════════

/// Extracts and renders a council block from a message's blocks list.
/// Returns null if no council block found.
Widget? buildCouncilAccordion(
  List<dynamic>? blocks, {
  VisualMode visualMode = VisualMode.classic,
}) {
  if (blocks == null) return null;
  for (final block in blocks) {
    if (block is Map &&
        (block['type']?.toString() == 'council')) {
      final content = block['content'];
      if (content is Map<String, dynamic>) {
        return CouncilAccordion(
          content: content,
          visualMode: visualMode,
        );
      }
    }
  }
  return null;
}

class CouncilAccordion extends StatefulWidget {
  const CouncilAccordion({
    super.key,
    required this.content,
    this.visualMode = VisualMode.classic,
  });

  final Map<String, dynamic> content;
  final VisualMode visualMode;

  @override
  State<CouncilAccordion> createState() => _CouncilAccordionState();
}

class _CouncilAccordionState extends State<CouncilAccordion> {
  bool _opinionsExpanded = false;
  bool _reviewsExpanded = false;
  String? _expandedModel;

  Map<String, dynamic> get c => widget.content;

  String get synthesis => (c['synthesis'] as String?) ?? '';
  String get status => (c['status'] as String?) ?? 'completed';
  String get strategy => (c['strategy'] as String?) ?? '';
  int get elapsedMs => (c['elapsed_ms'] as num?)?.toInt() ?? 0;
  double get totalCost => (c['total_cost'] as num?)?.toDouble() ?? 0.0;
  Map<String, dynamic> get scores =>
      (c['scores'] as Map<String, dynamic>?) ?? {};

  List<Map<String, dynamic>> get opinions {
    final list = c['opinions'];
    if (list is List) {
      return list
          .whereType<Map<String, dynamic>>()
          .toList();
    }
    return [];
  }

  List<Map<String, dynamic>> get peerReviews {
    final list = c['peer_reviews'];
    if (list is List) {
      return list
          .whereType<Map<String, dynamic>>()
          .toList();
    }
    return [];
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: cinematic
            ? tokens.primary.withValues(alpha: 0.06)
            : tokens.primary.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: tokens.primary.withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Row(
              children: [
                Icon(Icons.groups_rounded,
                    size: 16, color: tokens.primary),
                const SizedBox(width: 6),
                Text(
                  'Council Deliberation',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: tokens.primary,
                  ),
                ),
                const SizedBox(width: 8),
                if (status == 'pending' || status == 'processing')
                  SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.5,
                      color: tokens.primary,
                    ),
                  )
                else
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: status == 'completed'
                          ? Colors.green.withValues(alpha: 0.1)
                          : Colors.orange.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(
                        fontSize: 10,
                        color: status == 'completed'
                            ? Colors.green[700]
                            : Colors.orange[700],
                      ),
                    ),
                  ),
                const Spacer(),
                if (elapsedMs > 0)
                  Text(
                    '${(elapsedMs / 1000).toStringAsFixed(1)}s',
                    style: TextStyle(
                      fontSize: 10,
                      color: tokens.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
              ],
            ),
          ),

          // ── Synthesis ──
          if (synthesis.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: MarkdownBody(
                data: synthesis,
                styleSheet: MarkdownStyleSheet(
                  p: TextStyle(
                    fontSize: 14,
                    color: tokens.onSurface,
                    height: 1.5,
                  ),
                ),
              ),
            ),

          // ── Opinions accordion ──
          if (opinions.isNotEmpty) ...[
            _AccordionHeader(
              title: 'Model Opinions (${opinions.length})',
              icon: Icons.smart_toy_rounded,
              expanded: _opinionsExpanded,
              tokens: tokens,
              onTap: () =>
                  setState(() => _opinionsExpanded = !_opinionsExpanded),
            ),
            if (_opinionsExpanded)
              ...opinions.map((op) => _OpinionTile(
                    opinion: op,
                    scores: scores,
                    expanded: _expandedModel ==
                        (op['model'] as String? ?? ''),
                    tokens: tokens,
                    onTap: () {
                      final model = op['model'] as String? ?? '';
                      setState(() {
                        _expandedModel =
                            _expandedModel == model ? null : model;
                      });
                    },
                  )),
          ],

          // ── Peer reviews accordion ──
          if (peerReviews.isNotEmpty) ...[
            _AccordionHeader(
              title: 'Peer Reviews (${peerReviews.length})',
              icon: Icons.rate_review_rounded,
              expanded: _reviewsExpanded,
              tokens: tokens,
              onTap: () =>
                  setState(() => _reviewsExpanded = !_reviewsExpanded),
            ),
            if (_reviewsExpanded)
              ...peerReviews.map((pr) => _ReviewTile(
                    review: pr,
                    tokens: tokens,
                  )),
          ],

          // ── Footer: cost + strategy ──
          if (strategy.isNotEmpty || totalCost > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
              child: Row(
                children: [
                  if (strategy.isNotEmpty)
                    Text(
                      strategy,
                      style: TextStyle(
                        fontSize: 10,
                        color: tokens.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  const Spacer(),
                  if (totalCost > 0)
                    Text(
                      '\$${totalCost.toStringAsFixed(4)}',
                      style: TextStyle(
                        fontSize: 10,
                        color: tokens.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Shared accordion header widget ──

class _AccordionHeader extends StatelessWidget {
  const _AccordionHeader({
    required this.title,
    required this.icon,
    required this.expanded,
    required this.tokens,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final bool expanded;
  final SvenModeTokens tokens;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 14,
                color: tokens.onSurface.withValues(alpha: 0.6)),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: tokens.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const Spacer(),
            Icon(
              expanded
                  ? Icons.keyboard_arrow_up_rounded
                  : Icons.keyboard_arrow_down_rounded,
              size: 18,
              color: tokens.onSurface.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Individual model opinion tile ──

class _OpinionTile extends StatelessWidget {
  const _OpinionTile({
    required this.opinion,
    required this.scores,
    required this.expanded,
    required this.tokens,
    required this.onTap,
  });

  final Map<String, dynamic> opinion;
  final Map<String, dynamic> scores;
  final bool expanded;
  final SvenModeTokens tokens;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final model = opinion['model'] as String? ?? 'Unknown';
    final response = opinion['response'] as String? ?? '';
    final latency = (opinion['latency_ms'] as num?)?.toInt();
    final tokensCompletion =
        (opinion['tokens_completion'] as num?)?.toInt();
    final score = (scores[model] as num?)?.toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    model,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: tokens.onSurface,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (score != null) ...[
                  Icon(Icons.star_rounded, size: 12, color: Colors.amber[700]),
                  const SizedBox(width: 2),
                  Text(
                    score.toStringAsFixed(1),
                    style: TextStyle(
                      fontSize: 10,
                      color: tokens.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                if (latency != null)
                  Text(
                    '${latency}ms',
                    style: TextStyle(
                      fontSize: 10,
                      color: tokens.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                if (tokensCompletion != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '${tokensCompletion}tok',
                    style: TextStyle(
                      fontSize: 10,
                      color: tokens.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ],
                const SizedBox(width: 4),
                Icon(
                  expanded
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded,
                  size: 16,
                  color: tokens.onSurface.withValues(alpha: 0.3),
                ),
              ],
            ),
          ),
        ),
        if (expanded && response.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
            child: MarkdownBody(
              data: response,
              styleSheet: MarkdownStyleSheet(
                p: TextStyle(
                  fontSize: 13,
                  color: tokens.onSurface.withValues(alpha: 0.8),
                  height: 1.4,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ── Peer review tile ──

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({
    required this.review,
    required this.tokens,
  });

  final Map<String, dynamic> review;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final reviewer = review['reviewer'] as String? ?? '';
    final target = review['target'] as String? ?? '';
    final score = (review['score'] as num?)?.toDouble() ?? 0.0;
    final feedback = review['feedback'] as String? ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '$reviewer → $target',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: tokens.onSurface.withValues(alpha: 0.7),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(Icons.star_rounded, size: 12, color: Colors.amber[700]),
              const SizedBox(width: 2),
              Text(
                score.toStringAsFixed(1),
                style: TextStyle(
                  fontSize: 10,
                  color: tokens.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
          if (feedback.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                feedback,
                style: TextStyle(
                  fontSize: 11,
                  color: tokens.onSurface.withValues(alpha: 0.5),
                  height: 1.3,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
    );
  }
}
