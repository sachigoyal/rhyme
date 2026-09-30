import { appendFile } from 'node:fs/promises'

await appendFile(
  'src/production-bindings.d.ts',
  '\nexport type { ProductionBindings }\n',
)
