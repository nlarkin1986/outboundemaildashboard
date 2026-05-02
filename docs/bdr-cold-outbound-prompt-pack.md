**BDR Cold Outbound Sequences**

Gladly  ·  Retail & eCommerce  ·  12 Sequences  ·  4 Personas  ·  3 Brand Types

**Where to find personalization**

Four sources used across all sequences. Get comfortable with all of them.

**Instagram / TikTok**

Look for whatever product or campaign they're pushing hardest right now. You want a specific product name or better yet collection name (shows a better understanding of their marketing) to drop into the first sentence.

**Website product catalog**

Go to the Shop or Products nav. Find the most complex, customizable, or highest-ticket thing they sell, the one a customer would most likely have questions about before buying.

**Trustpilot / Google Reviews / App Store / Reddit**

Read the 2- and 3-star reviews and the threads about bad stuff. Also screenshot it so you can attach it when needed. Look for the same complaint showing up more than once: sizing confusion, slow response, hard to cancel, return friction. If you see a pattern, that's your personalization.

**LinkedIn Jobs**

Search the company, click Jobs. Count open CX, support, or CS roles. Also look for aggressive engineering or data hiring . That signals active digital transformation.

**eCommerce research tools**

For eCommerce personas: Shopify store data (Similarweb, Shopify Theme Detector \- all allow you to create free accounts and get some info), conversion rate optimization tools (Baymard Institute benchmarks), and industry-specific metrics (Littledata for subscription cohorts). Look for AOV trends, cart abandonment signals, repeat purchase patterns.

**PERSONALIZATION AGENT RULES — USE FOR EVERY PLACEHOLDER**

You have Exa and Browserbase. Do not fill placeholders from memory.

For each `{{company}}`, first build a mini evidence ledger:

1. **Official site / product pages** — current campaigns, collections, new arrivals, highest-complexity products.
2. **Official help center / policy pages** — returns, exchanges, shipping, cancellation, subscription management, contact channels, exception workflows.
3. **Careers / job posts** — CX, support, customer care, concierge, retention, ecommerce, digital, data, engineering roles. Prefer exact role titles and responsibilities over raw job counts.
4. **Press / investor pages** — expansion, replatforming, omnichannel, digital transformation, product launches, funding, executive hires.
5. **Reviews / social** — use only if at least 3 recent or credible reviews repeat the same friction pattern. Otherwise do not cite reviews.

Retrieval order:

1. Use Exa search first with official-domain and query-intent searches.
2. Use Exa fetch for the best pages.
3. Use Browserbase only when the page is JS-rendered, the product catalog/help center cannot be extracted cleanly, or a support widget/portal needs interaction.

Evidence rules:

- Every personalized line must trace to a URL and exact evidence snippet.
- Separate verified facts from inferred operating pressure.
- Do not claim the company has a pain unless public evidence proves it.
- Use “likely creates,” “usually creates,” or “can create” for reasoned inference.
- Prefer official help-center, policy, job, product, and investor evidence over review/social evidence.
- Never use one-off reviews, Reddit posts, or vague LinkedIn copy as a standalone pain claim.

Copy rules:

- Output only the final insert unless asked for notes.
- 1 sentence, ideally under 25 words.
- No “I noticed,” “I saw,” “I was looking at,” “spent time on,” or similar research-process language.
- Make the line about the prospect’s operating moment, not our browsing activity.
- Tie the signal to the sequence hypothesis: fit/returns, pre-purchase help, subscription retention, support routing, digital ROI, or customer continuity.
- Keep it non-accusatory.
- If evidence is weak, delete the personalization line and use the provided generic opener.

Internal output contract before inserting copy:

- `selected_insert`: final sentence to place in email
- `confidence`: high / medium / low
- `evidence_type`: product / help_center / jobs / press / reviews / social
- `verified_fact`: exact public fact
- `inference_used`: exact soft inference, if any
- `source_url`: URL
- `source_snippet`: short text excerpt
- `fallback_used`: yes/no

Only write `selected_insert` into the sequence unless evidence notes are requested.


| SEQUENCE A-1:  High Return Rate   ×   VP / Director of CX FOR VP of CX / Director of Customer Experience BRAND TYPES Swimwear, lingerie, footwear, children's clothing, athletic apparel  |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *what Rothy's figured out about sizing*

