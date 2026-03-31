import { basename } from "path";

export class FileStore {
  private path: string | null = null;

  get activePath(): string | null {
    return this.path;
  }

  get activeFilename(): string | null {
    return this.path ? basename(this.path) : null;
  }

  get outlinePath(): string | null {
    if (!this.path) return null;
    return this.path.replace(/\.(mdx?)$/, ".outline.md");
  }

  setActive(resolvedPath: string): void {
    this.path = resolvedPath;
  }

  clear(): void {
    this.path = null;
  }
}
