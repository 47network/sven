import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:sven_user_flutter/app/authenticated_client.dart';
import 'package:sven_user_flutter/features/approvals/approvals_models.dart';
import 'package:sven_user_flutter/features/approvals/approvals_page.dart';
import 'package:sven_user_flutter/features/approvals/approvals_service.dart';

class _FakeApprovalsService extends ApprovalsService {
  _FakeApprovalsService() : super(client: _buildClient());

  static AuthenticatedClient _buildClient() => AuthenticatedClient(
        client: MockClient((_) async => http.Response('{}', 200)),
      );

  List<ApprovalItem> pending = <ApprovalItem>[];
  List<ApprovalItem> all = <ApprovalItem>[];
  int voteCalls = 0;
  int listCalls = 0;

  @override
  Future<List<ApprovalItem>> list({String? status}) async {
    listCalls += 1;
    return status == 'pending' ? List<ApprovalItem>.from(pending) : List<ApprovalItem>.from(all);
  }

  @override
  Future<void> vote({required String id, required String decision}) async {
    voteCalls += 1;
  }
}

void main() {
  testWidgets('fallback polling re-fetches approvals after backend state changes', (tester) async {
    final service = _FakeApprovalsService();
    final approval = ApprovalItem(
      id: 'approval-1',
      status: 'pending',
      type: 'mobile.audit.approval',
      title: 'mobile.audit.approval',
      createdAt: DateTime.parse('2026-03-26T00:13:16.478Z'),
    );

    service.pending = <ApprovalItem>[approval];
    service.all = <ApprovalItem>[approval];

    final client = AuthenticatedClient(
      client: MockClient((_) async => http.Response('{}', 200)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ApprovalsPage(
          client: client,
          service: service,
          enableSse: false,
          enableFallbackPolling: true,
          pollInterval: const Duration(milliseconds: 100),
        ),
      ),
    );

    await tester.pump();
    expect(find.text('mobile.audit.approval'), findsOneWidget);
    expect(find.text('No approvals found.'), findsNothing);
    final initialListCalls = service.listCalls;

    service.pending = <ApprovalItem>[];
    service.all = <ApprovalItem>[
      ApprovalItem(
        id: 'approval-1',
        status: 'approved',
        type: 'mobile.audit.approval',
        title: 'mobile.audit.approval',
        createdAt: DateTime.parse('2026-03-26T00:13:16.478Z'),
      ),
    ];

    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    expect(service.listCalls, greaterThan(initialListCalls));
  });
}