| 🔍  PERSONALIZE Use Exa, then Browserbase if needed, to inspect {{company}}'s official homepage, new arrivals, featured collection pages, and recent public Instagram/TikTok. Identify the product, collection, or campaign they are currently pushing hardest. Then decide whether it plausibly creates fit, sizing, gift-timing, return, or pre-purchase question volume. Write one copy-safe first sentence that connects the campaign to the customer moment, not just the product name. Good shape: `{{first_name}} --- {{company}}'s [collection/campaign] likely puts [fit/sizing/gift timing/product-comparison] questions right in the buying moment.` Use only if the campaign/product is current or prominently featured and the tie to the sequence angle is natural. If evidence is weak, delete the sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: campaign/collection tied to fit, sizing, gift timing, returns, or pre-purchase question volume.]

Rothy's discovered something worth knowing about sizing questions. The customers asking about fit mid-browse are abandoning carts. When they made it easy to get a fast answer about sizing without leaving the product page, cart completion went up.

The CX teams taking that insight forward are connecting it back to the conversion funnel.

Worth 20 minutes to walk through what that looks like operationally?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note last week about how brands in your category are handling fit and sizing conversations differently. Thought it was worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your sizing flow*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a shopper, try to ask a sizing question mid-browse, see what the experience looks like from the outside. How many clicks to reach help, whether I can get an answer without leaving the product page. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *cart abandonment recovery when support is real-time*

| 🔍  PERSONALIZE Use Exa to search Trustpilot, Google Reviews, app reviews, Reddit, and other accessible public reviews for {{company}}. Look only for repeated 2- or 3-star patterns tied to high-return retail: sizing confusion, fit mismatch, exchange/return friction, abandoned carts, or hard-to-reach help before purchase. Use Version A only if you find at least 3 materially similar examples from recent or credible sources. Capture source URLs and short snippets internally. Do not quote inflammatory language. Do not say {{company}} "has a problem." Say the pattern "shows up" or "appears in reviews." If fewer than 3 examples or sources are weak, use Version B. Version A shape: `Pulled up recent {{company}} reviews and [specific pattern] shows up more than once --- that usually points to [operational moment], not just generic support volume.` |
| :---- |

{{first\_name}} \--- different angle since I hadn't heard back.

**VERSION A (if you found a review pattern):**  Pulled up some {{company}} reviews and \[DESCRIBE THE PATTERN, e.g., 'sizing questions showing up in a lot of the negative ones'\]. That's usually fixable once the right routing is in place.

**VERSION B (if no pattern found):**  Quick one since I hadn't heard back.

We have benchmarks for cart abandonment recovery in high-return retail, specifically recovery rates when real-time support is available vs. when it isn't, conversion lift data. Happy to share the relevant cuts for your category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the timing isn't right, totally fair. gladly.ai has the overview.

The audit offer stands whenever it makes sense. I can run it async and send the notes.

{{sender.first\_name}}
| SEQUENCE A-2:  High Return Rate   ×   Head of Support / Support Operations FOR Head of Support / VP of Support Operations / Director of Support BRAND TYPES Swimwear, lingerie, footwear, children's clothing, athletic apparel  |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *how Allbirds changed the routing on sizing calls*

| 🔍  PERSONALIZE Use Exa, then Browserbase if needed, to inspect {{company}}'s official homepage, new arrivals, featured collection pages, and recent public Instagram/TikTok. Identify the product, collection, or campaign they are currently pushing hardest. Then decide whether it plausibly creates fit, sizing, gift-timing, return, or pre-purchase question volume. Write one copy-safe first sentence that connects the campaign to the customer moment, not just the product name. Good shape: `{{first_name}} --- {{company}}'s [collection/campaign] likely puts [fit/sizing/gift timing/product-comparison] questions right in the buying moment.` Use only if the campaign/product is current or prominently featured and the tie to the sequence angle is natural. If evidence is weak, delete the sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: campaign/product tied to fit, sizing, returns, or routing volume; delete if evidence is weak.]

The support ops team at Allbirds made a specific change worth knowing about. They pulled fit and sizing contacts out of the general queue and gave them their own routing logic, specifically dedicated agents with deeper product training and the authority to actually resolve. Handle time went down. Contacts that used to spin into a second or third touch started closing in one.

I'd love to share what that looked like operationally if you've got 20 minutes.

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, reached out last week about how brands in your category are routing fit and sizing contacts differently. Work with a few brands in your space. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *quick look at your sizing ticket routing*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a customer, try to ask a sizing question, check your return policy flow, see what the experience looks like from the outside. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *handle time benchmarks for your category*

| 🔍  PERSONALIZE Use Exa to search official careers pages, Greenhouse/Lever/Ashby, and LinkedIn public job snippets for {{company}}. Count open support, CX, customer care, member experience, concierge, retention operations, or support operations roles, but prefer exact role titles and responsibilities over a raw count. Use Version A only if there are 2+ relevant open roles OR one senior role directly tied to the sequence angle, such as churn reduction, cancellation experience, support routing, QA, workforce management, or customer feedback loops. Version A shape: `{{company}} is hiring for [exact role/title or count], with responsibilities around [exact responsibility]. That usually means [volume/coverage/retention/routing] is active enough to have an owner.` Do not infer crisis from hiring. Do not say “pressure” unless tied to the role description. |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if they have 2+ support roles open):**  Noticed {{company}} has \[NUMBER\] support roles open right now. That usually signals some volume pressure at the moment.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have benchmarks for support ops in high-return retail: handle time on fit and sizing tickets, escalation rates. They look different from general retail benchmarks, which makes sense given the contact mix. Happy to share the relevant cuts for your category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one from me*

{{first\_name}} \--- this is the last one.

If now isn't the right time, no worries. gladly.ai has the overview.

I can also just send the benchmarks over without a call if that's easier.

{{sender.first\_name}}

| SEQUENCE A-3:  High Return Rate   ×   CIO / VP Digital / Chief Digital Officer FOR CIO / Chief Digital Officer / VP of Digital Transformation BRAND TYPES Swimwear, lingerie, footwear, children's clothing, athletic apparel *⚠️  No CX jargon in this sequence. Don't say: agents, CSAT, support queue, handle time, tickets. Say: revenue recovery, cart completion, modernization, digital program, ROI, LTV. This person is a transformation leader, not a CX operator.* |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *sizing uncertainty as a cart abandonment problem*

