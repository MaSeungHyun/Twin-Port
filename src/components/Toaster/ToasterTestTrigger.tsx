import { toaster, type ToasterType } from "@/components/Toaster";
import toastMock from "@/data/toast_mock.json";
import { useEffect } from "react";

const ALERT_INTERVAL_MS = 10_000;

function notifyFromMock() {
  for (const item of toastMock) {
    const type = item.status as ToasterType;
    const notify = toaster[type] ?? toaster.info;
    notify(item.title, {
      message: item.message,
      id: `${item.status}-${item.title}-${item.createdAt}`,
    });
  }
}

export default function ToasterTestTrigger() {
  useEffect(() => {
    notifyFromMock();
    const timer = window.setInterval(notifyFromMock, ALERT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
