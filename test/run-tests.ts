declare const process: any;

import { runAudioDspTests } from './audio-dsp.test.js';
import { runQueueManagerTests } from './queue-manager.test.js';
import { runStreamPipelineTests } from './stream-pipeline.test.js';

async function main(): Promise<void> {
  console.log('========================================');
  console.log('Running BitChord Audio Engine Test Suite');
  console.log('========================================\n');

  runAudioDspTests();
  console.log('');

  runQueueManagerTests();
  console.log('');

  await runStreamPipelineTests();
  console.log('');

  console.log('========================================');
  console.log('All BitChord Audio tests passed successfully!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