| 🔍  PERSONALIZE Use Exa to search official press releases, investor filings, executive announcements, careers, and credible retail press for {{company}}. Look for a concrete digital or operating-model signal: replatforming, eCommerce 2.0, omnichannel rollout, BOPIS/ship-from-store, data/AI hiring, new CTO/CDO/CPO, international expansion, retail/wholesale expansion, or explicit conversion/retention modernization. Do not use vague “digital transformation” language. Convert the verified signal into a business-sequencing sentence for a digital/ecommerce executive. Good shape: `Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.` If you cannot find a concrete signal, delete the first sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: verified digital/operating-model signal tied to cart completion, returns, or support continuity; delete if evidence is weak.]

Cart abandonment in high-return categories has a clear pattern worth knowing. Fit uncertainty, not having enough information to buy with confidence, accounts for a significant chunk. Rothy's started treating this as a digital program problem. The moment they made it easy to get a fast answer about sizing mid-browse, cart completion went up.

The ROI case tends to land faster than most commerce investments.

Worth a short conversation?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note about cart abandonment in high-return categories. Work with a few brands in your space on the digital side of that. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your cart recovery flow*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a shopper, try to ask a sizing question mid-browse, see what happens from the customer perspective. How many clicks to get help, whether I can get an answer without leaving the product page, what the experience is like when I can't find what I need. Takes about 30 minutes and I send you a one-page writeup.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *conversion lift from real-time pre-purchase support*

| 🔍  PERSONALIZE Use Exa to search official press releases, investor filings, executive announcements, careers, and credible retail press for {{company}}. Look for a concrete digital or operating-model signal: replatforming, eCommerce 2.0, omnichannel rollout, BOPIS/ship-from-store, data/AI hiring, new CTO/CDO/CPO, international expansion, retail/wholesale expansion, or explicit conversion/retention modernization. Do not use vague “digital transformation” language. Convert the verified signal into a business-sequencing sentence for a digital/ecommerce executive. Good shape: `Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.` If you cannot find a concrete signal, delete the first sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- different angle since I hadn't heard back.

**VERSION A (if you found a concrete digital investment signal):**  Given [SPECIFIC VERIFIED INITIATIVE], the sequencing question is probably where [pre-purchase support / returns / concierge continuity] fits into the digital roadmap.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have data on conversion lift in high-return retail when real-time support is available mid-browse versus when it isn't. Built for a finance audience rather than a CX one. Happy to send it over.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the priorities are elsewhere, completely fair. gladly.ai has the overview.

That analysis is available to send anytime. No strings on it.

{{sender.first\_name}}

| SEQUENCE B-1:  High Consideration / High Ticket   ×   VP / Director of CX FOR VP of CX / Director of Customer Experience BRAND TYPES Furniture, mattresses, electronics, luxury goods, home appliances  |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *the call that happens before someone buys a sofa*

| 🔍  PERSONALIZE Use Exa and Browserbase to inspect {{company}}'s product catalog, buying guides, PDPs, configurators, warranties, delivery/install pages, financing pages, and FAQ/help pages. Choose the product/category with the most decision complexity, not merely the highest price. Score complexity by configuration/options, fit/size/material compatibility, delivery/install/warranty requirements, high price or high regret risk, and need for expert guidance before purchase. Return one first sentence tying that product to a pre-purchase question a customer would reasonably ask. Good shape: `{{first_name}} --- [product/category] on the {{company}} site looks like the kind of purchase where customers need a real answer before they buy.` If no specific product stands out, use the category but include the decision complexity. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: complex product/category tied to a pre-purchase question a customer would reasonably ask.]

The CX leader at Nordstrom made a point that stuck. Their category can't deflect its way to better numbers. The brands winning in furniture and luxury are leaning into concierge-style support, not away from it. Customers who contact support before buying a high-ticket item convert at a significantly higher rate and have higher AOV , but they were routing those contacts into the general queue with no differentiation.

Worth 20 minutes to walk through how they're thinking about it?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, reached out last week about how brands selling high-ticket products are treating pre-purchase support as a revenue channel. Thought it was worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at {{company}}'s pre-purchase flow*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a customer, try to ask a question about your most complex products, see how fast I can get a real answer from the outside. How many clicks to reach help, what channels are available, how long before I hear back. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *a number worth knowing*

| 🔍  PERSONALIZE Use Exa to search Trustpilot, Google Reviews, app reviews, Reddit, and other accessible public reviews for {{company}}. Look only for repeated 2- or 3-star patterns tied to high-consideration purchases: slow pre-purchase response, unanswered product/spec questions, delivery/install/warranty confusion, or hard-to-get real guidance before buying. Use Version A only if you find at least 3 materially similar examples from recent or credible sources. Capture source URLs and short snippets internally. Do not quote inflammatory language. Do not say {{company}} "has a problem." Say the pattern "shows up" or "appears in reviews." If fewer than 3 examples or sources are weak, use Version B. Version A shape: `Pulled up recent {{company}} reviews and [specific pattern] shows up more than once --- that kind of friction usually shows up in conversion and AOV metrics.` |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if you found a review pattern):**  Pulled up some {{company}} reviews and \[DESCRIBE PATTERN, e.g., 'questions about product specs going unanswered before purchase'\]. That kind of friction tends to point to something specific in how pre-purchase contacts are being handled.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have data on assisted vs. unassisted conversion in high-consideration retail: customers who interact with support before buying convert at significantly higher rates and have higher AOV. Happy to share what the relevant numbers look like for {{company}}'s category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the timing isn't right, totally fair. gladly.ai has the overview.

