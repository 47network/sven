// GENERATED CODE - DO NOT MODIFY BY HAND
//
// *** NOTE: This file is hand-written because drift_dev conflicts with freezed
//           over the `build` package version. See docs/adr/006-drift-local-db.md
//           for rationale. Regenerate manually if the schema changes.
//
// This file is excluded from source_gen via build.yaml so that
// `dart run build_runner build --delete-conflicting-outputs` will NOT wipe it.

// ignore_for_file: type=lint
part of 'database.dart';

// ── Data classes ──────────────────────────────────────────────────────────────

class DbChatThread extends DataClass implements Insertable<DbChatThread> {
  final String id;
  final String title;
  final String lastMessage;
  final int updatedAt;
  final int unreadCount;
  final String type;
  final String? channel;
  final int messageCount;
  final bool isPinned;
  final bool isArchived;
  final String? tag;

  const DbChatThread({
    required this.id,
    required this.title,
    required this.lastMessage,
    required this.updatedAt,
    required this.unreadCount,
    required this.type,
    this.channel,
    required this.messageCount,
    required this.isPinned,
    required this.isArchived,
    this.tag,
  });

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['title'] = Variable<String>(title);
    map['last_message'] = Variable<String>(lastMessage);
    map['updated_at'] = Variable<int>(updatedAt);
    map['unread_count'] = Variable<int>(unreadCount);
    map['type'] = Variable<String>(type);
    if (!nullToAbsent || channel != null) {
      map['channel'] = Variable<String>(channel!);
    }
    map['message_count'] = Variable<int>(messageCount);
    map['is_pinned'] = Variable<bool>(isPinned);
    map['is_archived'] = Variable<bool>(isArchived);
    if (!nullToAbsent || tag != null) {
      map['tag'] = Variable<String>(tag!);
    }
    return map;
  }

  DbChatThreadsCompanion toCompanion(bool nullToAbsent) {
    return DbChatThreadsCompanion(
      id: Value(id),
      title: Value(title),
      lastMessage: Value(lastMessage),
      updatedAt: Value(updatedAt),
      unreadCount: Value(unreadCount),
      type: Value(type),
      channel: channel == null && nullToAbsent
          ? const Value.absent()
          : Value(channel),
      messageCount: Value(messageCount),
      isPinned: Value(isPinned),
      isArchived: Value(isArchived),
      tag: tag == null && nullToAbsent ? const Value.absent() : Value(tag),
    );
  }

  factory DbChatThread.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DbChatThread(
      id: serializer.fromJson<String>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      lastMessage: serializer.fromJson<String>(json['last_message']),
      updatedAt: serializer.fromJson<int>(json['updated_at']),
      unreadCount: serializer.fromJson<int>(json['unread_count']),
      type: serializer.fromJson<String>(json['type']),
      channel: serializer.fromJson<String?>(json['channel']),
      messageCount: serializer.fromJson<int>(json['message_count']),
      isPinned: serializer.fromJson<bool>(json['is_pinned']),
      isArchived: serializer.fromJson<bool>(json['is_archived']),
      tag: serializer.fromJson<String?>(json['tag']),
    );
  }

  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'title': serializer.toJson<String>(title),
      'last_message': serializer.toJson<String>(lastMessage),
      'updated_at': serializer.toJson<int>(updatedAt),
      'unread_count': serializer.toJson<int>(unreadCount),
      'type': serializer.toJson<String>(type),
      'channel': serializer.toJson<String?>(channel),
      'message_count': serializer.toJson<int>(messageCount),
      'is_pinned': serializer.toJson<bool>(isPinned),
      'is_archived': serializer.toJson<bool>(isArchived),
      'tag': serializer.toJson<String?>(tag),
    };
  }

  DbChatThread copyWith({
    String? id,
    String? title,
    String? lastMessage,
    int? updatedAt,
    int? unreadCount,
    String? type,
    Value<String?> channel = const Value.absent(),
    int? messageCount,
    bool? isPinned,
    bool? isArchived,
    Value<String?> tag = const Value.absent(),
  }) =>
      DbChatThread(
        id: id ?? this.id,
        title: title ?? this.title,
        lastMessage: lastMessage ?? this.lastMessage,
        updatedAt: updatedAt ?? this.updatedAt,
        unreadCount: unreadCount ?? this.unreadCount,
        type: type ?? this.type,
        channel: channel.present ? channel.value : this.channel,
        messageCount: messageCount ?? this.messageCount,
        isPinned: isPinned ?? this.isPinned,
        isArchived: isArchived ?? this.isArchived,
        tag: tag.present ? tag.value : this.tag,
      );

  @override
  String toString() {
    return (StringBuffer('DbChatThread(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('lastMessage: $lastMessage, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('unreadCount: $unreadCount, ')
          ..write('type: $type, ')
          ..write('channel: $channel, ')
          ..write('messageCount: $messageCount, ')
          ..write('isPinned: $isPinned, ')
          ..write('isArchived: $isArchived, ')
          ..write('tag: $tag')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, title, lastMessage, updatedAt,
      unreadCount, type, channel, messageCount, isPinned, isArchived, tag);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DbChatThread &&
          other.id == id &&
          other.title == title &&
          other.lastMessage == lastMessage &&
          other.updatedAt == updatedAt &&
          other.unreadCount == unreadCount &&
          other.type == type &&
          other.channel == channel &&
          other.messageCount == messageCount &&
          other.isPinned == isPinned &&
          other.isArchived == isArchived &&
          other.tag == tag);
}

