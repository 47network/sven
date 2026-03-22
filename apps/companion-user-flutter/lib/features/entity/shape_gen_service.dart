// ═══════════════════════════════════════════════════════════════════════════
// ShapeGenService — asks the local LLM to generate a CustomShapeSpec
// from a natural-language description like "a crystal dragon" or "a neon cat"
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../config/env_config.dart';
import 'custom_shape_spec.dart';

class ShapeGenService {
  ShapeGenService({required AuthenticatedClient client}) : _client = client;

  static final _apiBase = EnvConfig.apiBase;

  final AuthenticatedClient _client;

  /// System prompt that instructs the LLM to return only valid JSON.
  static const _systemPrompt = '''
You are a shape generator for an animated avatar system.
Given a user description, output ONLY a JSON object (no markdown, no explanation) with these exact fields:

{
  "name": "<short name for the entity, 1-2 words>",
  "description": "<one-line poetic description>",
  "body_type": "<one of: sphere, bipedal, quadruped, serpentine, amorphous, crystalline, geometric, avian>",
  "body_segments": <1-5>,
  "limb_count": <0-8>,
  "has_wings": <true/false>,
  "has_tail": <true/false>,
  "has_horns": <true/false>,
  "has_antennae": <true/false>,
  "eye_count": <0-6>,
  "eye_shape": "<one of: round, slit, compound, visor, diamond>",
  "extra_features": ["<feature1>", "<feature2>"],
  "primary_hue": <0-360>,
  "secondary_hue": <0-360>,
  "glow_intensity": <0.0-1.0>,
  "symmetry": <1-6>,
  "spikiness": <0.0-1.0>,
  "roundness": <0.0-1.0>,
  "pattern_type": "<one of: none, stripes, spots, circuits, hexgrid, fractal>",
  "aura_style": "<one of: glow, fire, electric, frost, shadow, holy>",
  "icon": "<single emoji that best represents this form>",
  "traits": ["<trait1>", "<trait2>", "<trait3>"]
}

Be creative with the hues and features. Match the spirit of the user's description.
Output ONLY the JSON object, nothing else.''';