The audit offer stands whenever. I can run it and send the notes async.

{{sender.first\_name}}

| SEQUENCE B-2:  High Consideration / High Ticket   ×   Head of Support / Support Operations FOR Head of Support / VP of Support Operations / Director of Support BRAND TYPES Furniture, mattresses, electronics, luxury goods, home appliances  |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *how Ralph Lauren staffs for pre-purchase calls*

| 🔍  PERSONALIZE Use Exa and Browserbase to inspect {{company}}'s product catalog, buying guides, PDPs, configurators, warranties, delivery/install pages, financing pages, and FAQ/help pages. Choose the product/category with the most decision complexity, not merely the highest price. Score complexity by configuration/options, fit/size/material compatibility, delivery/install/warranty requirements, high price or high regret risk, and need for expert guidance before purchase. Return one first sentence tying that product to a pre-purchase question a customer would reasonably ask. Good shape: `{{first_name}} --- [product/category] on the {{company}} site looks like the kind of purchase where customers need a real answer before they buy.` If no specific product stands out, use the category but include the decision complexity. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: complex product/category tied to a pre-purchase question a customer would reasonably ask.]

Something specific about how Ralph Lauren's support ops team thinks about queue design that's worth knowing. They pulled pre-purchase contacts, like questions about specific products, customization . Pulled them into their own routing path. Different agent pool with deeper product training, different escalation rules. They brought the strong brick-and-mortar experience to the web. Resolution in one touch went up significantly.

I'd love to walk through the operational setup if you've got 20 minutes.

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, reached out last week about pre-purchase routing for high-ticket products. Work with a few brands in your space on the ops side. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *quick look at your pre-purchase routing*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a customer, try to ask a question about your most complex product, see what the experience looks like from the outside. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send a short writeup.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *benchmarks for high-consideration support*

| 🔍  PERSONALIZE Use Exa to search official careers pages, Greenhouse/Lever/Ashby, and LinkedIn public job snippets for {{company}}. Count open support, CX, customer care, member experience, concierge, retention operations, or support operations roles, but prefer exact role titles and responsibilities over a raw count. Use Version A only if there are 2+ relevant open roles OR one senior role directly tied to the sequence angle, such as churn reduction, cancellation experience, support routing, QA, workforce management, or customer feedback loops. Version A shape: `{{company}} is hiring for [exact role/title or count], with responsibilities around [exact responsibility]. That usually means [volume/coverage/retention/routing] is active enough to have an owner.` Do not infer crisis from hiring. Do not say “pressure” unless tied to the role description. |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if 2+ support roles open):**  Noticed {{company}} has \[NUMBER\] support roles open right now. Usually a sign there's some volume or staffing pressure at the moment.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have benchmarks for support operations in high-ticket retail: handle time by contact type, first contact resolution on complex product questions. They look different from general benchmarks, which makes sense given the category. Happy to share the cuts relevant to {{company}}.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one from me*

{{first\_name}} \--- this is the last one.

If now isn't the right time, no worries. gladly.ai has the overview.

I can also just send the benchmarks over without a call.

{{sender.first\_name}}

| SEQUENCE B-3:  High Consideration / High Ticket   ×   CIO / VP Digital / Chief Digital Officer FOR CIO / Chief Digital Officer / VP of Digital Transformation BRAND TYPES Furniture, mattresses, electronics, luxury goods, home appliances *⚠️  Commerce language, not CX language. Say: conversion, AOV, assisted conversion, revenue per visitor. Not: CSAT, agents, tickets, support queue. This person owns the P\&L on digital channels.* |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *the concierge layer in the digital experience*

| 🔍  PERSONALIZE Use Exa to search official press releases, investor filings, executive announcements, careers, and credible retail press for {{company}}. Look for a concrete digital or operating-model signal: replatforming, eCommerce 2.0, omnichannel rollout, BOPIS/ship-from-store, data/AI hiring, new CTO/CDO/CPO, international expansion, retail/wholesale expansion, or explicit conversion/retention modernization. Do not use vague “digital transformation” language. Convert the verified signal into a business-sequencing sentence for a digital/ecommerce executive. Good shape: `Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.` If you cannot find a concrete signal, delete the first sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: verified digital investment signal tied to assisted conversion, concierge continuity, or pre-purchase support; delete if evidence is weak.]

There's a part of the high-consideration purchase journey that most digital programs don't instrument: what happens when a customer has a question before buying. Your category can't deflect its way to better numbers. The brands winning in your space are going the other direction. More consultative, more consultative. Nordstrom is famous for making customers feel known. Customers who interact with their team before buying have significantly higher AOV. That's a different architecture than what most CX tools are built for.

Worth a quick conversation about what that looks like operationally?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note about the concierge layer in digital conversion. Work with a few brands in your space on the digital side of that. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your pre-purchase journey*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a customer, try to ask a question about your most complex products, see what happens. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *conversion lift from assisted pre-purchase support*

| 🔍  PERSONALIZE Use Exa to search official press releases, investor filings, executive announcements, careers, and credible retail press for {{company}}. Look for a concrete digital or operating-model signal: replatforming, eCommerce 2.0, omnichannel rollout, BOPIS/ship-from-store, data/AI hiring, new CTO/CDO/CPO, international expansion, retail/wholesale expansion, or explicit conversion/retention modernization. Do not use vague “digital transformation” language. Convert the verified signal into a business-sequencing sentence for a digital/ecommerce executive. Good shape: `Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.` If you cannot find a concrete signal, delete the first sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- different angle since I hadn't heard back.

