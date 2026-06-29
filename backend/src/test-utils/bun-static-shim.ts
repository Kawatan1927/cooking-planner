import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Blob } from 'node:buffer';

type BunFile = Blob & { exists: () => Promise<boolean> };
type BunStaticRuntime = {
  file: (path: string) => BunFile;
  write: (path: string, data: string | Blob) => Promise<void>;
};

export const installBunStaticShim = (): void => {
  const runtimeGlobal = globalThis as typeof globalThis & {
    Bun?: BunStaticRuntime;
  };

  runtimeGlobal.Bun ??= {
    file: path =>
      Object.assign(new Blob(existsSync(path) ? [readFileSync(path)] : []), {
        exists: async () => existsSync(path),
      }),
    write: async (path, data) => {
      await writeFile(path, data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data);
    },
  };
};
