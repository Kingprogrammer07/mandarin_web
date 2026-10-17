import { beforeEach, describe, expect, it } from 'vitest';
import {
  isNotificationForFlight,
  useExpectedCargoStore,
  type FastEntryQueueItem,
} from '@/store/expectedCargoStore';

function queueItem(trackCode: string, clientCode: string): FastEntryQueueItem {
  return {
    id: trackCode,
    trackCode,
    clientCode,
    resolvedClientName: null,
    resolvedClientId: null,
    isResolved: true,
    notFound: false,
    isAlreadySent: false,
    alreadySentClientCode: null,
    alreadySentFlight: null,
    isContinuation: false,
    priorCountForClient: 0,
    isWrongClient: false,
    conflictClientCode: null,
  };
}

describe('expected cargo notifications are kept per flight', () => {
  beforeEach(() => {
    useExpectedCargoStore.setState({ notifications: [], entryQueue: [] });
  });

  it('matches a notification to its flight, falling back to navigateTo for old entries', () => {
    const { addNotification } = useExpectedCargoStore.getState();
    addNotification({ type: 'info', title: 'a', description: '', flightName: 'm214' });
    addNotification({
      type: 'info',
      title: 'old',
      description: '',
      navigateTo: { flightName: 'M215', clientCode: 'SS1' },
    });

    const [old, first] = useExpectedCargoStore.getState().notifications;
    expect(isNotificationForFlight(first, 'M214')).toBe(true);
    expect(isNotificationForFlight(first, 'M215')).toBe(false);
    expect(isNotificationForFlight(old, 'M215')).toBe(true);
  });

  it('marks read and clears only the given flight', () => {
    const { addNotification } = useExpectedCargoStore.getState();
    addNotification({ type: 'info', title: 'a', description: '', flightName: 'M214' });
    addNotification({ type: 'info', title: 'b', description: '', flightName: 'M215' });

    useExpectedCargoStore.getState().markAllNotificationsRead('M214');
    const afterRead = useExpectedCargoStore.getState().notifications;
    expect(afterRead.find((n) => n.title === 'a')?.isRead).toBe(true);
    expect(afterRead.find((n) => n.title === 'b')?.isRead).toBe(false);

    useExpectedCargoStore.getState().clearAllNotifications('M214');
    expect(useExpectedCargoStore.getState().notifications.map((n) => n.title)).toEqual(['b']);
  });

  it('caps history per flight so one busy flight does not erase another', () => {
    const { addNotification } = useExpectedCargoStore.getState();
    addNotification({ type: 'info', title: 'keep', description: '', flightName: 'M215' });
    for (let i = 0; i < 120; i += 1) {
      addNotification({ type: 'info', title: `n${i}`, description: '', flightName: 'M214' });
    }

    const notifications = useExpectedCargoStore.getState().notifications;
    expect(notifications.filter((n) => isNotificationForFlight(n, 'M214'))).toHaveLength(100);
    expect(notifications.some((n) => n.title === 'keep')).toBe(true);
  });
});

describe('earlier-saved codes on a queue row', () => {
  beforeEach(() => {
    useExpectedCargoStore.setState({ notifications: [], entryQueue: [queueItem('T4', 'SS1')] });
  });

  it('attaches saved codes only while the row still belongs to that client', () => {
    const saved = [{ trackCode: 'T1', savedAt: null }];
    useExpectedCargoStore.getState().setQueueItemSavedInFlight('T4', 'ss2', saved);
    expect(useExpectedCargoStore.getState().entryQueue[0].savedInFlight).toBeUndefined();

    useExpectedCargoStore.getState().setQueueItemSavedInFlight('T4', 'ss1', saved);
    expect(useExpectedCargoStore.getState().entryQueue[0].savedInFlight).toEqual(saved);

    useExpectedCargoStore.getState().setQueueItemSavedMerged('T4', true);
    expect(useExpectedCargoStore.getState().entryQueue[0].isSavedMerged).toBe(true);
  });
});
