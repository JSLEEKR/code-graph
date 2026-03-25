import type { LanguagePlugin } from '../types.js';

export class PluginRegistry {
  private plugins = new Map<string, LanguagePlugin>();

  register(plugin: LanguagePlugin): void {
    for (const ext of plugin.extensions) {
      this.plugins.set(ext, plugin);
    }
  }

  getForFile(filePath: string): LanguagePlugin | undefined {
    const ext = '.' + filePath.split('.').pop();
    return this.plugins.get(ext);
  }

  list(): LanguagePlugin[] {
    return [...new Set(this.plugins.values())];
  }
}