  /// Generate a [CustomShapeSpec] from a user-provided description.
  /// Uses the Sven gateway `/v1/chats` endpoint to create a one-shot chat
  /// and extract the LLM's structured response.
  Future<CustomShapeSpec> generate(String userDescription) async {
    // We use the internal completion endpoint
    final uri = Uri.parse('$_apiBase/v1/complete');
    final response = await _client.postJson(uri, {
      'messages': [
        {'role': 'system', 'content': _systemPrompt},
        {
          'role': 'user',
          'content':
              'Generate a shape for: $userDescription\n\nOutput only valid JSON.'
        },
      ],
      'temperature': 0.8,
      'max_tokens': 600,
    });

    if (response.statusCode != 200) {
      // Fallback: try the chat endpoint with a transient chat
      return _fallbackGenerate(userDescription);
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final content = _extractContent(body);
    return _parseSpec(content, userDescription);
  }

  /// Fallback: create a temporary chat and use the normal chat endpoint.
  Future<CustomShapeSpec> _fallbackGenerate(String description) async {
    // Create a one-off chat
    final createUri = Uri.parse('$_apiBase/v1/chats');
    final createResp = await _client.postJson(createUri, {
      'title': 'Shape Generation',
    });

    if (createResp.statusCode != 200 && createResp.statusCode != 201) {
      // Last resort: return a spec derived from the description heuristically
      return _heuristicGenerate(description);
    }

    final chatBody = jsonDecode(createResp.body) as Map<String, dynamic>;
    final chatId = (chatBody['data'] as Map<String, dynamic>?)?['id'] ??
        chatBody['id'] ??
        '';

    if (chatId == '') return _heuristicGenerate(description);

    // Send the shape generation prompt
    final msgUri = Uri.parse('$_apiBase/v1/chats/$chatId/messages');
    final msgResp = await _client.postJson(msgUri, {
      'content':
          '$_systemPrompt\n\nUser request: $description\n\nOutput ONLY the JSON.',
      'role': 'user',
    });

    if (msgResp.statusCode != 200) {
      return _heuristicGenerate(description);
    }

    final msgBody = jsonDecode(msgResp.body) as Map<String, dynamic>;
    final content = _extractContent(msgBody);

    // Cleanup: delete the temporary chat (fire and forget)
    try {
      await _client.delete(Uri.parse('$_apiBase/v1/chats/$chatId'));
    } catch (_) {}

    return _parseSpec(content, description);
  }

  /// Extract the assistant's text content from API response.
  String _extractContent(Map<String, dynamic> body) {
    // Try common response shapes
    final data = body['data'];
    if (data is Map<String, dynamic>) {
      return (data['content'] as String?) ??
          (data['text'] as String?) ??
          (data['message'] as String?) ??
          '';
    }
    if (data is String) return data;
    return (body['content'] as String?) ??
        (body['text'] as String?) ??
        (body['message'] as String?) ??
        '';
  }

  /// Parse JSON from the LLM's response text.
  CustomShapeSpec _parseSpec(String content, String description) {
    // Find JSON object in the response
    final trimmed = content.trim();
    var jsonStr = trimmed;

    // Strip markdown code fences if present
    if (jsonStr.contains('```')) {
      final match = RegExp(r'```(?:json)?\s*([\s\S]*?)```').firstMatch(jsonStr);
      if (match != null) jsonStr = match.group(1)!.trim();
    }

    // Find first { and last }
    final start = jsonStr.indexOf('{');
    final end = jsonStr.lastIndexOf('}');
    if (start >= 0 && end > start) {
      jsonStr = jsonStr.substring(start, end + 1);
    }

    try {
      final parsed = jsonDecode(jsonStr) as Map<String, dynamic>;
      return CustomShapeSpec.fromJson(parsed);
    } catch (_) {
      // If parsing fails, use heuristic
      return _heuristicGenerate(description);
    }
  }

  /// Heuristic fallback: derive shape params from keywords in the description.
  /// This works even without any LLM connection.
  CustomShapeSpec _heuristicGenerate(String description) {
    final d = description.toLowerCase();

    // Body type detection
    String bodyType = 'sphere';
    int limbs = 0;
    int segments = 1;
    bool wings = false, tail = false, horns = false, antennae = false;
    int eyes = 2;
    String eyeShape = 'round';
    double spikiness = 0.3, roundness = 0.6;
    double primaryHue = 200, secondaryHue = 280;
    String pattern = 'none';
    String aura = 'glow';
    String icon = '🔮';
    List<String> traits = ['Unique', 'Custom', 'Yours'];
    List<String> features = [];

    // Dragon-like
    if (d.contains('dragon') || d.contains('draco') || d.contains('wyrm')) {
      bodyType = 'quadruped';
      limbs = 4;
      segments = 3;
      wings = true;
      tail = true;
      horns = true;
      eyes = 2;
      eyeShape = 'slit';
      spikiness = 0.8;
      roundness = 0.2;
      primaryHue = 15;
      secondaryHue = 45;
      pattern = 'stripes';
      aura = 'fire';
      icon = '🐉';
      traits = ['Majestic', 'Fierce', 'Ancient'];
      features = ['scales', 'flames'];
    }
    // Cat-like
    else if (d.contains('cat') ||
        d.contains('feline') ||
        d.contains('panther')) {
      bodyType = 'quadruped';
      limbs = 4;
      segments = 2;
      tail = true;
      eyes = 2;
      eyeShape = 'slit';
      spikiness = 0.1;
      roundness = 0.7;
      primaryHue = 270;
      secondaryHue = 320;
      pattern = 'stripes';
      aura = 'shadow';
      icon = '🐱';
      traits = ['Agile', 'Mysterious', 'Silent'];
      features = ['whiskers'];
    }
    // Bird / phoenix
    else if (d.contains('bird') ||
        d.contains('phoenix') ||
        d.contains('eagle') ||
        d.contains('hawk')) {
      bodyType = 'avian';
      limbs = 2;
      segments = 2;
      wings = true;
      tail = true;
      eyes = 2;
      eyeShape = 'round';
      spikiness = 0.4;
      roundness = 0.5;
      primaryHue = 30;
      secondaryHue = 60;
      pattern = 'none';
      aura = 'fire';
      icon = '🦅';
      traits = ['Soaring', 'Free', 'Radiant'];
      features = ['feathers'];
    }
    // Crystal / gem
    else if (d.contains('crystal') ||
        d.contains('gem') ||
        d.contains('diamond') ||
        d.contains('prism')) {
      bodyType = 'crystalline';
      limbs = 0;
      segments = 1;
      eyes = 1;
      eyeShape = 'diamond';
      spikiness = 0.9;
      roundness = 0.1;
      primaryHue = 180;
      secondaryHue = 240;
      pattern = 'fractal';
      aura = 'frost';
      icon = '💎';
      traits = ['Pristine', 'Luminous', 'Eternal'];
      features = ['crystals'];
    }
    // Snake / serpent
    else if (d.contains('snake') ||
        d.contains('serpent') ||
        d.contains('viper')) {
      bodyType = 'serpentine';
      limbs = 0;
      segments = 5;
      tail = true;
      eyes = 2;
      eyeShape = 'slit';
      spikiness = 0.3;
      roundness = 0.7;
      primaryHue = 120;
      secondaryHue = 90;
      pattern = 'spots';
      aura = 'shadow';
      icon = '🐍';
      traits = ['Sinuous', 'Hypnotic', 'Swift'];
      features = ['scales'];
    }
    // Robot / mech / cyborg
    else if (d.contains('robot') ||
        d.contains('mech') ||
        d.contains('cyborg') ||
        d.contains('android')) {
      bodyType = 'bipedal';
      limbs = 4;
      segments = 3;
      antennae = true;
      eyes = 1;
      eyeShape = 'visor';
      spikiness = 0.5;
      roundness = 0.3;
      primaryHue = 210;
      secondaryHue = 180;
      pattern = 'circuits';
      aura = 'electric';
      icon = '⚙️';
      traits = ['Engineered', 'Adaptive', 'Strong'];
      features = ['circuits'];
    }
    // Ghost / spirit / wraith
    else if (d.contains('ghost') ||
        d.contains('spirit') ||
        d.contains('wraith') ||
        d.contains('phantom')) {
      bodyType = 'amorphous';
      limbs = 0;
      segments = 1;
      eyes = 2;
      eyeShape = 'round';
      spikiness = 0.2;
      roundness = 0.8;
      primaryHue = 240;
      secondaryHue = 200;
      pattern = 'none';
      aura = 'shadow';
      icon = '👻';
      traits = ['Ethereal', 'Haunting', 'Whispering'];
    }
    // Wolf / dog
    else if (d.contains('wolf') || d.contains('dog') || d.contains('hound')) {
      bodyType = 'quadruped';
      limbs = 4;
      segments = 2;
      tail = true;
      eyes = 2;
      eyeShape = 'round';
      spikiness = 0.3;
      roundness = 0.5;
      primaryHue = 220;
      secondaryHue = 270;
      pattern = 'none';
      aura = 'glow';
      icon = '🐺';
      traits = ['Loyal', 'Fierce', 'Pack'];
      features = ['fur'];
    }
    // Flower / nature / tree
    else if (d.contains('flower') ||
        d.contains('tree') ||
        d.contains('plant') ||
        d.contains('nature')) {
      bodyType = 'amorphous';
      limbs = 0;
      segments = 2;
      eyes = 0;
      spikiness = 0.1;
      roundness = 0.9;
      primaryHue = 130;
      secondaryHue = 80;
      pattern = 'fractal';
      aura = 'holy';
      icon = '🌸';
      traits = ['Serene', 'Growing', 'Rooted'];
      features = ['petals'];
    }
    // Neon prefix modifier
    if (d.contains('neon') || d.contains('cyber') || d.contains('tron')) {
      pattern = 'circuits';
      aura = 'electric';
      primaryHue = (primaryHue + 60) % 360;
    }
    // Ice / frost modifier
    if (d.contains('ice') || d.contains('frost') || d.contains('frozen')) {
      aura = 'frost';
      primaryHue = 195;
      secondaryHue = 220;
    }
    // Fire modifier
    if (d.contains('fire') || d.contains('flame') || d.contains('inferno')) {
      aura = 'fire';
      primaryHue = 15;
      secondaryHue = 40;
    }

    // Name: capitalize first word
    final words = description.trim().split(RegExp(r'\s+'));
    final name = words.length <= 2
        ? description.trim()
        : words
            .take(2)
            .map((w) => w[0].toUpperCase() + w.substring(1))
            .join(' ');

    return CustomShapeSpec(
      name: name,
      description: 'A shape born from "$description"',
      bodyType: bodyType,
      bodySegments: segments,
      limbCount: limbs,
      hasWings: wings,
      hasTail: tail,
      hasHorns: horns,
      hasAntennae: antennae,
      eyeCount: eyes,
      eyeShape: eyeShape,
      extraFeatures: features,
      primaryHue: primaryHue,
      secondaryHue: secondaryHue,
      glowIntensity: 0.6,
      symmetry: 1,
      spikiness: spikiness,
      roundness: roundness,
      patternType: pattern,
      auraStyle: aura,
      icon: icon,
      traits: traits,
    );
  }
}
