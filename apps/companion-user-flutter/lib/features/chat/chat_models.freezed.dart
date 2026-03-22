// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'chat_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ChatThreadSummary {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;

  /// Always empty string on list fetch; populated on detail fetch.
  String get lastMessage => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  int get unreadCount => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  String? get channel => throw _privateConstructorUsedError;
  int get messageCount => throw _privateConstructorUsedError;
  bool get isPinned => throw _privateConstructorUsedError;

  /// Client-side archive flag (not persisted to server).
  bool get isArchived => throw _privateConstructorUsedError;

  /// Client-side tag (not persisted to server — stored in AppState).
  String? get tag => throw _privateConstructorUsedError;

  /// Create a copy of ChatThreadSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChatThreadSummaryCopyWith<ChatThreadSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChatThreadSummaryCopyWith<$Res> {
  factory $ChatThreadSummaryCopyWith(
          ChatThreadSummary value, $Res Function(ChatThreadSummary) then) =
      _$ChatThreadSummaryCopyWithImpl<$Res, ChatThreadSummary>;
  @useResult
  $Res call(
      {String id,
      String title,
      String lastMessage,
      DateTime updatedAt,
      int unreadCount,
      String type,
      String? channel,
      int messageCount,
      bool isPinned,
      bool isArchived,
      String? tag});
}

/// @nodoc
class _$ChatThreadSummaryCopyWithImpl<$Res, $Val extends ChatThreadSummary>
    implements $ChatThreadSummaryCopyWith<$Res> {
  _$ChatThreadSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChatThreadSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? lastMessage = null,
    Object? updatedAt = null,
    Object? unreadCount = null,
    Object? type = null,
    Object? channel = freezed,
    Object? messageCount = null,
    Object? isPinned = null,
    Object? isArchived = null,
    Object? tag = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      lastMessage: null == lastMessage
          ? _value.lastMessage
          : lastMessage // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      unreadCount: null == unreadCount
          ? _value.unreadCount
          : unreadCount // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      channel: freezed == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String?,
      messageCount: null == messageCount
          ? _value.messageCount
          : messageCount // ignore: cast_nullable_to_non_nullable
              as int,
      isPinned: null == isPinned
          ? _value.isPinned
          : isPinned // ignore: cast_nullable_to_non_nullable
              as bool,
      isArchived: null == isArchived
          ? _value.isArchived
          : isArchived // ignore: cast_nullable_to_non_nullable
              as bool,
      tag: freezed == tag
          ? _value.tag
          : tag // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChatThreadSummaryImplCopyWith<$Res>
    implements $ChatThreadSummaryCopyWith<$Res> {
  factory _$$ChatThreadSummaryImplCopyWith(_$ChatThreadSummaryImpl value,
          $Res Function(_$ChatThreadSummaryImpl) then) =
      __$$ChatThreadSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String lastMessage,
      DateTime updatedAt,
      int unreadCount,
      String type,
      String? channel,
      int messageCount,
      bool isPinned,
      bool isArchived,
      String? tag});
}

