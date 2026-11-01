import fs from "node:fs/promises";
import path from "node:path";
import { redact } from "../core/security";
export class Logs {
  lines: string[] = [];
  constructor(readonly directory: string) {}
  append(line: string) {
    const safe = redact(line);
    this.lines.push(safe);
    if (this.lines.length > 5000)
      this.lines.splice(0, this.lines.length - 5000);
    return safe;
  }
  async export(file: string) {
    await fs.writeFile(file, this.lines.join("\n"));
  }
  async persist() {
    await fs.mkdir(this.directory, { recursive: true });
    await this.export(path.join(this.directory, "launcher.log"));
  }
}
