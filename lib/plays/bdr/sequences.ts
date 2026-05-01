import type { BdrSequenceCode, BdrSequenceTemplate } from './types';

const fitCampaignRule = 'Use only when a current campaign or collection naturally ties to fit, sizing, gift timing, returns, or pre-purchase question volume.';
const complexProductRule = 'Use only when a product or category has real decision complexity: configuration, compatibility, delivery, warranty, regret risk, or expert guidance.';
const subscriptionRule = 'Use only when evidence ties subscription, cancel, pause, skip, retention, lifecycle, or growth to the save/cancel moment.';
const digitalSignalRule = 'Use only when a concrete digital, operating-model, expansion, data, AI, or commerce initiative exists. Do not use vague transformation language.';

const highReturnCxStep4 = {
  subject: 'cart abandonment recovery when support is real-time',
  label: 'Step 4: Email · benchmarks / data',
  lookup: 'review_pattern' as const,
  version_a: { body: "{{first_name}}, different angle since I hadn't heard back.\n\n[REVIEW_PATTERN]. That's usually fixable once the right routing is in place.\n\n{{sender.first_name}}" },
  version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have benchmarks for cart abandonment recovery in high-return retail: recovery rates when real-time support is available versus when it is not, plus conversion lift data. Happy to share the relevant cuts for your category.\n\n{{sender.first_name}}" },
};

const supportJobsStep4 = (subject: string, category: string) => ({
  subject,
  label: 'Step 4: Email · benchmarks / data',
  lookup: 'support_jobs' as const,
  version_a: { body: "{{first_name}}, different angle.\n\n[OPEN_SUPPORT_ROLES].\n\nWe have benchmarks for support ops in " + category + ": handle time, escalation rates, and where specialized routing changes the contact mix. Happy to share the relevant cuts for your category.\n\n{{sender.first_name}}" },
  version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have benchmarks for support ops in " + category + ": handle time, escalation rates, and where specialized routing changes the contact mix. Happy to share the relevant cuts for your category.\n\n{{sender.first_name}}" },
});

