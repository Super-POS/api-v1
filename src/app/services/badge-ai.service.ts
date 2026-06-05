// ===========================================================================>> Core Library
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// ===========================================================================>> Custom Library — badge catalogue (read at startup, never mutated)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BADGE_CATALOGUE: Record<string, string[]> = require('../../../scripts/badge.json');
import RewardPoint from '@app/models/reward/reward_point.model';

// ---------------------------------------------------------------------------
// Flat list of every badge name across all categories (used in the prompt)
// ---------------------------------------------------------------------------
const ALL_BADGES: string[] = Object.values(BADGE_CATALOGUE).flat();

// ---------------------------------------------------------------------------
// Coffee-roast ranking tiers (rank based on TOTAL points ever earned)
// Thresholds are calibrated for KHR-priced items (e.g. 5 000 KHR coffee ≈ 5 000 pts/visit)
// ---------------------------------------------------------------------------
export const COFFEE_RANKS: { min: number; label: string; tier: number }[] = [
    { min: 0,       label: 'Green Bean (Starter)',      tier: 1  },
    { min: 100,     label: 'Light Roast Recruit',       tier: 2  },
    { min: 250,     label: 'City Roast Member',         tier: 3  },
    { min: 500,     label: 'Full City Explorer',        tier: 4  },
    { min: 1_000,   label: 'Medium Roast Regular',      tier: 5  },
    { min: 2_500,   label: 'Vienna Roast Veteran',      tier: 6  },
    { min: 5_000,   label: 'Dark Roast Devotee',        tier: 7  },
    { min: 10_000,  label: 'French Roast Champion',     tier: 8  },
    { min: 20_000,  label: 'Espresso Elite',            tier: 9  },
    { min: 35_000,  label: 'Single Origin Sovereign',   tier: 10 },
    { min: 55_000,  label: 'Reserve Roast Legend',      tier: 11 },
    { min: 85_000,  label: 'Black Label Patron',        tier: 12 },
    { min: 125_000, label: 'Master Blend Guardian',     tier: 13 },
    { min: 175_000, label: 'The Signature Pour',        tier: 14 },
    { min: 250_000, label: 'Infinite Roast',            tier: 15 },
];

// ---------------------------------------------------------------------------
// Five personality / interest questions shown to the customer
// ---------------------------------------------------------------------------
export const BADGE_QUESTIONS: { id: number; question: string; options: string[] }[] = [
    {
        id      : 1,
        question: 'What brings you to our café most often?',
        options : [
            'Studying or working',
            'Meeting friends',
            'Business meetings',
            'Creative projects',
            'Just chilling and enjoying coffee',
        ],
    },
    {
        id      : 2,
        question: 'Which best describes you?',
        options : [
            'Student',
            'Working professional',
            'Entrepreneur or founder',
            'Artist or creative',
            'Educator or mentor',
            'Parent or caregiver',
            'Community volunteer',
        ],
    },
    {
        id      : 3,
        question: "When you're not at the café, what are you usually doing?",
        options : [
            'Coding or building tech',
            'Sports or fitness',
            'Reading books',
            'Making music or art',
            'Creating content / photography',
            'Traveling or exploring',
            'Spending time with family',
        ],
    },
    {
        id      : 4,
        question: "What's your coffee personality?",
        options : [
            'I need the caffeine to function',
            'I love the ritual and slow process',
            'I enjoy experimenting with flavors',
            "I'm here for the vibe, not just the coffee",
        ],
    },
    {
        id      : 5,
        question: 'What kind of impact matters most to you?',
        options : [
            'Youth education and future generations',
            'Environmental sustainability',
            'Tech innovation and digital access',
            'Community building and social connection',
            'Arts, culture and creative expression',
            'Health and wellbeing',
        ],
    },
];

// ---------------------------------------------------------------------------
// Helper: resolve current rank tier from total points ever earned
// ---------------------------------------------------------------------------
export function resolveRank(
    totalEarned: number,
    ranks: { min: number; label: string; tier: number }[] = COFFEE_RANKS,
): {
    level          : number;
    name           : string;
    min_points     : number;
    max_points     : number | null;
    next_rank_name : string | null;
    points_to_next : number | null;
} {
    let current = ranks[0];
    for (const r of ranks) {
        if (totalEarned >= r.min) current = r;
        else break;
    }
    const nextRank = ranks.find(r => r.min > current.min) ?? null;
    return {
        level          : current.tier,
        name           : current.label,
        min_points     : current.min,
        max_points     : nextRank?.min ?? null,
        next_rank_name : nextRank?.label ?? null,
        points_to_next : nextRank ? nextRank.min - totalEarned : null,
    };
}

