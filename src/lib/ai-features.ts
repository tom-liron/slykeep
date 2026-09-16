/**
 * How the four AI features name themselves when one of them is refused for want of Pro.
 *
 * The refusal is written twice — once by `guardAiRequest` in `actions/ai.ts`, which is the
 * authority, and once by `hooks/use-ai-upsell.ts`, which answers a click the client already knows
 * will be refused and so never reaches the server. Both build their sentence from
 * {@link proRequiredMessage} and name the feature from {@link AI_FEATURE_NOUNS}, so the two cannot
 * come to say different things about the same button.
 *
 * @remarks
 * Client-safe by necessity: the hook imports it. Nothing here touches the entitlement rule itself,
 * which stays in `lib/limits.ts` and is enforced in the action.
 */

/**
 * The feature names, as they read mid-sentence.
 *
 * Plural noun phrases, because both sentences that use them are plural: "AI *tag suggestions*
 * require a Pro subscription", "you have used all your *explanations*". Keyed by the action that
 * produces each one.
 */
export const AI_FEATURE_NOUNS = {
    generateAutoTags: "tag suggestions",
    generateDescription: "descriptions",
    explainCode: "explanations",
    optimizePrompt: "prompt optimizations",
} as const;

export type AiFeatureNoun = (typeof AI_FEATURE_NOUNS)[keyof typeof AI_FEATURE_NOUNS];

/**
 * The first sentence of a Pro refusal, naming the feature that was asked for.
 *
 * @remarks
 * A sentence, not a whole message: each caller finishes it with the way out that its surface can
 * offer. The action appends "Upgrade in Settings", since a Server Action returns a string and
 * cannot hand back a control; the client toast appends nothing and renders an Upgrade button
 * instead.
 */
export function proRequiredMessage(feature: AiFeatureNoun): string {
    return `AI ${feature} require a Pro subscription.`;
}