// ── DbChatThreadsCompanion ───────────────────────────────────────────────────

class DbChatThreadsCompanion extends UpdateCompanion<DbChatThread> {
  final Value<String> id;
  final Value<String> title;
  final Value<String> lastMessage;
  final Value<int> updatedAt;
  final Value<int> unreadCount;
  final Value<String> type;
  final Value<String?> channel;
  final Value<int> messageCount;
  final Value<bool> isPinned;
  final Value<bool> isArchived;
  final Value<String?> tag;
  final Value<int> rowid;

  const DbChatThreadsCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.lastMessage = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.unreadCount = const Value.absent(),
    this.type = const Value.absent(),
    this.channel = const Value.absent(),
    this.messageCount = const Value.absent(),
    this.isPinned = const Value.absent(),
    this.isArchived = const Value.absent(),
    this.tag = const Value.absent(),
    this.rowid = const Value.absent(),
  });

  /// Named constructor used by [MessagesRepository] — required fields are
  /// plain `T`, optional fields with defaults or nullability use `Value<T>`.
  DbChatThreadsCompanion.insert({
    required String id,
    required String title,
    this.lastMessage = const Value.absent(),
    required int updatedAt,
    this.unreadCount = const Value.absent(),
    this.type = const Value.absent(),
    this.channel = const Value.absent(),
    this.messageCount = const Value.absent(),
    this.isPinned = const Value.absent(),
    this.isArchived = const Value.absent(),
    this.tag = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        title = Value(title),
        updatedAt = Value(updatedAt);

  static Insertable<DbChatThread> custom({
    Expression<String>? id,
    Expression<String>? title,
    Expression<String>? lastMessage,
    Expression<int>? updatedAt,
    Expression<int>? unreadCount,
    Expression<String>? type,
    Expression<String>? channel,
    Expression<int>? messageCount,
    Expression<bool>? isPinned,
    Expression<bool>? isArchived,
    Expression<String>? tag,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (lastMessage != null) 'last_message': lastMessage,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (unreadCount != null) 'unread_count': unreadCount,
      if (type != null) 'type': type,
      if (channel != null) 'channel': channel,
      if (messageCount != null) 'message_count': messageCount,
      if (isPinned != null) 'is_pinned': isPinned,
      if (isArchived != null) 'is_archived': isArchived,
      if (tag != null) 'tag': tag,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DbChatThreadsCompanion copyWith({
    Value<String>? id,
    Value<String>? title,
    Value<String>? lastMessage,
    Value<int>? updatedAt,
    Value<int>? unreadCount,
    Value<String>? type,
    Value<String?>? channel,
    Value<int>? messageCount,
    Value<bool>? isPinned,
    Value<bool>? isArchived,
    Value<String?>? tag,
    Value<int>? rowid,
  }) {
    return DbChatThreadsCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      lastMessage: lastMessage ?? this.lastMessage,
      updatedAt: updatedAt ?? this.updatedAt,
      unreadCount: unreadCount ?? this.unreadCount,
      type: type ?? this.type,
      channel: channel ?? this.channel,
      messageCount: messageCount ?? this.messageCount,
      isPinned: isPinned ?? this.isPinned,
      isArchived: isArchived ?? this.isArchived,
      tag: tag ?? this.tag,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) map['id'] = Variable<String>(id.value);
    if (title.present) map['title'] = Variable<String>(title.value);
    if (lastMessage.present) {
      map['last_message'] = Variable<String>(lastMessage.value);
    }
    if (updatedAt.present) map['updated_at'] = Variable<int>(updatedAt.value);
    if (unreadCount.present) {
      map['unread_count'] = Variable<int>(unreadCount.value);
    }
    if (type.present) map['type'] = Variable<String>(type.value);
    if (channel.present) map['channel'] = Variable<String>(channel.value!);
    if (messageCount.present) {
      map['message_count'] = Variable<int>(messageCount.value);
    }
    if (isPinned.present) map['is_pinned'] = Variable<bool>(isPinned.value);
    if (isArchived.present) {
      map['is_archived'] = Variable<bool>(isArchived.value);
    }
    if (tag.present) map['tag'] = Variable<String>(tag.value!);
    if (rowid.present) map['rowid'] = Variable<int>(rowid.value);
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DbChatThreadsCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('lastMessage: $lastMessage, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('unreadCount: $unreadCount, ')
          ..write('type: $type, ')
          ..write('channel: $channel, ')
          ..write('messageCount: $messageCount, ')
          ..write('isPinned: $isPinned, ')
          ..write('isArchived: $isArchived, ')
          ..write('tag: $tag, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

// ── DbChatMessage data class ─────────────────────────────────────────────────

class DbChatMessage extends DataClass implements Insertable<DbChatMessage> {
  final String id;
  final String chatId;
  final String role;
  final String content;
  final int timestamp;
  final String status;
  final String? senderName;
  final String contentType;
  final bool isEdited;

  const DbChatMessage({
    required this.id,
    required this.chatId,
    required this.role,
    required this.content,
    required this.timestamp,
    required this.status,
    this.senderName,
    required this.contentType,
    required this.isEdited,
  });

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['chat_id'] = Variable<String>(chatId);
    map['role'] = Variable<String>(role);
    map['content'] = Variable<String>(content);
    map['timestamp'] = Variable<int>(timestamp);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || senderName != null) {
      map['sender_name'] = Variable<String>(senderName!);
    }
    map['content_type'] = Variable<String>(contentType);
    map['is_edited'] = Variable<bool>(isEdited);
    return map;
  }

  DbChatMessagesCompanion toCompanion(bool nullToAbsent) {
    return DbChatMessagesCompanion(
      id: Value(id),
      chatId: Value(chatId),
      role: Value(role),
      content: Value(content),
      timestamp: Value(timestamp),
      status: Value(status),
      senderName: senderName == null && nullToAbsent
          ? const Value.absent()
          : Value(senderName),
      contentType: Value(contentType),
      isEdited: Value(isEdited),
    );
  }

  factory DbChatMessage.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DbChatMessage(
      id: serializer.fromJson<String>(json['id']),
      chatId: serializer.fromJson<String>(json['chat_id']),
      role: serializer.fromJson<String>(json['role']),
      content: serializer.fromJson<String>(json['content']),
      timestamp: serializer.fromJson<int>(json['timestamp']),
      status: serializer.fromJson<String>(json['status']),
      senderName: serializer.fromJson<String?>(json['sender_name']),
      contentType: serializer.fromJson<String>(json['content_type']),
      isEdited: serializer.fromJson<bool>(json['is_edited']),
    );
  }

  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'chat_id': serializer.toJson<String>(chatId),
      'role': serializer.toJson<String>(role),
      'content': serializer.toJson<String>(content),
      'timestamp': serializer.toJson<int>(timestamp),
      'status': serializer.toJson<String>(status),
      'sender_name': serializer.toJson<String?>(senderName),
      'content_type': serializer.toJson<String>(contentType),
      'is_edited': serializer.toJson<bool>(isEdited),
    };
  }

  DbChatMessage copyWith({
    String? id,
    String? chatId,
    String? role,
    String? content,
    int? timestamp,
    String? status,
    Value<String?> senderName = const Value.absent(),
    String? contentType,
    bool? isEdited,
  }) =>
      DbChatMessage(
        id: id ?? this.id,
        chatId: chatId ?? this.chatId,
        role: role ?? this.role,
        content: content ?? this.content,
        timestamp: timestamp ?? this.timestamp,
        status: status ?? this.status,
        senderName: senderName.present ? senderName.value : this.senderName,
        contentType: contentType ?? this.contentType,
        isEdited: isEdited ?? this.isEdited,
      );

  @override
  String toString() {
    return (StringBuffer('DbChatMessage(')
          ..write('id: $id, ')
          ..write('chatId: $chatId, ')
          ..write('role: $role, ')
          ..write('content: $content, ')
          ..write('timestamp: $timestamp, ')
          ..write('status: $status, ')
          ..write('senderName: $senderName, ')
          ..write('contentType: $contentType, ')
          ..write('isEdited: $isEdited')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, chatId, role, content, timestamp, status,
      senderName, contentType, isEdited);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DbChatMessage &&
          other.id == id &&
          other.chatId == chatId &&
          other.role == role &&
          other.content == content &&
          other.timestamp == timestamp &&
          other.status == status &&
          other.senderName == senderName &&
          other.contentType == contentType &&
          other.isEdited == isEdited);
}

// ── DbChatMessagesCompanion ──────────────────────────────────────────────────

class DbChatMessagesCompanion extends UpdateCompanion<DbChatMessage> {
  final Value<String> id;
  final Value<String> chatId;
  final Value<String> role;
  final Value<String> content;
  final Value<int> timestamp;
  final Value<String> status;
  final Value<String?> senderName;
  final Value<String> contentType;
  final Value<bool> isEdited;
  final Value<int> rowid;

  const DbChatMessagesCompanion({
    this.id = const Value.absent(),
    this.chatId = const Value.absent(),
    this.role = const Value.absent(),
    this.content = const Value.absent(),
    this.timestamp = const Value.absent(),
    this.status = const Value.absent(),
    this.senderName = const Value.absent(),
    this.contentType = const Value.absent(),
    this.isEdited = const Value.absent(),
    this.rowid = const Value.absent(),
  });

  /// Named constructor used by [MessagesRepository].
  DbChatMessagesCompanion.insert({
    required String id,
    required String chatId,
    required String role,
    required String content,
    required int timestamp,
    this.status = const Value.absent(),
    this.senderName = const Value.absent(),
    this.contentType = const Value.absent(),
    this.isEdited = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        chatId = Value(chatId),
        role = Value(role),
        content = Value(content),
        timestamp = Value(timestamp);

  static Insertable<DbChatMessage> custom({
    Expression<String>? id,
    Expression<String>? chatId,
    Expression<String>? role,
    Expression<String>? content,
    Expression<int>? timestamp,
    Expression<String>? status,
    Expression<String>? senderName,
    Expression<String>? contentType,
    Expression<bool>? isEdited,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (chatId != null) 'chat_id': chatId,
      if (role != null) 'role': role,
      if (content != null) 'content': content,
      if (timestamp != null) 'timestamp': timestamp,
      if (status != null) 'status': status,
      if (senderName != null) 'sender_name': senderName,
      if (contentType != null) 'content_type': contentType,
      if (isEdited != null) 'is_edited': isEdited,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DbChatMessagesCompanion copyWith({
    Value<String>? id,
    Value<String>? chatId,
    Value<String>? role,
    Value<String>? content,
    Value<int>? timestamp,
    Value<String>? status,
    Value<String?>? senderName,
    Value<String>? contentType,
    Value<bool>? isEdited,
    Value<int>? rowid,
  }) {
    return DbChatMessagesCompanion(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      role: role ?? this.role,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      status: status ?? this.status,
      senderName: senderName ?? this.senderName,
      contentType: contentType ?? this.contentType,
      isEdited: isEdited ?? this.isEdited,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) map['id'] = Variable<String>(id.value);
    if (chatId.present) map['chat_id'] = Variable<String>(chatId.value);
    if (role.present) map['role'] = Variable<String>(role.value);
    if (content.present) map['content'] = Variable<String>(content.value);
    if (timestamp.present) map['timestamp'] = Variable<int>(timestamp.value);
    if (status.present) map['status'] = Variable<String>(status.value);
    if (senderName.present) {
      map['sender_name'] = Variable<String>(senderName.value!);
    }
    if (contentType.present) {
      map['content_type'] = Variable<String>(contentType.value);
    }
    if (isEdited.present) map['is_edited'] = Variable<bool>(isEdited.value);
    if (rowid.present) map['rowid'] = Variable<int>(rowid.value);
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DbChatMessagesCompanion(')
          ..write('id: $id, ')
          ..write('chatId: $chatId, ')
          ..write('role: $role, ')
          ..write('content: $content, ')
          ..write('timestamp: $timestamp, ')
          ..write('status: $status, ')
          ..write('senderName: $senderName, ')
          ..write('contentType: $contentType, ')
          ..write('isEdited: $isEdited, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

// ── Table classes ─────────────────────────────────────────────────────────────

class $DbChatThreadsTable extends DbChatThreads
    with TableInfo<DbChatThreads, DbChatThread> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DbChatThreadsTable(this.attachedDatabase, [this._alias]);

  static const VerificationMeta _idMeta = VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _titleMeta = VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _lastMessageMeta =
      VerificationMeta('lastMessage');
  @override
  late final GeneratedColumn<String> lastMessage = GeneratedColumn<String>(
    'last_message',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );

  static const VerificationMeta _updatedAtMeta = VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _unreadCountMeta =
      VerificationMeta('unreadCount');
  @override
  late final GeneratedColumn<int> unreadCount = GeneratedColumn<int>(
    'unread_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );

  static const VerificationMeta _typeMeta = VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('dm'),
  );

  static const VerificationMeta _channelMeta = VerificationMeta('channel');
  @override
  late final GeneratedColumn<String> channel = GeneratedColumn<String>(
    'channel',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );

  static const VerificationMeta _messageCountMeta =
      VerificationMeta('messageCount');
  @override
  late final GeneratedColumn<int> messageCount = GeneratedColumn<int>(
    'message_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );

  static const VerificationMeta _isPinnedMeta = VerificationMeta('isPinned');
  @override
  late final GeneratedColumn<bool> isPinned = GeneratedColumn<bool>(
    'is_pinned',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints:
        GeneratedColumn.constraintIsAlways('CHECK ("is_pinned" IN (0, 1))'),
    defaultValue: const Constant(false),
  );

  static const VerificationMeta _isArchivedMeta =
      VerificationMeta('isArchived');
  @override
  late final GeneratedColumn<bool> isArchived = GeneratedColumn<bool>(
    'is_archived',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints:
        GeneratedColumn.constraintIsAlways('CHECK ("is_archived" IN (0, 1))'),
    defaultValue: const Constant(false),
  );

  static const VerificationMeta _tagMeta = VerificationMeta('tag');
  @override
  late final GeneratedColumn<String> tag = GeneratedColumn<String>(
    'tag',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );

  @override
  List<GeneratedColumn> get $columns => [
        id,
        title,
        lastMessage,
        updatedAt,
        unreadCount,
        type,
        channel,
        messageCount,
        isPinned,
        isArchived,
        tag,
      ];

  @override
  String get aliasedName => _alias ?? actualTableName;

  @override
  String get actualTableName => $name;

  static const String $name = 'db_chat_threads';

  @override
  VerificationContext validateIntegrity(
    Insertable<DbChatThread> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
          _titleMeta, title.isAcceptableOrUnknown(data['title']!, _titleMeta));
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('last_message')) {
      context.handle(
          _lastMessageMeta,
          lastMessage.isAcceptableOrUnknown(
              data['last_message']!, _lastMessageMeta));
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('unread_count')) {
      context.handle(
          _unreadCountMeta,
          unreadCount.isAcceptableOrUnknown(
              data['unread_count']!, _unreadCountMeta));
    }
    if (data.containsKey('type')) {
      context.handle(
          _typeMeta, type.isAcceptableOrUnknown(data['type']!, _typeMeta));
    }
    if (data.containsKey('channel')) {
      context.handle(_channelMeta,
          channel.isAcceptableOrUnknown(data['channel']!, _channelMeta));
    }
    if (data.containsKey('message_count')) {
      context.handle(
          _messageCountMeta,
          messageCount.isAcceptableOrUnknown(
              data['message_count']!, _messageCountMeta));
    }
    if (data.containsKey('is_pinned')) {
      context.handle(_isPinnedMeta,
          isPinned.isAcceptableOrUnknown(data['is_pinned']!, _isPinnedMeta));
    }
    if (data.containsKey('is_archived')) {
      context.handle(
          _isArchivedMeta,
          isArchived.isAcceptableOrUnknown(
              data['is_archived']!, _isArchivedMeta));
    }
    if (data.containsKey('tag')) {
      context.handle(
          _tagMeta, tag.isAcceptableOrUnknown(data['tag']!, _tagMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};

  @override
  DbChatThread map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DbChatThread(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      title: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}title'])!,
      lastMessage: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}last_message'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}updated_at'])!,
      unreadCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}unread_count'])!,
      type: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}type'])!,
      channel: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}channel']),
      messageCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}message_count'])!,
      isPinned: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_pinned'])!,
      isArchived: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_archived'])!,
      tag: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}tag']),
    );
  }

  @override
  $DbChatThreadsTable createAlias(String alias) {
    return $DbChatThreadsTable(attachedDatabase, alias);
  }
}

