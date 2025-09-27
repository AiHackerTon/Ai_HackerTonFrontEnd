import { create } from "zustand";

export const useApp = create((set) => ({
  userPos: null,                 // { lat, lng }
  suggestedDept: null,           // "신경과" 등
  selectedHospital: null,        // { id, name, lat, lng, addr, tel, depts? }
  setUserPos: (p) => set({ userPos: p }),
  setSuggestedDept: (d) => set({ suggestedDept: d }),
  setSelectedHospital: (h) => set({ selectedHospital: h }),
}));
