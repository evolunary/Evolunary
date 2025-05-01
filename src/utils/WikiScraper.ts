/**
 * Evolunary WikiScraper Module
 * Unified interface for querying Wikipedia via the MediaWiki API
 * Supports article search, content extraction, metadata, and link analysis.
 */

interface WikiParams {
  [key: string]: string | number | boolean;
}

interface WikiPage {
  extract?: string;
  categories?: Array<{ title: string }>;
  links?: Array<{ title: string }>;
  revisions?: Array<{
    timestamp: string;
    user: string;
    comment: string;
    size: number;
  }>;
}

export interface WikiArticle {
  title: string;
  snippet: string;
  pageid: number;
  size: number;
  timestamp: string;
  url: string;
}

interface WikiResponse {
  query: {
    pages: {
      [key: string]: WikiPage;
    };
    search?: Array<{
      title: string;
      snippet: string;
      pageid: number;
      size: number;
      timestamp: string;
    }>;
  };
}

export class WikiScraper {
  private apiEndpoint: string;
  private baseUrl: string;

  constructor(apiEndpoint = 'https://en.wikipedia.org/w/api.php') {
    this.apiEndpoint = apiEndpoint;
    this.baseUrl = 'https://en.wikipedia.org/wiki/';
  }

  private buildUrl(params: WikiParams): string {
    const defaultParams = {
      format: 'json',
      origin: '*',
    };
    const fullParams = { ...defaultParams, ...params };
    const queryString = new URLSearchParams(fullParams as Record<string, string>).toString();
    return `${this.apiEndpoint}?${queryString}`;
  }

  private getWikiUrl(title: string): string {
    return `${this.baseUrl}${encodeURIComponent(title.replace(/ /g, '_'))}`;
  }

  async getArticleContent(title: string): Promise<string | undefined> {
    const params: WikiParams = {
      action: 'query',
      prop: 'extracts',
      titles: title,
      exintro: true,
      explaintext: true,
    };

    const response = await fetch(this.buildUrl(params));
    const data = (await response.json()) as WikiResponse;
    const pageId = Object.keys(data.query.pages)[0];
    return data.query.pages[pageId].extract;
  }

  async searchArticles(
    query: string,
    limit = 10
  ): Promise<WikiArticle[]> {
    const params: WikiParams = {
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: limit,
    };

    const response = await fetch(this.buildUrl(params));
    const data = (await response.json()) as WikiResponse;

    return (
      data.query.search?.map(result => ({
        ...result,
        url: this.getWikiUrl(result.title),
      })) ?? []
    );
  }

  async getArticleCategories(title: string): Promise<string[]> {
    const params: WikiParams = {
      action: 'query',
      prop: 'categories',
      titles: title,
      cllimit: 500,
    };

    const response = await fetch(this.buildUrl(params));
    const data = (await response.json()) as WikiResponse;
    const pageId = Object.keys(data.query.pages)[0];
    return data.query.pages[pageId].categories?.map(c => c.title) || [];
  }

  async getArticleLinks(title: string): Promise<string[]> {
    const params: WikiParams = {
      action: 'query',
      prop: 'links',
      titles: title,
      pllimit: 500,
    };

    const response = await fetch(this.buildUrl(params));
    const data = (await response.json()) as WikiResponse;
    const pageId = Object.keys(data.query.pages)[0];
    return data.query.pages[pageId].links?.map(l => l.title) || [];
  }

  async getArticleRevisions(
    title: string,
    limit = 10
  ): Promise<WikiPage['revisions']> {
    const params: WikiParams = {
      action: 'query',
      prop: 'revisions',
      titles: title,
      rvlimit: limit,
      rvprop: 'timestamp|user|comment|size',
    };

    const response = await fetch(this.buildUrl(params));
    const data = (await response.json()) as WikiResponse;
    const pageId = Object.keys(data.query.pages)[0];
    return data.query.pages[pageId].revisions || [];
  }
}
