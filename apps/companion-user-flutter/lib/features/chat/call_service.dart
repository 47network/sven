import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Service for initiating, joining, and managing WebRTC voice/video calls.
///
/// Signaling is handled via the Sven server (REST + SSE), not peer-to-peer.
/// The actual WebRTC media negotiation (offer/answer/ICE) runs client-side.
class CallService {
  CallService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  // ── Call Management ────────────────────────────────────────

  /// Initiate a new call in a chat.
  Future<CallStartResult?> startCall(String chatId,
      {String type = 'voice'}) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/calls'),
      {'chat_id': chatId, 'call_type': type},
    );
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
      return CallStartResult.fromJson(data);
    }
    if (response.statusCode == 409) {
      // Call already in progress — return existing call info
      final data = jsonDecode(response.body)['data'] as Map<String, dynamic>?;
      if (data != null) {
        return CallStartResult(
            callId: data['call_id'] as String, iceServers: []);
      }
    }
    return null;
  }

  /// Join an active/ringing call.
  Future<CallJoinResult?> joinCall(String callId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/calls/$callId/join'),
      {},
    );
    if (response.statusCode != 200) return null;
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    return CallJoinResult.fromJson(data);
  }

  /// Send a WebRTC signal (offer, answer, ICE candidate) to another participant.
  Future<bool> sendSignal({
    required String callId,
    required String targetUserId,
    required String type,
    String? sdp,
    Map<String, dynamic>? candidate,
  }) async {
    final base = ApiBaseService.currentSync();
    final body = <String, dynamic>{
      'type': type,
      'target_user_id': targetUserId,
    };
    if (sdp != null) body['sdp'] = sdp;
    if (candidate != null) body['candidate'] = candidate;

    final response = await _client.postJson(
      Uri.parse('$base/v1/calls/$callId/signal'),
      body,
    );
    return response.statusCode == 200;
  }

  /// Update local media state (mute/unmute audio, video, screen share).
  Future<bool> updateMediaState(
    String callId, {
    bool? audio,
    bool? video,
    bool? screen,
  }) async {
    final base = ApiBaseService.currentSync();
    final body = <String, dynamic>{};
    if (audio != null) body['audio'] = audio;
    if (video != null) body['video'] = video;
    if (screen != null) body['screen'] = screen;

    final response = await _client.patchJson(
      Uri.parse('$base/v1/calls/$callId/media'),
      body,
    );
    return response.statusCode == 200;
  }

  /// Leave the call.
  Future<bool> leaveCall(String callId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/calls/$callId/leave'),
      {},
    );
    return response.statusCode == 200;
  }

  /// Decline an incoming call.
  Future<bool> declineCall(String callId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/calls/$callId/decline'),
      {},
    );
    return response.statusCode == 200;
  }

  /// Get active calls in a chat.
  Future<List<ActiveCall>> getActiveCalls(String chatId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.get(
      Uri.parse('$base/v1/chats/$chatId/calls'),
    );
    if (response.statusCode != 200) return [];
    final calls = jsonDecode(response.body)['data']['calls'] as List;
    return calls
        .map((c) => ActiveCall.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  /// Get ICE server configuration.
  Future<List<IceServer>> getIceConfig() async {
    final base = ApiBaseService.currentSync();
    final response = await _client.get(Uri.parse('$base/v1/calls/ice-config'));
    if (response.statusCode != 200) return [];
    final servers = jsonDecode(response.body)['data']['ice_servers'] as List;
    return servers
        .map((s) => IceServer.fromJson(s as Map<String, dynamic>))
        .toList();
  }
}

// ── Models ─────────────────────────────────────────────────────

class IceServer {
  const IceServer({required this.urls, this.username, this.credential});
  final List<String> urls;
  final String? username;
  final String? credential;

  factory IceServer.fromJson(Map<String, dynamic> json) => IceServer(
        urls: (json['urls'] as List?)?.cast<String>() ?? [],
        username: json['username'] as String?,
        credential: json['credential'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'urls': urls,
        if (username != null) 'username': username,
        if (credential != null) 'credential': credential,
      };
}

class CallStartResult {
  const CallStartResult(
      {required this.callId,
      required this.iceServers,
      this.callType,
      this.status});
  final String callId;
  final List<IceServer> iceServers;
  final String? callType;
  final String? status;

  factory CallStartResult.fromJson(Map<String, dynamic> json) =>
      CallStartResult(
        callId: json['call_id'] as String? ?? '',
        callType: json['call_type'] as String?,
        status: json['status'] as String?,
        iceServers: (json['ice_servers'] as List?)
                ?.map((s) => IceServer.fromJson(s as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class CallJoinResult {
  const CallJoinResult(
      {required this.callId,
      required this.participants,
      required this.iceServers});
  final String callId;
  final List<CallParticipant> participants;
  final List<IceServer> iceServers;

  factory CallJoinResult.fromJson(Map<String, dynamic> json) => CallJoinResult(
        callId: json['call_id'] as String? ?? '',
        participants: (json['participants'] as List?)
                ?.map(
                    (p) => CallParticipant.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
        iceServers: (json['ice_servers'] as List?)
                ?.map((s) => IceServer.fromJson(s as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class CallParticipant {
  const CallParticipant(
      {required this.userId,
      required this.status,
      this.displayName,
      this.mediaState});
  final String userId;
  final String status;
  final String? displayName;
  final Map<String, dynamic>? mediaState;

  factory CallParticipant.fromJson(Map<String, dynamic> json) =>
      CallParticipant(
        userId: json['user_id'] as String? ?? '',
        status: json['status'] as String? ?? '',
        displayName: json['display_name'] as String?,
        mediaState: json['media_state'] as Map<String, dynamic>?,
      );
}

class ActiveCall {
  const ActiveCall(
      {required this.id,
      required this.callType,
      required this.status,
      this.participantCount = 0});
  final String id;
  final String callType;
  final String status;
  final int participantCount;

  factory ActiveCall.fromJson(Map<String, dynamic> json) => ActiveCall(
        id: json['id'] as String? ?? '',
        callType: json['call_type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        participantCount: json['participant_count'] as int? ?? 0,
      );
}