// ── $DbChatMessagesTable ─────────────────────────────────────────────────────

class $DbChatMessagesTable extends DbChatMessages
    with TableInfo<DbChatMessages, DbChatMessage> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DbChatMessagesTable(this.attachedDatabase, [this._alias]);

  static const VerificationMeta _idMeta = VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _chatIdMeta = VerificationMeta('chatId');
  @override
  late final GeneratedColumn<String> chatId = GeneratedColumn<String>(
    'chat_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _roleMeta = VerificationMeta('role');
  @override
  late final GeneratedColumn<String> role = GeneratedColumn<String>(
    'role',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _contentMeta = VerificationMeta('content');
  @override
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _timestampMeta = VerificationMeta('timestamp');
  @override
  late final GeneratedColumn<int> timestamp = GeneratedColumn<int>(
    'timestamp',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _statusMeta = VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('sent'),
  );

  static const VerificationMeta _senderNameMeta =
      VerificationMeta('senderName');
  @override
  late final GeneratedColumn<String> senderName = GeneratedColumn<String>(
    'sender_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );

  static const VerificationMeta _contentTypeMeta =
      VerificationMeta('contentType');
  @override
  late final GeneratedColumn<String> contentType = GeneratedColumn<String>(
    'content_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('text'),
  );

  static const VerificationMeta _isEditedMeta = VerificationMeta('isEdited');
  @override
  late final GeneratedColumn<bool> isEdited = GeneratedColumn<bool>(
    'is_edited',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints:
        GeneratedColumn.constraintIsAlways('CHECK ("is_edited" IN (0, 1))'),
    defaultValue: const Constant(false),
  );

  @override
  List<GeneratedColumn> get $columns => [
        id,
        chatId,
        role,
        content,
        timestamp,
        status,
        senderName,
        contentType,
        isEdited,
      ];

  @override
  String get aliasedName => _alias ?? actualTableName;

  @override
  String get actualTableName => $name;

  static const String $name = 'db_chat_messages';

  @override
  VerificationContext validateIntegrity(
    Insertable<DbChatMessage> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('chat_id')) {
      context.handle(_chatIdMeta,
          chatId.isAcceptableOrUnknown(data['chat_id']!, _chatIdMeta));
    } else if (isInserting) {
      context.missing(_chatIdMeta);
    }
    if (data.containsKey('role')) {
      context.handle(
          _roleMeta, role.isAcceptableOrUnknown(data['role']!, _roleMeta));
    } else if (isInserting) {
      context.missing(_roleMeta);
    }
    if (data.containsKey('content')) {
      context.handle(_contentMeta,
          content.isAcceptableOrUnknown(data['content']!, _contentMeta));
    } else if (isInserting) {
      context.missing(_contentMeta);
    }
    if (data.containsKey('timestamp')) {
      context.handle(_timestampMeta,
          timestamp.isAcceptableOrUnknown(data['timestamp']!, _timestampMeta));
    } else if (isInserting) {
      context.missing(_timestampMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('sender_name')) {
      context.handle(
          _senderNameMeta,
          senderName.isAcceptableOrUnknown(
              data['sender_name']!, _senderNameMeta));
    }
    if (data.containsKey('content_type')) {
      context.handle(
          _contentTypeMeta,
          contentType.isAcceptableOrUnknown(
              data['content_type']!, _contentTypeMeta));
    }
    if (data.containsKey('is_edited')) {
      context.handle(_isEditedMeta,
          isEdited.isAcceptableOrUnknown(data['is_edited']!, _isEditedMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};

  @override
  DbChatMessage map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DbChatMessage(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      chatId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}chat_id'])!,
      role: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}role'])!,
      content: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}content'])!,
      timestamp: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}timestamp'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      senderName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}sender_name']),
      contentType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}content_type'])!,
      isEdited: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_edited'])!,
    );
  }

  @override
  $DbChatMessagesTable createAlias(String alias) {
    return $DbChatMessagesTable(attachedDatabase, alias);
  }
}

