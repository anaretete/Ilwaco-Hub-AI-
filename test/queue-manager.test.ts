import { assert, strictEqual, deepStrictEqual } from './assert.js';
import { QueueManager, Track } from '../dist/index.js';

export function runQueueManagerTests(): void {
  console.log('--- Testing QueueManager ---');

  const createTrack = (id: string, title: string): Track => ({
    id,
    title,
    artist: 'Artist',
    duration: 180,
    sourceType: 'youtube',
  });

  const tracks = [
    createTrack('1', 'Track 1'),
    createTrack('2', 'Track 2'),
    createTrack('3', 'Track 3'),
    createTrack('4', 'Track 4'),
    createTrack('5', 'Track 5'),
  ];

  const qm = new QueueManager();

  // 1. Initial queue setup
  const current = qm.setQueue(tracks, 1); // Start at index 1 ('Track 2')
  strictEqual(current?.id, '2');
  strictEqual(qm.getCurrentTrack()?.id, '2');
  strictEqual(qm.getHistory().length, 1);
  strictEqual(qm.getHistory()[0].id, '1');
  strictEqual(qm.getUpcomingQueue().length, 3);
  strictEqual(qm.getUpcomingQueue()[0].id, '3');

  // 2. Next track
  const next1 = qm.next();
  strictEqual(next1?.id, '3');
  strictEqual(qm.getHistory().length, 2);
  strictEqual(qm.getHistory()[1].id, '2');
  strictEqual(qm.getUpcomingQueue().length, 2);

  // 3. Previous track
  const prev1 = qm.previous();
  strictEqual(prev1?.id, '2');
  strictEqual(qm.getHistory().length, 1);
  strictEqual(qm.getUpcomingQueue()[0].id, '3');

  // 4. Queue manipulation: addNext and addTrack
  const extraTrack = createTrack('extra', 'Extra Track');
  qm.addNext(extraTrack);
  strictEqual(qm.getUpcomingQueue()[0].id, 'extra');

  const queuedTrack = createTrack('queued', 'Queued Track');
  qm.addTrack(queuedTrack);
  strictEqual(qm.getUpcomingQueue()[qm.getUpcomingQueue().length - 1].id, 'queued');

  // 5. Remove track
  const removed = qm.removeTrack(0);
  strictEqual(removed?.id, 'extra');
  strictEqual(qm.getUpcomingQueue()[0].id, '3');

  // 6. Move track
  qm.moveTrack(0, 1); // move '3' behind '4'
  strictEqual(qm.getUpcomingQueue()[0].id, '4');
  strictEqual(qm.getUpcomingQueue()[1].id, '3');

  // 7. Repeat Mode: Repeat ONE
  qm.setRepeatMode('one');
  const currentBeforeRepeatOne = qm.getCurrentTrack()?.id;
  const peeked = qm.peekNext();
  strictEqual(peeked?.id, currentBeforeRepeatOne, 'Peek next should be current track when repeat one');
  const nextRepeatOne = qm.next();
  strictEqual(nextRepeatOne?.id, currentBeforeRepeatOne, 'Next should remain current track when repeat one');

  // 8. Repeat Mode: Repeat ALL
  qm.setRepeatMode('all');
  // Consume all upcoming
  while (qm.getUpcomingQueue().length > 0) {
    qm.next();
  }
  // Now at the end, next() should loop back to first history item
  const loopBack = qm.next();
  assert(loopBack !== null, 'Loop back should not be null on repeat all');

  // 9. Shuffle & Unshuffle
  const freshTracks = [
    createTrack('A', 'Song A'),
    createTrack('B', 'Song B'),
    createTrack('C', 'Song C'),
    createTrack('D', 'Song D'),
    createTrack('E', 'Song E'),
  ];
  const qmShuffle = new QueueManager();
  qmShuffle.setQueue(freshTracks, 0);

  strictEqual(qmShuffle.isShuffleEnabled(), false);
  qmShuffle.toggleShuffle();
  strictEqual(qmShuffle.isShuffleEnabled(), true);

  // Unshuffle should restore original ordering
  qmShuffle.toggleShuffle();
  strictEqual(qmShuffle.isShuffleEnabled(), false);
  const upcomingIds = qmShuffle.getUpcomingQueue().map((t) => t.id);
  deepStrictEqual(upcomingIds, ['B', 'C', 'D', 'E'], 'Unshuffling should restore original sequence');

  console.log('✓ QueueManager passed');
}
