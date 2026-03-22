import {
  appendCitationsIfMissing,
  hasCitationMarkers,
  normalizeCitations,
  verifyCitations,
} from '../src/citation-utils.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const citations = normalizeCitations([
  { id: 'rag:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  { id: 'rag:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
]);

const baseText = 'Here is an answer with sources.';
const injected = appendCitationsIfMissing(baseText, citations);

assert(injected.includes('Sources:'), 'Should append Sources block');
assert(hasCitationMarkers(injected), 'Injected text should include citation markers');
assert(verifyCitations(injected, citations).ok, 'Verification should pass with markers');

const alreadyMarked = `${baseText} [rag:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc]`;
const unchanged = appendCitationsIfMissing(alreadyMarked, citations);
assert(unchanged === alreadyMarked, 'Should not alter text when markers exist');

const noCitations = normalizeCitations([]);
const untouched = appendCitationsIfMissing(baseText, noCitations);
assert(untouched === baseText, 'Should not append when citations are empty');

console.log('citation-check: ok');