**VERSION A (if you found a concrete digital investment signal):**  Given [SPECIFIC VERIFIED INITIATIVE], the sequencing question is probably where assisted pre-purchase support fits into the digital roadmap.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have data on conversion rates in high-consideration retail when customers have access to real support before buying versus when they don't. Customers who get a fast answer have higher conversion and higher AOV. Built for a finance audience. Happy to send it over.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the priorities are elsewhere, completely fair. gladly.ai has the overview.

That analysis is available to send anytime. No strings on it.

{{sender.first\_name}}

| SEQUENCE C-1:  Subscription & Replenishment   ×   VP / Director of CX FOR VP of CX / Director of Customer Experience BRAND TYPES Supplements, pet food, beauty subscriptions, personal care, meal kits  |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *what MaryRuth's figured out about cancel calls*

| 🔍  PERSONALIZE Use Exa to inspect {{company}}'s official subscription pages, cancel/skip/pause FAQs, trial terms, retention/lifecycle job posts, funding/expansion news, and reviews. Find the strongest signal that subscription retention or cancellation experience is operationally important. Best signals, in order: (1) job post mentioning churn, LTV, pause/save logic, cancellation experience, retention dashboard, subscriber health; (2) official cancel/skip/pause/trial terms with renewal timing or support-assisted cancellation paths; (3) growth/funding/expansion signal combined with a subscription model; (4) repeated reviews about cancellation or subscription-management friction. Output shape: `{{first_name}} --- [specific retention/cancel/subscription signal] makes the save/cancel moment look like a revenue workflow, not just a support workflow.` If evidence is weak, delete the sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: strongest retention, cancel, subscription, growth, or lifecycle signal tied to the save/cancel moment; delete if weak.]

The CX team at MaryRuth's found something counterintuitive a while back. Their highest-LTV customers were disproportionately likely to have called in to cancel at some point and stayed. The conversation was handled fast enough and well enough that the person just changed their mind.

They rebuilt the cancel flow around that insight. The revenue those conversations recover now shows up in the board deck, not the support dashboard.

I'd love to share how they approached it if you've got 20 minutes.

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note last week about how subscription brands are handling cancel conversations differently. Work with a few brands in your space. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at {{company}}'s cancel flow*

{{first\_name}} \--- following up.

Something I do for subscription brands. I go through your site as a customer, try to manage a subscription, test the cancel flow, see what the experience looks like from the outside. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *subscription CX benchmarks*

| 🔍  PERSONALIZE Use Exa to search Trustpilot, Google Reviews, app reviews, Reddit, and other accessible public reviews for {{company}}. Look only for repeated 2- or 3-star patterns tied to subscription/replenishment: hard to cancel, pause/skip confusion, billing surprise, slow response during cancellation, delivery exception, or subscription-management friction. Use Version A only if you find at least 3 materially similar examples from recent or credible sources. Capture source URLs and short snippets internally. Do not quote inflammatory language. Do not say {{company}} "has a problem." Say the pattern "shows up" or "appears in reviews." If fewer than 3 examples or sources are weak, use Version B. Version A shape: `Pulled up recent {{company}} reviews and [specific pattern] shows up more than once --- that usually points to a subscriber-retention moment, not just generic support volume.` |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if you found a review pattern):**  Pulled up some {{company}} reviews and \[DESCRIBE PATTERN, e.g., 'cancel friction showing up in a fair number of the negative ones'\]. That kind of friction is usually recoverable once the right routing is in place.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have benchmarks for CX operations in subscription retail: repeat purchase rates, revenue recovered per cancel interaction. Happy to share what's relevant for {{company}}'s category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the timing isn't right, totally fair. gladly.ai has the overview.

The audit offer stands whenever. I can run it async and send the notes.

{{sender.first\_name}}

| SEQUENCE C-2:  Subscription & Replenishment   ×   Head of Support / Support Operations FOR Head of Support / VP of Support Operations / Director of Support BRAND TYPES Supplements, pet food, beauty subscriptions, personal care, meal kits  |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *how MaryRuth's redesigned the cancel queue*

| 🔍  PERSONALIZE Use Exa to inspect {{company}}'s official subscription pages, cancel/skip/pause FAQs, trial terms, retention/lifecycle job posts, funding/expansion news, and reviews. Find the strongest signal that subscription retention or cancellation experience is operationally important. Best signals, in order: (1) job post mentioning churn, LTV, pause/save logic, cancellation experience, retention dashboard, subscriber health; (2) official cancel/skip/pause/trial terms with renewal timing or support-assisted cancellation paths; (3) growth/funding/expansion signal combined with a subscription model; (4) repeated reviews about cancellation or subscription-management friction. Output shape: `{{first_name}} --- [specific retention/cancel/subscription signal] makes the save/cancel moment look like a revenue workflow, not just a support workflow.` If evidence is weak, delete the sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: strongest retention, cancel, subscription, growth, or lifecycle signal tied to support routing; delete if weak.]

Something specific about how MaryRuth's support ops team redesigned their cancel flow that's worth knowing. They created a dedicated routing path for cancel and downgrade contacts. Separate queue, agents with specific training and the authority to actually resolve. The save rate on those contacts went up significantly. Contacts that used to require a second touch started resolving in one.

