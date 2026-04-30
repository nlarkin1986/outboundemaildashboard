import type { BdrSequenceCode, BdrSequenceTemplate } from './types';

const highReturnCxStep4 = {
  subject: 'cart abandonment recovery when support is real-time',
  label: 'Step 4: Email · benchmarks / data',
  lookup: 'review_pattern' as const,
  version_a: { body: "{{first_name}} --- different angle since I hadn't heard back.\n\nPulled up some {{company}} reviews and [REVIEW_PATTERN]. That's usually fixable once the right routing is in place.\n\n{{sender.first_name}}" },
  version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\nWe have benchmarks for cart abandonment recovery in high-return retail, specifically recovery rates when real-time support is available vs. when it isn't, conversion lift data. Happy to share the relevant cuts for your category.\n\n{{sender.first_name}}" },
};

const supportJobsStep4 = (category: string) => ({
  subject: `handle time benchmarks for your category`,
  label: 'Step 4: Email · benchmarks / data',
  lookup: 'support_jobs' as const,
  version_a: { body: "{{first_name}} --- different angle.\n\nNoticed {{company}} has [OPEN_SUPPORT_ROLES] support roles open right now. That usually signals some volume pressure at the moment.\n\nWe have benchmarks for support ops in " + category + ": handle time, escalation rates, and where specialized routing changes the contact mix. Happy to share the relevant cuts for your category.\n\n{{sender.first_name}}" },
  version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\nWe have benchmarks for support ops in " + category + ": handle time, escalation rates, and where specialized routing changes the contact mix. Happy to share the relevant cuts for your category.\n\n{{sender.first_name}}" },
});

const digitalStep4 = (subject: string, body: string) => ({
  subject,
  label: 'Step 4: Email · benchmarks / data',
  lookup: 'digital_investment' as const,
  version_a: { body: "{{first_name}} --- different angle since I hadn't heard back.\n\nGiven [DIGITAL_SIGNAL], the sequencing of where this fits is probably a live question.\n\n" + body + "\n\n{{sender.first_name}}" },
  version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\n" + body + "\n\n{{sender.first_name}}" },
});

