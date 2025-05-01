import * as fs from 'node:fs/promises';
import { prompt } from './llm';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Evolunary TopicTree
 * A dynamic topic graph that supports branching, linking, and persistent storage
 */
class TopicTree {
  private tree: Record<string, { subtopics: string[]; links: string[] }> = {};

  addNode(topic: string, subtopics: string[] = []) {
    if (!this.tree[topic]) {
      this.tree[topic] = { subtopics: [], links: [] };
    }
    this.tree[topic].subtopics.push(...subtopics);
  }

  removeNode(topic: string) {
    delete this.tree[topic];
    for (const key in this.tree) {
      this.tree[key].subtopics = this.tree[key].subtopics.filter(sub => sub !== topic);
      this.tree[key].links = this.tree[key].links.filter(link => link !== topic);
    }
  }

  addLink(topic: string, linkedTopic: string) {
    if (this.tree[topic] && this.tree[linkedTopic]) {
      this.tree[topic].links.push(linkedTopic);
    }
  }

  async saveToFile(filename: string) {
    await fs.writeFile(filename, JSON.stringify(this.tree, null, 4));
  }

  async loadFromFile(filename: string) {
    const data = await fs.readFile(filename, 'utf-8');
    this.tree = JSON.parse(data);
  }

  getTopics(): string[] {
    return Object.keys(this.tree);
  }

  getBranches(topic: string): { subtopics: string[]; links: string[] } {
    return this.tree[topic] || { subtopics: [], links: [] };
  }

  getRandomBranch(): { topic: string; subtopics: string[]; links: string[] } | null {
    const topics = Object.keys(this.tree);
    if (topics.length === 0) return null;
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    return { topic: randomTopic, ...this.tree[randomTopic] };
  }

  getAllTopics(): string[] {
    const topics = new Set<string>();
    for (const topic in this.tree) {
      topics.add(topic);
      this.tree[topic].subtopics.forEach(sub => topics.add(sub));
      this.tree[topic].links.forEach(link => topics.add(link));
    }
    return Array.from(topics);
  }
}

// Initial core topic list for branching
const topics = [
  "Book of Genesis",
  "Sumeria",
  "Ascension Glossary",
  "Annunaki",
  "Book of Thoth",
  "Emerald Tablets of Thoth",
  "2012 Mayan Calendar",
  "Tower of Babel",
  "Nibiru",
  "Nag Hammadi Library",
  "Book of Enoch",
  "Corpus Hermeticum",
  "Behold a Pale Horse",
  "Babylon",
  "Kyballion",
  "Dead Sea Scrolls",
  "Ascension Glossary"
];

/**
 * Generates a TopicTree from a base set of topics using LLM prompt engineering
 * @param topics Array of base topics to branch from
 * @returns Populated TopicTree instance
 */
export const generateTopicTree = async (topics: string[]): Promise<TopicTree> => {
  const SYSTEM_PROMPT = `You are an Evolunary agent responsible for generating logical topic branches based on provided seeds.`;

  const PROMPT = `
    You are given an array of foundational topics. Generate at least 5 logically connected branches per topic.
    
    <Topic Input>
    ${topics.join("\n")}
    </Topic Input>

    Respond only with JSON in the following structure:
    {
        "Topic A": ["Branch 1", "Branch 2", ...],
        "Topic B": [...],
        ...
    }
  `;

  const response = await prompt(SYSTEM_PROMPT, PROMPT, 2000);

  if (!response.content.length) {
    throw new Error("ERR_NO_CONTENT_RETURNED");
  }

  if (response.content[0].type !== "text") {
    throw new Error("ERR_CONTENT_NOT_TEXT_TYPE");
  }

  const parsed = JSON.parse(response.content[0].text);
  const topicTree = new TopicTree();

  for (const [topic, branches] of Object.entries(parsed)) {
    topicTree.addNode(topic, branches as string[]);
  }

  return topicTree;
};