/// @nodoc
class __$$ChatThreadSummaryImplCopyWithImpl<$Res>
    extends _$ChatThreadSummaryCopyWithImpl<$Res, _$ChatThreadSummaryImpl>
    implements _$$ChatThreadSummaryImplCopyWith<$Res> {
  __$$ChatThreadSummaryImplCopyWithImpl(_$ChatThreadSummaryImpl _value,
      $Res Function(_$ChatThreadSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of ChatThreadSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? lastMessage = null,
    Object? updatedAt = null,
    Object? unreadCount = null,
    Object? type = null,
    Object? channel = freezed,
    Object? messageCount = null,
    Object? isPinned = null,
    Object? isArchived = null,
    Object? tag = freezed,
  }) {
    return _then(_$ChatThreadSummaryImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      lastMessage: null == lastMessage
          ? _value.lastMessage
          : lastMessage // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      unreadCount: null == unreadCount
          ? _value.unreadCount
          : unreadCount // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      channel: freezed == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String?,
      messageCount: null == messageCount
          ? _value.messageCount
          : messageCount // ignore: cast_nullable_to_non_nullable
              as int,
      isPinned: null == isPinned
          ? _value.isPinned
          : isPinned // ignore: cast_nullable_to_non_nullable
              as bool,
      isArchived: null == isArchived
          ? _value.isArchived
          : isArchived // ignore: cast_nullable_to_non_nullable
              as bool,
      tag: freezed == tag
          ? _value.tag
          : tag // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$ChatThreadSummaryImpl implements _ChatThreadSummary {
  const _$ChatThreadSummaryImpl(
      {required this.id,
      required this.title,
      required this.lastMessage,
      required this.updatedAt,
      this.unreadCount = 0,
      this.type = 'dm',
      this.channel,
      this.messageCount = 0,
      this.isPinned = false,
      this.isArchived = false,
      this.tag});

  @override
  final String id;
  @override
  final String title;

  /// Always empty string on list fetch; populated on detail fetch.
  @override
  final String lastMessage;
  @override
  final DateTime updatedAt;
  @override
  @JsonKey()
  final int unreadCount;
  @override
  @JsonKey()
  final String type;
  @override
  final String? channel;
  @override
  @JsonKey()
  final int messageCount;
  @override
  @JsonKey()
  final bool isPinned;

  /// Client-side archive flag (not persisted to server).
  @override
  @JsonKey()
  final bool isArchived;

  /// Client-side tag (not persisted to server — stored in AppState).
  @override
  final String? tag;

  @override
  String toString() {
    return 'ChatThreadSummary(id: $id, title: $title, lastMessage: $lastMessage, updatedAt: $updatedAt, unreadCount: $unreadCount, type: $type, channel: $channel, messageCount: $messageCount, isPinned: $isPinned, isArchived: $isArchived, tag: $tag)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChatThreadSummaryImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.lastMessage, lastMessage) ||
                other.lastMessage == lastMessage) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.unreadCount, unreadCount) ||
                other.unreadCount == unreadCount) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.messageCount, messageCount) ||
                other.messageCount == messageCount) &&
            (identical(other.isPinned, isPinned) ||
                other.isPinned == isPinned) &&
            (identical(other.isArchived, isArchived) ||
                other.isArchived == isArchived) &&
            (identical(other.tag, tag) || other.tag == tag));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
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
      tag);

  /// Create a copy of ChatThreadSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChatThreadSummaryImplCopyWith<_$ChatThreadSummaryImpl> get copyWith =>
      __$$ChatThreadSummaryImplCopyWithImpl<_$ChatThreadSummaryImpl>(
          this, _$identity);
}

abstract class _ChatThreadSummary implements ChatThreadSummary {
  const factory _ChatThreadSummary(
      {required final String id,
      required final String title,
      required final String lastMessage,
      required final DateTime updatedAt,
      final int unreadCount,
      final String type,
      final String? channel,
      final int messageCount,
      final bool isPinned,
      final bool isArchived,
      final String? tag}) = _$ChatThreadSummaryImpl;

  @override
  String get id;
  @override
  String get title;

  /// Always empty string on list fetch; populated on detail fetch.
  @override
  String get lastMessage;
  @override
  DateTime get updatedAt;
  @override
  int get unreadCount;
  @override
  String get type;
  @override
  String? get channel;
  @override
  int get messageCount;
  @override
  bool get isPinned;

  /// Client-side archive flag (not persisted to server).
  @override
  bool get isArchived;

  /// Client-side tag (not persisted to server — stored in AppState).
  @override
  String? get tag;

  /// Create a copy of ChatThreadSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChatThreadSummaryImplCopyWith<_$ChatThreadSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ChatMessage _$ChatMessageFromJson(Map<String, dynamic> json) {
  return _ChatMessage.fromJson(json);
}

/// @nodoc
mixin _$ChatMessage {
  String get id => throw _privateConstructorUsedError;
  String get role => throw _privateConstructorUsedError;
  String get text => throw _privateConstructorUsedError;

  /// Mapped from JSON key `created_at`; defaults to [DateTime.now] when absent.
  @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
  DateTime get timestamp => throw _privateConstructorUsedError;
  ChatMessageStatus get status => throw _privateConstructorUsedError;
  @JsonKey(name: 'sender_name')
  String? get senderName => throw _privateConstructorUsedError;
  @JsonKey(name: 'content_type')
  String get contentType => throw _privateConstructorUsedError;
  @JsonKey(name: 'blocks')
  List<dynamic>? get blocks => throw _privateConstructorUsedError;
  @JsonKey(name: 'chat_id')
  String? get chatId => throw _privateConstructorUsedError;
  @JsonKey(name: 'queue_id')
  String? get queueId => throw _privateConstructorUsedError;
  @JsonKey(name: 'queue_position')
  int? get queuePosition => throw _privateConstructorUsedError;

  /// Set to true when the user edited and re-sent this message.
  bool get isEdited => throw _privateConstructorUsedError;

  /// Serializes this ChatMessage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChatMessageCopyWith<ChatMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChatMessageCopyWith<$Res> {
  factory $ChatMessageCopyWith(
          ChatMessage value, $Res Function(ChatMessage) then) =
      _$ChatMessageCopyWithImpl<$Res, ChatMessage>;
  @useResult
  $Res call(
      {String id,
      String role,
      String text,
      @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
      DateTime timestamp,
      ChatMessageStatus status,
      @JsonKey(name: 'sender_name') String? senderName,
      @JsonKey(name: 'content_type') String contentType,
      @JsonKey(name: 'blocks') List<dynamic>? blocks,
      @JsonKey(name: 'chat_id') String? chatId,
      @JsonKey(name: 'queue_id') String? queueId,
      @JsonKey(name: 'queue_position') int? queuePosition,
      bool isEdited});
}

