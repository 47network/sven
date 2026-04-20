type Input = Record<string, unknown>;

function getString(input: Input, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function getNumber(input: Input, key: string): number | undefined {
  const v = input[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

export default async function handler(input: Input): Promise<Record<string, unknown>> {
  const action = getString(input, 'action');
  if (action !== 'publish_skill') {
    return { error: `Unknown action "${String(action)}". Use: publish_skill` };
  }

  const orgId = getString(input, 'orgId');
  const skillName = getString(input, 'skillName');
  const unitPrice = getNumber(input, 'unitPrice');
  const payoutAccountId = getString(input, 'payoutAccountId');

  if (!orgId || !skillName || unitPrice === undefined || unitPrice < 0 || !payoutAccountId) {
    return {
      error:
        'Missing required fields: orgId, skillName, unitPrice (>=0), payoutAccountId.',
    };
  }

  const apiBaseUrl =
    getString(input, 'apiBaseUrl') ??
    process.env.MARKETPLACE_API ??
    'http://127.0.0.1:9478';

  const title =
    getString(input, 'title') ??
    skillName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const body = {
    orgId,
    sellerAgentId: getString(input, 'sellerAgentId') ?? null,
    title,
    description:
      getString(input, 'description') ??
      `Programmatic access to the ${skillName} skill.`,
    kind: 'skill_api',
    pricingModel: getString(input, 'pricingModel') ?? 'per_call',
    unitPrice,
    currency: getString(input, 'currency') ?? 'USD',
    payoutAccountId,
    skillName,
    endpointUrl: getString(input, 'endpointUrl') ?? null,
    tags: Array.isArray(input.tags)
      ? (input.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
    metadata: { source: 'autonomous-economy/market-publish' },
  };

  const createRes = await fetch(`${apiBaseUrl}/v1/market/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    return {
      error: `Create listing failed (${createRes.status}): ${await createRes.text()}`,
    };
  }
  const created = (await createRes.json()) as { data?: { listing?: { id: string; slug: string; status: string } } };
  const listing = created?.data?.listing;
  if (!listing) {
    return { error: `Unexpected response from marketplace: ${JSON.stringify(created)}` };
  }

  let finalStatus = listing.status;
  if (input.publishNow === true) {
    const pubRes = await fetch(`${apiBaseUrl}/v1/market/listings/${listing.id}/publish`, {
      method: 'POST',
    });
    if (!pubRes.ok) {
      return {
        error: `Publish failed (${pubRes.status}): ${await pubRes.text()}`,
        result: {
          listingId: listing.id,
          slug: listing.slug,
          status: listing.status,
          url: `https://market.sven.systems/listings/${listing.slug}`,
        },
      };
    }
    const pub = (await pubRes.json()) as { data?: { listing?: { status: string } } };
    finalStatus = pub?.data?.listing?.status ?? finalStatus;
  }

  return {
    result: {
      listingId: listing.id,
      slug: listing.slug,
      status: finalStatus,
      url: `https://market.sven.systems/listings/${listing.slug}`,
    },
  };
}
