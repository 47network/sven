class DeepLinkTarget {
  const DeepLinkTarget._(this.kind, {this.chatId, this.gatewayUrl});

  final String kind;
  final String? chatId;
  final String? gatewayUrl;

  static DeepLinkTarget approvals() => const DeepLinkTarget._('approvals');
  static DeepLinkTarget home() => const DeepLinkTarget._('home');
  static DeepLinkTarget widgetVoice() => const DeepLinkTarget._('widget_voice');
  static DeepLinkTarget gatewayConnect(String url) =>
      DeepLinkTarget._('gateway_connect', gatewayUrl: url);

  static DeepLinkTarget chat(String id) => DeepLinkTarget._('chat', chatId: id);
}

DeepLinkTarget? parseDeepLink(Uri uri) {
  // Custom-scheme links like `sven://approvals` put route in `host`,
  // while links like `sven://chat/123` split host/path.
  final segments = <String>[
    if (uri.host.isNotEmpty) uri.host,
    ...uri.pathSegments,
  ];
  if (segments.isEmpty) return null;

  if (segments.first == 'approvals') {
    return DeepLinkTarget.approvals();
  }

  if (segments.first == 'widget') {
    if (segments.length >= 2 && segments[1] == 'voice') {
      return DeepLinkTarget.widgetVoice();
    }
    return DeepLinkTarget.home();
  }

  if (segments.first == 'chat' && segments.length >= 2) {
    return DeepLinkTarget.chat(segments[1]);
  }

  if (segments.first == 'gateway' &&
      segments.length >= 2 &&
      segments[1] == 'connect') {
    final url = uri.queryParameters['url']?.trim() ?? '';
    final parsed = Uri.tryParse(url);
    if (parsed != null && (parsed.isScheme('http') || parsed.isScheme('https'))) {
      return DeepLinkTarget.gatewayConnect(url);
    }
    return null;
  }

  return null;
}