I'd love to walk through the operational setup if you've got 20 minutes.

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, reached out last week about how subscription brands are redesigning cancel and downgrade routing. Work with a few brands in your space. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *quick look at your cancel routing*

{{first\_name}} \--- following up.

Something I do for subscription brands. I go through your site as a customer, try to manage a subscription and test the cancel flow, see what the experience looks like from the outside. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup.

Happy to run that for {{company}} and send the notes.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *cancel flow benchmarks for subscription brands*

| 🔍  PERSONALIZE Use Exa to search official careers pages, Greenhouse/Lever/Ashby, and LinkedIn public job snippets for {{company}}. Count open support, CX, customer care, member experience, concierge, retention operations, or support operations roles, but prefer exact role titles and responsibilities over a raw count. Use Version A only if there are 2+ relevant open roles OR one senior role directly tied to the sequence angle, such as churn reduction, cancellation experience, support routing, QA, workforce management, or customer feedback loops. Version A shape: `{{company}} is hiring for [exact role/title or count], with responsibilities around [exact responsibility]. That usually means [volume/coverage/retention/routing] is active enough to have an owner.` Do not infer crisis from hiring. Do not say “pressure” unless tied to the role description. |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if 2+ support roles open):**  Noticed {{company}} has \[NUMBER\] support roles open right now. Usually a sign there's some volume or coverage pressure at the moment.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have benchmarks for support ops in subscription retail: repeat purchase rates by channel, revenue recovered per cancel interaction. Happy to share the relevant cuts for {{company}}'s category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one from me*

{{first\_name}} \--- this is the last one.

If now isn't the right time, no worries. gladly.ai has the overview.

I can also just send the benchmarks over without a call.

{{sender.first\_name}}

| SEQUENCE C-3:  Subscription & Replenishment   ×   CIO / VP Digital / Chief Digital Officer FOR CIO / Chief Digital Officer / VP of Digital Transformation BRAND TYPES Supplements, pet food, beauty subscriptions, personal care, meal kits *⚠️  No CX jargon. Don't say: agents, CSAT, support queue, handle time, tickets. Say: revenue recovery, subscriber retention, LTV, modernization, digital program, ROI. This person thinks about transformation sequencing and board-level ROI, not day-to-day support ops.* |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *the transformation bet with the fastest payback*

| 🔍  PERSONALIZE Use Exa to search official press releases, investor filings, executive announcements, careers, and credible retail press for {{company}}. Look for a concrete digital or operating-model signal: replatforming, eCommerce 2.0, omnichannel rollout, BOPIS/ship-from-store, data/AI hiring, new CTO/CDO/CPO, international expansion, retail/wholesale expansion, or explicit conversion/retention modernization. Do not use vague “digital transformation” language. Convert the verified signal into a business-sequencing sentence for a digital/ecommerce executive. Good shape: `Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.` If you cannot find a concrete signal, delete the first sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: verified transformation, retention, subscription, or operating-model signal tied to roadmap sequencing; delete if weak.]

When teams are running multiple transformation workstreams in parallel, the sequencing question is usually the hard one. CX tends to get slotted behind commerce and supply chain. For a subscription business, the economics on that ordering are worth reconsidering. The revenue recovered from a retained subscriber versus a cancel that went uncontested tends to stack up faster than most other bets on the roadmap. MaryRuth's resequenced around this. The numbers made the case fast.

Worth a short conversation?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note about transformation sequencing for subscription businesses. We work with a few brands in your space on the digital side of that. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your subscriber lifecycle*

{{first\_name}} \--- following up.

Something I do for subscription businesses. I go through your site as a customer, try to manage a subscription, test the cancel flow, see what the experience looks like from the outside. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send the findings.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *the revenue number your board probably isn't seeing*

| 🔍  PERSONALIZE Use Exa to search official press releases, investor filings, executive announcements, careers, and credible retail press for {{company}}. Look for a concrete digital or operating-model signal: replatforming, eCommerce 2.0, omnichannel rollout, BOPIS/ship-from-store, data/AI hiring, new CTO/CDO/CPO, international expansion, retail/wholesale expansion, or explicit conversion/retention modernization. Do not use vague “digital transformation” language. Convert the verified signal into a business-sequencing sentence for a digital/ecommerce executive. Good shape: `Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.` If you cannot find a concrete signal, delete the first sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- different angle since I hadn't heard back.

**VERSION A (if you found a concrete transformation signal):**  Given [SPECIFIC VERIFIED INITIATIVE], the sequencing question is probably where subscription save moments and customer continuity fit into the roadmap.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We put together an analysis on CX ROI in subscription retail: what the revenue impact looks like when the subscriber communication layer is modernized versus not. Built for a finance audience rather than a CX one, which makes it more useful. Happy to send it over.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the priorities are elsewhere right now, completely makes sense. gladly.ai has the broader picture.

That analysis is available to send anytime. No strings on it.

{{sender.first\_name}}

| SEQUENCE D-1:  eCommerce Leader × High Return Rate FOR Director of eCommerce / VP of Digital / Chief Digital Officer BRAND TYPES Swimwear, lingerie, footwear, kids clothing *⚠️  Commerce language, not CX language. Say: conversion, cart completion, repeat purchase rate, AOV, revenue per visitor, LTV. Don't say: CSAT, handle time, agents, tickets, support queue.* |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *rothy's connected CX to the conversion funnel*