/// @nodoc
class _$ChatMessageCopyWithImpl<$Res, $Val extends ChatMessage>
    implements $ChatMessageCopyWith<$Res> {
  _$ChatMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? role = null,
    Object? text = null,
    Object? timestamp = null,
    Object? status = null,
    Object? senderName = freezed,
    Object? contentType = null,
    Object? blocks = freezed,
    Object? chatId = freezed,
    Object? queueId = freezed,
    Object? queuePosition = freezed,
    Object? isEdited = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String,
      text: null == text
          ? _value.text
          : text // ignore: cast_nullable_to_non_nullable
              as String,
      timestamp: null == timestamp
          ? _value.timestamp
          : timestamp // ignore: cast_nullable_to_non_nullable
              as DateTime,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as ChatMessageStatus,
      senderName: freezed == senderName
          ? _value.senderName
          : senderName // ignore: cast_nullable_to_non_nullable
              as String?,
      contentType: null == contentType
          ? _value.contentType
          : contentType // ignore: cast_nullable_to_non_nullable
              as String,
      blocks: freezed == blocks
          ? _value.blocks
          : blocks // ignore: cast_nullable_to_non_nullable
              as List<dynamic>?,
      chatId: freezed == chatId
          ? _value.chatId
          : chatId // ignore: cast_nullable_to_non_nullable
              as String?,
      queueId: freezed == queueId
          ? _value.queueId
          : queueId // ignore: cast_nullable_to_non_nullable
              as String?,
      queuePosition: freezed == queuePosition
          ? _value.queuePosition
          : queuePosition // ignore: cast_nullable_to_non_nullable
              as int?,
      isEdited: null == isEdited
          ? _value.isEdited
          : isEdited // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChatMessageImplCopyWith<$Res>
    implements $ChatMessageCopyWith<$Res> {
  factory _$$ChatMessageImplCopyWith(
          _$ChatMessageImpl value, $Res Function(_$ChatMessageImpl) then) =
      __$$ChatMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String role,
      String text,
      @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
      DateTime timestamp,
      ChatMessageStatus status,
      @JsonKey(name: 'sender_name') String? senderName,
      @JsonKey(name: 'content_type') String contentType,
      @JsonKey(name: 'blocks') List<dynamic>? blocks,
      @JsonKey(name: 'chat_id') String? chatId,
      @JsonKey(name: 'queue_id') String? queueId,
      @JsonKey(name: 'queue_position') int? queuePosition,
      bool isEdited});
}

