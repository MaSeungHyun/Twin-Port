import type { ShipLoadedContainerLog } from "@/types/detailGraph";
import { getShipTwinProfile } from "./portTwinMock";

function seeded(index: number, salt: number) {
  return Math.abs(Math.sin(index * 12.989 + salt * 78.233)) % 1;
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

function loadedContainersFor(
  shipIndex: number,
  count: number,
): ShipLoadedContainerLog[] {
  const baseHour = 6 + (shipIndex % 4);
  const baseMin = 10 + shipIndex * 3;

  return Array.from({ length: count }, (_, i) => {
    const totalMin = baseMin + i * (7 + (shipIndex % 5));
    const hour = baseHour + Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    const containerNo = 1000 + shipIndex * 37 + i * 13 + Math.floor(seeded(shipIndex, i) * 9);

    return {
      id: `CONT-${pad(containerNo, 5)}`,
      loadedAt: `08-31 ${pad(hour, 2)}:${pad(minute, 2)}`,
    };
  }).reverse();
}

export function getShipDetailGraphData(
  index: number,
  subjectKey: string,
) {
  const twin = getShipTwinProfile(index);
  const logCount = 14 + (index % 5) * 2;

  return {
    subjectKey,
    vesselName: twin.vesselName,
    loadedContainers: loadedContainersFor(index, logCount),
  };
}
