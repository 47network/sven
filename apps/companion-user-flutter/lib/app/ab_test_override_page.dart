// lib/app/ab_test_override_page.dart
//
// QA override page for the A/B testing framework.
//
// Surfaced from the Developer section in Settings (kDebugMode builds only).
// Allows testers to pin specific variant assignments per experiment, then
// reset individual or all overrides.

import 'package:flutter/material.dart';

import 'ab_experiments.dart';
import 'ab_test_service.dart';
import 'app_models.dart';
import 'sven_tokens.dart';

// ─────────────────────────────────────────────────────────────────────────────

class AbTestOverridePage extends StatelessWidget {
  const AbTestOverridePage({
    super.key,
    required this.service,
    required this.visualMode,
  });

  final AbTestService service;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: tokens.card,
        foregroundColor: tokens.onSurface,
        title: Text(
          'A/B Test Overrides',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: tokens.onSurface,
          ),
        ),
        elevation: 0,
        actions: [
          ListenableBuilder(
            listenable: service,
            builder: (context, _) {
              final hasAny = service.overrides.isNotEmpty;
              return TextButton(
                onPressed: hasAny
                    ? () async {
                        await service.clearAllOverrides();
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('All overrides cleared'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        }
                      }
                    : null,
                child: Text(
                  'Reset all',
                  style: TextStyle(
                    color: hasAny
                        ? Colors.redAccent
                        : tokens.onSurface.withValues(alpha: 0.3),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: service,
        builder: (context, _) {
          return ListView(
            padding: const EdgeInsets.symmetric(vertical: 16),
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Text(
                  service.isBound
                      ? 'User: ${service.userId}'
                      : 'Not bound — sign in first.',
                  style: TextStyle(
                    fontSize: 12,
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              const SizedBox(height: 12),
              for (final exp in AbExperiments.all)
                _ExperimentRow(
                  experiment: exp,
                  service: service,
                  tokens: tokens,
                ),
            ],
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _ExperimentRow extends StatelessWidget {
  const _ExperimentRow({
    required this.experiment,
    required this.service,
    required this.tokens,
  });

  final AbExperiment experiment;
  final AbTestService service;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final assigned =
        service.isBound ? (service.assignments[experiment.id] ?? '—') : '—';
    final overridden = service.overrides[experiment.id];
    final effectiveVariant = overridden ?? assigned;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: overridden != null
              ? Colors.amber.withValues(alpha: 0.6)
              : tokens.frame,
          width: overridden != null ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    experiment.displayName,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: tokens.onSurface,
                    ),
                  ),
                ),
                if (overridden != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'OVERRIDE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.amber,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              experiment.description,
              style: TextStyle(
                fontSize: 12,
                color: tokens.onSurface.withValues(alpha: 0.55),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text(
                  'Hash assignment: ',
                  style: TextStyle(
                    fontSize: 12,
                    color: tokens.onSurface.withValues(alpha: 0.55),
                  ),
                ),
                Text(
                  assigned,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: tokens.onSurface,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  'Override: ',
                  style: TextStyle(
                    fontSize: 13,
                    color: tokens.onSurface.withValues(alpha: 0.55),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _VariantDropdown(
                    experiment: experiment,
                    selectedVariant: overridden,
                    tokens: tokens,
                    service: service,
                    onChanged: (variant) async {
                      if (variant == null) return;
                      await service.overrideVariant(experiment.id, variant);
                    },
                  ),
                ),
                if (overridden != null) ...[
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => service.clearOverride(experiment.id),
                    child: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: tokens.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  'Effective: ',
                  style: TextStyle(
                    fontSize: 12,
                    color: tokens.onSurface.withValues(alpha: 0.55),
                  ),
                ),
                Text(
                  effectiveVariant,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: overridden != null ? Colors.amber : tokens.onSurface,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _VariantDropdown extends StatelessWidget {
  const _VariantDropdown({
    required this.experiment,
    required this.selectedVariant,
    required this.tokens,
    required this.service,
    required this.onChanged,
  });

  final AbExperiment experiment;
  final String? selectedVariant;
  final SvenModeTokens tokens;
  final AbTestService service;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final totalWeight =
        experiment.variants.values.fold(0.0, (sum, w) => sum + w);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: tokens.scaffold,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.frame),
      ),
      child: DropdownButton<String>(
        value: selectedVariant,
        hint: Text(
          'no override',
          style: TextStyle(
            fontSize: 13,
            color: tokens.onSurface.withValues(alpha: 0.4),
            fontStyle: FontStyle.italic,
          ),
        ),
        isExpanded: true,
        underline: const SizedBox.shrink(),
        dropdownColor: tokens.card,
        style: TextStyle(
          fontSize: 13,
          color: tokens.onSurface,
          fontFamily: 'monospace',
        ),
        icon: Icon(
          Icons.arrow_drop_down_rounded,
          color: tokens.onSurface.withValues(alpha: 0.5),
        ),
        items: [
          DropdownMenuItem<String>(
            value: null,
            child: Text(
              'no override',
              style: TextStyle(
                fontSize: 13,
                color: tokens.onSurface.withValues(alpha: 0.4),
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
          ...experiment.variants.entries.map(
            (e) => DropdownMenuItem<String>(
              value: e.key,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(e.key),
                  Text(
                    '${(e.value / totalWeight * 100).round()}%',
                    style: TextStyle(
                      fontSize: 11,
                      color: tokens.onSurface.withValues(alpha: 0.45),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        onChanged: (val) {
          if (val == null) {
            service.clearOverride(experiment.id);
          } else {
            onChanged(val);
          }
        },
      ),
    );
  }
}
