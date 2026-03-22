// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChatMessageImpl _$$ChatMessageImplFromJson(Map<String, dynamic> json) =>
    _$ChatMessageImpl(
      id: json['id'] as String,
      role: json['role'] as String,
      text: json['text'] as String,
      timestamp: _parseNullableDateTime(json['created_at']),
      status: $enumDecodeNullable(_$ChatMessageStatusEnumMap, json['status']) ??
          ChatMessageStatus.sent,
      senderName: json['sender_name'] as String?,
      contentType: json['content_type'] as String? ?? 'text',
      blocks: json['blocks'] as List<dynamic>?,
      chatId: json['chat_id'] as String?,
      queueId: json['queue_id'] as String?,
      queuePosition: (json['queue_position'] as num?)?.toInt(),
      isEdited: json['isEdited'] as bool? ?? false,
    );

Map<String, dynamic> _$$ChatMessageImplToJson(_$ChatMessageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'role': instance.role,
      'text': instance.text,
      'created_at': instance.timestamp.toIso8601String(),
      'status': _$ChatMessageStatusEnumMap[instance.status]!,
      'sender_name': instance.senderName,
      'content_type': instance.contentType,
      'blocks': instance.blocks,
      'chat_id': instance.chatId,
      'queue_id': instance.queueId,
      'queue_position': instance.queuePosition,
      'isEdited': instance.isEdited,
    };

const _$ChatMessageStatusEnumMap = {
  ChatMessageStatus.sending: 'sending',
  ChatMessageStatus.sent: 'sent',
  ChatMessageStatus.failed: 'failed',
  ChatMessageStatus.queued: 'queued',
  ChatMessageStatus.streaming: 'streaming',
};
