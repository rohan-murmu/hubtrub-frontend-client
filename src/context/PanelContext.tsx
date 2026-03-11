import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Panel item types
export type PanelItemType = "chat_request" | "chat_received" | "chat_response";

export interface PanelItem {
  id: string;
  type: PanelItemType;
  targetClientId: string;
  targetClientName: string;
  // For chat_request: "idle" | "pending" (waiting for response)
  // For chat_received: always "idle" (awaiting user action)
  // For chat_response: "accepted" | "rejected"
  status: "idle" | "pending" | "accepted" | "rejected";
}

interface PanelContextType {
  panelItems: PanelItem[];
  addPanelItem: (item: Omit<PanelItem, "id">) => string;
  removePanelItem: (id: string) => void;
  updatePanelItem: (id: string, updates: Partial<PanelItem>) => void;
  getPanelItemByTargetClient: (clientId: string, type: PanelItemType) => PanelItem | undefined;
  removeItemsByTargetClient: (clientId: string) => void;
  clearAllPanelItems: () => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panelItems, setPanelItems] = useState<PanelItem[]>([]);

  const addPanelItem = useCallback((item: Omit<PanelItem, "id">): string => {
    const id = `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: PanelItem = { ...item, id };
    setPanelItems((prev) => [...prev, newItem]);
    return id;
  }, []);

  const removePanelItem = useCallback((id: string) => {
    setPanelItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updatePanelItem = useCallback((id: string, updates: Partial<PanelItem>) => {
    setPanelItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const getPanelItemByTargetClient = useCallback(
    (clientId: string, type: PanelItemType): PanelItem | undefined => {
      return panelItems.find(
        (item) => item.targetClientId === clientId && item.type === type
      );
    },
    [panelItems]
  );

  // Remove all panel items related to a specific target client
  const removeItemsByTargetClient = useCallback((clientId: string) => {
    setPanelItems((prev) => prev.filter((item) => item.targetClientId !== clientId));
  }, []);

  const clearAllPanelItems = useCallback(() => {
    setPanelItems([]);
  }, []);

  return (
    <PanelContext.Provider
      value={{
        panelItems,
        addPanelItem,
        removePanelItem,
        updatePanelItem,
        getPanelItemByTargetClient,
        removeItemsByTargetClient,
        clearAllPanelItems,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel() {
  const context = useContext(PanelContext);
  if (context === undefined) {
    throw new Error("usePanel must be used within a PanelProvider");
  }
  return context;
}