// ---------------------------------------------------------------------------
// BadgeAiService — calls OpenAI GPT-4o-mini to pick the best badge
// ---------------------------------------------------------------------------
@Injectable()
export class BadgeAiService {

    private readonly logger = new Logger(BadgeAiService.name);

    constructor(private readonly http: HttpService) {}

    /** Returns the 5 questions the frontend should show the user */
    getQuestions() {
        return BADGE_QUESTIONS;
    }

    /**
     * Sends user answers + context to GPT-4o-mini and returns the chosen badge name.
     * answers[i] corresponds to BADGE_QUESTIONS[i]. Pass empty array when no Q&A available.
     */
    async decideBadge(params: {
        customerName : string;
        totalEarned  : number;
        rankLabel    : string;
        answers      ?: string[];
    }): Promise<string> {

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new BadRequestException('OPENAI_API_KEY is not configured on this server.');
        }

        const { customerName, totalEarned, rankLabel, answers = [] } = params;

        // Build the Q&A section — omit if no answers
        const qa = answers.length > 0
            ? BADGE_QUESTIONS.map((q, i) =>
                `Q${i + 1}: ${q.question}\nA: ${answers[i] ?? '(no answer)'}`,
              ).join('\n\n')
            : '(Customer has not completed the personality questionnaire yet. Use rank and loyalty to decide.)';

        // Compact badge list for the prompt (category: [badge1, badge2, ...])
        const badgeList = Object.entries(BADGE_CATALOGUE)
            .map(([cat, names]) => `**${cat}**: ${names.join(' | ')}`)
            .join('\n');

        const systemPrompt = `You are a badge curator for a specialty coffee shop called "54 Coffee" that supports youth and community causes.
Your job is to assign ONE badge that best reflects who the customer is based on their answers and loyalty level.

## Rules
- You MUST return ONLY the exact badge name from the list below — no explanation, no punctuation outside the JSON.
- Respond with valid JSON: { "badge": "<exact badge name>" }
- The badge name must appear VERBATIM in the badge catalogue.
- If the user is a high-tier loyalist (tier ≥ 10), prefer a premium or legacy badge.
- Match the user's personality, profession, and values to the most fitting badge.

## Badge Catalogue
${badgeList}`;

        const userPrompt = `Customer: ${customerName}
Total points earned: ${totalEarned.toLocaleString()} (Rank: ${rankLabel})

${qa}

Based on everything above, choose the single best badge for this customer.`;

        try {
            const response = await firstValueFrom(
                this.http.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model      : 'gpt-5-mini',
                        messages   : [
                            { role: 'system', content: systemPrompt },
                            { role: 'user',   content: userPrompt   },
                        ],
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
            const parsed = JSON.parse(raw.trim());
            const badge: string = parsed?.badge?.trim();

            if (!badge || !ALL_BADGES.includes(badge)) {
                this.logger.warn(`GPT returned unknown badge: "${badge}" — falling back`);
                return this._fallback(totalEarned);
            }

            return badge;

        } catch (err) {
            this.logger.error('OpenAI badge call failed', (err as Error).message);
            throw new BadRequestException('Could not determine badge at this time. Please try again later.');
        }
    }

    /**
     * Auto-assign badge on rank-up. Fire-and-forget safe — never throws.
     * Uses stored Q&A answers if available, otherwise decides by rank alone.
     */
    async decideBadgeForRankUp(params: {
        customerName  : string;
        totalEarned   : number;
        newRankLabel  : string;
        badgeAnswers  : string | null;  // JSON string from reward_point.badge_answers
        rewardPointId : number;
    }): Promise<void> {
        try {
            const answers: string[] = params.badgeAnswers
                ? JSON.parse(params.badgeAnswers)
                : [];

            const badge = await this.decideBadge({
                customerName : params.customerName,
                totalEarned  : params.totalEarned,
                rankLabel    : params.newRankLabel,
                answers,
            });

            await RewardPoint.update({ badge }, { where: { id: params.rewardPointId } });
            this.logger.log(`Rank-up badge assigned: "${badge}" → rewardPoint #${params.rewardPointId}`);
        } catch (err) {
            // Never fail the order over a badge error
            this.logger.error('decideBadgeForRankUp failed', (err as Error).message);
        }
    }

    /** Fallback: pick deterministically from coffeeRoastRank */
    private _fallback(totalEarned: number): string {
        const rank = resolveRank(totalEarned);
        const roastBadges: string[] = BADGE_CATALOGUE['coffeeRoastRank'] ?? [];
        return roastBadges[Math.min(rank.level - 1, roastBadges.length - 1)] ?? 'Green Bean (Starter)';
    }
}