// ── DbOutboxMessage ───────────────────────────────────────────────────────────

class DbOutboxMessage extends DataClass implements Insertable<DbOutboxMessage> {
  final String id;
  final String chatId;
  final String body;
  final int queuedAt;
  final int attemptCount;

  const DbOutboxMessage({
    required this.id,
    required this.chatId,
    required this.body,
    required this.queuedAt,
    required this.attemptCount,
  });

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['chat_id'] = Variable<String>(chatId);
    map['body'] = Variable<String>(body);
    map['queued_at'] = Variable<int>(queuedAt);
    map['attempt_count'] = Variable<int>(attemptCount);
    return map;
  }

  DbOutboxMessagesCompanion toCompanion(bool nullToAbsent) {
    return DbOutboxMessagesCompanion(
      id: Value(id),
      chatId: Value(chatId),
      body: Value(body),
      queuedAt: Value(queuedAt),
      attemptCount: Value(attemptCount),
    );
  }

  factory DbOutboxMessage.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DbOutboxMessage(
      id: serializer.fromJson<String>(json['id']),
      chatId: serializer.fromJson<String>(json['chat_id']),
      body: serializer.fromJson<String>(json['body']),
      queuedAt: serializer.fromJson<int>(json['queued_at']),
      attemptCount: serializer.fromJson<int>(json['attempt_count']),
    );
  }

  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'chat_id': serializer.toJson<String>(chatId),
      'body': serializer.toJson<String>(body),
      'queued_at': serializer.toJson<int>(queuedAt),
      'attempt_count': serializer.toJson<int>(attemptCount),
    };
  }

  DbOutboxMessage copyWith({
    String? id,
    String? chatId,
    String? body,
    int? queuedAt,
    int? attemptCount,
  }) =>
      DbOutboxMessage(
        id: id ?? this.id,
        chatId: chatId ?? this.chatId,
        body: body ?? this.body,
        queuedAt: queuedAt ?? this.queuedAt,
        attemptCount: attemptCount ?? this.attemptCount,
      );

  @override
  String toString() {
    return (StringBuffer('DbOutboxMessage(')
          ..write('id: $id, ')
          ..write('chatId: $chatId, ')
          ..write('body: $body, ')
          ..write('queuedAt: $queuedAt, ')
          ..write('attemptCount: $attemptCount')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, chatId, body, queuedAt, attemptCount);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DbOutboxMessage &&
          other.id == id &&
          other.chatId == chatId &&
          other.body == body &&
          other.queuedAt == queuedAt &&
          other.attemptCount == attemptCount);
}

