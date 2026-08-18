import { BLOCKS, type BlockDefinition } from "@/constants/block";
import { DECK_Y } from "@/constants/container";
import { CONTAINER_YARD_OFFSET } from "@/domain/container";
import { generateYardContainers } from "@/domain/generateYardContainers";
import type { QuayBerth } from "@/domain/extractQuayBerths";
import type { Vec3 } from "@/constants/geometry";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { create } from "zustand";

const DEFAULT_CONTAINERS = mockContainers as Container[];

type YardState = {
  blocks: readonly BlockDefinition[];
  containers: Container[];
  ships: readonly QuayBerth[];
  deckY: number;
  yardOffset: Vec3;
  fromModel: boolean;
  setModelBlocks: (blocks: BlockDefinition[]) => void;
  setModelShips: (ships: QuayBerth[]) => void;
  resetBlocks: () => void;
};

export const useYardStore = create<YardState>((set) => ({
  blocks: BLOCKS,
  containers: DEFAULT_CONTAINERS,
  ships: [],
  deckY: DECK_Y,
  yardOffset: CONTAINER_YARD_OFFSET,
  fromModel: false,
  setModelBlocks: (blocks) =>
    set({
      blocks,
      containers: generateYardContainers(blocks),
      deckY: 0,
      yardOffset: [0, 0, 0],
      fromModel: true,
    }),
  setModelShips: (ships) => set({ ships }),
  resetBlocks: () =>
    set({
      blocks: BLOCKS,
      containers: DEFAULT_CONTAINERS,
      ships: [],
      deckY: DECK_Y,
      yardOffset: CONTAINER_YARD_OFFSET,
      fromModel: false,
    }),
}));

export function selectBlockByCode(blocks: readonly BlockDefinition[]) {
  return Object.fromEntries(blocks.map((block) => [block.code, block])) as Record<
    string,
    BlockDefinition
  >;
}