export const BDR_SEQUENCES: Record<BdrSequenceCode, BdrSequenceTemplate> = {
  'A-1': {
    code: 'A-1',
    brand_label: 'High return rate',
    persona_label: 'VP / Director of CX',
    step1: {
      subject: "what Rothy's figured out about sizing",
      label: 'Step 1: Email · peer story',
      lookup: 'hero_product',
      body: "{{first_name}} --- saw the [PRODUCT_OR_COLLECTION] push.\n\nRothy's discovered something worth knowing about sizing questions. The customers asking about fit mid-browse are abandoning carts. When they made it easy to get a fast answer about sizing without leaving the product page, cart completion went up.\n\nThe CX teams taking that insight forward are connecting it back to the conversion funnel.\n\nWorth 20 minutes to walk through what that looks like operationally?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- The CX teams we work with are seeing sizing questions show up before purchase, not just after.\n\nRothy's discovered something worth knowing about sizing questions. The customers asking about fit mid-browse are abandoning carts. When they made it easy to get a fast answer about sizing without leaving the product page, cart completion went up.\n\nThe CX teams taking that insight forward are connecting it back to the conversion funnel.\n\nWorth 20 minutes to walk through what that looks like operationally?\n\n{{sender.first_name}}",
    },
    step4: highReturnCxStep4,
  },
  'A-2': {
    code: 'A-2',
    brand_label: 'High return rate',
    persona_label: 'Head of Support / Support Ops',
    step1: {
      subject: 'how Allbirds changed the routing on sizing calls',
      label: 'Step 1: Email · peer story',
      lookup: 'hero_product',
      body: "{{first_name}} --- [PRODUCT_OR_COLLECTION].\n\nThe support ops team at Allbirds made a specific change worth knowing about. They pulled fit and sizing contacts out of the general queue and gave them their own routing logic, specifically dedicated agents with deeper product training and the authority to actually resolve. Handle time went down. Contacts that used to spin into a second or third touch started closing in one.\n\nI'd love to share what that looked like operationally if you've got 20 minutes.\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- The support ops team at Allbirds made a specific change worth knowing about.\n\nThey pulled fit and sizing contacts out of the general queue and gave them their own routing logic, specifically dedicated agents with deeper product training and the authority to actually resolve. Handle time went down. Contacts that used to spin into a second or third touch started closing in one.\n\nI'd love to share what that looked like operationally if you've got 20 minutes.\n\n{{sender.first_name}}",
    },
    step4: supportJobsStep4('high-return retail'),
  },
  'A-3': {
    code: 'A-3',
    brand_label: 'High return rate',
    persona_label: 'CIO / CDO / VP Digital Transformation',
    step1: {
      subject: 'sizing uncertainty as a cart abandonment problem',
      label: 'Step 1: Email · peer story',
      lookup: 'digital_signal',
      body: "{{first_name}} --- [DIGITAL_SIGNAL].\n\nCart abandonment in high-return categories has a clear pattern worth knowing. Fit uncertainty, not having enough information to buy with confidence, accounts for a significant chunk. Rothy's started treating this as a digital program problem. The moment they made it easy to get a fast answer about sizing mid-browse, cart completion went up.\n\nThe ROI case tends to land faster than most commerce investments.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- Cart abandonment in high-return categories has a clear pattern worth knowing.\n\nFit uncertainty, not having enough information to buy with confidence, accounts for a significant chunk. Rothy's started treating this as a digital program problem. The moment they made it easy to get a fast answer about sizing mid-browse, cart completion went up.\n\nThe ROI case tends to land faster than most commerce investments.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
    },
    step4: digitalStep4('conversion lift from real-time pre-purchase support', "We have data on conversion lift in high-return retail when real-time support is available mid-browse versus when it isn't. Built for a finance audience rather than a CX one. Happy to send it over."),
  },
  'B-1': {
    code: 'B-1',
    brand_label: 'High consideration / high ticket',
    persona_label: 'VP / Director of CX',
    step1: {
      subject: 'the call that happens before someone buys a sofa',
      label: 'Step 1: Email · peer story',
      lookup: 'complex_product',
      body: "{{first_name}} --- was looking at the [PRODUCT_OR_CATEGORY] on the {{company}} site.\n\nThe CX leader at Nordstrom made a point that stuck. Their category can't deflect its way to better numbers. The brands winning in furniture and luxury are leaning into concierge-style support, not away from it. Customers who contact support before buying a high-ticket item convert at a significantly higher rate and have higher AOV, but they were routing those contacts into the general queue with no differentiation.\n\nWorth 20 minutes to walk through how they're thinking about it?\n\n{{sender.first_name}}",
    },
    step4: {
      subject: 'pre-purchase support benchmarks',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}} --- different angle since I hadn't heard back.\n\nPulled up some {{company}} reviews and [REVIEW_PATTERN]. That's usually a sign that high-consideration shoppers need a faster path to a real answer before they buy.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\nWe have benchmarks on high-ticket retail conversations: conversion rate when shoppers can reach a real person before buying, AOV impact, and what happens when those contacts get routed like general support. Happy to share the relevant cuts.\n\n{{sender.first_name}}" },
    },
  },
  'B-2': {
    code: 'B-2',
    brand_label: 'High consideration / high ticket',
    persona_label: 'Head of Support / Support Ops',
    step1: {
      subject: 'routing high-intent shoppers differently',
      label: 'Step 1: Email · peer story',
      lookup: 'complex_product',
      body: "{{first_name}} --- was looking at the [PRODUCT_OR_CATEGORY] on the {{company}} site.\n\nThe support teams doing this well treat pre-purchase questions on complex products differently from general support. The customer asking a detailed question before buying is not a deflection problem. That is a high-intent buyer who needs the right person fast.\n\nWorth comparing notes on how that routing works operationally?\n\n{{sender.first_name}}",
    },
    step4: supportJobsStep4('high-consideration retail'),
  },
  'B-3': {
    code: 'B-3',
    brand_label: 'High consideration / high ticket',
    persona_label: 'CIO / CDO / VP Digital Transformation',
    step1: {
      subject: 'pre-purchase support as conversion infrastructure',
      label: 'Step 1: Email · peer story',
      lookup: 'digital_signal',
      body: "{{first_name}} --- [DIGITAL_SIGNAL].\n\nFor high-consideration categories, the question before purchase is part of the conversion path. The brands making progress are treating that as commerce infrastructure, not just service coverage.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- For high-consideration categories, the question before purchase is part of the conversion path.\n\nThe brands making progress are treating that as commerce infrastructure, not just service coverage.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
    },
    step4: digitalStep4('conversion lift from guided pre-purchase support', 'We have data on conversion lift for high-consideration retail when pre-purchase support is real-time and routed differently from general service. Happy to send the finance-facing version.'),
  },
  'C-1': {
    code: 'C-1',
    brand_label: 'Subscription & replenishment',
    persona_label: 'VP / Director of CX',
    step1: {
      subject: 'what cancellation friction does to repeat purchase',
      label: 'Step 1: Email · peer story',
      lookup: 'subscription_signal',
      body: "{{first_name}} --- noticed [SUBSCRIPTION_SIGNAL].\n\nSubscription brands have a different CX problem than transactional retail. The moments around cancel, pause, replenish, and change frequency are where loyalty either compounds or breaks. The teams getting this right are making those conversations easier to resolve without turning every save attempt into friction.\n\nWorth 20 minutes to compare notes?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- Subscription brands have a different CX problem than transactional retail.\n\nThe moments around cancel, pause, replenish, and change frequency are where loyalty either compounds or breaks. The teams getting this right are making those conversations easier to resolve without turning every save attempt into friction.\n\nWorth 20 minutes to compare notes?\n\n{{sender.first_name}}",
    },
    step4: {
      subject: 'subscription support benchmarks',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}} --- different angle since I hadn't heard back.\n\nPulled up some {{company}} reviews and [REVIEW_PATTERN]. That usually shows up when subscription support is carrying more retention risk than the dashboards make obvious.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\nWe have benchmarks for subscription support: cancel-save contacts, pause and frequency-change conversations, and where response quality affects repeat purchase. Happy to share the relevant cuts.\n\n{{sender.first_name}}" },
    },
  },
  'C-2': {
    code: 'C-2',
    brand_label: 'Subscription & replenishment',
    persona_label: 'Head of Support / Support Ops',
    step1: {
      subject: 'routing subscription changes differently',
      label: 'Step 1: Email · peer story',
      lookup: 'subscription_signal',
      body: "{{first_name}} --- noticed [SUBSCRIPTION_SIGNAL].\n\nThe support ops teams doing this well separate subscription-change contacts from the general queue. Cancel, pause, skip, and frequency changes need different authority and different context than normal order support.\n\nWorth comparing notes on the routing model?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- The support ops teams doing this well separate subscription-change contacts from the general queue.\n\nCancel, pause, skip, and frequency changes need different authority and different context than normal order support.\n\nWorth comparing notes on the routing model?\n\n{{sender.first_name}}",
    },
    step4: supportJobsStep4('subscription commerce'),
  },
  'C-3': {
    code: 'C-3',
    brand_label: 'Subscription & replenishment',
    persona_label: 'CIO / CDO / VP Digital Transformation',
    step1: {
      subject: 'retention infrastructure for subscription commerce',
      label: 'Step 1: Email · peer story',
      lookup: 'digital_signal',
      body: "{{first_name}} --- [DIGITAL_SIGNAL].\n\nSubscription commerce puts unusual pressure on customer systems. The moments that drive LTV are not only acquisition moments. They are change, pause, cancel, save, and replenish moments where the customer expects the brand to know the whole relationship.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- Subscription commerce puts unusual pressure on customer systems.\n\nThe moments that drive LTV are not only acquisition moments. They are change, pause, cancel, save, and replenish moments where the customer expects the brand to know the whole relationship.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
    },
    step4: digitalStep4('retention lift from better subscription support', 'We have data on subscription support moments that affect LTV: pause, cancel, skip, frequency changes, and how real-time context changes the save path. Happy to send it over.'),
  },
  'D-1': {
    code: 'D-1',
    brand_label: 'High return rate',
    persona_label: 'eCommerce Leader',
    step1: {
      subject: 'fit questions before checkout',
      label: 'Step 1: Email · peer story',
      lookup: 'hero_product',
      body: "{{first_name}} --- saw the [PRODUCT_OR_COLLECTION] push.\n\nFor eCommerce leaders in high-return categories, fit uncertainty is not just a service issue. It is a checkout issue. The brands making progress are connecting those questions back to conversion and returns.\n\nWorth comparing notes?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- For eCommerce leaders in high-return categories, fit uncertainty is not just a service issue.\n\nIt is a checkout issue. The brands making progress are connecting those questions back to conversion and returns.\n\nWorth comparing notes?\n\n{{sender.first_name}}",
    },
    step4: highReturnCxStep4,
  },
  'D-2': {
    code: 'D-2',
    brand_label: 'High consideration / high ticket',
    persona_label: 'eCommerce Leader',
    step1: {
      subject: 'the shopper asking before they buy',
      label: 'Step 1: Email · peer story',
      lookup: 'complex_product',
      body: "{{first_name}} --- was looking at the [PRODUCT_OR_CATEGORY] on the {{company}} site.\n\nThe eCommerce teams winning in high-consideration categories are treating pre-purchase support as part of the conversion path. A shopper asking a complex question before buying is often the highest-intent person on the site.\n\nWorth comparing notes?\n\n{{sender.first_name}}",
    },
    step4: {
      subject: 'conversion data from pre-purchase support',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}} --- different angle since I hadn't heard back.\n\nPulled up some {{company}} reviews and [REVIEW_PATTERN]. That is usually a conversion problem before it becomes a support problem.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\nWe have data on high-consideration shoppers who contact support before buying: conversion, AOV, and where live help changes the path. Happy to share the relevant cuts.\n\n{{sender.first_name}}" },
    },
  },
  'D-3': {
    code: 'D-3',
    brand_label: 'Subscription & replenishment',
    persona_label: 'eCommerce Leader',
    step1: {
      subject: 'subscription changes as retention moments',
      label: 'Step 1: Email · peer story',
      lookup: 'subscription_signal',
      body: "{{first_name}} --- noticed [SUBSCRIPTION_SIGNAL].\n\nFor eCommerce leaders, subscription changes are retention moments. Pause, skip, cancel, replenish, and frequency changes are all points where better context can keep a customer in the relationship.\n\nWorth comparing notes?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}} --- For eCommerce leaders, subscription changes are retention moments.\n\nPause, skip, cancel, replenish, and frequency changes are all points where better context can keep a customer in the relationship.\n\nWorth comparing notes?\n\n{{sender.first_name}}",
    },
    step4: {
      subject: 'subscription conversion and retention benchmarks',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}} --- different angle since I hadn't heard back.\n\nPulled up some {{company}} reviews and [REVIEW_PATTERN]. That usually points to a retention path worth tightening.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}} --- quick one since I hadn't heard back.\n\nWe have benchmarks for subscription commerce support moments that affect repeat purchase and LTV. Happy to share the relevant cuts.\n\n{{sender.first_name}}" },
    },
  },
};

export function sequenceFor(code: BdrSequenceCode) {
  return BDR_SEQUENCES[code];
}
