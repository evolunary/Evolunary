import { Anthropic } from '@anthropic-ai/sdk';
import { WikiArticle } from './WikiScraper';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Evolunary Claude-powered content generation module
 * Handles structured HTML generation, tweet summarization, and custom prompting
 */

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

/**
 * Generates interactive HTML from a given article content and prompt
 */
export async function generateHTMLFromArticle(articleContent: string, prompt: string) {
  const PROMPT = `
${prompt}

<Article Content>
{{ ${articleContent} }}
</Article Content>
  `;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    system: 'Generate HTML with user interactivity based on the input provided.',
    max_tokens: 8000,
    messages: [{ role: 'user', content: PROMPT }]
  });

  return response;
}

/**
 * Creates a tweet-length summary or comment based on a full article
 */
export async function generateTweetFromContent(article: WikiArticle, articleContent: string, prompt: string) {
  const PROMPT = `
${prompt}

<Article>
{{ ${JSON.stringify(article)} }}
<Article/>

<Article Content>
{{ ${articleContent} }}
</Article Content>
  `;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    system: 'Generate a tweet based on the article provided.',
    max_tokens: 200,
    messages: [{ role: 'user', content: PROMPT }]
  });

  return response;
}

/**
 * Suggests a new, complex research topic in JSON format
 */
export async function generateNewTopic() {
  const PROMPT = `
Generate a new research topic that is interesting, complex, and thought-provoking.
It should be specific enough to explore deeply but broad enough to offer multiple angles.
Return only valid JSON:
{
  "topic": "your topic here"
}
  `;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    system: 'You are an expert at identifying compelling research topics. Return valid JSON only.',
    max_tokens: 500,
    messages: [{ role: 'user', content: PROMPT }]
  });

  return response;
}

/**
 * Generic Claude prompt wrapper with system role and flexible token count
 */
export async function prompt(system: string, promptText: string, maxTokens: number = 2000) {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    system,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: promptText }]
  });

  return response;
}
