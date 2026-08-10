import { toaster, type ToasterType } from "@/components/Toaster";
import toastMock from "@/data/toast_mock.json";
import { useEffect } from "react";

const ALERT_INTERVAL_MS = 5_000;

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function notifyItem(item: (typeof toastMock)[number]) {
  const type = item.level as ToasterType;
  const notify = toaster[type] ?? toaster.info;
  notify(item.title, {
    message: item.message,
    id: item.id,
  });
}

/** mock 알람을 5초 간격으로 하나씩 노출 (한 바퀴 후 종료) */
export default function ToasterTestTrigger() {
  useEffect(() => {
    const queue = shuffle(toastMock);
    let index = 0;
    let timer: number | undefined;
    let cancelled = false;

    const showNext = () => {
      if (cancelled || index >= queue.length) return;
      const item = queue[index++];
      if (item) notifyItem(item);
      if (index < queue.length) {
        timer = window.setTimeout(showNext, ALERT_INTERVAL_MS);
      }
    };

    showNext();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
