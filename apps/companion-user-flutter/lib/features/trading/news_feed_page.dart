// ═══════════════════════════════════════════════════════════════════════════
// NewsFeedPage — Aggregated crypto news from 17+ sources.
//
// Shows: recent articles with sentiment indicator, impact level, source.
// Top section shows the LLM-generated news digest with key themes.
// Pull-to-refresh for latest data.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class NewsFeedPage extends StatefulWidget {
  const NewsFeedPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<NewsFeedPage> createState() => _NewsFeedPageState();
}

class _NewsFeedPageState extends State<NewsFeedPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchNews();
    widget.tradingService.fetchStatus();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  Future<void> _refresh() async {
    await Future.wait([
      widget.tradingService.fetchNews(),
      widget.tradingService.fetchStatus(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final news = widget.tradingService.news;
    final status = widget.tradingService.status;
    final digest = status?.newsIngestion?.lastDigest;
    final ingestion = status?.newsIngestion;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('News Feed'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              HapticFeedback.lightImpact();
              _refresh();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: tokens.primary,
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Source health summary ─────────────────────────────────
            if (ingestion != null)
              _SourceHealthBar(ingestion: ingestion, tokens: tokens),
            if (ingestion != null) const SizedBox(height: 12),

            // ── LLM Digest ───────────────────────────────────────────
            if (digest != null) ...[
              _DigestCard(digest: digest, tokens: tokens),
              const SizedBox(height: 16),
            ],

            // ── Articles header ──────────────────────────────────────
            Row(
              children: [
                Icon(Icons.article_rounded, color: tokens.primary, size: 18),
                const SizedBox(width: 6),
                Text(
                  'LATEST ARTICLES',
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    letterSpacing: 1.0,
                  ),
                ),
                const Spacer(),
                Text(
                  '${news.length} articles',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.4),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // ── Article list ─────────────────────────────────────────
            if (news.isEmpty)
              _EmptyState(tokens: tokens)
            else
              ...news.map((article) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _ArticleCard(article: article, tokens: tokens),
                  )),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Source health bar
// ─────────────────────────────────────────────────────────────────────────────

class _SourceHealthBar extends StatelessWidget {
  const _SourceHealthBar({required this.ingestion, required this.tokens});

  final NewsIngestionInfo ingestion;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final healthyCount = ingestion.sourceHealth.values
        .where((v) => v == 'ok' || v == true)
        .length;
    final totalSources = ingestion.sourceHealth.length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.frame),
      ),
      child: Row(
        children: [
          Icon(Icons.satellite_alt_rounded, color: tokens.primary, size: 18),
          const SizedBox(width: 8),
          Text(
            '$healthyCount/$totalSources sources active',
            style: TextStyle(
              color: tokens.onSurface,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          const Spacer(),
          Text(
            '${ingestion.cachedArticles} cached',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.4),
              fontSize: 11,
            ),
          ),
          if (ingestion.rssFeedCount > 0) ...[
            const SizedBox(width: 8),
            Text(
              '${ingestion.rssFeedCount} RSS',
              style: TextStyle(
                color: tokens.primary.withValues(alpha: 0.7),
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM news digest card
// ─────────────────────────────────────────────────────────────────────────────

class _DigestCard extends StatelessWidget {
  const _DigestCard({required this.digest, required this.tokens});

  final NewsDigestInfo digest;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome_rounded,
                  color: tokens.primary, size: 18),
              const SizedBox(width: 6),
              Text(
                'SVEN\'S DIGEST',
                style: TextStyle(
                  color: tokens.primary,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  letterSpacing: 1.0,
                ),
              ),
              const Spacer(),
              if (digest.timestamp.isNotEmpty)
                Text(
                  _formatTime(digest.timestamp),
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.4),
                    fontSize: 10,
                  ),
                ),
            ],
          ),
          if (digest.summaryPreview.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              digest.summaryPreview,
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.8),
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
          if (digest.keyThemes.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: digest.keyThemes.map((theme) {
                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: tokens.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    theme,
                    style: TextStyle(
                      color: tokens.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(String isoStr) {
    final dt = DateTime.tryParse(isoStr);
    if (dt == null) return isoStr;
    final local = dt.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual article card
// ─────────────────────────────────────────────────────────────────────────────

class _ArticleCard extends StatelessWidget {
  const _ArticleCard({required this.article, required this.tokens});

  final NewsArticle article;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final sentiment = article.sentimentScore;
    final sentimentColor = sentiment > 0.2
        ? Colors.greenAccent
        : sentiment < -0.2
            ? Colors.redAccent
            : Colors.amber;
    final sentimentLabel = sentiment > 0.2
        ? 'Bullish'
        : sentiment < -0.2
            ? 'Bearish'
            : 'Neutral';

    final impactColor = article.impactLevel >= 4
        ? Colors.redAccent
        : article.impactLevel >= 3
            ? Colors.orange
            : Colors.grey;

    // Format timestamp.
    final ts = DateTime.tryParse(article.createdAt);
    final timeStr = ts != null ? _timeAgo(ts) : '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Headline
          Text(
            article.event,
            style: TextStyle(
              color: tokens.onSurface,
              fontWeight: FontWeight.w500,
              fontSize: 13,
              height: 1.3,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          // Meta row
          Row(
            children: [
              // Source
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: tokens.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  article.source,
                  style: TextStyle(
                    color: tokens.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              // Sentiment
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: sentimentColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  sentimentLabel,
                  style: TextStyle(
                    color: sentimentColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              // Impact
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  5,
                  (i) => Icon(
                    Icons.circle,
                    size: 6,
                    color: i < article.impactLevel
                        ? impactColor
                        : tokens.onSurface.withValues(alpha: 0.15),
                  ),
                ),
              ),
              const Spacer(),
              // Time
              Text(
                timeStr,
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt.toLocal());
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.tokens});

  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(
        children: [
          Icon(Icons.newspaper_rounded,
              color: tokens.onSurface.withValues(alpha: 0.3), size: 48),
          const SizedBox(height: 12),
          Text(
            'No news yet',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Sven aggregates news from 17+ crypto sources.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.3),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
