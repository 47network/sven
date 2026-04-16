import { jest, describe, it, expect } from '@jest/globals';
import { extractNamedEntities } from '../entities';

describe('extractNamedEntities', () => {
  it('extracts persons correctly', () => {
    const text = 'Hello John Doe and Jane Smith.';
    const entities = extractNamedEntities(text);

    const persons = entities.filter(e => e.category === 'person');
    expect(persons.length).toBe(2);
    expect(persons[0].value.trim()).toBe('Hello John Doe');
    expect(persons[1].value.trim()).toBe('Jane Smith');
  });

  it('extracts emails correctly', () => {
    const text = 'Contact us at test@example.com or support@company.org.';
    const entities = extractNamedEntities(text);

    const emails = entities.filter(e => e.category === 'email');
    expect(emails.length).toBe(2);
    expect(emails[0].value).toBe('test@example.com');
    expect(emails[1].value).toBe('support@company.org');
  });

  it('extracts URLs correctly', () => {
    const text = 'Visit https://example.com and http://test.org for more info.';
    const entities = extractNamedEntities(text);

    const urls = entities.filter(e => e.category === 'url');
    expect(urls.length).toBe(2);
    expect(urls[0].value).toBe('https://example.com');
    expect(urls[1].value).toBe('http://test.org');
  });

  it('extracts currencies correctly', () => {
    const text = 'The total is $50.00 and the tax is €4.50.';
    const entities = extractNamedEntities(text);

    const currencies = entities.filter(e => e.category === 'currency');
    expect(currencies.length).toBe(2);
    expect(currencies[0].value).toBe('$50.00');
    expect(currencies[1].value).toBe('€4.50');
  });

  it('extracts all entity types combined', () => {
    const text = 'John Doe bought items for $20.50. Contact him at john@example.com or visit https://johndoe.com';
    const entities = extractNamedEntities(text);

    expect(entities.length).toBe(4);

    const persons = entities.filter(e => e.category === 'person');
    expect(persons.length).toBe(1);
    expect(persons[0].value).toBe('John Doe');

    const currencies = entities.filter(e => e.category === 'currency');
    expect(currencies.length).toBe(1);
    expect(currencies[0].value).toBe('$20.50');

    const emails = entities.filter(e => e.category === 'email');
    expect(emails.length).toBe(1);
    expect(emails[0].value).toBe('john@example.com');

    const urls = entities.filter(e => e.category === 'url');
    expect(urls.length).toBe(1);
    expect(urls[0].value).toBe('https://johndoe.com');
  });
});