| 🔍  PERSONALIZE Use Exa, then Browserbase if needed, to inspect {{company}}'s official homepage, new arrivals, featured collection pages, and recent public Instagram/TikTok. Identify the product, collection, or campaign they are currently pushing hardest. Then decide whether it plausibly creates fit, sizing, gift-timing, return, or pre-purchase question volume. Write one copy-safe first sentence that connects the campaign to the customer moment, not just the product name. Good shape: `{{first_name}} --- {{company}}'s [collection/campaign] likely puts [fit/sizing/gift timing/product-comparison] questions right in the buying moment.` Use only if the campaign/product is current or prominently featured and the tie to the sequence angle is natural. If evidence is weak, delete the sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: campaign/collection tied to fit, sizing, gift timing, returns, or pre-purchase question volume.]

In high-return categories, fit uncertainty doesn't show up as a support ticket, it shows up as cart abandonment. Rothy's connected this to the conversion funnel. When they made it easy to get a fast answer about sizing mid-browse, without leaving the product page, cart completion went up. Not because they got better at CX. Because they fixed a leak in the purchase funnel.

The play in your category is making sure those conversations happen where the sale is, not where support is.

Worth 20 minutes to talk through what that looks like?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note about connecting fit conversations to cart completion in high-return categories. Work with a few brands in your space on the ecomm side. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your cart recovery flow*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a shopper, try to ask a sizing question mid-browse, see what happens. How many clicks to reach help, whether I can get an answer without leaving the product page. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *cart abandonment recovery when support is available mid-purchase*

| 🔍  PERSONALIZE Use Exa to search Trustpilot, Google Reviews, app reviews, Reddit, and other accessible public reviews for {{company}}. Look only for repeated 2- or 3-star patterns tied to high-return retail: sizing confusion, fit mismatch, exchange/return friction, abandoned carts, or hard-to-reach help before purchase. Use Version A only if you find at least 3 materially similar examples from recent or credible sources. Capture source URLs and short snippets internally. Do not quote inflammatory language. Do not say {{company}} "has a problem." Say the pattern "shows up" or "appears in reviews." If fewer than 3 examples or sources are weak, use Version B. Version A shape: `Pulled up recent {{company}} reviews and [specific pattern] shows up more than once --- that usually points to [operational moment], not just generic support volume.` |
| :---- |

{{first\_name}} \--- different angle since I hadn't heard back.

**VERSION A (if you found a review pattern):**  Pulled up some {{company}} reviews and \[DESCRIBE THE PATTERN, e.g., 'sizing questions showing up in a lot of the negative ones'\]. That usually points to cart abandonment, not support tickets.

**VERSION B (if no pattern found):**  Quick one since I hadn't heard back.

We have data on conversion lift in high-return retail: cart abandonment recovery rates, repeat purchase rates when real-time support is available at key moments. Happy to share the relevant benchmarks for your category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the timing isn't right, totally fair. gladly.ai has the overview.

The audit offer stands whenever it makes sense. I can run it async and send the notes.

{{sender.first\_name}}

| SEQUENCE D-2:  eCommerce Leader × High Consideration FOR Director of eCommerce / VP of Digital / Chief Digital Officer BRAND TYPES Furniture, electronics, luxury goods *⚠️  Commerce language, not CX language. Say: conversion, AOV, assisted conversion, revenue per visitor, customer LTV. Don't say: CSAT, handle time, agents, tickets.* |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *nordstrom built a digital concierge layer*

| 🔍  PERSONALIZE Use Exa and Browserbase to inspect {{company}}'s product catalog, buying guides, PDPs, configurators, warranties, delivery/install pages, financing pages, and FAQ/help pages. Choose the product/category with the most decision complexity, not merely the highest price. Score complexity by configuration/options, fit/size/material compatibility, delivery/install/warranty requirements, high price or high regret risk, and need for expert guidance before purchase. Return one first sentence tying that product to a pre-purchase question a customer would reasonably ask. Good shape: `{{first_name}} --- [product/category] on the {{company}} site looks like the kind of purchase where customers need a real answer before they buy.` If no specific product stands out, use the category but include the decision complexity. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: complex product/category tied to a pre-purchase question a customer would reasonably ask.]

Nordstrom built a digital concierge layer that mimics what their best in-store associates do. Your category can't deflect its way to better numbers. The brands winning in your space are going the other direction. More consultative. Customers who interact with that team before buying convert at significantly higher rates and have higher AOV.

That's a different architecture than what most CX tools are built for. But the math works.

Worth 20 minutes to talk through what that looks like operationally?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note about building a concierge layer into digital conversion. Work with a few brands in your space on the ecomm side. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your pre-purchase journey*

{{first\_name}} \--- following up.

Something I do for brands in your category. I go through your site as a customer, try to ask a question about your most complex products, see what happens. How many clicks to reach help, what channels are available, how fast I can get a real answer. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *conversion and AOV lift from assisted pre-purchase interactions*

| 🔍  PERSONALIZE Use Exa to search Trustpilot, Google Reviews, app reviews, Reddit, and other accessible public reviews for {{company}}. Look only for repeated 2- or 3-star patterns tied to high-consideration purchases: slow pre-purchase response, unanswered product/spec questions, delivery/install/warranty confusion, or hard-to-get real guidance before buying. Use Version A only if you find at least 3 materially similar examples from recent or credible sources. Capture source URLs and short snippets internally. Do not quote inflammatory language. Do not say {{company}} "has a problem." Say the pattern "shows up" or "appears in reviews." If fewer than 3 examples or sources are weak, use Version B. Version A shape: `Pulled up recent {{company}} reviews and [specific pattern] shows up more than once --- that kind of friction usually shows up in conversion and AOV metrics.` |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if you found a review pattern):**  Pulled up some {{company}} reviews and \[DESCRIBE PATTERN, e.g., 'product specification questions going unanswered'\]. That kind of friction usually shows up in conversion and AOV metrics.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have data on conversion and AOV in high-consideration retail: assisted vs. unassisted conversion rates, AOV lift from concierge support. Happy to share what the relevant numbers look like for {{company}}'s category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the timing isn't right, totally fair. gladly.ai has the overview.

The audit offer stands whenever. I can run it and send the notes async.

{{sender.first\_name}}

| SEQUENCE D-3:  eCommerce Leader × Subscription FOR Director of eCommerce / VP of Digital / Chief Digital Officer BRAND TYPES Supplements, pet food, beauty subscriptions *⚠️  Commerce language, not CX language. Say: repeat purchase rate, revenue recovered, customer LTV, churn reduction. Don't say: CSAT, agents, tickets, support queue.* |
| :---- |

**STEP 1    EMAIL**   *·   peer story*

**Subject:** *how MaryRuth's monetized the cancel flow*

| 🔍  PERSONALIZE Use Exa to inspect {{company}}'s official subscription pages, cancel/skip/pause FAQs, trial terms, retention/lifecycle job posts, funding/expansion news, and reviews. Find the strongest signal that subscription retention or cancellation experience is operationally important. Best signals, in order: (1) job post mentioning churn, LTV, pause/save logic, cancellation experience, retention dashboard, subscriber health; (2) official cancel/skip/pause/trial terms with renewal timing or support-assisted cancellation paths; (3) growth/funding/expansion signal combined with a subscription model; (4) repeated reviews about cancellation or subscription-management friction. Output shape: `{{first_name}} --- [specific retention/cancel/subscription signal] makes the save/cancel moment look like a revenue workflow, not just a support workflow.` If evidence is weak, delete the sentence and use the generic opener. |
| :---- |

{{first\_name}} \--- [SELECTED_INSERT: strongest retention, cancel, subscription, growth, or lifecycle signal tied to revenue recovery; delete if weak.]

In subscription retail, the cancel conversation is usually treated as a cost to minimize. MaryRuth's reframed it as a revenue problem. When customers call to cancel and get a fast answer, a significant percentage just change their mind. Revenue recovered from those save conversations now shows up in their ecomm revenue reporting as a line item.

The play is making sure those conversations are easy and happen in a context where they actually move the revenue needle.

Worth 20 minutes to talk through what that looks like?

{{sender.first\_name}}

**STEP 2    LINKEDIN**   *·   connection note*

| 🔗  LINKEDIN \- Connection Request Note   (keep under 200 characters \- LinkedIn cuts longer notes off) {{first\_name}}, sent you a note about monetizing the subscriber lifecycle. Work with a few brands in your space on the digital revenue side. Worth connecting. {{sender.first\_name}} |
| :---- |

**STEP 3    EMAIL**   *·   audit offer*

**Subject:** *offer to look at your subscriber management experience*

{{first\_name}} \--- following up.

Something I do for subscription brands. I go through your site as a customer, try to manage a subscription and test the cancel flow, see what the experience looks like from the outside. How many clicks to reach help, what channels are available, how fast a response comes back. Takes about 30 minutes and I send you a one-page writeup with what I found.

Happy to run that for {{company}} and send it over.

{{sender.first\_name}}

**STEP 4    EMAIL**   *·   benchmarks / data*

**Subject:** *repeat purchase rates and revenue recovery in subscription*

| 🔍  PERSONALIZE Use Exa to search Trustpilot, Google Reviews, app reviews, Reddit, and other accessible public reviews for {{company}}. Look only for repeated 2- or 3-star patterns tied to subscription/replenishment: hard to cancel, pause/skip confusion, billing surprise, slow response during cancellation, delivery exception, or subscription-management friction. Use Version A only if you find at least 3 materially similar examples from recent or credible sources. Capture source URLs and short snippets internally. Do not quote inflammatory language. Do not say {{company}} "has a problem." Say the pattern "shows up" or "appears in reviews." If fewer than 3 examples or sources are weak, use Version B. Version A shape: `Pulled up recent {{company}} reviews and [specific pattern] shows up more than once --- that usually points to a subscriber-retention moment, not just generic support volume.` |
| :---- |

{{first\_name}} \--- different angle.

**VERSION A (if you found a review pattern):**  Pulled up some {{company}} reviews and \[DESCRIBE PATTERN, e.g., 'cancel friction showing up in the negative ones'\]. That usually correlates with repeat purchase rate and LTV impact.

**VERSION B (generic):**  Quick one since I hadn't heard back.

We have data on subscription revenue recovery: repeat purchase rates by interaction type, revenue recovered per cancel conversation. Brands like AG1 use this to model churn prevention ROI. Happy to share the relevant benchmarks for your category.

{{sender.first\_name}}

**STEP 5    EMAIL**   *·   breakup*

**Subject:** *last one*

{{first\_name}} \--- won't follow up after this.

If the timing isn't right, totally fair. gladly.ai has the overview.

The audit offer stands whenever it makes sense. I can run it async and send the notes.

{{sender.first\_name}}
