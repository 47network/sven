class ApprovalItem {
  ApprovalItem({
    required this.id,
    required this.status,
    required this.type,
    required this.createdAt,
    this.title,
    this.details,
  });

  final String id;
  final String status;
  final String type;
  final DateTime createdAt;
  final String? title;
  final Map<String, dynamic>? details;

  factory ApprovalItem.fromJson(Map<String, dynamic> json) {
    return ApprovalItem(
      id: (json['id'] ?? '').toString(),
      status: (json['status'] ?? 'pending').toString(),
      type: (json['type'] ?? json['tool_name'] ?? 'approval').toString(),
      title: json['title']?.toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      details: json['details'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['details'])
          : null,
    );
  }
}
