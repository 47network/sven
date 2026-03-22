import argparse
import json
import sys

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({'error': 'faster-whisper is not installed'}))
    sys.exit(1)

parser = argparse.ArgumentParser(description='Transcribe audio via faster-whisper')
parser.add_argument('--model', required=True, help='Path to the faster-whisper model')
parser.add_argument('--input', required=True, help='Audio file to transcribe')
parser.add_argument('--language', default='auto', help='Language hint')
parser.add_argument('--device', default='cpu', help='Device to run inference on')
parser.add_argument('--beam_size', type=int, default=5, help='Beam size for transcription')
args = parser.parse_args()

language_hint = None if (args.language or '').lower() == 'auto' else args.language

try:
    model = WhisperModel(args.model, device=args.device)
    segments, info = model.transcribe(
        args.input,
        language=language_hint,
        task='transcribe',
        beam_size=args.beam_size,
    )
    detected_language = getattr(info, 'language', None) if info is not None else None
    language_probability = getattr(info, 'language_probability', None) if info is not None else None
    transcript = ' '.join([segment.text.strip() for segment in segments]).strip()
    print(json.dumps({'transcript': transcript, 'segments': [
        {'start': segment.start, 'end': segment.end, 'text': segment.text}
        for segment in segments]
        ,
        'detected_language': detected_language,
        'language_probability': language_probability
    }))
except Exception as err:
    print(json.dumps({'error': str(err)}))
    sys.exit(1)
