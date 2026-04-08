import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/authenticated_client.dart';
import '../chat/chat_sse_service.dart';
import 'approvals_models.dart';
import 'approvals_service.dart';

class ApprovalsPage extends StatefulWidget {
  const ApprovalsPage({
    super.key,
    required this.client,
    this.service,
    this.enableSse = true,
    this.enableFallbackPolling = true,
    this.pollInterval = const Duration(seconds: 5),
  });

  final AuthenticatedClient client;
  final ApprovalsService? service;
  final bool enableSse;
  final bool enableFallbackPolling;
  final Duration pollInterval;

  @override
  State<ApprovalsPage> createState() => _ApprovalsPageState();
}

class _ApprovalsPageState extends State<ApprovalsPage> {
  late final ApprovalsService _service;
  bool _loading = true;
  String? _error;
  String _tab = 'pending';
  List<ApprovalItem> _pending = [];
  List<ApprovalItem> _history = [];
  Timer? _pollTimer;
  Future<void>? _refreshInFlight;

  ChatSseService? _sseService;
  StreamSubscription<SseEvent>? _sseSub;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? ApprovalsService(client: widget.client);
    _load();
    if (widget.enableSse) {
      _startSse();
    }
    if (widget.enableFallbackPolling) {
      _startFallbackPolling();
    }
  }

  void _startSse() {
    final sseService = ChatSseService(client: widget.client);
    _sseService = sseService;
    _sseSub = sseService.events.listen((event) {
      if (!mounted) return;
      if (event.type == 'approval') {
        _load(silent: true);
      }
    });
    sseService.connect();
  }

  void _startFallbackPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(widget.pollInterval, (_) {
      if (!mounted) return;
      _load(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _sseSub?.cancel();
    _sseService?.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (_refreshInFlight != null) {
      return _refreshInFlight!;
    }
    final completer = Completer<void>();
    _refreshInFlight = completer.future;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final pending = await _service.list(status: 'pending');
      final history = await _service.list();
      setState(() {
        _pending = pending;
        _history = history.where((a) => a.status != 'pending').toList();
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
      _refreshInFlight = null;
      completer.complete();
    }
  }

  Future<void> _vote(String id, String decision) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title:
                Text('${decision == 'approve' ? 'Approve' : 'Deny'} approval'),
            content: const Text('Confirm this decision?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Confirm'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    HapticFeedback.heavyImpact();
    await _service.vote(id: id, decision: decision);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _tab == 'pending' ? _pending : _history;
    return Scaffold(
      appBar: AppBar(title: const Text('Approvals')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'pending', label: Text('Pending')),
                ButtonSegment(value: 'history', label: Text('History')),
              ],
              selected: {_tab},
              onSelectionChanged: (value) {
                setState(() => _tab = value.first);
              },
            ),
          ),
          if (_loading)
            const Expanded(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Expanded(
              child: Center(
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            )
          else if (items.isEmpty)
            const Expanded(
              child: Center(child: Text('No approvals found.')),
            )
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return ListTile(
                      title: Text(item.title ?? item.type),
                      subtitle: Text(
                        '${item.type} · ${item.createdAt.toLocal()} · ${item.status}',
                      ),
                      trailing: _tab == 'pending'
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Semantics(
                                  label: 'Approve: ${item.title ?? item.type}',
                                  button: true,
                                  child: TextButton(
                                    onPressed: () => _vote(item.id, 'approve'),
                                    child: const Text('Approve'),
                                  ),
                                ),
                                Semantics(
                                  label: 'Deny: ${item.title ?? item.type}',
                                  button: true,
                                  child: TextButton(
                                    onPressed: () => _vote(item.id, 'deny'),
                                    child: const Text('Deny'),
                                  ),
                                ),
                              ],
                            )
                          : null,
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}
