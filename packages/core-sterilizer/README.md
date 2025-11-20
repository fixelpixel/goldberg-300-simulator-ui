# @goldberg/core-sterilizer

Базовая доменная модель и упрощённый движок для виртуального стерилизатора.

Использование (внутри рабочей области):
```ts
import { createSterilizerEngine } from '@goldberg/core-sterilizer';
import { SimulationIO } from '@goldberg/io-simulation';

const engine = createSterilizerEngine({ io: new SimulationIO(), programs: [] });
await engine.tick(200);
```
