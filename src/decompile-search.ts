import * as fs from 'fs/promises';
import * as path from 'path';

export interface ComponentInfo {
  name: string;
  file: string;
  category?: string;
  baseClass?: string;
  members: MemberInfo[];
}

export interface MemberInfo {
  name: string;
  type: string;
  isReadonly: boolean;
  isStatic: boolean;
}

export interface SearchResult {
  file: string;
  matches: string[];
}

export class DecompileSearch {
  private sourcePath: string;

  constructor(sourcePath?: string) {
    this.sourcePath = sourcePath || 'C:\\Users\\neo\\GitHub\\reso-decompile\\sources';
  }

  async searchComponents(query: string, options: { maxResults?: number } = {}): Promise<ComponentInfo[]> {
    const results: ComponentInfo[] = [];
    const maxResults = options.maxResults || 20;

    try {
      await this.scanDirectory(this.sourcePath, async (filePath) => {
        if (results.length >= maxResults) return;

        const fileName = path.basename(filePath, '.cs');
        if (fileName.toLowerCase().includes(query.toLowerCase())) {
          const info = await this.parseComponentFile(filePath);
          if (info) {
            results.push(info);
          }
        }
      });
    } catch (error) {
      console.error('Error searching components:', error);
    }

    return results;
  }

  async getComponent(name: string): Promise<ComponentInfo | null> {
    let result: ComponentInfo | null = null;
    try {
      await this.scanDirectory(this.sourcePath, async (filePath) => {
        if (result) return;
        const fileName = path.basename(filePath, '.cs');
        if (fileName === name) {
          result = await this.parseComponentFile(filePath);
        }
      });
    } catch (error) {
      console.error('Error getting component:', error);
    }
    return result;
  }

  async getComponentSource(name: string): Promise<string | null> {
    let source: string | null = null;
    try {
      await this.scanDirectory(this.sourcePath, async (filePath) => {
        if (source) return;
        const fileName = path.basename(filePath, '.cs');
        if (fileName === name) {
          source = await fs.readFile(filePath, 'utf-8');
        }
      });
    } catch (error) {
      console.error('Error getting component source:', error);
    }
    return source;
  }

  async listCategories(): Promise<string[]> {
    const categories = new Set<string>();
    try {
        await this.scanDirectory(this.sourcePath, async (filePath) => {
             const content = await fs.readFile(filePath, 'utf-8');
             const match = content.match(/\x5BCategory\x28(?:new string\[\]\s*\{)?\s*\"([^\"]+)\"/);
             if (match) {
                 categories.add(match[1]);
             }
        });
    } catch (error) {
        console.error('Error listing categories:', error);
    }
    return Array.from(categories).sort();
  }

  async searchByCategory(category: string, options: { maxResults?: number } = {}): Promise<ComponentInfo[]> {
      const results: ComponentInfo[] = [];
      const maxResults = options.maxResults || 50;
      try {
          await this.scanDirectory(this.sourcePath, async (filePath) => {
              if (results.length >= maxResults) return;
              const content = await fs.readFile(filePath, 'utf-8');
              if (content.includes(`"${category}"`)) { // Simple check first
                  const info = await this.parseComponentFile(filePath);
                  if (info && info.category === category) {
                      results.push(info);
                  }
              }
          });
      } catch (error) {
          console.error('Error searching by category:', error);
      }
      return results;
  }

  async searchByMember(memberName: string, options: { maxResults?: number } = {}): Promise<ComponentInfo[]> {
    const results: ComponentInfo[] = [];
    const maxResults = options.maxResults || 20;

    try {
        await this.scanDirectory(this.sourcePath, async (filePath) => {
            if (results.length >= maxResults) return;
            // specific optimization: check file content before parsing
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.includes(memberName)) {
                 const info = await this.parseComponentFile(filePath);
                 if (info && info.members.some(m => m.name.toLowerCase().includes(memberName.toLowerCase()))) {
                     results.push(info);
                 }
            }
        });
    } catch (error) {
        console.error('Error searching by member:', error);
    }
    return results;
  }

  async searchAllSources(query: string, options: { maxResults?: number } = {}): Promise<SearchResult[]> {
      const results: SearchResult[] = [];
      const maxResults = options.maxResults || 30;

      try {
          await this.scanDirectory(this.sourcePath, async (filePath) => {
              if (results.length >= maxResults) return;
              const content = await fs.readFile(filePath, 'utf-8');
              if (content.includes(query)) {
                  const matches: string[] = [];
                  const lines = content.split('\n');
                  for (let i = 0; i < lines.length; i++) {
                      if (lines[i].includes(query)) {
                          matches.push(`Line ${i + 1}: ${lines[i].trim()}`);
                          if (matches.length >= 5) break; // Limit matches per file
                      }
                  }
                  if (matches.length > 0) {
                      results.push({ file: path.basename(filePath), matches });
                  }
              }
          });
      } catch (error) {
          console.error('Error grepping sources:', error);
      }
      return results;
  }


  private async scanDirectory(dir: string, callback: (filePath: string) => Promise<void>) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, callback);
      } else if (entry.isFile() && entry.name.endsWith('.cs')) {
        await callback(fullPath);
      }
    }
  }

  private async parseComponentFile(filePath: string): Promise<ComponentInfo | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Basic regex parsing for C# class definition
      const classMatch = content.match(/public\s+(?:sealed\s+|abstract\s+)?class\s+(\w+)(?:\s*:\s*([^{\s]+))?/);
      if (!classMatch) return null;

      const className = classMatch[1];
      const baseClass = classMatch[2];

      // Extract Category
      const categoryMatch = content.match(/\x5BCategory\x28(?:new string\[\]\s*\{)?\s*\"([^\"]+)\"/);
      const category = categoryMatch ? categoryMatch[1] : undefined;

      const members: MemberInfo[] = [];

      // Extract Fields/Properties (Sync<T>, etc.)
      // public readonly Sync<float> Height;
      const syncFieldRegex = /public\s+(?:readonly\s+)?Sync<([^>]+)>\s+(\w+);/g;
      let match;
      while ((match = syncFieldRegex.exec(content)) !== null) {
        members.push({
          name: match[2],
          type: `Sync<${match[1]}>`,
          isReadonly: false, // Sync fields themselves are objects, usually readonly, but value is mutable
          isStatic: false
        });
      }
      
      return {
        name: className,
        file: path.basename(filePath),
        category,
        baseClass,
        members
      };

    } catch (error) {
      console.warn(`Failed to parse file ${filePath}:`, error);
      return null;
    }
  }

  formatComponentInfo(info: ComponentInfo): string {
    let output = `Component: ${info.name}\n`;
    if (info.category) output += `Category: ${info.category}\n`;
    if (info.baseClass) output += `Base Class: ${info.baseClass}\n`;
    output += `File: ${info.file}\n`;
    
    if (info.members.length > 0) {
      output += 'Members:\n';
      for (const member of info.members) {
        output += `  - ${member.name} (${member.type})\n`;
      }
    } else {
      output += 'No Sync members found (or failed to parse).\n';
    }
    
    return output;
  }
}