class DbOutboxMessagesCompanion extends UpdateCompanion<DbOutboxMessage> {
  final Value<String> id;
  final Value<String> chatId;
  final Value<String> body;
  final Value<int> queuedAt;
  final Value<int> attemptCount;
  final Value<int> rowid;

  const DbOutboxMessagesCompanion({
    this.id = const Value.absent(),
    this.chatId = const Value.absent(),
    this.body = const Value.absent(),
    this.queuedAt = const Value.absent(),
    this.attemptCount = const Value.absent(),
    this.rowid = const Value.absent(),
  });

  DbOutboxMessagesCompanion.insert({
    required String id,
    required String chatId,
    required String body,
    required int queuedAt,
    this.attemptCount = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        chatId = Value(chatId),
        body = Value(body),
        queuedAt = Value(queuedAt);

  static Insertable<DbOutboxMessage> custom({
    Expression<String>? id,
    Expression<String>? chatId,
    Expression<String>? body,
    Expression<int>? queuedAt,
    Expression<int>? attemptCount,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (chatId != null) 'chat_id': chatId,
      if (body != null) 'body': body,
      if (queuedAt != null) 'queued_at': queuedAt,
      if (attemptCount != null) 'attempt_count': attemptCount,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DbOutboxMessagesCompanion copyWith({
    Value<String>? id,
    Value<String>? chatId,
    Value<String>? body,
    Value<int>? queuedAt,
    Value<int>? attemptCount,
    Value<int>? rowid,
  }) {
    return DbOutboxMessagesCompanion(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      body: body ?? this.body,
      queuedAt: queuedAt ?? this.queuedAt,
      attemptCount: attemptCount ?? this.attemptCount,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) map['id'] = Variable<String>(id.value);
    if (chatId.present) map['chat_id'] = Variable<String>(chatId.value);
    if (body.present) map['body'] = Variable<String>(body.value);
    if (queuedAt.present) map['queued_at'] = Variable<int>(queuedAt.value);
    if (attemptCount.present) {
      map['attempt_count'] = Variable<int>(attemptCount.value);
    }
    if (rowid.present) map['rowid'] = Variable<int>(rowid.value);
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DbOutboxMessagesCompanion(')
          ..write('id: $id, ')
          ..write('chatId: $chatId, ')
          ..write('body: $body, ')
          ..write('queuedAt: $queuedAt, ')
          ..write('attemptCount: $attemptCount, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

// ── $DbOutboxMessagesTable ────────────────────────────────────────────────────

class $DbOutboxMessagesTable extends DbOutboxMessages
    with TableInfo<DbOutboxMessages, DbOutboxMessage> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DbOutboxMessagesTable(this.attachedDatabase, [this._alias]);

  static const VerificationMeta _idMeta = VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _chatIdMeta = VerificationMeta('chatId');
  @override
  late final GeneratedColumn<String> chatId = GeneratedColumn<String>(
    'chat_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _bodyMeta = VerificationMeta('body');
  @override
  late final GeneratedColumn<String> body = GeneratedColumn<String>(
    'body',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _queuedAtMeta = VerificationMeta('queuedAt');
  @override
  late final GeneratedColumn<int> queuedAt = GeneratedColumn<int>(
    'queued_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );

  static const VerificationMeta _attemptCountMeta =
      VerificationMeta('attemptCount');
  @override
  late final GeneratedColumn<int> attemptCount = GeneratedColumn<int>(
    'attempt_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );

  @override
  List<GeneratedColumn> get $columns =>
      [id, chatId, body, queuedAt, attemptCount];

  @override
  String get aliasedName => _alias ?? actualTableName;

  @override
  String get actualTableName => $name;

  static const String $name = 'db_outbox_messages';

  @override
  VerificationContext validateIntegrity(
    Insertable<DbOutboxMessage> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('chat_id')) {
      context.handle(_chatIdMeta,
          chatId.isAcceptableOrUnknown(data['chat_id']!, _chatIdMeta));
    } else if (isInserting) {
      context.missing(_chatIdMeta);
    }
    if (data.containsKey('body')) {
      context.handle(
          _bodyMeta, body.isAcceptableOrUnknown(data['body']!, _bodyMeta));
    } else if (isInserting) {
      context.missing(_bodyMeta);
    }
    if (data.containsKey('queued_at')) {
      context.handle(_queuedAtMeta,
          queuedAt.isAcceptableOrUnknown(data['queued_at']!, _queuedAtMeta));
    } else if (isInserting) {
      context.missing(_queuedAtMeta);
    }
    if (data.containsKey('attempt_count')) {
      context.handle(
          _attemptCountMeta,
          attemptCount.isAcceptableOrUnknown(
              data['attempt_count']!, _attemptCountMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};

  @override
  DbOutboxMessage map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DbOutboxMessage(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      chatId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}chat_id'])!,
      body: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}body'])!,
      queuedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}queued_at'])!,
      attemptCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}attempt_count'])!,
    );
  }

  @override
  $DbOutboxMessagesTable createAlias(String alias) {
    return $DbOutboxMessagesTable(attachedDatabase, alias);
  }
}

// ── _$AppDatabase ─────────────────────────────────────────────────────────────

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);

  late final $DbChatThreadsTable dbChatThreads = $DbChatThreadsTable(this);
  late final $DbChatMessagesTable dbChatMessages = $DbChatMessagesTable(this);
  late final $DbOutboxMessagesTable dbOutboxMessages =
      $DbOutboxMessagesTable(this);

  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();

  @override
  List<DatabaseSchemaEntity> get allSchemaEntities =>
      [dbChatThreads, dbChatMessages, dbOutboxMessages];
}