/// @nodoc
class __$$ChatMessageImplCopyWithImpl<$Res>
    extends _$ChatMessageCopyWithImpl<$Res, _$ChatMessageImpl>
    implements _$$ChatMessageImplCopyWith<$Res> {
  __$$ChatMessageImplCopyWithImpl(
      _$ChatMessageImpl _value, $Res Function(_$ChatMessageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? role = null,
    Object? text = null,
    Object? timestamp = null,
    Object? status = null,
    Object? senderName = freezed,
    Object? contentType = null,
    Object? blocks = freezed,
    Object? chatId = freezed,
    Object? queueId = freezed,
    Object? queuePosition = freezed,
    Object? isEdited = null,
  }) {
    return _then(_$ChatMessageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String,
      text: null == text
          ? _value.text
          : text // ignore: cast_nullable_to_non_nullable
              as String,
      timestamp: null == timestamp
          ? _value.timestamp
          : timestamp // ignore: cast_nullable_to_non_nullable
              as DateTime,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as ChatMessageStatus,
      senderName: freezed == senderName
          ? _value.senderName
          : senderName // ignore: cast_nullable_to_non_nullable
              as String?,
      contentType: null == contentType
          ? _value.contentType
          : contentType // ignore: cast_nullable_to_non_nullable
              as String,
      blocks: freezed == blocks
          ? _value._blocks
          : blocks // ignore: cast_nullable_to_non_nullable
              as List<dynamic>?,
      chatId: freezed == chatId
          ? _value.chatId
          : chatId // ignore: cast_nullable_to_non_nullable
              as String?,
      queueId: freezed == queueId
          ? _value.queueId
          : queueId // ignore: cast_nullable_to_non_nullable
              as String?,
      queuePosition: freezed == queuePosition
          ? _value.queuePosition
          : queuePosition // ignore: cast_nullable_to_non_nullable
              as int?,
      isEdited: null == isEdited
          ? _value.isEdited
          : isEdited // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ChatMessageImpl implements _ChatMessage {
  const _$ChatMessageImpl(
      {required this.id,
      required this.role,
      required this.text,
      @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
      required this.timestamp,
      this.status = ChatMessageStatus.sent,
      @JsonKey(name: 'sender_name') this.senderName,
      @JsonKey(name: 'content_type') this.contentType = 'text',
      @JsonKey(name: 'blocks') final List<dynamic>? blocks,
      @JsonKey(name: 'chat_id') this.chatId,
      @JsonKey(name: 'queue_id') this.queueId,
      @JsonKey(name: 'queue_position') this.queuePosition,
      this.isEdited = false})
      : _blocks = blocks;

  factory _$ChatMessageImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChatMessageImplFromJson(json);

  @override
  final String id;
  @override
  final String role;
  @override
  final String text;

  /// Mapped from JSON key `created_at`; defaults to [DateTime.now] when absent.
  @override
  @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
  final DateTime timestamp;
  @override
  @JsonKey()
  final ChatMessageStatus status;
  @override
  @JsonKey(name: 'sender_name')
  final String? senderName;
  @override
  @JsonKey(name: 'content_type')
  final String contentType;
  final List<dynamic>? _blocks;
  @override
  @JsonKey(name: 'blocks')
  List<dynamic>? get blocks {
    final value = _blocks;
    if (value == null) return null;
    if (_blocks is EqualUnmodifiableListView) return _blocks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: 'chat_id')
  final String? chatId;
  @override
  @JsonKey(name: 'queue_id')
  final String? queueId;
  @override
  @JsonKey(name: 'queue_position')
  final int? queuePosition;

  /// Set to true when the user edited and re-sent this message.
  @override
  @JsonKey()
  final bool isEdited;

  @override
  String toString() {
    return 'ChatMessage(id: $id, role: $role, text: $text, timestamp: $timestamp, status: $status, senderName: $senderName, contentType: $contentType, blocks: $blocks, chatId: $chatId, queueId: $queueId, queuePosition: $queuePosition, isEdited: $isEdited)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChatMessageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.text, text) || other.text == text) &&
            (identical(other.timestamp, timestamp) ||
                other.timestamp == timestamp) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.senderName, senderName) ||
                other.senderName == senderName) &&
            (identical(other.contentType, contentType) ||
                other.contentType == contentType) &&
            const DeepCollectionEquality().equals(other._blocks, _blocks) &&
            (identical(other.chatId, chatId) || other.chatId == chatId) &&
            (identical(other.queueId, queueId) || other.queueId == queueId) &&
            (identical(other.queuePosition, queuePosition) ||
                other.queuePosition == queuePosition) &&
            (identical(other.isEdited, isEdited) ||
                other.isEdited == isEdited));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      role,
      text,
      timestamp,
      status,
      senderName,
      contentType,
      const DeepCollectionEquality().hash(_blocks),
      chatId,
      queueId,
      queuePosition,
      isEdited);

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChatMessageImplCopyWith<_$ChatMessageImpl> get copyWith =>
      __$$ChatMessageImplCopyWithImpl<_$ChatMessageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ChatMessageImplToJson(
      this,
    );
  }
}

abstract class _ChatMessage implements ChatMessage {
  const factory _ChatMessage(
      {required final String id,
      required final String role,
      required final String text,
      @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
      required final DateTime timestamp,
      final ChatMessageStatus status,
      @JsonKey(name: 'sender_name') final String? senderName,
      @JsonKey(name: 'content_type') final String contentType,
      @JsonKey(name: 'blocks') final List<dynamic>? blocks,
      @JsonKey(name: 'chat_id') final String? chatId,
      @JsonKey(name: 'queue_id') final String? queueId,
      @JsonKey(name: 'queue_position') final int? queuePosition,
      final bool isEdited}) = _$ChatMessageImpl;

  factory _ChatMessage.fromJson(Map<String, dynamic> json) =
      _$ChatMessageImpl.fromJson;

  @override
  String get id;
  @override
  String get role;
  @override
  String get text;

  /// Mapped from JSON key `created_at`; defaults to [DateTime.now] when absent.
  @override
  @JsonKey(name: 'created_at', fromJson: _parseNullableDateTime)
  DateTime get timestamp;
  @override
  ChatMessageStatus get status;
  @override
  @JsonKey(name: 'sender_name')
  String? get senderName;
  @override
  @JsonKey(name: 'content_type')
  String get contentType;
  @override
  @JsonKey(name: 'blocks')
  List<dynamic>? get blocks;
  @override
  @JsonKey(name: 'chat_id')
  String? get chatId;
  @override
  @JsonKey(name: 'queue_id')
  String? get queueId;
  @override
  @JsonKey(name: 'queue_position')
  int? get queuePosition;

  /// Set to true when the user edited and re-sent this message.
  @override
  bool get isEdited;

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChatMessageImplCopyWith<_$ChatMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
