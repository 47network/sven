---
name: book-print-broker
version: 1.0.0
description: Print service discovery and order management — compares POD providers, calculates costs, handles order placement for paperback, hardcover, and specialty editions.
archetype: operator
category: publishing

actions:
  - name: compare-providers
    description: Compare available POD providers for a specific print job.
    inputs:
      - name: format
        type: string
        required: true
        description: Print format (paperback, hardcover, special_edition).
      - name: pageCount
        type: number
        required: true
      - name: quantity
        type: number
        required: true
      - name: edgeType
        type: string
        required: false
        description: Edge treatment (plain, stained, sprayed, foil, painted, gilded).
      - name: targetCountry
        type: string
        required: false
        description: Shipping destination country code.
    outputs:
      - name: providers
        type: array
        description: Ranked list of providers with pricing, turnaround, and capabilities.
      - name: cheapest
        type: object
      - name: fastest
        type: object
      - name: recommended
        type: object

  - name: calculate-costs
    description: Calculate detailed cost breakdown for a print order.
    inputs:
      - name: provider
        type: string
        required: true
      - name: format
        type: string
        required: true
      - name: pageCount
        type: number
        required: true
      - name: quantity
        type: number
        required: true
      - name: edgeType
        type: string
        required: false
    outputs:
      - name: unitCostEur
        type: number
      - name: totalCostEur
        type: number
      - name: shippingEstimateEur
        type: number
      - name: breakdownItems
        type: array

  - name: submit-order
    description: Submit a print order to a POD provider.
    inputs:
      - name: podIntegrationId
        type: string
        required: true
      - name: projectId
        type: string
        required: true
      - name: format
        type: string
        required: true
      - name: quantity
        type: number
        required: true
      - name: printFileUrl
        type: string
        required: true
      - name: coverFileUrl
        type: string
        required: true
      - name: shippingAddress
        type: object
        required: false
    outputs:
      - name: orderId
        type: string
      - name: estimatedDelivery
        type: string
      - name: totalCostEur
        type: number
      - name: trackingUrl
        type: string

  - name: find-edge-suppliers
    description: Discover suppliers for specialty edge printing (stained, sprayed, foil, painted, gilded).
    inputs:
      - name: edgeType
        type: string
        required: true
      - name: preferredCountry
        type: string
        required: false
      - name: minQuantity
        type: number
        required: false
    outputs:
      - name: suppliers
        type: array
      - name: bestValue
        type: object
      - name: bestQuality
        type: object

pricing:
  model: per_call
  amount: 9.99
  currency: EUR

rate_limit:
  requests_per_minute: 5
  requests_per_hour: 50

tags:
  - printing
  - pod
  - fulfillment
  - edge-printing
  - publishing
---

# Book Print Broker — Print Service Discovery & Ordering

Print broker agent skill for the autonomous publishing pipeline. Discovers and
compares printing services (POD vs bulk), negotiates pricing, handles order
placement, and specialises in premium edge treatments.

## Capabilities

- **Provider comparison**: Rank POD providers by cost, speed, and quality for
  any given print specification.
- **Cost calculation**: Detailed cost breakdowns including printing, binding,
  edge treatment, and shipping.
- **Order submission**: Submit print orders to connected POD integrations with
  full tracking.
- **Edge printing sourcing**: Find Romanian and EU suppliers for specialty
  stained, sprayed, foil, painted, and gilded book edges.

## Specialty: Edge Printing

Premium book edges are a growing market trend. This skill maintains a database
of edge printing suppliers with quality ratings, minimum quantities, and
pricing. Supports automated sourcing for both standard runs and premium editions.

## Integration

Used by the `print_broker` task type in the marketplace task executor. Orders
are tracked in `printing_orders` table with NATS events for real-time status.