const digitalStep4 = (subject: string, body: string) => ({
  subject,
  label: 'Step 4: Email · benchmarks / data',
  lookup: 'digital_investment' as const,
  version_a: { body: "{{first_name}}, different angle since I hadn't heard back.\n\n[DIGITAL_SIGNAL].\n\n" + body + "\n\n{{sender.first_name}}" },
  version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\n" + body + "\n\n{{sender.first_name}}" },
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
      insert_rule: fitCampaignRule,
      body: "{{first_name}}, [PRODUCT_OR_COLLECTION].\n\nRothy's discovered something worth knowing about sizing questions. The customers asking about fit mid-browse are abandoning carts. When they made it easy to get a fast answer about sizing without leaving the product page, cart completion went up.\n\nThe CX teams taking that insight forward are connecting it back to the conversion funnel.\n\nWorth 20 minutes to walk through what that looks like operationally?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, CX teams we work with are seeing sizing questions show up before purchase, not just after.\n\nRothy's discovered something worth knowing about sizing questions. The customers asking about fit mid-browse are abandoning carts. When they made it easy to get a fast answer about sizing without leaving the product page, cart completion went up.\n\nThe CX teams taking that insight forward are connecting it back to the conversion funnel.\n\nWorth 20 minutes to walk through what that looks like operationally?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note last week about how brands in your category are handling fit and sizing conversations differently. Thought it was worth connecting. {{sender.first_name}}" },
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
      insert_rule: fitCampaignRule,
      body: "{{first_name}}, [PRODUCT_OR_COLLECTION].\n\nThe support ops team at Allbirds made a specific change worth knowing about. They pulled fit and sizing contacts out of the general queue and gave them their own routing logic: dedicated agents with deeper product training and the authority to actually resolve. Handle time went down. Contacts that used to spin into a second or third touch started closing in one.\n\nI'd love to share what that looked like operationally if you've got 20 minutes.\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, the support ops team at Allbirds made a specific change worth knowing about.\n\nThey pulled fit and sizing contacts out of the general queue and gave them their own routing logic: dedicated agents with deeper product training and the authority to actually resolve. Handle time went down. Contacts that used to spin into a second or third touch started closing in one.\n\nI'd love to share what that looked like operationally if you've got 20 minutes.\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, reached out last week about how brands in your category are routing fit and sizing contacts differently. Work with a few brands in your space. Worth connecting. {{sender.first_name}}" },
    step4: supportJobsStep4('handle time benchmarks for your category', 'high-return retail'),
  },
  'A-3': {
    code: 'A-3',
    brand_label: 'High return rate',
    persona_label: 'CIO / CDO / VP Digital Transformation',
    step1: {
      subject: 'sizing uncertainty as a cart abandonment problem',
      label: 'Step 1: Email · peer story',
      lookup: 'digital_signal',
      insert_rule: digitalSignalRule,
      body: "{{first_name}}, [DIGITAL_SIGNAL].\n\nCart abandonment in high-return categories has a clear pattern worth knowing. Fit uncertainty, not having enough information to buy with confidence, accounts for a significant chunk. Rothy's started treating this as a digital program problem. The moment they made it easy to get a fast answer about sizing mid-browse, cart completion went up.\n\nThe ROI case tends to land faster than most commerce investments.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, cart abandonment in high-return categories has a clear pattern worth knowing.\n\nFit uncertainty, not having enough information to buy with confidence, accounts for a significant chunk. Rothy's started treating this as a digital program problem. The moment they made it easy to get a fast answer about sizing mid-browse, cart completion went up.\n\nThe ROI case tends to land faster than most commerce investments.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note about cart abandonment in high-return categories. Work with a few brands in your space on the digital side of that. Worth connecting. {{sender.first_name}}" },
    step4: digitalStep4('conversion lift from real-time pre-purchase support', "We have data on conversion lift in high-return retail when real-time support is available mid-browse versus when it is not. Built for a finance audience rather than a CX one. Happy to send it over."),
  },
  'B-1': {
    code: 'B-1',
    brand_label: 'High consideration / high ticket',
    persona_label: 'VP / Director of CX',
    step1: {
      subject: 'the call that happens before someone buys a sofa',
      label: 'Step 1: Email · peer story',
      lookup: 'complex_product',
      insert_rule: complexProductRule,
      body: "{{first_name}}, [PRODUCT_OR_CATEGORY].\n\nThe CX leader at Nordstrom made a point that stuck. Their category cannot deflect its way to better numbers. The brands winning in furniture and luxury are leaning into concierge-style support, not away from it. Customers who contact support before buying a high-ticket item convert at a significantly higher rate and have higher AOV, but they were routing those contacts into the general queue with no differentiation.\n\nWorth 20 minutes to walk through how they are thinking about it?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, reached out last week about how brands selling high-ticket products are treating pre-purchase support as a revenue channel. Thought it was worth connecting. {{sender.first_name}}" },
    step4: {
      subject: 'a number worth knowing',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}}, different angle.\n\n[REVIEW_PATTERN]. That kind of friction tends to point to something specific in how pre-purchase contacts are being handled.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have data on assisted vs. unassisted conversion in high-consideration retail: customers who interact with support before buying convert at significantly higher rates and have higher AOV. Happy to share what the relevant numbers look like for {{company}}'s category.\n\n{{sender.first_name}}" },
    },
  },
  'B-2': {
    code: 'B-2',
    brand_label: 'High consideration / high ticket',
    persona_label: 'Head of Support / Support Ops',
    step1: {
      subject: 'how Ralph Lauren staffs for pre-purchase calls',
      label: 'Step 1: Email · peer story',
      lookup: 'complex_product',
      insert_rule: complexProductRule,
      body: "{{first_name}}, [PRODUCT_OR_CATEGORY].\n\nSomething specific about how Ralph Lauren's support ops team thinks about queue design is worth knowing. They pulled pre-purchase contacts, like questions about specific products and customization, into their own routing path. Different agent pool, deeper product training, different escalation rules. They brought the strong brick-and-mortar experience to the web. Resolution in one touch went up significantly.\n\nI'd love to walk through the operational setup if you've got 20 minutes.\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, reached out last week about pre-purchase routing for high-ticket products. Work with a few brands in your space on the ops side. Worth connecting. {{sender.first_name}}" },
    step4: supportJobsStep4('benchmarks for high-consideration support', 'high-ticket retail'),
  },
  'B-3': {
    code: 'B-3',
    brand_label: 'High consideration / high ticket',
    persona_label: 'CIO / CDO / VP Digital Transformation',
    step1: {
      subject: 'the concierge layer in the digital experience',
      label: 'Step 1: Email · peer story',
      lookup: 'digital_signal',
      insert_rule: digitalSignalRule,
      body: "{{first_name}}, [DIGITAL_SIGNAL].\n\nThere is a part of the high-consideration purchase journey that most digital programs do not instrument: what happens when a customer has a question before buying. Your category cannot deflect its way to better numbers. The brands winning in your space are going the other direction, more consultative. Nordstrom is famous for making customers feel known. Customers who interact with their team before buying have significantly higher AOV. That is a different architecture than what most CX tools are built for.\n\nWorth a quick conversation about what that looks like operationally?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, there is a part of the high-consideration purchase journey that most digital programs do not instrument: what happens when a customer has a question before buying.\n\nYour category cannot deflect its way to better numbers. The brands winning in your space are going the other direction, more consultative. Customers who interact with a team before buying convert at higher rates and have higher AOV.\n\nWorth a quick conversation about what that looks like operationally?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note about the concierge layer in digital conversion. Work with a few brands in your space on the digital side of that. Worth connecting. {{sender.first_name}}" },
    step4: digitalStep4('conversion lift from assisted pre-purchase support', 'We have data on conversion rates in high-consideration retail when customers have access to real support before buying versus when they do not. Customers who get a fast answer have higher conversion and higher AOV. Built for a finance audience. Happy to send it over.'),
  },
  'C-1': {
    code: 'C-1',
    brand_label: 'Subscription & replenishment',
    persona_label: 'VP / Director of CX',
    step1: {
      subject: "what MaryRuth's figured out about cancel calls",
      label: 'Step 1: Email · peer story',
      lookup: 'subscription_signal',
      insert_rule: subscriptionRule,
      body: "{{first_name}}, [SUBSCRIPTION_SIGNAL].\n\nThe CX team at MaryRuth's found something counterintuitive a while back. Their highest-LTV customers were disproportionately likely to have called in to cancel at some point and stayed. The conversation was handled fast enough and well enough that the person just changed their mind.\n\nThey rebuilt the cancel flow around that insight. The revenue those conversations recover now shows up in the board deck, not the support dashboard.\n\nI'd love to share how they approached it if you've got 20 minutes.\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, subscription brands have a different CX problem than transactional retail.\n\nThe moments around cancel, pause, replenish, and change frequency are where loyalty either compounds or breaks. The teams getting this right are making those conversations easier to resolve without turning every save attempt into friction.\n\nWorth 20 minutes to compare notes?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note last week about how subscription brands are handling cancel conversations differently. Work with a few brands in your space. Worth connecting. {{sender.first_name}}" },
    step4: {
      subject: 'subscription CX benchmarks',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}}, different angle.\n\n[REVIEW_PATTERN]. That kind of friction is usually recoverable once the right routing is in place.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have benchmarks for CX operations in subscription retail: repeat purchase rates, revenue recovered per cancel interaction. Happy to share what is relevant for {{company}}'s category.\n\n{{sender.first_name}}" },
    },
  },
  'C-2': {
    code: 'C-2',
    brand_label: 'Subscription & replenishment',
    persona_label: 'Head of Support / Support Ops',
    step1: {
      subject: "how MaryRuth's redesigned the cancel queue",
      label: 'Step 1: Email · peer story',
      lookup: 'subscription_signal',
      insert_rule: subscriptionRule,
      body: "{{first_name}}, [SUBSCRIPTION_SIGNAL].\n\nSomething specific about how MaryRuth's support ops team redesigned their cancel flow is worth knowing. They created a dedicated routing path for cancel and downgrade contacts. Separate queue, agents with specific training and the authority to actually resolve. The save rate on those contacts went up significantly. Contacts that used to require a second touch started resolving in one.\n\nI'd love to walk through the operational setup if you've got 20 minutes.\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, the support ops teams doing this well separate subscription-change contacts from the general queue.\n\nCancel, pause, skip, and frequency changes need different authority and different context than normal order support.\n\nWorth comparing notes on the routing model?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, reached out last week about how subscription brands are redesigning cancel and downgrade routing. Work with a few brands in your space. Worth connecting. {{sender.first_name}}" },
    step4: supportJobsStep4('cancel flow benchmarks for subscription brands', 'subscription retail'),
  },
  'C-3': {
    code: 'C-3',
    brand_label: 'Subscription & replenishment',
    persona_label: 'CIO / CDO / VP Digital Transformation',
    step1: {
      subject: 'the transformation bet with the fastest payback',
      label: 'Step 1: Email · peer story',
      lookup: 'digital_signal',
      insert_rule: digitalSignalRule,
      body: "{{first_name}}, [DIGITAL_SIGNAL].\n\nWhen teams are running multiple transformation workstreams in parallel, the sequencing question is usually the hard one. CX tends to get slotted behind commerce and supply chain. For a subscription business, the economics on that ordering are worth reconsidering. The revenue recovered from a retained subscriber versus a cancel that went uncontested tends to stack up faster than most other bets on the roadmap. MaryRuth's resequenced around this. The numbers made the case fast.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, when teams are running multiple transformation workstreams in parallel, the sequencing question is usually the hard one.\n\nFor a subscription business, the revenue recovered from a retained subscriber versus a cancel that went uncontested tends to stack up faster than most other bets on the roadmap.\n\nWorth a short conversation?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note about transformation sequencing for subscription businesses. We work with a few brands in your space on the digital side of that. Worth connecting. {{sender.first_name}}" },
    step4: digitalStep4('the revenue number your board probably is not seeing', 'We put together an analysis on CX ROI in subscription retail: what the revenue impact looks like when the subscriber communication layer is modernized versus not. Built for a finance audience rather than a CX one, which makes it more useful. Happy to send it over.'),
  },
  'D-1': {
    code: 'D-1',
    brand_label: 'High return rate',
    persona_label: 'eCommerce Leader',
    step1: {
      subject: "rothy's connected CX to the conversion funnel",
      label: 'Step 1: Email · peer story',
      lookup: 'hero_product',
      insert_rule: fitCampaignRule,
      body: "{{first_name}}, [PRODUCT_OR_COLLECTION].\n\nIn high-return categories, fit uncertainty does not show up as a support ticket, it shows up as cart abandonment. Rothy's connected this to the conversion funnel. When they made it easy to get a fast answer about sizing mid-browse, without leaving the product page, cart completion went up. Not because they got better at CX. Because they fixed a leak in the purchase funnel.\n\nThe play in your category is making sure those conversations happen where the sale is, not where support is.\n\nWorth 20 minutes to talk through what that looks like?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, in high-return categories, fit uncertainty does not show up as a support ticket, it shows up as cart abandonment.\n\nRothy's connected this to the conversion funnel. When they made it easy to get a fast answer about sizing mid-browse, without leaving the product page, cart completion went up.\n\nWorth 20 minutes to talk through what that looks like?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note about connecting fit conversations to cart completion in high-return categories. Work with a few brands in your space on the ecomm side. Worth connecting. {{sender.first_name}}" },
    step4: {
      ...highReturnCxStep4,
      subject: 'cart abandonment recovery when support is available mid-purchase',
      version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have data on conversion lift in high-return retail: cart abandonment recovery rates, repeat purchase rates when real-time support is available at key moments. Happy to share the relevant benchmarks for your category.\n\n{{sender.first_name}}" },
    },
  },
  'D-2': {
    code: 'D-2',
    brand_label: 'High consideration / high ticket',
    persona_label: 'eCommerce Leader',
    step1: {
      subject: 'nordstrom built a digital concierge layer',
      label: 'Step 1: Email · peer story',
      lookup: 'complex_product',
      insert_rule: complexProductRule,
      body: "{{first_name}}, [PRODUCT_OR_CATEGORY].\n\nNordstrom built a digital concierge layer that mimics what their best in-store associates do. Your category cannot deflect its way to better numbers. The brands winning in your space are going the other direction: more consultative. Customers who interact with that team before buying convert at significantly higher rates and have higher AOV.\n\nThat is a different architecture than what most CX tools are built for. But the math works.\n\nWorth 20 minutes to talk through what that looks like operationally?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note about building a concierge layer into digital conversion. Work with a few brands in your space on the ecomm side. Worth connecting. {{sender.first_name}}" },
    step4: {
      subject: 'conversion and AOV lift from assisted pre-purchase interactions',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}}, different angle.\n\n[REVIEW_PATTERN]. That kind of friction usually shows up in conversion and AOV metrics.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have data on conversion and AOV in high-consideration retail: assisted vs. unassisted conversion rates, AOV lift from concierge support. Happy to share what the relevant numbers look like for {{company}}'s category.\n\n{{sender.first_name}}" },
    },
  },
  'D-3': {
    code: 'D-3',
    brand_label: 'Subscription & replenishment',
    persona_label: 'eCommerce Leader',
    step1: {
      subject: "how MaryRuth's monetized the cancel flow",
      label: 'Step 1: Email · peer story',
      lookup: 'subscription_signal',
      insert_rule: subscriptionRule,
      body: "{{first_name}}, [SUBSCRIPTION_SIGNAL].\n\nIn subscription retail, the cancel conversation is usually treated as a cost to minimize. MaryRuth's reframed it as a revenue problem. When customers call to cancel and get a fast answer, a significant percentage just change their mind. Revenue recovered from those save conversations now shows up in their ecomm revenue reporting as a line item.\n\nThe play is making sure those conversations are easy and happen in a context where they actually move the revenue needle.\n\nWorth 20 minutes to talk through what that looks like?\n\n{{sender.first_name}}",
      fallback_body: "{{first_name}}, in subscription retail, the cancel conversation is usually treated as a cost to minimize.\n\nMaryRuth's reframed it as a revenue problem. Revenue recovered from save conversations now shows up in ecomm revenue reporting as a line item.\n\nWorth 20 minutes to talk through what that looks like?\n\n{{sender.first_name}}",
    },
    linkedin: { label: 'Step 2: LinkedIn · connection note', max_length: 200, note: "{{first_name}}, sent you a note about monetizing the subscriber lifecycle. Work with a few brands in your space on the digital revenue side. Worth connecting. {{sender.first_name}}" },
    step4: {
      subject: 'repeat purchase rates and revenue recovery in subscription',
      label: 'Step 4: Email · benchmarks / data',
      lookup: 'review_pattern',
      version_a: { body: "{{first_name}}, different angle.\n\n[REVIEW_PATTERN]. That usually correlates with repeat purchase rate and LTV impact.\n\n{{sender.first_name}}" },
      version_b: { body: "{{first_name}}, quick one since I hadn't heard back.\n\nWe have data on subscription revenue recovery: repeat purchase rates by interaction type, revenue recovered per cancel conversation. Brands like AG1 use this to model churn prevention ROI. Happy to share the relevant benchmarks for your category.\n\n{{sender.first_name}}" },
    },
  },
};

export function sequenceFor(code: BdrSequenceCode) {
  return BDR_SEQUENCES[code];
}
