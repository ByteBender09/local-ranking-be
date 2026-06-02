// Shared venue ranking helpers.
//
// Problem: a raw `ORDER BY rating DESC` lets a 4.9★ venue with 3 reviews
// outrank a 4.6★ venue with 2,000 reviews — a high average on a tiny sample
// isn't trustworthy. We fix this with a Bayesian weighted rating that regresses
// a venue's average toward a global prior until it has enough reviews to be
// confident.

// Minimum review volume before a venue's own rating is trusted at face value.
// Below this the score is pulled toward BAYESIAN_PRIOR. Matches the product
// rule "fewer than 100 reviews shouldn't sit at the very top".
export const MIN_CONFIDENT_REVIEWS = 100;

// Prior mean rating the score regresses toward when review volume is thin.
// Deliberately below the typical 4.5+ "vanity" averages so low-volume venues
// settle mid-pack rather than at the top.
export const BAYESIAN_PRIOR = 3.8;

// Bayesian weighted rating as a SQL expression:
//   score = (v·R + m·C) / (v + m)
// where v = review_count, R = rating, m = MIN_CONFIDENT_REVIEWS, C = prior.
// `review_count` is the blended (in-app + external) count, so imported venues
// with large external review volumes are trusted proportionally. Constants are
// inlined (not bound params) because TypeORM's orderBy() takes raw SQL with no
// parameter binding — they are our own numeric literals, never user input.
export function bayesianScoreExpr(alias: string): string {
  return (
    `((${alias}.review_count * ${alias}.rating + ` +
    `${MIN_CONFIDENT_REVIEWS} * ${BAYESIAN_PRIOR}) / ` +
    `(${alias}.review_count + ${MIN_CONFIDENT_REVIEWS}))`
  );
}
